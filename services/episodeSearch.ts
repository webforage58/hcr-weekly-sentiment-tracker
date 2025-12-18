import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import type { EpisodeMetadata, SearchCacheEntry } from "../types";
import {
  getSearchCache,
  saveSearchCache,
  clearExpiredSearchCache
} from "./episodeDB";

// Episode search prompt template
const EPISODE_SEARCH_PROMPT = `
You are an episode discovery assistant.

TASK: Find all episodes from Heather Cox Richardson's shows/podcasts published between {{START_DATE}} and {{END_DATE}} (inclusive).

Shows to search for:
- "This Week in Politics"
- "Politics Chat"
- "American Conversations"
- "What the Heck Just Happened"

INSTRUCTIONS:
1. Use Google Search to find episodes published in the specified date range
2. For each episode found, extract: episode identifier, show name, title, publication date, and transcript URL if available
3. Return ONLY a valid JSON array (no markdown, no explanation, no code blocks)
4. If no episodes are found, return an empty array: []

OUTPUT FORMAT:
Return ONLY a JSON array in this exact format:
[
  {
    "episode_id": "unique_id_or_url_slug",
    "show_name": "exact show name",
    "title": "episode title",
    "published_at": "YYYY-MM-DD",
    "transcript_url": "URL if available, else null"
  }
]

IMPORTANT:
- Return ONLY the JSON array, no markdown code blocks like \`\`\`json
- Use null (not "null" string) for missing transcript_url
- Ensure all dates are in YYYY-MM-DD format
- If episode_id is not explicitly available, generate one from the show name and date (e.g., "politics-chat-2025-01-15")
`;

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];

const MAX_RETRIES = 3;
const CACHE_EXPIRY_DAYS = 7;

/**
 * Retry wrapper for API calls with exponential backoff
 */
async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const msg = error?.message || JSON.stringify(error);

      // Handle invalid API key error
      if (msg.includes("Requested entity was not found")) {
        console.warn("API Key might be invalid or project missing. Resetting key selection.");
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          throw new Error("API key reset required. Please try your action again.");
        }
      }

      const isNetworkError = msg.includes("xhr error") || msg.includes("fetch failed") || msg.includes("network error");
      const isServerError = error?.code === 500 || error?.code === 503 || msg.includes('"code":500') || msg.includes('"code":503');
      const isJsonError = msg.includes("JSON_PARSE_ERROR") || msg.includes("SyntaxError");

      const isRetryable = isNetworkError || isServerError || isJsonError;

      if (i === retries - 1 || !isRetryable) {
        throw error;
      }

      const delay = Math.pow(2, i) * 1000;
      console.warn(`Episode search attempt ${i + 1} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

/**
 * Clean JSON text by removing markdown code blocks and extracting the JSON
 */
function cleanJsonText(text: string): string {
  if (!text) return "";

  // Remove markdown code blocks if present
  const codeBlockMatch = text.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }

  // Try to extract JSON array
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    return text.substring(firstBracket, lastBracket + 1);
  }

  return text.trim();
}

/**
 * Generate a cache key for episode search results
 */
function generateCacheKey(startDate: string, endDate: string): string {
  return `search_${startDate}_${endDate}`;
}

/**
 * Generate a deterministic episode ID if one is not provided
 */
function normalizeEpisodeId(episode: any): string {
  if (episode.episode_id && episode.episode_id !== 'null') {
    return episode.episode_id;
  }

  // Generate ID from show name and date
  const showSlug = episode.show_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${showSlug}-${episode.published_at}`;
}

function normalizePublishedAt(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  const fallbackMatch = fallback.match(/^\d{4}-\d{2}-\d{2}/);
  return fallbackMatch ? fallbackMatch[0] : fallback;
}

/**
 * Deduplicate episodes by episode_id
 */
function deduplicateEpisodes(episodes: EpisodeMetadata[]): EpisodeMetadata[] {
  const seen = new Set<string>();
  const unique: EpisodeMetadata[] = [];

  for (const episode of episodes) {
    if (!seen.has(episode.episode_id)) {
      seen.add(episode.episode_id);
      unique.push(episode);
    } else {
      console.log(`Duplicate episode found and removed: ${episode.episode_id}`);
    }
  }

  return unique;
}

/**
 * Search for HCR episodes within a date range
 * Uses Gemini API with Google Search to discover episodes
 * Results are cached for 7 days to avoid redundant searches
 *
 * @param startDate - Start date in YYYY-MM-DD format (inclusive)
 * @param endDate - End date in YYYY-MM-DD format (inclusive)
 * @returns Array of episode metadata
 */
export async function searchEpisodesInRange(
  startDate: string,
  endDate: string
): Promise<EpisodeMetadata[]> {
  console.log(`Searching for episodes between ${startDate} and ${endDate}`);

  // Check cache first
  const cacheKey = generateCacheKey(startDate, endDate);
  try {
    const cached = await getSearchCache(cacheKey);
    if (cached) {
      console.log(`Cache hit for episode search: ${cacheKey} (${cached.episodes.length} episodes)`);
      return cached.episodes;
    }
  } catch (error) {
    console.warn('Failed to check search cache, proceeding with API call:', error);
  }

  // Periodically clear expired cache entries
  try {
    await clearExpiredSearchCache();
  } catch (error) {
    console.warn('Failed to clear expired search cache:', error);
  }

  // Build prompt with date range
  const prompt = EPISODE_SEARCH_PROMPT
    .replace('{{START_DATE}}', startDate)
    .replace('{{END_DATE}}', endDate);

  // Call Gemini API with search
  const episodes = await withRetry<EpisodeMetadata[]>(async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: SAFETY_SETTINGS,
      }
    });

    if (!response.text) {
      throw new Error('No response from Gemini API');
    }

    const cleanText = cleanJsonText(response.text);

    try {
      const parsed = JSON.parse(cleanText);

      // Handle empty results
      if (!Array.isArray(parsed)) {
        console.warn('Expected array but got:', typeof parsed);
        return [];
      }

      if (parsed.length === 0) {
        console.log('No episodes found in date range');
        return [];
      }

      // Normalize episode IDs and validate structure
      const normalized = parsed.map((ep: any) => {
        // Normalize the episode ID
        const episodeId = normalizeEpisodeId(ep);
        const publishedAt = normalizePublishedAt(ep.published_at, startDate);

        return {
          episode_id: episodeId,
          show_name: ep.show_name || 'Unknown Show',
          title: ep.title || 'Untitled Episode',
          published_at: publishedAt,
          transcript_url: ep.transcript_url === 'null' || !ep.transcript_url ? undefined : ep.transcript_url
        } as EpisodeMetadata;
      });

      // Deduplicate episodes
      const deduplicated = deduplicateEpisodes(normalized);

      console.log(`Found ${deduplicated.length} unique episodes`);
      return deduplicated;

    } catch (e) {
      console.error('JSON Parse Error in searchEpisodesInRange:', e, 'Text:', cleanText);
      throw new Error('JSON_PARSE_ERROR');
    }
  });

  // Cache the results
  if (episodes.length > 0) {
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

      const cacheEntry: SearchCacheEntry = {
        cache_key: cacheKey,
        start_date: startDate,
        end_date: endDate,
        episodes: episodes,
        cached_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      };

      await saveSearchCache(cacheEntry);
      console.log(`Cached search results: ${cacheKey}`);
    } catch (error) {
      console.warn('Failed to cache search results:', error);
      // Continue even if caching fails
    }
  }

  return episodes;
}

/**
 * Get metadata for a single episode by episode ID
 * First checks if the episode exists in the episodes store (full analysis)
 * If not found there, searches through cached search results
 *
 * @param episodeId - The unique episode identifier
 * @returns Episode metadata or null if not found
 */
export async function getEpisodeMetadata(episodeId: string): Promise<EpisodeMetadata | null> {
  try {
    // This is a simple lookup - in a real implementation, we might want to:
    // 1. Check the episodes store for full episode insights
    // 2. Extract metadata from there
    // 3. Or search through cached search results

    // For now, this is a placeholder that would need to be integrated
    // with the episode store or search cache
    console.log(`Looking up metadata for episode: ${episodeId}`);

    // TODO: Implement actual lookup logic when integrated with episode processor
    // For now, return null to indicate not implemented
    return null;
  } catch (error) {
    console.error(`Failed to get episode metadata for ${episodeId}:`, error);
    return null;
  }
}

/**
 * Validate a date string is in YYYY-MM-DD format
 */
export function validateDateFormat(date: string): boolean {
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(date)) {
    return false;
  }

  // Check if it's a valid date
  const parsed = new Date(date);
  return !isNaN(parsed.getTime());
}

/**
 * Search for episodes with date validation
 * Wrapper around searchEpisodesInRange with input validation
 */
export async function searchEpisodesWithValidation(
  startDate: string,
  endDate: string
): Promise<{ success: boolean; episodes?: EpisodeMetadata[]; error?: string }> {
  // Validate date formats
  if (!validateDateFormat(startDate)) {
    return {
      success: false,
      error: `Invalid start date format: ${startDate}. Expected YYYY-MM-DD`
    };
  }

  if (!validateDateFormat(endDate)) {
    return {
      success: false,
      error: `Invalid end date format: ${endDate}. Expected YYYY-MM-DD`
    };
  }

  // Validate date range
  if (startDate > endDate) {
    return {
      success: false,
      error: 'Start date must be before or equal to end date'
    };
  }

  try {
    const episodes = await searchEpisodesInRange(startDate, endDate);
    return {
      success: true,
      episodes
    };
  } catch (error) {
    console.error('Episode search failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
