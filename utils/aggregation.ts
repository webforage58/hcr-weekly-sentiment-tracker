import type {
  EpisodeInsight,
  RankedIssue
} from '../types';

interface RankingFactors {
  episodeCount: number;
  avgProminence: number;
  sentimentConsistency: number;
  recencyDays: number;
  maxEpisodeCount: number;
}

export interface DeltaResult {
  issue: RankedIssue;
  priorIssue: RankedIssue | null;
  sentimentDelta: number | "unknown";
  prominenceDelta: number | "unknown";
  movement: "up" | "down" | "new" | "unchanged";
  description: string;
  matchConfidence: number;
}

export interface DeltaComputationResult {
  deltas: DeltaResult[];
  dropped: RankedIssue[];
}

const MIN_PROMINENCE = 0.2;
const SIMILARITY_THRESHOLD = 0.78;
const STOP_WORDS = new Set(["the", "of", "and", "for", "on", "in", "to", "a"]);

const TOPIC_NORMALIZATIONS: Record<string, string> = {
  "jan 6": "january 6",
  "jan. 6": "january 6",
  "january sixth": "january 6",
  "j6": "january 6",
  "doj": "department of justice",
  "scotus": "supreme court",
  "potus": "president",
  "gop": "republican party",
  "dems": "democratic party",
  "democrats": "democratic party",
  "republicans": "republican party",
  "border policy": "immigration policy",
  "border": "immigration policy",
  "climate": "climate change"
};

/**
 * Normalize topic strings for deterministic grouping.
 */
export function normalizeTopic(topicName: string): string {
  const cleaned = topicName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  if (TOPIC_NORMALIZATIONS[cleaned]) {
    return TOPIC_NORMALIZATIONS[cleaned];
  }

  // Apply partial replacements while keeping determinism.
  let normalized = cleaned;
  for (const [pattern, replacement] of Object.entries(TOPIC_NORMALIZATIONS)) {
    const regex = new RegExp(`\\b${escapeRegex(pattern)}\\b`, "g");
    normalized = normalized.replace(regex, replacement);
  }

  return normalized;
}

/**
 * Rank issues deterministically across episodes.
 */
export function rankIssues(episodes: EpisodeInsight[]): RankedIssue[] {
  if (episodes.length === 0) {
    return [];
  }

  // Process in chronological order so merges are deterministic.
  const sortedEpisodes = [...episodes].sort((a, b) =>
    a.published_at.localeCompare(b.published_at)
  );

  const issueMap = new Map<string, {
    sentiments: number[];
    confidences: number[];
    prominences: number[];
    evidenceQuotes: string[];
    episodeIds: Set<string>;
    latestPublished: number | null;
  }>();

  let latestWindowDate = 0;

  for (const episode of sortedEpisodes) {
    const publishedMs = Date.parse(episode.published_at);
    latestWindowDate = Math.max(latestWindowDate, isNaN(publishedMs) ? 0 : publishedMs);

    for (const topic of episode.topics) {
      const topicName = String((topic as any)?.topic_name ?? (topic as any)?.name ?? "");
      const normalized = normalizeTopic(topicName);
      if (!normalized) continue;

      const canonical = findCanonicalTopic(normalized, issueMap.keys());

      if (!issueMap.has(canonical)) {
        issueMap.set(canonical, {
          sentiments: [],
          confidences: [],
          prominences: [],
          evidenceQuotes: [],
          episodeIds: new Set<string>(),
          latestPublished: null
        });
      }

      const bucket = issueMap.get(canonical)!;
      const sentiment = coerceNumber((topic as any)?.sentiment_score ?? (topic as any)?.sentiment);
      if (sentiment === null) continue;

      const confidence = coerceNumber((topic as any)?.confidence, 0.6);
      const prominence = coerceNumber(
        (topic as any)?.prominence_score ?? (topic as any)?.prominence ?? (topic as any)?.prominenceScore,
        0.3
      );
      const evidenceQuotesRaw = (topic as any)?.evidence_quotes ?? (topic as any)?.evidenceQuotes ?? (topic as any)?.quotes ?? [];
      const evidenceQuotes = Array.isArray(evidenceQuotesRaw)
        ? evidenceQuotesRaw.filter((quote: unknown) => typeof quote === "string" && quote.trim().length > 0)
        : [];

      bucket.sentiments.push(clamp(sentiment, 0, 100));
      bucket.confidences.push(clamp01(confidence));
      bucket.prominences.push(clamp01(prominence));
      bucket.evidenceQuotes.push(...evidenceQuotes);
      bucket.episodeIds.add(episode.episode_id);

      if (!isNaN(publishedMs)) {
        bucket.latestPublished = bucket.latestPublished === null
          ? publishedMs
          : Math.max(bucket.latestPublished, publishedMs);
      }
    }
  }

  if (issueMap.size === 0) {
    return [];
  }

  const maxEpisodeCount = Math.max(
    ...Array.from(issueMap.values()).map(v => v.episodeIds.size),
    1
  );

  const allIssues = Array.from(issueMap.entries())
    .map(([normalizedName, bucket]): RankedIssue => {
      const avgSentiment = mean(bucket.sentiments);
      const avgConfidence = mean(bucket.confidences);
      const avgProminence = mean(bucket.prominences);
      const episodeCount = bucket.episodeIds.size;
      const sentimentConsistency = clamp01(1 - (standardDeviation(bucket.sentiments) / 50));
      const recencyDays = getRecencyDays(latestWindowDate, bucket.latestPublished);

      const rankScore = calculateRankScore({
        episodeCount,
        avgProminence,
        sentimentConsistency,
        recencyDays,
        maxEpisodeCount
      });

      return {
        issue_name: formatIssueName(normalizedName),
        normalized_name: normalizedName,
        avg_sentiment: avgSentiment,
        avg_confidence: avgConfidence,
        avg_prominence: avgProminence,
        episode_count: episodeCount,
        rank_score: rankScore,
        sentiment_values: bucket.sentiments,
        episode_ids: Array.from(bucket.episodeIds),
        evidence_quotes: bucket.evidenceQuotes.slice(0, 12),
        latest_published_at: bucket.latestPublished ? new Date(bucket.latestPublished).toISOString().slice(0, 10) : null,
        recency_days: recencyDays
      };
    })
    .sort((a, b) => {
      if (b.rank_score !== a.rank_score) {
        return b.rank_score - a.rank_score;
      }
      if (a.recency_days !== b.recency_days) {
        return a.recency_days - b.recency_days; // more recent first
      }
      return a.normalized_name.localeCompare(b.normalized_name);
    });

  // Primary thresholds: require cross-episode agreement for larger weeks.
  // If these filters produce zero issues, fall back to less strict filtering so the UI
  // doesn't show "no topics" when we do have valid per-episode topics.
  const primaryEpisodeThreshold = sortedEpisodes.length >= 6 ? 2 : 1;

  const withPrimaryThresholds = allIssues.filter(issue =>
    issue.episode_count >= primaryEpisodeThreshold &&
    issue.avg_prominence > MIN_PROMINENCE
  );

  if (withPrimaryThresholds.length > 0) {
    return withPrimaryThresholds;
  }

  const withRelaxedThresholds = allIssues.filter(issue =>
    issue.episode_count >= 1 &&
    issue.avg_prominence > MIN_PROMINENCE
  );

  if (withRelaxedThresholds.length > 0) {
    return withRelaxedThresholds;
  }

  return allIssues;
}

/**
 * Compute sentiment/prominence deltas between weeks using normalized topic matching.
 */
export function computeDeltas(
  currentWeekIssues: RankedIssue[],
  priorWeekIssues: RankedIssue[]
): DeltaComputationResult {
  if (currentWeekIssues.length === 0) {
    return { deltas: [], dropped: priorWeekIssues.slice(0, 5) };
  }

  const deltas: DeltaResult[] = [];
  const matchedPrior = new Set<string>();

  for (const issue of currentWeekIssues) {
    const match = findBestPriorIssue(issue, priorWeekIssues);
    if (match) {
      matchedPrior.add(match.normalized_name);
    }

    const sentimentDelta = match
      ? issue.avg_sentiment - match.avg_sentiment
      : "unknown";
    const prominenceDelta = match
      ? issue.avg_prominence - match.avg_prominence
      : "unknown";
    const movement = resolveMovement(sentimentDelta, prominenceDelta, Boolean(match));
    const description = buildDeltaDescription(issue, match, sentimentDelta, prominenceDelta);
    const matchConfidence = match
      ? topicSimilarity(issue.normalized_name, match.normalized_name)
      : 0;

    deltas.push({
      issue,
      priorIssue: match ?? null,
      sentimentDelta,
      prominenceDelta,
      movement,
      description,
      matchConfidence
    });
  }

  const dropped = priorWeekIssues
    .filter(issue => !matchedPrior.has(issue.normalized_name))
    .slice(0, 5);

  return { deltas, dropped };
}

// ===== Internal helpers =====

function calculateRankScore(factors: RankingFactors): number {
  const frequencyScore = factors.maxEpisodeCount > 0
    ? factors.episodeCount / factors.maxEpisodeCount
    : 0;
  const recencyScore = Math.exp(-(factors.recencyDays || 0) / 7);

  return (
    frequencyScore * 0.35 +
    factors.avgProminence * 0.30 +
    factors.sentimentConsistency * 0.20 +
    recencyScore * 0.15
  );
}

function findCanonicalTopic(normalized: string, existingKeys: Iterable<string>): string {
  let bestKey = normalized;
  let bestScore = 0;

  for (const key of existingKeys) {
    const score = topicSimilarity(normalized, key);
    if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}

function findBestPriorIssue(
  current: RankedIssue,
  priorWeekIssues: RankedIssue[]
): RankedIssue | null {
  let bestMatch: RankedIssue | null = null;
  let bestScore = 0;

  for (const candidate of priorWeekIssues) {
    if (candidate.normalized_name === current.normalized_name) {
      return candidate;
    }

    const score = topicSimilarity(current.normalized_name, candidate.normalized_name);
    if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return bestMatch;
}

function buildDeltaDescription(
  current: RankedIssue,
  prior: RankedIssue | null,
  sentimentDelta: number | "unknown",
  prominenceDelta: number | "unknown"
): string {
  if (!prior || sentimentDelta === "unknown" || prominenceDelta === "unknown") {
    return `${current.issue_name} emerged as a new focus this week.`;
  }

  const sentimentText = `sentiment ${formatDelta(sentimentDelta)} pts`;
  const prominenceText = `prominence ${formatDelta(prominenceDelta * 100, 0)}%`;

  if (Math.abs(sentimentDelta) < 5 && Math.abs(prominenceDelta) < 0.1) {
    return `${current.issue_name} held steady week over week (Δ ${sentimentText}, ${prominenceText}).`;
  }

  if (sentimentDelta > 0 || prominenceDelta > 0) {
    return `${current.issue_name} gained momentum (Δ ${sentimentText}, ${prominenceText}).`;
  }

  return `${current.issue_name} lost momentum (Δ ${sentimentText}, ${prominenceText}).`;
}

function resolveMovement(
  sentimentDelta: number | "unknown",
  prominenceDelta: number | "unknown",
  hasPrior: boolean
): "up" | "down" | "new" | "unchanged" {
  if (!hasPrior || sentimentDelta === "unknown" || prominenceDelta === "unknown") {
    return hasPrior ? "unchanged" : "new";
  }

  if (Math.abs(sentimentDelta) < 5 && Math.abs(prominenceDelta) < 0.1) {
    return "unchanged";
  }

  if (sentimentDelta > 0 || prominenceDelta > 0) {
    return "up";
  }

  return "down";
}

function getRecencyDays(latestWindowDate: number, issueLatest: number | null): number {
  if (!latestWindowDate || issueLatest === null) return 0;
  const diffMs = latestWindowDate - issueLatest;
  return Math.max(0, Math.round(diffMs / (1000 * 60 * 60 * 24)));
}

function topicSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  const tokensA = tokenizeTopic(a);
  const tokensB = tokenizeTopic(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  const intersection = tokensA.filter(t => setB.has(t));
  const unionSize = new Set([...setA, ...setB]).size || 1;
  const overlap = intersection.length / unionSize;
  const substringBoost = (a.includes(b) || b.includes(a)) ? 0.1 : 0;
  const prefixBoost = tokensA[0] === tokensB[0] ? 0.05 : 0;

  return Math.min(1, overlap + substringBoost + prefixBoost);
}

function tokenizeTopic(value: string): string[] {
  return value
    .split(/\s+/)
    .filter(token => token && !STOP_WORDS.has(token))
    .sort();
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function coerceNumber(value: unknown, fallback: number | null = null): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatDelta(delta: number, precision = 0): string {
  const prefix = delta > 0 ? "+" : "";
  return `${prefix}${delta.toFixed(precision)}`;
}

function formatIssueName(normalized: string): string {
  return normalized
    .split(" ")
    .map(word => word ? word.charAt(0).toUpperCase() + word.slice(1) : "")
    .join(" ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
