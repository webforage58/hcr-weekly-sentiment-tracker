import { storageService } from '../services/storage';
import { saveEpisode, saveWeeklyAggregation, getEpisode } from '../services/episodeDB';
import type { HCRReport, EpisodeInsight, TopicInsight, WeeklyAggregation, Evidence } from '../types';

/**
 * Migration utility to convert LocalStorage week-level data to IndexedDB episode-level data
 */

const LEGACY_FRAMEWORK_VERSION = 'v1-legacy';

/**
 * Generate a deterministic episode ID from available metadata
 * Uses a combination of show name, title, and date to create a unique ID
 */
function generateEpisodeId(showName: string, title: string, publishedAt: string): string {
  // Create a simple but deterministic ID
  const normalized = `${showName}_${title}_${publishedAt}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized;
}

/**
 * Extract topics for a specific episode from the week's top issues
 * Maps issues back to episodes using evidence
 */
function extractTopicsForEpisode(
  report: HCRReport,
  episodeId: string
): TopicInsight[] {
  const topics: TopicInsight[] = [];

  for (const issue of report.top_issues) {
    // Find evidence from this episode
    const episodeEvidence = issue.evidence.filter(e => e.episode_id === episodeId);

    if (episodeEvidence.length > 0) {
      // Create a topic insight for this issue
      topics.push({
        topic_name: issue.issue_name,
        sentiment_score: typeof issue.sentiment_index === 'number' ? issue.sentiment_index : 50,
        confidence: issue.confidence,
        evidence_quotes: episodeEvidence.map(e => e.evidence_text),
        prominence_score: 0.5, // Default prominence since we don't have this data
      });
    }
  }

  return topics;
}

/**
 * Calculate overall sentiment for an episode based on its topics
 */
function calculateOverallSentiment(topics: TopicInsight[]): number {
  if (topics.length === 0) return 50; // Neutral default

  // Weighted average by confidence
  const totalWeight = topics.reduce((sum, t) => sum + t.confidence, 0);
  if (totalWeight === 0) return 50;

  const weightedSum = topics.reduce((sum, t) => sum + (t.sentiment_score * t.confidence), 0);
  return Math.round(weightedSum / totalWeight);
}

/**
 * Extract key quotes for an episode from all evidence
 */
function extractKeyQuotes(report: HCRReport, episodeId: string): string[] {
  const quotes: string[] = [];
  const maxQuotes = 5;

  for (const issue of report.top_issues) {
    const episodeEvidence = issue.evidence.filter(
      e => e.episode_id === episodeId && e.evidence_type === 'quote_excerpt'
    );

    for (const evidence of episodeEvidence) {
      if (quotes.length < maxQuotes && !quotes.includes(evidence.evidence_text)) {
        quotes.push(evidence.evidence_text);
      }
    }
  }

  return quotes;
}

/**
 * Check if episode focuses on Trump administration
 * Based on topic names and issue content
 */
function checkTrumpAdminFocus(topics: TopicInsight[]): boolean {
  const trumpKeywords = ['trump', 'administration', 'executive order', 'white house', 'president'];

  return topics.some(topic =>
    trumpKeywords.some(keyword =>
      topic.topic_name.toLowerCase().includes(keyword)
    )
  );
}

/**
 * Convert week-level report's sources_analyzed to EpisodeInsight objects
 */
async function convertSourceToEpisode(
  source: { episode_id: string; show_name: string; title: string; published_at: string },
  report: HCRReport
): Promise<EpisodeInsight> {
  // Use existing episode_id if present, otherwise generate one
  const episodeId = source.episode_id || generateEpisodeId(
    source.show_name,
    source.title,
    source.published_at
  );

  // Extract topics from the week report for this episode
  const topics = extractTopicsForEpisode(report, episodeId);

  // Calculate overall sentiment
  const overallSentiment = calculateOverallSentiment(topics);

  // Extract key quotes
  const keyQuotes = extractKeyQuotes(report, episodeId);

  // Check Trump admin focus
  const trumpAdminFocus = checkTrumpAdminFocus(topics);

  return {
    episode_id: episodeId,
    show_name: source.show_name,
    title: source.title,
    published_at: source.published_at,
    transcript_url: undefined, // Not available in old format
    topics,
    overall_sentiment: overallSentiment,
    trump_admin_focus: trumpAdminFocus,
    key_quotes: keyQuotes,
    framework_version: LEGACY_FRAMEWORK_VERSION,
    processed_at: report.generated_at,
    model_used: 'gemini-3-flash-preview', // Assume this model
  };
}

/**
 * Convert HCRReport to WeeklyAggregation format
 */
function convertReportToAggregation(
  weekStart: string,
  report: HCRReport,
  episodeIds: string[]
): WeeklyAggregation {
  return {
    week_start: weekStart,
    week_end: report.run_window.window_end,
    episode_ids: episodeIds,
    top_issues: report.top_issues.map(issue => ({
      issue_name: issue.issue_name,
      avg_sentiment: typeof issue.sentiment_index === 'number' ? issue.sentiment_index : 50,
      confidence: issue.confidence,
      episode_count: new Set(issue.evidence.map(e => e.episode_id)).size,
      evidence: issue.evidence,
    })),
    computed_at: report.generated_at,
    framework_version: LEGACY_FRAMEWORK_VERSION,
  };
}

/**
 * Migration result statistics
 */
export interface MigrationResult {
  success: boolean;
  weeksProcessed: number;
  episodesCreated: number;
  episodesUpdated: number;
  aggregationsSaved: number;
  errors: string[];
  warnings: string[];
}

/**
 * Main migration function
 * Migrates all LocalStorage week-level data to IndexedDB episode-level data
 *
 * @param options.dryRun - If true, simulates migration without writing to database
 * @param options.force - If true, overwrites existing episodes (default: false)
 */
export async function migrateWeeklyReportsToEpisodes(
  options: { dryRun?: boolean; force?: boolean } = {}
): Promise<MigrationResult> {
  const { dryRun = false, force = false } = options;

  const result: MigrationResult = {
    success: false,
    weeksProcessed: 0,
    episodesCreated: 0,
    episodesUpdated: 0,
    aggregationsSaved: 0,
    errors: [],
    warnings: [],
  };

  try {
    console.log('🔄 Starting migration from LocalStorage to IndexedDB...');
    if (dryRun) {
      console.log('ℹ️ DRY RUN MODE - No changes will be written to database');
    }

    // Load all weeks from LocalStorage
    const oldWeeks = storageService.getAllWeeks();
    const weekEntries = Object.entries(oldWeeks);

    if (weekEntries.length === 0) {
      result.warnings.push('No weeks found in LocalStorage to migrate');
      console.log('⚠️ No weeks found in LocalStorage');
      result.success = true;
      return result;
    }

    console.log(`📦 Found ${weekEntries.length} weeks in LocalStorage`);

    // Track unique episodes across all weeks
    const processedEpisodeIds = new Set<string>();

    // Process each week
    for (const [weekStart, report] of weekEntries) {
      try {
        console.log(`\n📅 Processing week: ${weekStart}`);

        if (!report.sources_analyzed || report.sources_analyzed.length === 0) {
          result.warnings.push(`Week ${weekStart} has no sources_analyzed`);
          continue;
        }

        const episodeIds: string[] = [];

        // Convert each source to an episode insight
        for (const source of report.sources_analyzed) {
          try {
            const episodeInsight = await convertSourceToEpisode(source, report);
            episodeIds.push(episodeInsight.episode_id);

            // Check if episode already exists (skip if not forcing)
            if (!force && !dryRun) {
              const existing = await getEpisode(episodeInsight.episode_id);
              if (existing && existing.framework_version !== LEGACY_FRAMEWORK_VERSION) {
                // Don't overwrite newer versions
                result.warnings.push(
                  `Skipped episode ${episodeInsight.episode_id} (already exists with version ${existing.framework_version})`
                );
                continue;
              }
            }

            // Save episode to IndexedDB
            if (!dryRun) {
              await saveEpisode(episodeInsight);
            }

            // Track statistics
            if (processedEpisodeIds.has(episodeInsight.episode_id)) {
              result.episodesUpdated++;
            } else {
              result.episodesCreated++;
              processedEpisodeIds.add(episodeInsight.episode_id);
            }

            console.log(`  ✅ Processed episode: ${episodeInsight.title}`);
          } catch (error) {
            const errMsg = `Failed to process episode from week ${weekStart}: ${error instanceof Error ? error.message : String(error)}`;
            result.errors.push(errMsg);
            console.error(`  ❌ ${errMsg}`);
          }
        }

        // Save weekly aggregation
        if (!dryRun && episodeIds.length > 0) {
          const aggregation = convertReportToAggregation(weekStart, report, episodeIds);
          await saveWeeklyAggregation(aggregation);
          result.aggregationsSaved++;
          console.log(`  ✅ Saved weekly aggregation`);
        }

        result.weeksProcessed++;
      } catch (error) {
        const errMsg = `Failed to process week ${weekStart}: ${error instanceof Error ? error.message : String(error)}`;
        result.errors.push(errMsg);
        console.error(`❌ ${errMsg}`);
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  Weeks processed: ${result.weeksProcessed}`);
    console.log(`  Episodes created: ${result.episodesCreated}`);
    console.log(`  Episodes updated: ${result.episodesUpdated}`);
    console.log(`  Weekly aggregations saved: ${result.aggregationsSaved}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Warnings: ${result.warnings.length}`);

    if (result.errors.length === 0) {
      result.success = true;
      console.log('\n✅ Migration completed successfully!');

      if (!dryRun) {
        console.log('\nℹ️ LocalStorage data has been preserved as backup.');
        console.log('ℹ️ You can clear it manually if needed using: storageService.clearAll()');
      }
    } else {
      console.log('\n⚠️ Migration completed with errors');
      result.errors.forEach(err => console.error(`  - ${err}`));
    }

    return result;
  } catch (error) {
    const errMsg = `Migration failed: ${error instanceof Error ? error.message : String(error)}`;
    result.errors.push(errMsg);
    console.error(`❌ ${errMsg}`);
    return result;
  }
}

/**
 * Check if migration is needed
 * Returns true if there's LocalStorage data that hasn't been migrated yet
 */
export function isMigrationNeeded(): boolean {
  try {
    const weeks = storageService.getAllWeeks();
    const weekCount = Object.keys(weeks).length;

    if (weekCount === 0) {
      return false; // No data to migrate
    }

    // Could check IndexedDB for existing legacy episodes here
    // For now, return true if LocalStorage has data
    return true;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}

/**
 * Get migration statistics without performing migration
 */
export function getMigrationStats(): {
  weeksInLocalStorage: number;
  totalEpisodes: number;
} {
  try {
    const weeks = storageService.getAllWeeks();
    const weekEntries = Object.entries(weeks);

    let totalEpisodes = 0;
    for (const [, report] of weekEntries) {
      totalEpisodes += report.sources_analyzed?.length || 0;
    }

    return {
      weeksInLocalStorage: weekEntries.length,
      totalEpisodes,
    };
  } catch (error) {
    console.error('Failed to get migration stats:', error);
    return {
      weeksInLocalStorage: 0,
      totalEpisodes: 0,
    };
  }
}
