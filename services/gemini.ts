
import { GoogleGenAI, HarmCategory, HarmBlockThreshold, GenerateContentResponse } from "@google/genai";
import { HCRReport, MarketAnalysisResult, EpisodeInsight, EpisodeMetadata, TopicInsight } from "../types";

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
- Compare political sentiment changes across the ENTIRE target period against actual market moves.
- If sentiment data is provided as a weekly time series, identify inflection points (regime changes), not just the most recent week.
- Note when sentiment trends diverge from market behavior (e.g., sentiment deteriorates while equities rally).
- Provide actionable advice for asset allocation.

Step 3: Sentiment Attribution
- Assign an "hcr_sentiment" score (0-100) to each day in the daily_data.
  - If only weekly sentiment is available, interpolate/step daily sentiment in a sensible way and call out limitations.

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

const SUMMARY_SYNTHESIS_PROMPT = `
You are a political analysis writer specializing in weekly political commentary summaries.

TASK: Write a concise, informative executive summary (3-5 paragraphs, 50-80 words each) for this week's political sentiment analysis based on Heather Cox Richardson's shows.

INPUT DATA:
Week Period: {{WEEK_START}} to {{WEEK_END}}

Top Issues (ranked by prominence):
{{TOP_ISSUES_JSON}}

Episode Summaries:
{{EPISODE_SUMMARIES}}

Narrative Shifts:
{{NARRATIVE_SHIFTS}}

INSTRUCTIONS:
1. Write 3-5 distinct paragraphs, each 50-80 words
2. Be specific: mention bills, events, names, and dates when available
3. Explain WHY sentiment changed (not just that it did)
4. Focus on narrative shifts and notable developments
5. Use active voice and clear language
6. Each paragraph should cover a distinct theme or issue
7. Ground all claims in the provided evidence and topics

OUTPUT REQUIREMENTS:
- Return ONLY a valid JSON array of paragraph strings.
- NO markdown formatting (like \`\`\`json).
- ESCAPE ALL DOUBLE QUOTES inside string values.
- NO TRAILING COMMAS.

REQUIRED JSON OUTPUT SCHEMA:
["Paragraph 1 text here (50-80 words)...", "Paragraph 2 text here...", "Paragraph 3 text here..."]
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

function normalizeDateYmd(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }

  // Fallback might already be YYYY-MM-DD; preserve it as best-effort.
  if (typeof fallback === "string") {
    const match = fallback.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  return fallback;
}

function normalizeDateYmdOrNull(value: unknown): string | null {
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  }
  return null;
}

function computeOverallSentimentIndexFromIssues(report: HCRReport): number | null {
  const values = report.top_issues
    .map(i => (typeof i.sentiment_index === 'number' ? i.sentiment_index : null))
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

function computeSentimentForDate(report: HCRReport, dateYmd: string): number | null {
  const series = report.period_series;
  if (Array.isArray(series) && series.length > 0) {
    for (const week of series) {
      if (dateYmd >= week.week_start && dateYmd <= week.week_end) {
        return typeof week.overall_sentiment_index === 'number' ? week.overall_sentiment_index : null;
      }
    }
  }
  // Fallback: treat the report as a single bucket.
  return computeOverallSentimentIndexFromIssues(report);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

function coerceNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: unknown) => typeof item === "string")
    .map(item => item.trim())
    .filter(item => item.length > 0);
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
      const raw = JSON.parse(cleanText) as any;

      const topicsRaw = Array.isArray(raw?.topics) ? raw.topics : [];
      const topics: TopicInsight[] = topicsRaw
        .map((topic: any): TopicInsight | null => {
          const topicName = String(topic?.topic_name ?? topic?.name ?? topic?.topic ?? "").trim();
          if (!topicName) return null;

          const sentiment = coerceNumber(topic?.sentiment_score ?? topic?.sentiment);
          if (sentiment === null) return null;

          const confidence = coerceNumber(topic?.confidence, 0.6);
          const prominence = coerceNumber(
            topic?.prominence_score ?? topic?.prominence ?? topic?.prominenceScore,
            0.3
          );

          const evidenceQuotes =
            coerceStringArray(topic?.evidence_quotes ?? topic?.evidenceQuotes ?? topic?.quotes ?? topic?.evidence);

          return {
            topic_name: topicName,
            sentiment_score: clamp(sentiment, 0, 100),
            confidence: clamp01(confidence ?? 0.6),
            evidence_quotes: evidenceQuotes,
            prominence_score: clamp01(prominence ?? 0.3)
          };
        })
        .filter((topic): topic is TopicInsight => Boolean(topic));

      if (topicsRaw.length > 0 && topics.length === 0) {
        throw new Error("Invalid episode insight structure: topics present but not parseable");
      }

      const publishedAt = normalizeDateYmd(raw?.published_at ?? episodeMetadata.published_at, episodeMetadata.published_at);
      const transcriptUrlRaw = raw?.transcript_url ?? episodeMetadata.transcript_url ?? null;
      const transcriptUrl = typeof transcriptUrlRaw === "string" && transcriptUrlRaw.trim().length > 0
        ? transcriptUrlRaw
        : undefined;

      const overallSentimentRaw = coerceNumber(raw?.overall_sentiment);
      const overallSentiment = overallSentimentRaw !== null
        ? clamp(overallSentimentRaw, 0, 100)
        : (topics.length > 0 ? clamp(topics.reduce((sum, t) => sum + t.sentiment_score, 0) / topics.length, 0, 100) : 50);

      const keyQuotes = coerceStringArray(raw?.key_quotes ?? raw?.keyQuotes);
      const fallbackQuotes = topics.flatMap(t => t.evidence_quotes).slice(0, 5);

      const parsed: EpisodeInsight = {
        episode_id: episodeId,
        show_name: String(raw?.show_name ?? episodeMetadata.show_name),
        title: String(raw?.title ?? episodeMetadata.title),
        published_at: publishedAt,
        transcript_url: transcriptUrl,
        topics,
        overall_sentiment: overallSentiment,
        trump_admin_focus: typeof raw?.trump_admin_focus === "boolean"
          ? raw.trump_admin_focus
          : topics.length > 0,
        key_quotes: keyQuotes.length > 0 ? keyQuotes : fallbackQuotes,
        framework_version: frameworkVersion,
        processed_at: new Date().toISOString(),
        model_used: 'gemini-3-flash-preview'
      };

      if (!parsed.episode_id || !Array.isArray(parsed.topics)) {
        throw new Error("Invalid episode insight structure: missing required fields");
      }

      return parsed;
    } catch (e) {
      console.error("Episode insight parse/validation error in analyzeEpisode:", e, "Text:", cleanText);
      if (e instanceof Error) {
        throw e;
      }
      throw new Error("JSON_PARSE_ERROR");
    }
  });
}

/**
 * Synthesizes an AI-generated executive summary from weekly report data.
 * This is an optional enhancement that provides more detailed, narrative-driven summaries
 * compared to the placeholder summaries.
 *
 * @param weekStart - Start date of the week (YYYY-MM-DD)
 * @param weekEnd - End date of the week (YYYY-MM-DD)
 * @param topIssues - Array of ranked issues with sentiment and evidence
 * @param episodes - Array of episode insights from the week
 * @param narrativeShifts - Array of narrative shift descriptions
 * @returns Array of paragraph strings (3-5 paragraphs, 50-80 words each)
 */
export async function synthesizeExecutiveSummary(
  weekStart: string,
  weekEnd: string,
  topIssues: Array<{
    issue_name: string;
    avg_sentiment: number;
    avg_prominence: number;
    episode_count: number;
    delta_vs_prior_week?: number | "unknown";
    movement?: string;
  }>,
  episodes: EpisodeInsight[],
  narrativeShifts: string[]
): Promise<string[]> {
  // Prepare top issues summary for prompt
  const topIssuesJson = JSON.stringify(
    topIssues.slice(0, 5).map((issue, idx) => ({
      rank: idx + 1,
      name: issue.issue_name,
      sentiment: Math.round(issue.avg_sentiment),
      prominence: issue.avg_prominence.toFixed(2),
      episodes_mentioned: issue.episode_count,
      delta: issue.delta_vs_prior_week,
      movement: issue.movement
    })),
    null,
    2
  );

  // Prepare episode summaries (condensed)
  const episodeSummaries = episodes.map(ep => {
    const topTopics = ep.topics
      .slice(0, 3)
      .map(t => `${t.topic_name} (sentiment: ${t.sentiment_score})`)
      .join(', ');
    return `- ${ep.show_name} (${ep.published_at}): ${ep.title}. Topics: ${topTopics}`;
  }).join('\n');

  // Prepare narrative shifts
  const shiftsText = narrativeShifts.length > 0
    ? narrativeShifts.map(shift => `- ${shift}`).join('\n')
    : '- No major narrative shifts identified this week';

  // Build the prompt
  const prompt = SUMMARY_SYNTHESIS_PROMPT
    .replace('{{WEEK_START}}', weekStart)
    .replace('{{WEEK_END}}', weekEnd)
    .replace('{{TOP_ISSUES_JSON}}', topIssuesJson)
    .replace('{{EPISODE_SUMMARIES}}', episodeSummaries)
    .replace('{{NARRATIVE_SHIFTS}}', shiftsText);

  console.log(`Synthesizing executive summary for ${weekStart} to ${weekEnd}...`);

  return withRetry<string[]>(async () => {
    // Create fresh instance to ensure we use current process.env.API_KEY
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        // No search needed - all context is provided
        safetySettings: SAFETY_SETTINGS,
      }
    });

    let text = response.text;
    if (!text) {
      throw new Error('No response from Gemini for executive summary synthesis.');
    }

    const cleanText = cleanJsonText(text);
    try {
      const parsed = JSON.parse(cleanText);

      // Validate output is an array of strings
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array of paragraph strings');
      }

      const paragraphs = parsed
        .filter(p => typeof p === 'string' && p.trim().length > 0)
        .map(p => p.trim());

      if (paragraphs.length < 3 || paragraphs.length > 5) {
        console.warn(`Expected 3-5 paragraphs, got ${paragraphs.length}. Proceeding anyway.`);
      }

      console.log(`✓ Synthesized executive summary with ${paragraphs.length} paragraphs`);
      return paragraphs;
    } catch (e) {
      console.error('Executive summary parse error:', e, 'Text:', cleanText);
      if (e instanceof Error) {
        throw e;
      }
      throw new Error('JSON_PARSE_ERROR');
    }
  });
}

export async function generateMarketBrainstorm(
  report: HCRReport,
  customStartDate?: string,
  customEndDate?: string
): Promise<MarketAnalysisResult> {
  // Use custom date range if provided, otherwise fall back to report's date range
  const startDate = customStartDate || report.run_window.window_start;
  const endDate = customEndDate || report.run_window.window_end;

  const context = JSON.stringify(
    {
      analysis_window: report.run_window,
      is_aggregated: Boolean(report.isAggregated),

      // Latest-week snapshot (always present)
      executive_summary: report.executive_summary,
      top_issues_latest_week: report.top_issues.map(i => ({
        name: i.issue_name,
        sentiment: i.sentiment_index,
        label: i.sentiment_label,
        change_vs_prior_week: i.what_changed_week_over_week,
        change_over_period: i.what_changed_over_period ?? null
      })),
      narrative_shifts_latest_week: report.narrative_shifts.map(n => n.shift),
      gaining_latest_week: report.issues_gaining_importance.map(i => i.issue_name),
      losing_latest_week: report.issues_losing_importance.map(i => i.issue_name),

      // Optional: full-period sentiment context (present on aggregated multi-week reports)
      period_comparison: report.period_comparison ?? null,
      period_series: report.period_series ?? null
    },
    null,
    2
  );

  const prompt = MARKET_ANALYSIS_PROMPT_TEMPLATE
    .replace('{{WINDOW_START}}', startDate)
    .replace('{{WINDOW_END}}', endDate)
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

        // Prefer the app's computed sentiment series (derived from weekly composition)
        // over model-assigned daily sentiment values.
        if (Array.isArray(parsed.daily_data)) {
          let overwritten = 0;
          parsed.daily_data = parsed.daily_data
            .map((row: any) => {
              const dateYmd = normalizeDateYmdOrNull(row?.date);
              if (!dateYmd) return row;
              const sentiment = computeSentimentForDate(report, dateYmd);
              if (typeof sentiment !== 'number') return { ...row, date: dateYmd };
              overwritten += 1;
              return { ...row, date: dateYmd, hcr_sentiment: sentiment };
            })
            .filter((row: any) => row && typeof row === 'object');

          if (overwritten > 0) {
            parsed.analysis_markdown +=
              `\n\n---\n\nNote: The chart’s sentiment series is derived from the report’s weekly sentiment data across the selected period.`;
          }
        }

        return parsed as MarketAnalysisResult;
    } catch (e) {
        console.error("JSON Parse Error in generateMarketBrainstorm:", e, "Text:", cleanText);
        throw new Error("JSON_PARSE_ERROR");
    }
  });
}
