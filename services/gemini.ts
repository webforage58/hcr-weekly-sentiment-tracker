
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { HCRReport, MarketAnalysisResult, EpisodeInsight, EpisodeMetadata } from "../types";

const PROMPT_TEMPLATE = `
You are an AI political analysis assistant performing evidence-grounded weekly sentiment and issue tracking.
TASK: Analyze episodes from Heather Cox Richardson’s shows/series ("This Week in Politics", "Politics Chat", "American Conversations", "What the Heck Just Happened") found via Google Search.

RUN_WINDOW (weekly)
Analyze episodes published within:
window_start: {{WINDOW_START}}
window_end: {{WINDOW_END}} (inclusive)
Timezone: America/Denver
Also use the immediately prior week window:
prior_window_start: {{PRIOR_START}}
prior_window_end: {{PRIOR_END}} (inclusive)
to compute week-over-week changes.

FOCUS: Restrict analysis to content about the Trump administration and public/political sentiment around it.

OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON object.
- NO markdown formatting (like \`\`\`json) inside the JSON string values.
- ESCAPE ALL DOUBLE QUOTES inside string values (e.g. "She said \\"Hello\\"").
- NO TRAILING COMMAS in arrays or objects.
- Ensure all newlines in string values are escaped as \\n.

EXECUTIVE SUMMARY REQUIREMENTS:
- Provide detailed, paragraph-length summaries (approx 50-80 words per item).
- Be specific. Explicitly mention specific bills, events, names, and the nuance of the sentiment.
- Avoid generic phrases like "discussed negative sentiment" or "portrayed in a bad light" without context.
- Instead, explain *why* sentiment was negative (e.g., "due to the weaponization of the shutdown to implement drastic policy changes...").

SENTIMENT INDEX (0–100): 0 = extremely negative, 50 = neutral/mixed, 100 = extremely positive.
TOP 5 ISSUES: Rank by frequency and emphasis.
EVIDENCE: Support every issue with evidence found in search results (quotes or paraphrases).

REQUIRED JSON OUTPUT SCHEMA:
{
  "run_window": { "window_start": "YYYY-MM-DD", "window_end": "YYYY-MM-DD", "timezone": "America/Denver" },
  "prior_window": { "window_start": "YYYY-MM-DD", "window_end": "YYYY-MM-DD", "timezone": "America/Denver" },
  "generated_at": "ISO-DATE",
  "sources_analyzed": [ { "episode_id": "string", "show_name": "string", "title": "string", "published_at": "ISO-DATE", "input_types_present": ["description", "search_result"] } ],
  "executive_summary": ["string"],
  "top_issues": [ { "issue_id": "string", "issue_name": "string", "rank_this_week": 1, "sentiment_index": 50, "sentiment_label": "neutral", "confidence": 0.8, "delta_vs_prior_week": 0, "why_this_week": "string", "what_changed_week_over_week": "string", "evidence": [ { "episode_id": "string", "show_name": "string", "published_at": "ISO-DATE", "evidence_type": "paraphrase", "evidence_text": "string", "offsets": null } ] } ],
  "issues_gaining_importance": [],
  "issues_losing_importance": [],
  "narrative_shifts": [],
  "evidence_gaps": [],
  "quality_flags": { "hallucination_risk": "low", "data_coverage": "partial", "notes": [] }
}
`;

const MARKET_ANALYSIS_PROMPT_TEMPLATE = `
Role & Expertise
You are a senior quantitative strategist specializing in political risk and macro-market correlations.

Task
Perform a comparative analysis between the provided political sentiment data (HCR Report) and ACTUAL financial market performance for the specified period.
You MUST use Google Search to retrieve the historical market data for the dates provided.

Target Period: {{WINDOW_START}} to {{WINDOW_END}}

Step 1: Data Retrieval (Use Google Search)
Find the daily closing performance metrics for the following assets during the Target Period:
- S&P 500 Index (SPX): Closing Price.
- US 10-Year Treasury Yield (TNX): Yield %.
- CBOE Volatility Index (VIX): Closing level.

Step 2: Comparative Analysis & Strategy
- Compare the "Sentiment Index" and "Narrative Shifts" against actual market moves.
- Provide actionable advice for asset allocation.

Step 3: Sentiment Attribution
- Assign an "hcr_sentiment" score (0-100) to each day in the daily_data.

Output Format
Return a single valid JSON object. 
IMPORTANT:
- Return the analysis text as an ARRAY of strings called "analysis_content".
- Do NOT include a preamble or any text outside the JSON.
- Ensure NO trailing commas and all quotes inside strings are escaped.

Schema:
{
  "analysis_content": [
    "## Market Snapshot",
    "Section 1...",
    "Section 2..."
  ],
  "daily_data": [
    {
      "date": "YYYY-MM-DD",
      "sp500_close": number,
      "vix_close": number,
      "tnx_yield": number,
      "hcr_sentiment": number
    }
  ]
}

INPUT DATA (HCR Sentiment Report):
`;

const EPISODE_ANALYSIS_PROMPT = `
You are a political sentiment analysis assistant specializing in episode-level analysis.

TASK: Analyze a single episode for topics, sentiment, and evidence related to the Trump administration and US politics.

EPISODE METADATA:
- Show: {{SHOW_NAME}}
- Title: {{TITLE}}
- Published: {{PUBLISHED_AT}}
- Episode ID: {{EPISODE_ID}}

INSTRUCTIONS:
1. Use Google Search to find the full transcript, detailed summary, or comprehensive description for this specific episode.
2. Identify ALL topics related to Trump administration and US politics discussed in this episode.
3. For each topic, extract:
   - Topic name (clear, specific label - e.g., "Federal Shutdown", "Immigration Policy", "Jan 6 Investigation")
   - Sentiment score (0=extremely negative, 50=neutral, 100=extremely positive) based on how HCR discussed it
   - Confidence (0.0-1.0) in your sentiment assessment
   - Key quotes that support the sentiment (2-4 direct quotes or close paraphrases)
   - Prominence (0.0-1.0): How much attention/time this topic received in the episode
4. Assess overall episode sentiment toward Trump administration (0-100 scale).
5. Determine if Trump administration was the primary focus (true/false).
6. Extract 3-5 most impactful quotes from the episode.

OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON object.
- NO markdown formatting (like \`\`\`json).
- ESCAPE ALL DOUBLE QUOTES inside string values (e.g., "She said \\"Hello\\"").
- NO TRAILING COMMAS in arrays or objects.
- Ensure all newlines in string values are escaped as \\n.

REQUIRED JSON OUTPUT SCHEMA:
{
  "episode_id": "{{EPISODE_ID}}",
  "show_name": "{{SHOW_NAME}}",
  "title": "{{TITLE}}",
  "published_at": "{{PUBLISHED_AT}}",
  "transcript_url": "URL if found, else null",
  "topics": [
    {
      "topic_name": "string",
      "sentiment_score": 0-100,
      "confidence": 0.0-1.0,
      "evidence_quotes": ["quote1", "quote2"],
      "prominence_score": 0.0-1.0
    }
  ],
  "overall_sentiment": 0-100,
  "trump_admin_focus": true/false,
  "key_quotes": ["quote1", "quote2", "quote3"]
}
`;

const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }
];

const MAX_RETRIES = 3;

async function withRetry<T>(operation: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await operation();
    } catch (error: any) {
      const msg = error?.message || JSON.stringify(error);

      // Handle the "Requested entity was not found" error by prompting for a new key
      if (msg.includes("Requested entity was not found")) {
        console.warn("API Key might be invalid or project missing. Resetting key selection.");
        if (window.aistudio) {
          await window.aistudio.openSelectKey();
          // We can't easily restart the whole operation chain from here,
          // so we throw to let the UI handle the state update.
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
      console.warn(`Gemini API attempt ${i + 1} failed. Retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

function cleanJsonText(text: string): string {
  if (!text) return "";
  const codeBlockMatch = text.match(/```(?:json|JSON)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    return codeBlockMatch[1].trim();
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

export async function generateReport(start: string, end: string, priorStart: string, priorEnd: string): Promise<HCRReport> {
  const prompt = PROMPT_TEMPLATE
    .replace('{{WINDOW_START}}', start)
    .replace('{{WINDOW_END}}', end)
    .replace('{{PRIOR_START}}', priorStart)
    .replace('{{PRIOR_END}}', priorEnd);

  return withRetry<HCRReport>(async () => {
    // Create fresh instance to ensure we use current process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: SAFETY_SETTINGS,
      }
    });

    let text = response.text;
    if (!text) {
      throw new Error(`No response from Gemini.`);
    }

    const cleanText = cleanJsonText(text);
    try {
      return JSON.parse(cleanText) as HCRReport;
    } catch (e) {
      console.error("JSON Parse Error in generateReport:", e, "Text:", cleanText);
      throw new Error("JSON_PARSE_ERROR");
    }
  });
}

/**
 * Analyzes a single episode for topics, sentiment, and evidence.
 * This is the new episode-centric analysis function that operates on individual episodes
 * rather than week-level aggregations.
 *
 * @param episodeId - Unique identifier for the episode
 * @param episodeMetadata - Basic episode metadata (show name, title, date, etc.)
 * @param frameworkVersion - Version tag for cache invalidation (default: "v2")
 * @returns EpisodeInsight object with topics, sentiment scores, and quotes
 */
export async function analyzeEpisode(
  episodeId: string,
  episodeMetadata: EpisodeMetadata,
  frameworkVersion: string = "v2"
): Promise<EpisodeInsight> {
  const prompt = EPISODE_ANALYSIS_PROMPT
    .replace(/\{\{EPISODE_ID\}\}/g, episodeId)
    .replace(/\{\{SHOW_NAME\}\}/g, episodeMetadata.show_name)
    .replace(/\{\{TITLE\}\}/g, episodeMetadata.title)
    .replace(/\{\{PUBLISHED_AT\}\}/g, episodeMetadata.published_at);

  return withRetry<EpisodeInsight>(async () => {
    // Create fresh instance to ensure we use current process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        safetySettings: SAFETY_SETTINGS,
      }
    });

    let text = response.text;
    if (!text) {
      throw new Error(`No response from Gemini for episode ${episodeId}.`);
    }

    const cleanText = cleanJsonText(text);
    try {
      const parsed = JSON.parse(cleanText);

      // Add metadata fields that come from the system, not the AI
      parsed.framework_version = frameworkVersion;
      parsed.processed_at = new Date().toISOString();
      parsed.model_used = 'gemini-3-flash-preview';

      // Validate required fields are present
      if (!parsed.episode_id || !parsed.topics || !Array.isArray(parsed.topics)) {
        throw new Error("Invalid episode insight structure: missing required fields");
      }

      return parsed as EpisodeInsight;
    } catch (e) {
      console.error("JSON Parse Error in analyzeEpisode:", e, "Text:", cleanText);
      throw new Error("JSON_PARSE_ERROR");
    }
  });
}

export async function generateMarketBrainstorm(report: HCRReport): Promise<MarketAnalysisResult> {
  const context = JSON.stringify({
    executive_summary: report.executive_summary,
    top_issues: report.top_issues.map(i => ({
      name: i.issue_name,
      sentiment: i.sentiment_index,
      label: i.sentiment_label,
      change: i.what_changed_week_over_week
    })),
    narrative_shifts: report.narrative_shifts.map(n => n.shift),
    gaining: report.issues_gaining_importance.map(i => i.issue_name),
    losing: report.issues_losing_importance.map(i => i.issue_name)
  }, null, 2);

  const prompt = MARKET_ANALYSIS_PROMPT_TEMPLATE
    .replace('{{WINDOW_START}}', report.run_window.window_start)
    .replace('{{WINDOW_END}}', report.run_window.window_end) 
    + `\nINPUT DATA:\n${context}`;

  return withRetry<MarketAnalysisResult>(async () => {
    // Create fresh instance to ensure we use current process.env.API_KEY
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
       throw new Error("No response generated for market analysis.");
    }
    
    const cleanText = cleanJsonText(response.text);
    try {
        const parsed = JSON.parse(cleanText);
        if (parsed.analysis_content && Array.isArray(parsed.analysis_content)) {
          parsed.analysis_markdown = parsed.analysis_content.join('\n\n');
          delete parsed.analysis_content;
        }
        if (!parsed.analysis_markdown) {
            parsed.analysis_markdown = "Analysis generation incomplete.";
        }
        return parsed as MarketAnalysisResult;
    } catch (e) {
        console.error("JSON Parse Error in generateMarketBrainstorm:", e, "Text:", cleanText);
        throw new Error("JSON_PARSE_ERROR");
    }
  });
}
