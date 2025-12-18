import type {
  HCRReport,
  IssueEntry,
  IssueMovement,
  NarrativeShift,
  QualityFlags,
  Evidence,
  AnalyzedSource,
  EpisodeInsight,
  RankedIssue,
  WeeklyAggregation,
  AggregatedIssue
} from '../types';
import {
  getEpisodesByDateRange,
  getWeeklyAggregation,
  saveWeeklyAggregation,
  getAllWeeklyAggregations,
  deleteWeeklyAggregation
} from './episodeDB';
import { computeDeltas, normalizeTopic, rankIssues, DeltaResult } from '../utils/aggregation';
import { FRAMEWORK_VERSION } from '../constants/frameworkVersion';

// Current framework version for cache validation
const CURRENT_FRAMEWORK_VERSION = FRAMEWORK_VERSION;

// Algorithm version hash - update when ranking/aggregation logic changes
// This ensures cache invalidation when the composition algorithm changes
const AGGREGATION_ALGORITHM_VERSION = 'v2.0.0';

/**
 * Validates whether a cached weekly aggregation is still valid.
 * Returns true if all episodes in the cache match current database state.
 */
async function validateWeeklyCache(
  cached: WeeklyAggregation,
  currentWeekEpisodes: EpisodeInsight[]
): Promise<boolean> {
  // Check framework version matches current version
  if (cached.framework_version !== CURRENT_FRAMEWORK_VERSION) {
    console.log(`Cache invalid: framework version mismatch (cached: ${cached.framework_version}, current: ${CURRENT_FRAMEWORK_VERSION})`);
    return false;
  }

  // Check that all episode IDs in cache are present in current week episodes
  const currentEpisodeIds = new Set(currentWeekEpisodes.map(ep => ep.episode_id));
  const cachedEpisodeIds = new Set(cached.episode_ids);

  // If episode counts differ, cache is invalid
  if (cachedEpisodeIds.size !== currentEpisodeIds.size) {
    console.log(`Cache invalid: episode count mismatch (cached: ${cachedEpisodeIds.size}, current: ${currentEpisodeIds.size})`);
    return false;
  }

  // Check all cached episode IDs exist in current episodes
  for (const episodeId of cachedEpisodeIds) {
    if (!currentEpisodeIds.has(episodeId)) {
      console.log(`Cache invalid: episode ${episodeId} not found in current week`);
      return false;
    }
  }

  // Verify framework versions of all episodes match current version
  const outdatedEpisodes = currentWeekEpisodes.filter(
    ep => ep.framework_version !== CURRENT_FRAMEWORK_VERSION
  );
  if (outdatedEpisodes.length > 0) {
    console.log(`Cache invalid: ${outdatedEpisodes.length} episode(s) have outdated framework versions`);
    return false;
  }

  console.log(`Cache valid: all ${cachedEpisodeIds.size} episodes match current state`);
  return true;
}

/**
 * Converts a cached WeeklyAggregation back to a full HCRReport.
 * Used when cache hit occurs to avoid recomputing the report.
 */
async function convertAggregationToReport(
  cached: WeeklyAggregation,
  weekStart: string,
  weekEnd: string,
  priorWeekStart: string,
  priorWeekEnd: string
): Promise<HCRReport> {
  console.log(`Converting cached aggregation to HCRReport for ${weekStart}`);

  // Retrieve episodes to populate sources_analyzed and evidence
  const currentWeekEpisodes = await getEpisodesByDateRange(weekStart, weekEnd);
  const priorWeekEpisodes = await getEpisodesByDateRange(priorWeekStart, priorWeekEnd);

  // Build sources_analyzed array
  const sourcesAnalyzed: AnalyzedSource[] = currentWeekEpisodes.map(ep => ({
    episode_id: ep.episode_id,
    show_name: ep.show_name,
    title: ep.title,
    published_at: ep.published_at,
    input_types_present: ['transcript_summary']
  }));

  // Convert AggregatedIssues to IssueEntries with full evidence
  const issueEntries: IssueEntry[] = [];
  const gainingIssues: IssueMovement[] = [];
  const losingIssues: IssueMovement[] = [];

  // Rank current week issues to get proper structure
  const currentWeekIssues = rankIssues(currentWeekEpisodes);
  const priorWeekIssues = rankIssues(priorWeekEpisodes);

  // Use top 5 issues from cache to build entries
  const top5 = currentWeekIssues.slice(0, 5);
  const { deltas } = computeDeltas(top5, priorWeekIssues);

  deltas.forEach((delta, index) => {
    const evidence = buildEvidenceArray(delta.issue, currentWeekEpisodes);
    const sentimentIndex = Math.round(delta.issue.avg_sentiment);
    const deltaValue = typeof delta.sentimentDelta === 'number'
      ? Math.round(delta.sentimentDelta)
      : "unknown";

    const enhancedDescription = buildEnhancedDeltaDescription(
      delta,
      evidence,
      currentWeekEpisodes
    );

    issueEntries.push({
      issue_id: `issue-${index + 1}`,
      issue_name: delta.issue.issue_name,
      rank_this_week: index + 1,
      sentiment_index: sentimentIndex,
      sentiment_label: getSentimentLabel(sentimentIndex),
      confidence: delta.issue.avg_confidence,
      delta_vs_prior_week: deltaValue,
      why_this_week: `Mentioned in ${delta.issue.episode_count} episode(s) with ${(delta.issue.avg_prominence * 100).toFixed(0)}% prominence.`,
      what_changed_week_over_week: enhancedDescription,
      evidence
    });

    // Track gaining/losing issues
    if (delta.movement === "up" && typeof delta.sentimentDelta === 'number' && delta.sentimentDelta > 10) {
      gainingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "up",
        reason: `Sentiment improved by ${formatDelta(delta.sentimentDelta)} points.`,
        supporting_evidence: evidence.slice(0, 3)
      });
    } else if (delta.movement === "down" && typeof delta.sentimentDelta === 'number' && delta.sentimentDelta < -10) {
      losingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "down",
        reason: `Sentiment declined by ${formatDelta(delta.sentimentDelta)} points.`,
        supporting_evidence: evidence.slice(0, 3)
      });
    } else if (delta.movement === "new") {
      gainingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "new",
        reason: "New topic of focus this week.",
        supporting_evidence: evidence.slice(0, 2)
      });
    }
  });

  // Detect narrative shifts
  const narrativeShifts = detectNarrativeShifts(
    top5,
    priorWeekIssues,
    currentWeekEpisodes
  );

  // Compute quality flags
  const qualityFlags = computeQualityFlags(currentWeekEpisodes, currentWeekIssues);

  // Generate placeholder executive summary
  const executiveSummary = generatePlaceholderSummary(top5, currentWeekEpisodes);

  return {
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
    generated_at: cached.computed_at, // Use original computation time
    sources_analyzed: sourcesAnalyzed,
    executive_summary: executiveSummary,
    top_issues: issueEntries,
    issues_gaining_importance: gainingIssues,
    issues_losing_importance: losingIssues,
    narrative_shifts: narrativeShifts,
    evidence_gaps: [],
    quality_flags: qualityFlags
  };
}

/**
 * Prunes old weekly aggregations, keeping only the most recent 52 weeks.
 * Helps prevent unbounded storage growth.
 */
async function pruneOldWeeklyAggregations(): Promise<void> {
  try {
    const allAggregations = await getAllWeeklyAggregations();

    // If we have 52 or fewer, no pruning needed
    if (allAggregations.length <= 52) {
      return;
    }

    // Sort by week_start descending (newest first)
    const sorted = allAggregations.sort((a, b) =>
      b.week_start.localeCompare(a.week_start)
    );

    // Keep first 52, delete the rest
    const toDelete = sorted.slice(52);
    console.log(`Pruning ${toDelete.length} old weekly aggregations (keeping most recent 52)`);

    for (const aggregation of toDelete) {
      await deleteWeeklyAggregation(aggregation.week_start);
    }

    console.log(`Successfully pruned ${toDelete.length} old weekly aggregations`);
  } catch (error) {
    console.error('Error pruning old weekly aggregations:', error);
    // Non-fatal error, continue execution
  }
}

/**
 * Composes a weekly report from episode insights without calling AI.
 * Aggregates topics across episodes, ranks by importance, and calculates deltas.
 * Uses caching to speed up re-runs and multi-week analysis.
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
    // Check if we have a cached weekly aggregation
    const cachedAggregation = await getWeeklyAggregation(weekStart);

    if (cachedAggregation) {
      console.log(`Found cached weekly aggregation for ${weekStart}`);

      // Query current week episodes to validate cache
      const currentWeekEpisodes = await getEpisodesByDateRange(weekStart, weekEnd);

      // Validate cache is still valid
      const isCacheValid = await validateWeeklyCache(cachedAggregation, currentWeekEpisodes);

      if (isCacheValid) {
        console.log(`✓ Using cached weekly aggregation for ${weekStart} (cache hit)`);
        return await convertAggregationToReport(
          cachedAggregation,
          weekStart,
          weekEnd,
          priorWeekStart,
          priorWeekEnd
        );
      } else {
        console.log(`✗ Cache invalid for ${weekStart}, recomputing...`);
      }
    }

    // Cache miss or invalid - compute fresh report
    console.log(`Computing fresh weekly report for ${weekStart} (cache miss)`);

    // Query episodes from IndexedDB
    const currentWeekEpisodes = await getEpisodesByDateRange(weekStart, weekEnd);
    const priorWeekEpisodes = await getEpisodesByDateRange(priorWeekStart, priorWeekEnd);

    console.log(
      `Found ${currentWeekEpisodes.length} episodes in current week, ` +
      `${priorWeekEpisodes.length} in prior week`
    );

    // Aggregate topics into ranked issues
    const currentWeekIssues = rankIssues(currentWeekEpisodes);
    const priorWeekIssues = rankIssues(priorWeekEpisodes);

    // Select top 5 issues
    const top5 = currentWeekIssues.slice(0, 5);

    // Compute deltas and movements
    const { deltas, dropped } = computeDeltas(top5, priorWeekIssues);
    const {
      issueEntries,
      gainingIssues,
      losingIssues
    } = buildIssueEntriesFromDeltas(deltas, dropped, currentWeekEpisodes);

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

    // Cache the weekly aggregation for future re-runs
    try {
      const aggregatedIssues: AggregatedIssue[] = top5.map(issue => ({
        issue_name: issue.issue_name,
        avg_sentiment: issue.avg_sentiment,
        confidence: issue.avg_confidence,
        episode_count: issue.episode_count,
        evidence: buildEvidenceArray(issue, currentWeekEpisodes)
      }));

      const weeklyAggregation: WeeklyAggregation = {
        week_start: weekStart,
        week_end: weekEnd,
        episode_ids: currentWeekEpisodes.map(ep => ep.episode_id),
        top_issues: aggregatedIssues,
        computed_at: report.generated_at,
        framework_version: CURRENT_FRAMEWORK_VERSION
      };

      await saveWeeklyAggregation(weeklyAggregation);
      console.log(`✓ Cached weekly aggregation for ${weekStart}`);

      // Prune old aggregations to prevent unbounded growth
      await pruneOldWeeklyAggregations();
    } catch (cacheError) {
      // Non-fatal: log error but continue
      console.error('Failed to cache weekly aggregation:', cacheError);
    }

    return report;
  } catch (error) {
    console.error('Error composing weekly report:', error);
    throw new Error(`Failed to compose weekly report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Builds issue entries and movement arrays from delta results.
 */
function buildIssueEntriesFromDeltas(
  deltas: DeltaResult[],
  droppedIssues: RankedIssue[],
  currentWeekEpisodes: EpisodeInsight[]
): {
  issueEntries: IssueEntry[];
  gainingIssues: IssueMovement[];
  losingIssues: IssueMovement[];
} {
  const issueEntries: IssueEntry[] = [];
  const gainingIssues: IssueMovement[] = [];
  const losingIssues: IssueMovement[] = [];

  deltas.forEach((delta, index) => {
    const evidence = buildEvidenceArray(delta.issue, currentWeekEpisodes);
    const sentimentIndex = Math.round(delta.issue.avg_sentiment);
    const deltaValue = typeof delta.sentimentDelta === 'number'
      ? Math.round(delta.sentimentDelta)
      : "unknown";

    // Generate evidence-based description
    const enhancedDescription = buildEnhancedDeltaDescription(
      delta,
      evidence,
      currentWeekEpisodes
    );

    const issueEntry: IssueEntry = {
      issue_id: `issue-${index + 1}`,
      issue_name: delta.issue.issue_name,
      rank_this_week: index + 1,
      sentiment_index: sentimentIndex,
      sentiment_label: getSentimentLabel(sentimentIndex),
      confidence: delta.issue.avg_confidence,
      delta_vs_prior_week: deltaValue,
      why_this_week: `Mentioned in ${delta.issue.episode_count} episode(s) with ${(delta.issue.avg_prominence * 100).toFixed(0)}% prominence.`,
      what_changed_week_over_week: enhancedDescription,
      evidence
    };

    issueEntries.push(issueEntry);

    if (delta.movement === "up" && typeof delta.sentimentDelta === 'number' && delta.sentimentDelta > 10) {
      gainingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "up",
        reason: `Sentiment improved by ${formatDelta(delta.sentimentDelta)} points.`,
        supporting_evidence: evidence.slice(0, 3)
      });
    } else if (delta.movement === "down" && typeof delta.sentimentDelta === 'number' && delta.sentimentDelta < -10) {
      losingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "down",
        reason: `Sentiment declined by ${formatDelta(delta.sentimentDelta)} points.`,
        supporting_evidence: evidence.slice(0, 3)
      });
    } else if (delta.movement === "new") {
      gainingIssues.push({
        issue_name: delta.issue.issue_name,
        movement: "new",
        reason: "New topic of focus this week.",
        supporting_evidence: evidence.slice(0, 2)
      });
    }
  });

  droppedIssues.forEach(issue => {
    losingIssues.push({
      issue_name: issue.issue_name,
      movement: "dropped",
      reason: "Dropped out of top 5 issues this week.",
      supporting_evidence: []
    });
  });

  return { issueEntries, gainingIssues, losingIssues };
}

/**
 * Builds enhanced delta description using evidence analysis.
 * Generates more informative descriptions by analyzing evidence quotes.
 */
function buildEnhancedDeltaDescription(
  delta: DeltaResult,
  evidence: Evidence[],
  episodes: EpisodeInsight[]
): string {
  const { issue, priorIssue, sentimentDelta, prominenceDelta, movement } = delta;

  // Extract key themes from evidence
  const themes = extractKeyThemesFromEvidence(evidence, issue.issue_name);

  // Build context-aware description based on movement type
  if (movement === "new") {
    if (themes.length > 0) {
      return `${issue.issue_name} emerged as a new focus this week following ${themes[0].toLowerCase()}.`;
    }
    return `${issue.issue_name} emerged as a new focus this week with ${issue.episode_count} episode(s) covering this topic.`;
  }

  if (movement === "unchanged") {
    if (themes.length > 0) {
      return `${issue.issue_name} maintained steady coverage this week, with continued discussion of ${themes[0].toLowerCase()}.`;
    }
    return `${issue.issue_name} held steady week over week (Δ ${formatDelta(sentimentDelta as number)} pts sentiment).`;
  }

  // For "up" or "down" movements, analyze sentiment direction
  const isPositive = typeof sentimentDelta === 'number' && sentimentDelta > 0;
  const isNegative = typeof sentimentDelta === 'number' && sentimentDelta < 0;
  const magnitude = typeof sentimentDelta === 'number' ? Math.abs(sentimentDelta) : 0;

  if (movement === "up") {
    if (magnitude > 20 && themes.length > 0) {
      return `${issue.issue_name} sentiment improved significantly (+${magnitude} pts) amid ${themes[0].toLowerCase()}.`;
    } else if (themes.length > 0) {
      return `${issue.issue_name} gained momentum (+${magnitude} pts) with focus on ${themes[0].toLowerCase()}.`;
    }
    return `${issue.issue_name} gained momentum (Δ ${formatDelta(sentimentDelta as number)} pts sentiment, ${formatDelta((prominenceDelta as number) * 100)} pts prominence).`;
  }

  if (movement === "down") {
    if (magnitude > 20 && themes.length > 0) {
      return `${issue.issue_name} sentiment declined significantly (-${magnitude} pts) amid concerns about ${themes[0].toLowerCase()}.`;
    } else if (themes.length > 0) {
      return `${issue.issue_name} lost momentum (-${magnitude} pts) with continued attention to ${themes[0].toLowerCase()}.`;
    }
    return `${issue.issue_name} lost momentum (Δ ${formatDelta(sentimentDelta as number)} pts sentiment, ${formatDelta((prominenceDelta as number) * 100)} pts prominence).`;
  }

  // Fallback to basic description
  return delta.description;
}

/**
 * Extracts key themes and events from evidence quotes.
 * Analyzes quote text to identify specific developments, events, or concerns.
 */
function extractKeyThemesFromEvidence(
  evidence: Evidence[],
  issueName: string
): string[] {
  if (evidence.length === 0) return [];

  const themes: string[] = [];
  const evidenceTexts = evidence.map(e => e.evidence_text).filter(Boolean);

  // Common patterns to extract key themes
  const patterns = [
    // Developments and events
    /(?:following|after|due to|amid|regarding)\s+(.{20,80}?)(?:\.|,|;|$)/gi,
    /(?:developments?|events?|announcements?|decisions?|actions?)\s+(?:on|about|regarding)\s+(.{20,80}?)(?:\.|,|;|$)/gi,

    // Concerns and criticism
    /concerns?\s+(?:about|over|regarding)\s+(.{20,80}?)(?:\.|,|;|$)/gi,
    /criticism\s+(?:of|about|over)\s+(.{20,80}?)(?:\.|,|;|$)/gi,

    // Specific actions
    /(?:announced|proposed|introduced|passed|signed|blocked|rejected)\s+(.{20,80}?)(?:\.|,|;|$)/gi,

    // Focus areas
    /(?:focus|attention|emphasis)\s+on\s+(.{20,80}?)(?:\.|,|;|$)/gi,
  ];

  // Try to extract themes from all evidence
  for (const text of evidenceTexts.slice(0, 5)) {
    for (const pattern of patterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches.slice(0, 2)) {
        if (match[1] && match[1].trim().length > 10) {
          const theme = cleanThemeText(match[1].trim());
          if (theme && !themes.includes(theme)) {
            themes.push(theme);
            if (themes.length >= 3) break;
          }
        }
      }
      if (themes.length >= 3) break;
    }
    if (themes.length >= 3) break;
  }

  // If no specific themes found, try to extract key phrases
  if (themes.length === 0) {
    const keyPhrases = extractKeyPhrases(evidenceTexts.slice(0, 3));
    themes.push(...keyPhrases.slice(0, 2));
  }

  return themes;
}

/**
 * Extracts key phrases from evidence text when pattern matching fails.
 */
function extractKeyPhrases(texts: string[]): string[] {
  const phrases: string[] = [];

  for (const text of texts) {
    // Look for noun phrases (simplified extraction)
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    for (const sentence of sentences.slice(0, 2)) {
      // Extract phrases between commas or before periods
      const parts = sentence.split(/[,;]/).map(p => p.trim());
      for (const part of parts) {
        if (part.length > 30 && part.length < 100) {
          const cleaned = cleanThemeText(part);
          if (cleaned && !phrases.includes(cleaned)) {
            phrases.push(cleaned);
            if (phrases.length >= 2) return phrases;
          }
        }
      }
    }
  }

  return phrases;
}

/**
 * Cleans and normalizes theme text for readability.
 */
function cleanThemeText(text: string): string {
  // Remove leading articles and pronouns
  let cleaned = text
    .replace(/^(the|a|an|this|that|these|those|he|she|it|they)\s+/i, '')
    .trim();

  // Remove trailing punctuation except periods in abbreviations
  cleaned = cleaned.replace(/[,;:]$/, '').trim();

  // Ensure it doesn't end mid-word
  if (cleaned.endsWith(' the') || cleaned.endsWith(' a') || cleaned.endsWith(' an')) {
    cleaned = cleaned.replace(/\s+(the|a|an)$/i, '');
  }

  // Ensure reasonable length
  if (cleaned.length < 15 || cleaned.length > 120) {
    return '';
  }

  return cleaned;
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
 * Calculates mean of number array
 */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
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
