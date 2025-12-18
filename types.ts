
export interface RunWindow {
  window_start: string;
  window_end: string;
  timezone: string;
}

export interface AnalyzedSource {
  episode_id: string;
  show_name: string;
  title: string;
  published_at: string;
  input_types_present: string[];
}

export interface Evidence {
  episode_id: string;
  show_name: string;
  published_at: string;
  evidence_type: "quote_excerpt" | "paraphrase" | "topic_mention" | "sentiment_signal";
  evidence_text: string;
  offsets: string | null;
}

export interface IssueEntry {
  issue_id: string;
  issue_name: string;
  rank_this_week: number;
  sentiment_index: number | "unknown";
  sentiment_label: "positive" | "neutral" | "negative" | "mixed" | "unknown";
  confidence: number;
  delta_vs_prior_week: number | "unknown";
  why_this_week: string;
  what_changed_week_over_week: string;
  evidence: Evidence[];
}

export interface IssueMovement {
  issue_name: string;
  movement: "up" | "down" | "new" | "dropped" | "unchanged" | "unknown";
  reason: string;
  supporting_evidence: Evidence[];
}

export interface NarrativeShift {
  shift: string;
  why_it_changed: string;
  supporting_evidence: Evidence[];
}

export interface QualityFlags {
  hallucination_risk: "low" | "medium" | "high";
  data_coverage: "full" | "partial" | "minimal" | "none";
  notes: string[];
}

export interface HCRReport {
  isAggregated?: boolean;
  run_window: RunWindow;
  prior_window: RunWindow;
  generated_at: string;
  sources_analyzed: AnalyzedSource[];
  executive_summary: string[];
  top_issues: IssueEntry[];
  issues_gaining_importance: IssueMovement[];
  issues_losing_importance: IssueMovement[];
  narrative_shifts: NarrativeShift[];
  evidence_gaps: string[];
  quality_flags: QualityFlags;
}

export interface DailyMarketData {
  date: string;
  sp500_close: number;
  vix_close: number;
  tnx_yield: number;
  hcr_sentiment: number;
}

export interface MarketAnalysisResult {
  analysis_markdown: string;
  daily_data: DailyMarketData[];
}

// Episode-Level Types for new architecture

// Lightweight episode metadata for search/discovery (before full analysis)
export interface EpisodeMetadata {
  episode_id: string;
  show_name: string;
  title: string;
  published_at: string;          // ISO date (YYYY-MM-DD)
  transcript_url?: string;
}

export interface TopicInsight {
  topic_name: string;
  sentiment_score: number;      // 0-100
  confidence: number;            // 0-1
  evidence_quotes: string[];
  prominence_score: number;      // How much time/focus on this topic (0-1)
}

export interface EpisodeInsight {
  episode_id: string;            // Primary key
  show_name: string;
  title: string;
  published_at: string;          // ISO date (YYYY-MM-DD)
  transcript_url?: string;
  topics: TopicInsight[];
  overall_sentiment: number;     // 0-100
  trump_admin_focus: boolean;
  key_quotes: string[];
  framework_version: string;     // e.g., "v1", "v2"
  processed_at: string;          // ISO timestamp
  model_used: string;            // e.g., "gemini-3-flash-preview"
}

export interface RankedIssue {
  issue_name: string;
  normalized_name: string;
  avg_sentiment: number;
  avg_confidence: number;
  avg_prominence: number;
  episode_count: number;
  rank_score: number;
  sentiment_values: number[];
  episode_ids: string[];
  evidence_quotes: string[];
  latest_published_at: string | null;
  recency_days: number;
}

export interface AggregatedIssue {
  issue_name: string;
  avg_sentiment: number;
  confidence: number;
  episode_count: number;         // How many episodes mentioned this
  evidence: Evidence[];          // From original schema
}

export interface WeeklyAggregation {
  week_start: string;            // Primary key (YYYY-MM-DD)
  week_end: string;
  episode_ids: string[];         // Episodes included in this week
  top_issues: AggregatedIssue[];
  computed_at: string;
  framework_version: string;
}

// Search cache for episode discovery
export interface SearchCacheEntry {
  cache_key: string;             // Primary key: "search_{startDate}_{endDate}"
  start_date: string;            // YYYY-MM-DD
  end_date: string;              // YYYY-MM-DD
  episodes: EpisodeMetadata[];   // List of discovered episodes
  cached_at: string;             // ISO timestamp
  expires_at: string;            // ISO timestamp (cached_at + 7 days)
}
