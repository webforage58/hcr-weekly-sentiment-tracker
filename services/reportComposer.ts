import type {
  HCRReport,
  IssueEntry,
  IssueMovement,
  NarrativeShift,
  QualityFlags,
  Evidence,
  AnalyzedSource,
  EpisodeInsight,
  TopicInsight
} from '../types';
import { getEpisodesByDateRange } from './episodeDB';

/**
 * Internal structure for ranking issues during aggregation
 */
interface RankedIssue {
  issue_name: string;
  normalized_name: string; // For matching similar topics
  avg_sentiment: number;
  avg_confidence: number;
  avg_prominence: number;
  episode_count: number;
  rank_score: number;
  evidence_quotes: string[];
  episode_ids: string[];
  sentiment_values: number[]; // For consistency calculation
}

/**
 * Composes a weekly report from episode insights without calling AI.
 * Aggregates topics across episodes, ranks by importance, and calculates deltas.
 *
 * @param weekStart - Start of current week (YYYY-MM-DD, Sunday)
 * @param weekEnd - End of current week (YYYY-MM-DD, Saturday)
 * @param priorWeekStart - Start of prior week (YYYY-MM-DD, Sunday)
 * @param priorWeekEnd - End of prior week (YYYY-MM-DD, Saturday)
 * @returns Complete HCRReport matching existing schema
 */
export async function composeWeeklyReport(
  weekStart: string,
  weekEnd: string,
  priorWeekStart: string,
  priorWeekEnd: string
): Promise<HCRReport> {
  console.log(`Composing weekly report for ${weekStart} to ${weekEnd}`);

  try {
    // Query episodes from IndexedDB
    const currentWeekEpisodes = await getEpisodesByDateRange(weekStart, weekEnd);
    const priorWeekEpisodes = await getEpisodesByDateRange(priorWeekStart, priorWeekEnd);

    console.log(
      `Found ${currentWeekEpisodes.length} episodes in current week, ` +
      `${priorWeekEpisodes.length} in prior week`
    );

    // Aggregate topics into ranked issues
    const currentWeekIssues = aggregateTopIssues(currentWeekEpisodes);
    const priorWeekIssues = aggregateTopIssues(priorWeekEpisodes);

    // Select top 5 issues
    const top5 = currentWeekIssues.slice(0, 5);

    // Compute deltas and movements
    const { issueEntries, gainingIssues, losingIssues } = computeDeltas(
      top5,
      priorWeekIssues,
      currentWeekEpisodes
    );

    // Detect narrative shifts
    const narrativeShifts = detectNarrativeShifts(
      top5,
      priorWeekIssues,
      currentWeekEpisodes
    );

    // Compute quality flags
    const qualityFlags = computeQualityFlags(currentWeekEpisodes, currentWeekIssues);

    // Generate placeholder executive summary (Phase 4 will add AI synthesis)
    const executiveSummary = generatePlaceholderSummary(top5, currentWeekEpisodes);

    // Build sources_analyzed array
    const sourcesAnalyzed: AnalyzedSource[] = currentWeekEpisodes.map(ep => ({
      episode_id: ep.episode_id,
      show_name: ep.show_name,
      title: ep.title,
      published_at: ep.published_at,
      input_types_present: ['transcript_summary'] // From episode analysis
    }));

    // Assemble final report
    const report: HCRReport = {
      run_window: {
        window_start: weekStart,
        window_end: weekEnd,
        timezone: 'America/New_York'
      },
      prior_window: {
        window_start: priorWeekStart,
        window_end: priorWeekEnd,
        timezone: 'America/New_York'
      },
      generated_at: new Date().toISOString(),
      sources_analyzed: sourcesAnalyzed,
      executive_summary: executiveSummary,
      top_issues: issueEntries,
      issues_gaining_importance: gainingIssues,
      issues_losing_importance: losingIssues,
      narrative_shifts: narrativeShifts,
      evidence_gaps: [],
      quality_flags: qualityFlags
    };

    return report;
  } catch (error) {
    console.error('Error composing weekly report:', error);
    throw new Error(`Failed to compose weekly report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Aggregates topics across episodes and ranks them by importance.
 * Ranking formula: (episode_count × 0.4) + (avg_prominence × 0.35) + (consistency × 0.25)
 *
 * @param episodes - Array of episode insights
 * @returns Ranked array of aggregated issues
 */
function aggregateTopIssues(episodes: EpisodeInsight[]): RankedIssue[] {
  if (episodes.length === 0) {
    return [];
  }

  // Map to collect all topic mentions
  const issueMap = new Map<string, {
    sentiments: number[];
    confidences: number[];
    prominences: number[];
    quotes: string[];
    episodeIds: Set<string>;
  }>();

  // Collect all mentions across episodes
  for (const episode of episodes) {
    for (const topic of episode.topics) {
      const normalizedName = normalizeTopic(topic.topic_name);

      if (!issueMap.has(normalizedName)) {
        issueMap.set(normalizedName, {
          sentiments: [],
          confidences: [],
          prominences: [],
          quotes: [],
          episodeIds: new Set()
        });
      }

      const issue = issueMap.get(normalizedName)!;
      issue.sentiments.push(topic.sentiment_score);
      issue.confidences.push(topic.confidence);
      issue.prominences.push(topic.prominence_score);
      issue.quotes.push(...topic.evidence_quotes);
      issue.episodeIds.add(episode.episode_id);
    }
  }

  // Calculate maximum episode count for normalization
  const maxEpisodeCount = Math.max(...Array.from(issueMap.values()).map(v => v.episodeIds.size));

  // Rank issues by importance
  const rankedIssues = Array.from(issueMap.entries())
    .map(([normalizedName, data]): RankedIssue => {
      const avgSentiment = mean(data.sentiments);
      const avgConfidence = mean(data.confidences);
      const avgProminence = mean(data.prominences);
      const episodeCount = data.episodeIds.size;

      // Calculate consistency (1 - normalized_std_dev)
      const sentimentConsistency = 1 - (standardDeviation(data.sentiments) / 50);
      const consistency = Math.max(0, Math.min(1, sentimentConsistency));

      // Normalized frequency score
      const frequencyScore = episodeCount / maxEpisodeCount;

      // Ranking formula
      const rankScore =
        frequencyScore * 0.40 +
        avgProminence * 0.35 +
        consistency * 0.25;

      return {
        issue_name: normalizedName,
        normalized_name: normalizedName,
        avg_sentiment: avgSentiment,
        avg_confidence: avgConfidence,
        avg_prominence: avgProminence,
        episode_count: episodeCount,
        rank_score: rankScore,
        evidence_quotes: data.quotes.slice(0, 10), // Limit to top 10 quotes
        episode_ids: Array.from(data.episodeIds),
        sentiment_values: data.sentiments
      };
    })
    .filter(issue => {
      // Apply minimum thresholds
      // For single episode weeks, lower the threshold
      const minEpisodes = episodes.length === 1 ? 1 : 1;
      return issue.episode_count >= minEpisodes && issue.avg_prominence > 0.2;
    })
    .sort((a, b) => b.rank_score - a.rank_score);

  return rankedIssues;
}

/**
 * Computes deltas between current and prior week issues.
 * Returns issue entries with sentiment changes and movement indicators.
 */
function computeDeltas(
  currentWeekIssues: RankedIssue[],
  priorWeekIssues: RankedIssue[],
  currentWeekEpisodes: EpisodeInsight[]
): {
  issueEntries: IssueEntry[];
  gainingIssues: IssueMovement[];
  losingIssues: IssueMovement[];
} {
  const issueEntries: IssueEntry[] = [];
  const gainingIssues: IssueMovement[] = [];
  const losingIssues: IssueMovement[] = [];

  // Create lookup map for prior week issues
  const priorMap = new Map(
    priorWeekIssues.map(issue => [issue.normalized_name, issue])
  );

  currentWeekIssues.forEach((issue, index) => {
    const priorIssue = priorMap.get(issue.normalized_name);
    const rank = index + 1;

    let delta: number | "unknown" = "unknown";
    let whatChanged = "New topic of focus this week.";
    let movement: "up" | "down" | "new" | "unchanged" = "new";

    if (priorIssue) {
      delta = issue.avg_sentiment - priorIssue.avg_sentiment;
      const absDelta = Math.abs(delta);

      if (absDelta < 5) {
        movement = "unchanged";
        whatChanged = `Sentiment remained stable (${formatDelta(delta)} points).`;
      } else if (delta > 0) {
        movement = "up";
        whatChanged = `Sentiment improved by ${formatDelta(delta)} points compared to prior week.`;
      } else {
        movement = "down";
        whatChanged = `Sentiment declined by ${formatDelta(delta)} points compared to prior week.`;
      }
    }

    // Build evidence array
    const evidence: Evidence[] = buildEvidenceArray(
      issue,
      currentWeekEpisodes
    );

    // Create issue entry
    const issueEntry: IssueEntry = {
      issue_id: `issue-${rank}`,
      issue_name: issue.issue_name,
      rank_this_week: rank,
      sentiment_index: Math.round(issue.avg_sentiment),
      sentiment_label: getSentimentLabel(issue.avg_sentiment),
      confidence: issue.avg_confidence,
      delta_vs_prior_week: delta,
      why_this_week: `Mentioned in ${issue.episode_count} episode(s) with ${(issue.avg_prominence * 100).toFixed(0)}% prominence.`,
      what_changed_week_over_week: whatChanged,
      evidence: evidence
    };

    issueEntries.push(issueEntry);

    // Track gaining/losing issues
    if (priorIssue && typeof delta === 'number') {
      if (delta > 10) {
        gainingIssues.push({
          issue_name: issue.issue_name,
          movement: "up",
          reason: `Sentiment improved by ${formatDelta(delta)} points.`,
          supporting_evidence: evidence.slice(0, 3)
        });
      } else if (delta < -10) {
        losingIssues.push({
          issue_name: issue.issue_name,
          movement: "down",
          reason: `Sentiment declined by ${formatDelta(delta)} points.`,
          supporting_evidence: evidence.slice(0, 3)
        });
      }
    }
  });

  // Identify dropped issues (in prior week top 5 but not current)
  const currentNames = new Set(currentWeekIssues.map(i => i.normalized_name));
  priorWeekIssues.slice(0, 5).forEach(priorIssue => {
    if (!currentNames.has(priorIssue.normalized_name)) {
      losingIssues.push({
        issue_name: priorIssue.issue_name,
        movement: "dropped",
        reason: "Dropped out of top 5 issues this week.",
        supporting_evidence: []
      });
    }
  });

  return { issueEntries, gainingIssues, losingIssues };
}

/**
 * Detects narrative shifts between weeks
 */
function detectNarrativeShifts(
  currentWeekIssues: RankedIssue[],
  priorWeekIssues: RankedIssue[],
  currentWeekEpisodes: EpisodeInsight[]
): NarrativeShift[] {
  const shifts: NarrativeShift[] = [];

  // Detect new emerging topics
  const priorNames = new Set(priorWeekIssues.map(i => i.normalized_name));
  currentWeekIssues.slice(0, 3).forEach(issue => {
    if (!priorNames.has(issue.normalized_name)) {
      shifts.push({
        shift: `New focus on ${issue.issue_name}`,
        why_it_changed: `This topic emerged as a top issue this week, mentioned in ${issue.episode_count} episode(s).`,
        supporting_evidence: buildEvidenceArray(issue, currentWeekEpisodes).slice(0, 2)
      });
    }
  });

  // Detect significant sentiment changes
  const priorMap = new Map(priorWeekIssues.map(i => [i.normalized_name, i]));
  currentWeekIssues.forEach(issue => {
    const prior = priorMap.get(issue.normalized_name);
    if (prior) {
      const delta = issue.avg_sentiment - prior.avg_sentiment;
      if (Math.abs(delta) > 15) {
        const direction = delta > 0 ? 'more positive' : 'more negative';
        shifts.push({
          shift: `${issue.issue_name} sentiment turned ${direction}`,
          why_it_changed: `Sentiment shifted by ${formatDelta(delta)} points compared to prior week.`,
          supporting_evidence: buildEvidenceArray(issue, currentWeekEpisodes).slice(0, 2)
        });
      }
    }
  });

  return shifts.slice(0, 5); // Limit to top 5 shifts
}

/**
 * Computes quality flags based on data coverage and confidence
 */
function computeQualityFlags(
  episodes: EpisodeInsight[],
  issues: RankedIssue[]
): QualityFlags {
  if (episodes.length === 0) {
    return {
      hallucination_risk: "high",
      data_coverage: "none",
      notes: ["No episodes found in this date range."]
    };
  }

  const avgConfidence = issues.length > 0
    ? mean(issues.map(i => i.avg_confidence))
    : 0;

  const notes: string[] = [];
  let hallucinationRisk: "low" | "medium" | "high" = "low";
  let dataCoverage: "full" | "partial" | "minimal" | "none" = "full";

  // Assess hallucination risk based on confidence
  if (avgConfidence < 0.5) {
    hallucinationRisk = "high";
    notes.push("Low average confidence in topic identification.");
  } else if (avgConfidence < 0.7) {
    hallucinationRisk = "medium";
    notes.push("Moderate confidence in topic identification.");
  }

  // Assess data coverage based on episode count
  if (episodes.length < 2) {
    dataCoverage = "minimal";
    notes.push("Limited episode coverage for this week (less than 2 episodes).");
  } else if (episodes.length < 5) {
    dataCoverage = "partial";
    notes.push(`Partial episode coverage (${episodes.length} episodes analyzed).`);
  }

  // Check for low prominence issues
  const lowProminence = issues.filter(i => i.avg_prominence < 0.3).length;
  if (lowProminence > 2) {
    notes.push(`${lowProminence} issues have low prominence scores.`);
  }

  return {
    hallucination_risk: hallucinationRisk,
    data_coverage: dataCoverage,
    notes: notes.length > 0 ? notes : ["Analysis based on comprehensive episode coverage."]
  };
}

/**
 * Generates placeholder executive summary (Phase 4 will add AI synthesis)
 */
function generatePlaceholderSummary(
  topIssues: RankedIssue[],
  episodes: EpisodeInsight[]
): string[] {
  if (topIssues.length === 0) {
    return ["No significant political topics identified this week."];
  }

  const summary: string[] = [];

  // Paragraph 1: Overview
  const topIssueNames = topIssues.slice(0, 3).map(i => i.issue_name).join(', ');
  summary.push(
    `This week's political discourse focused primarily on ${topIssueNames}. ` +
    `Analysis of ${episodes.length} episode(s) revealed these as the most prominent topics in Heather Cox Richardson's commentary.`
  );

  // Paragraph 2: Top issue detail
  const topIssue = topIssues[0];
  const sentimentDesc = getSentimentDescription(topIssue.avg_sentiment);
  summary.push(
    `${topIssue.issue_name} emerged as the leading topic, mentioned across ${topIssue.episode_count} episode(s) ` +
    `with a ${sentimentDesc} sentiment (${Math.round(topIssue.avg_sentiment)}/100).`
  );

  // Paragraph 3: Additional context if multiple issues
  if (topIssues.length > 1) {
    const secondIssue = topIssues[1];
    summary.push(
      `${secondIssue.issue_name} also received significant attention this week, ` +
      `reflecting ongoing developments in this area.`
    );
  }

  return summary;
}

/**
 * Builds evidence array from episode quotes
 */
function buildEvidenceArray(
  issue: RankedIssue,
  episodes: EpisodeInsight[]
): Evidence[] {
  const evidence: Evidence[] = [];

  // Filter episodes that discussed this issue
  const relevantEpisodes = episodes.filter(ep =>
    issue.episode_ids.includes(ep.episode_id)
  );

  for (const episode of relevantEpisodes) {
    // Find topics matching this issue
    const matchingTopics = episode.topics.filter(t =>
      normalizeTopic(t.topic_name) === issue.normalized_name
    );

    for (const topic of matchingTopics) {
      // Add quotes as evidence
      for (const quote of topic.evidence_quotes.slice(0, 2)) { // Max 2 quotes per topic
        evidence.push({
          episode_id: episode.episode_id,
          show_name: episode.show_name,
          published_at: episode.published_at,
          evidence_type: "quote_excerpt",
          evidence_text: quote,
          offsets: null
        });
      }
    }
  }

  // Limit total evidence entries
  return evidence.slice(0, 15);
}

// ===== Utility Functions =====

/**
 * Normalizes topic names to handle variations
 * Examples: "Jan 6" → "january 6 investigation", "DOJ" → "department of justice"
 */
function normalizeTopic(topicName: string): string {
  let normalized = topicName.toLowerCase().trim();

  // Common normalizations
  const replacements: Record<string, string> = {
    'jan 6': 'january 6',
    'jan. 6': 'january 6',
    'january sixth': 'january 6',
    'doj': 'department of justice',
    'scotus': 'supreme court',
    'potus': 'president',
    'gop': 'republican party',
    'dems': 'democratic party',
  };

  for (const [pattern, replacement] of Object.entries(replacements)) {
    if (normalized.includes(pattern)) {
      normalized = normalized.replace(pattern, replacement);
    }
  }

  return normalized;
}

/**
 * Calculates mean of number array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Calculates standard deviation of number array
 */
function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = mean(values);
  const squareDiffs = values.map(value => Math.pow(value - avg, 2));
  const avgSquareDiff = mean(squareDiffs);
  return Math.sqrt(avgSquareDiff);
}

/**
 * Formats delta with + or - prefix
 */
function formatDelta(delta: number): string {
  const prefix = delta > 0 ? '+' : '';
  return `${prefix}${Math.round(delta)}`;
}

/**
 * Maps sentiment score to label
 */
function getSentimentLabel(score: number): "positive" | "neutral" | "negative" | "mixed" {
  if (score >= 60) return "positive";
  if (score <= 40) return "negative";
  return "neutral";
}

/**
 * Gets descriptive sentiment text
 */
function getSentimentDescription(score: number): string {
  if (score >= 70) return "highly positive";
  if (score >= 60) return "positive";
  if (score >= 45) return "slightly positive";
  if (score >= 35) return "slightly negative";
  if (score >= 25) return "negative";
  return "highly negative";
}
