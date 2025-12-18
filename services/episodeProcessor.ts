/**
 * Episode Processor
 *
 * Orchestrates parallel episode analysis with configurable concurrency.
 * Handles episode discovery, caching, and batch processing.
 */

import { EpisodeInsight, EpisodeMetadata } from '@/types';
import { searchEpisodesInRange } from './episodeSearch';
import { analyzeEpisode } from './gemini';
import {
  getEpisodesByDateRange,
  saveEpisode,
  episodeExists,
  getEpisode,
  getEpisodesByFrameworkVersion,
  getAllEpisodes
} from './episodeDB';
import { FRAMEWORK_VERSION } from '../constants/frameworkVersion';

/**
 * Injectable dependencies for testing/benchmarking.
 *
 * Allows callers (e.g., `test-performanceBench.ts`) to run the pipeline with
 * mocked episode discovery and/or analysis without touching real network/AI.
 */
export interface ProcessDependencies {
  searchEpisodesInRange?: (startDate: string, endDate: string) => Promise<EpisodeMetadata[]>;
  analyzeEpisode?: (
    episodeId: string,
    episodeMetadata: EpisodeMetadata,
    frameworkVersion?: string
  ) => Promise<EpisodeInsight>;
}

/**
 * Options for episode processing
 */
export interface ProcessOptions {
  /** Maximum number of concurrent episode analyses (default: 10) */
  concurrency?: number;

  /** Optional dependency overrides (used by manual tests/benchmarks) */
  deps?: ProcessDependencies;

  /** Force reprocessing of all episodes, even if cached (default: false) */
  forceReprocess?: boolean;

  /** Framework version to use for new analyses (default: "v2") */
  frameworkVersion?: string;

  /** Reprocess episodes cached longer than this many days ago (default: null = disabled) */
  stalenessThresholdDays?: number | null;

  /** Callback fired after each episode completes (cached or new) */
  onProgress?: (completed: number, total: number, currentEpisode: string, isCached: boolean) => void;

  /** Callback fired when episode discovery completes */
  onDiscoveryComplete?: (totalEpisodes: number, cachedCount: number, newCount: number) => void;

  /** Optional abort signal for cancelling work */
  signal?: AbortSignal;
}

/**
 * Result of episode processing
 */
export interface ProcessResult {
  /** All episode insights (cached + newly analyzed) */
  episodes: EpisodeInsight[];

  /** Statistics about the processing run */
  stats: {
    totalEpisodes: number;
    cachedEpisodes: number;
    newlyAnalyzed: number;
    failed: number;
    durationMs: number;
  };

  /** Errors encountered during processing (non-fatal) */
  errors: Array<{
    episodeId: string;
    error: string;
  }>;
}

/**
 * Default processing options
 */
const DEFAULT_OPTIONS: ProcessOptions = {
  concurrency: 10,
  forceReprocess: false,
  frameworkVersion: FRAMEWORK_VERSION,
  stalenessThresholdDays: null, // Disabled by default
  onProgress: () => {},
  onDiscoveryComplete: () => {},
  signal: undefined
};

/**
 * Process episodes in a date range with parallel execution
 *
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @param options - Processing options
 * @returns ProcessResult with all episodes and statistics
 *
 * @example
 * const result = await processEpisodesInRange('2025-01-01', '2025-01-31', {
 *   concurrency: 10,
 *   onProgress: (completed, total, episode, isCached) => {
 *     console.log(`${completed}/${total}: ${episode} ${isCached ? '(cached)' : '(analyzing)'}`);
 *   }
 * });
 */
export async function processEpisodesInRange(
  startDate: string,
  endDate: string,
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const concurrency = opts.concurrency ?? 10;
  const startTime = performance.now();
  const abortSignal = opts.signal;
  const onProgress = opts.onProgress ?? (() => {});
  const onDiscoveryComplete = opts.onDiscoveryComplete ?? (() => {});
  const deps = opts.deps ?? {};
  const searchFn = deps.searchEpisodesInRange ?? searchEpisodesInRange;
  const analyzeFn = deps.analyzeEpisode ?? analyzeEpisode;

  console.log(`[EpisodeProcessor] Processing episodes from ${startDate} to ${endDate}`);
  console.log(`[EpisodeProcessor] Concurrency: ${concurrency}, Force reprocess: ${opts.forceReprocess}`);

  const throwIfAborted = () => {
    if (abortSignal?.aborted) {
      throw new Error('Processing cancelled');
    }
  };

  try {
    throwIfAborted();

    // Phase 1: Discover episodes in date range
    console.log('[EpisodeProcessor] Phase 1: Discovering episodes...');
    const searchResults = await searchFn(startDate, endDate);

    throwIfAborted();

    if (searchResults.length === 0) {
      console.warn('[EpisodeProcessor] No episodes found in date range');
      return {
        episodes: [],
        stats: {
          totalEpisodes: 0,
          cachedEpisodes: 0,
          newlyAnalyzed: 0,
          failed: 0,
          durationMs: performance.now() - startTime
        },
        errors: []
      };
    }

    console.log(`[EpisodeProcessor] Found ${searchResults.length} episodes`);

    // Phase 2: Check cache for existing episodes
    console.log('[EpisodeProcessor] Phase 2: Checking cache...');
    const { cached, uncached, stale } = await categorizeEpisodes(
      searchResults,
      opts.forceReprocess,
      opts.stalenessThresholdDays
    );

    console.log(`[EpisodeProcessor] Cache status: ${cached.length} cached, ${uncached.length} new${stale > 0 ? `, ${stale} stale` : ''}`);

    throwIfAborted();

    // Notify discovery complete
    onDiscoveryComplete(searchResults.length, cached.length, uncached.length);

    // Progress through cached episodes to keep UI aligned
    let completedCount = 0;
    if (cached.length > 0) {
      cached.forEach(ep => {
        completedCount += 1;
        onProgress(
          completedCount,
          searchResults.length,
          ep.title || ep.episode_id,
          true
        );
      });
    }

    // Phase 3: Process uncached episodes in parallel
    const errors: Array<{ episodeId: string; error: string }> = [];
    let newlyAnalyzed: EpisodeInsight[] = [];

    if (uncached.length > 0) {
      console.log(`[EpisodeProcessor] Phase 3: Analyzing ${uncached.length} episodes (concurrency: ${concurrency})...`);

      const analysisResult = await processInParallel(
        uncached,
        async (episodeMetadata) => {
          try {
            const insight = await analyzeFn(
              episodeMetadata.episode_id,
              episodeMetadata,
              opts.frameworkVersion
            );

            // Save to cache immediately
            const normalizedInsight = { ...insight, episode_id: episodeMetadata.episode_id };
            await saveEpisode(normalizedInsight);

            return { success: true, insight: normalizedInsight, error: null };
          } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            console.error(`[EpisodeProcessor] Failed to analyze episode ${episodeMetadata.episode_id}:`, errorMsg);
            return { success: false, insight: null, error: errorMsg };
          }
        },
        concurrency,
        (completed, total, current) => {
          completedCount += 1;
          onProgress(
            completedCount,
            searchResults.length,
            current?.title || 'Unknown episode',
            false // Not cached
          );
        },
        abortSignal
      );

      // Separate successful and failed analyses
      newlyAnalyzed = analysisResult
        .filter(r => r.success && r.insight !== null)
        .map(r => r.insight!);

      const failed = analysisResult.filter(r => !r.success);
      failed.forEach((f, idx) => {
        errors.push({
          episodeId: uncached[idx].episode_id,
          error: f.error || 'Unknown error'
        });
      });

      console.log(`[EpisodeProcessor] Analysis complete: ${newlyAnalyzed.length} succeeded, ${failed.length} failed`);
    } else {
      console.log('[EpisodeProcessor] Phase 3: All episodes cached, skipping analysis');
    }

    throwIfAborted();

    // Combine cached and newly analyzed episodes
    const allEpisodes = [...cached, ...newlyAnalyzed];

    const durationMs = performance.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.log(`[EpisodeProcessor] Processing complete in ${durationSec}s`);
    console.log(`[EpisodeProcessor] Total: ${allEpisodes.length} episodes, ${errors.length} errors`);

    return {
      episodes: allEpisodes,
      stats: {
        totalEpisodes: searchResults.length,
        cachedEpisodes: cached.length,
        newlyAnalyzed: newlyAnalyzed.length,
        failed: errors.length,
        durationMs
      },
      errors
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[EpisodeProcessor] Fatal error during processing:', errorMsg);
    throw new Error(`Episode processing failed: ${errorMsg}`);
  }
}

/**
 * Categorize episodes into cached and uncached
 */
async function categorizeEpisodes(
  searchResults: EpisodeMetadata[],
  forceReprocess: boolean,
  stalenessThresholdDays: number | null | undefined
): Promise<{
  cached: EpisodeInsight[];
  uncached: EpisodeMetadata[];
  stale: number;
}> {
  const cached: EpisodeInsight[] = [];
  const uncached: EpisodeMetadata[] = [];
  let staleCount = 0;

  if (forceReprocess) {
    // Force reprocess: all episodes are uncached
    return { cached: [], uncached: searchResults, stale: 0 };
  }

  // Calculate staleness threshold timestamp if enabled
  const stalenessThreshold = stalenessThresholdDays
    ? Date.now() - (stalenessThresholdDays * 24 * 60 * 60 * 1000)
    : null;

  // Check each episode in cache
  for (const metadata of searchResults) {
    const exists = await episodeExists(metadata.episode_id);

    if (exists) {
      // Retrieve from cache
      const episode = await getEpisode(metadata.episode_id);
      if (episode) {
        // Check if episode is stale (if staleness detection enabled)
        if (stalenessThreshold !== null) {
          const processedAt = new Date(episode.processed_at).getTime();

          if (processedAt < stalenessThreshold) {
            // Episode is stale - treat as uncached
            console.log(`[EpisodeProcessor] Episode ${metadata.episode_id} is stale (processed ${episode.processed_at}), will reprocess`);
            uncached.push(metadata);
            staleCount++;
            continue;
          }
        }

        // Episode is fresh (or staleness check disabled) - use cached version
        cached.push(episode);
      } else {
        // Exists but couldn't retrieve - treat as uncached
        uncached.push(metadata);
      }
    } else {
      uncached.push(metadata);
    }
  }

  return { cached, uncached, stale: staleCount };
}

/**
 * Process items in parallel with concurrency limit
 *
 * Uses a worker pool pattern to limit concurrent operations while
 * maintaining throughput.
 *
 * @param items - Items to process
 * @param processor - Async function to process each item
 * @param concurrency - Maximum concurrent operations
 * @param onProgress - Progress callback (completed, total, current item)
 * @returns Array of processing results
 */
async function processInParallel<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrency: number,
  onProgress?: (completed: number, total: number, current: T | null) => void,
  signal?: AbortSignal
): Promise<R[]> {
  const results: R[] = [];
  const queue = [...items];
  let completed = 0;

  /**
   * Worker function - processes items from queue until empty
   */
  async function worker(): Promise<void> {
    while (queue.length > 0) {
      if (signal?.aborted) break;

      const item = queue.shift();
      if (!item) break;

      try {
        const result = await processor(item);
        results.push(result);
        completed++;

        // Fire progress callback
        if (onProgress) {
          onProgress(completed, items.length, item);
        }

        if (signal?.aborted) break;
      } catch (error) {
        console.error('[ProcessInParallel] Worker error:', error);
        // Error handling is done in processor, this is just a safety net
        completed++;
        if (onProgress) {
          onProgress(completed, items.length, null);
        }
      }
    }
  }

  // Launch worker pool
  const workerCount = Math.min(concurrency, items.length);
  const workers = Array(workerCount)
    .fill(0)
    .map(() => worker());

  // Wait for all workers to complete
  await Promise.all(workers);

  return results;
}

/**
 * Get episodes for a specific week window
 *
 * Helper function to retrieve episodes for a single week, useful when
 * composing weekly reports.
 *
 * @param weekStart - Week start date (YYYY-MM-DD)
 * @param weekEnd - Week end date (YYYY-MM-DD)
 * @returns Array of episodes in the week
 */
export async function getEpisodesForWeek(
  weekStart: string,
  weekEnd: string
): Promise<EpisodeInsight[]> {
  console.log(`[EpisodeProcessor] Retrieving episodes for week ${weekStart} to ${weekEnd}`);

  const episodes = await getEpisodesByDateRange(weekStart, weekEnd);

  console.log(`[EpisodeProcessor] Found ${episodes.length} episodes in week`);

  return episodes;
}

/**
 * Estimate processing time based on episode count and cache status
 *
 * @param totalEpisodes - Total number of episodes
 * @param cachedEpisodes - Number of cached episodes
 * @param concurrency - Concurrency level
 * @returns Estimated duration in seconds
 */
export function estimateProcessingTime(
  totalEpisodes: number,
  cachedEpisodes: number,
  concurrency: number = 10
): number {
  const uncachedEpisodes = totalEpisodes - cachedEpisodes;

  // Assumptions:
  // - Cached episode retrieval: ~10ms per episode
  // - New episode analysis: ~6 seconds per episode
  // - Search overhead: ~2 seconds
  // - Parallel efficiency: ~80% (accounts for network variability)

  const cachedTime = cachedEpisodes * 0.01; // 10ms per cached episode
  const analysisTime = (uncachedEpisodes / concurrency) * 6 * 1.2; // 20% overhead
  const searchTime = 2;

  const totalSeconds = cachedTime + analysisTime + searchTime;

  return Math.ceil(totalSeconds);
}

/**
 * Version Management Functions
 */

/**
 * Get all episodes that need updating to current framework version
 *
 * This identifies episodes that were processed with older framework versions
 * and may need reprocessing to take advantage of improved analysis.
 *
 * @returns Array of episodes with outdated framework versions
 */
export async function getEpisodesNeedingUpdate(): Promise<EpisodeInsight[]> {
  console.log(`[VersionManager] Checking for episodes needing update to ${FRAMEWORK_VERSION}`);

  const allEpisodes = await getAllEpisodes();
  const outdated = allEpisodes.filter(ep => ep.framework_version !== FRAMEWORK_VERSION);

  console.log(`[VersionManager] Found ${outdated.length} episodes with outdated framework versions`);

  return outdated;
}

/**
 * Get count of episodes by framework version
 *
 * Useful for displaying version distribution in UI or analytics.
 *
 * @returns Map of framework version to episode count
 */
export async function getEpisodeCountsByVersion(): Promise<Map<string, number>> {
  console.log('[VersionManager] Calculating episode counts by version');

  const allEpisodes = await getAllEpisodes();
  const versionCounts = new Map<string, number>();

  for (const episode of allEpisodes) {
    const version = episode.framework_version || 'unknown';
    versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
  }

  console.log('[VersionManager] Version distribution:', Object.fromEntries(versionCounts));

  return versionCounts;
}

/**
 * Reprocess episodes with a specific framework version
 *
 * This function allows selective reprocessing of episodes that were analyzed
 * with a specific framework version. Useful when you want to upgrade episodes
 * to a newer framework version.
 *
 * @param targetVersion - Framework version to upgrade TO (default: current version)
 * @param sourceVersion - Framework version to upgrade FROM (default: all non-current versions)
 * @param dateRange - Optional date range to limit reprocessing
 * @param options - Processing options (concurrency, callbacks, etc.)
 * @returns ProcessResult with reprocessing statistics
 *
 * @example
 * // Upgrade all v1.0.0 episodes to current version
 * const result = await reprocessWithFrameworkVersion('v2.0.0', 'v1.0.0');
 *
 * @example
 * // Upgrade all outdated episodes in a date range
 * const result = await reprocessWithFrameworkVersion(
 *   'v2.0.0',
 *   undefined,
 *   { start: '2024-01-01', end: '2024-12-31' }
 * );
 */
export async function reprocessWithFrameworkVersion(
  targetVersion: string = FRAMEWORK_VERSION,
  sourceVersion?: string,
  dateRange?: { start: string; end: string },
  options: ProcessOptions = {}
): Promise<ProcessResult> {
  console.log('[VersionManager] Starting framework version reprocessing');
  console.log(`[VersionManager] Target version: ${targetVersion}`);
  console.log(`[VersionManager] Source version: ${sourceVersion || 'all outdated'}`);
  if (dateRange) {
    console.log(`[VersionManager] Date range: ${dateRange.start} to ${dateRange.end}`);
  }

  const startTime = performance.now();
  const errors: Array<{ episodeId: string; error: string }> = [];

  try {
    // Step 1: Identify episodes to reprocess
    let episodesToReprocess: EpisodeInsight[];

    if (sourceVersion) {
      // Get episodes with specific source version
      episodesToReprocess = await getEpisodesByFrameworkVersion(sourceVersion);
      console.log(`[VersionManager] Found ${episodesToReprocess.length} episodes with version ${sourceVersion}`);
    } else {
      // Get all episodes that need updating
      episodesToReprocess = await getEpisodesNeedingUpdate();
    }

    // Apply date range filter if specified
    if (dateRange) {
      episodesToReprocess = episodesToReprocess.filter(ep => {
        const date = ep.published_at;
        return date >= dateRange.start && date <= dateRange.end;
      });
      console.log(`[VersionManager] After date range filter: ${episodesToReprocess.length} episodes`);
    }

    if (episodesToReprocess.length === 0) {
      console.log('[VersionManager] No episodes need reprocessing');
      return {
        episodes: [],
        stats: {
          totalEpisodes: 0,
          cachedEpisodes: 0,
          newlyAnalyzed: 0,
          failed: 0,
          durationMs: performance.now() - startTime
        },
        errors: []
      };
    }

    // Step 2: Convert EpisodeInsights to EpisodeMetadata for reprocessing
    const metadata: EpisodeMetadata[] = episodesToReprocess.map(ep => ({
      episode_id: ep.episode_id,
      show_name: ep.show_name,
      title: ep.title,
      published_at: ep.published_at,
      transcript_url: ep.transcript_url || undefined
    }));

    console.log(`[VersionManager] Reprocessing ${metadata.length} episodes with framework version ${targetVersion}`);

    // Step 3: Process episodes in parallel with target framework version
    const opts = {
      ...DEFAULT_OPTIONS,
      ...options,
      frameworkVersion: targetVersion,
      forceReprocess: true // Force reprocessing even if cached
    };

    const newlyAnalyzed: EpisodeInsight[] = [];
    let completedCount = 0;

    const analysisResult = await processInParallel(
      metadata,
      async (episodeMetadata) => {
        try {
          const insight = await analyzeEpisode(
            episodeMetadata.episode_id,
            episodeMetadata,
            targetVersion
          );

          // Save to cache immediately
          await saveEpisode(insight);

          return { success: true, insight, error: null };
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`[VersionManager] Failed to reprocess episode ${episodeMetadata.episode_id}:`, errorMsg);
          return { success: false, insight: null, error: errorMsg };
        }
      },
      opts.concurrency ?? 10,
      (completed, total, current) => {
        completedCount = completed;
        if (opts.onProgress) {
          opts.onProgress(
            completed,
            total,
            current?.title || 'Unknown episode',
            false // Not cached (reprocessing)
          );
        }
      },
      opts.signal
    );

    // Separate successful and failed analyses
    const successful = analysisResult.filter(r => r.success && r.insight !== null);
    newlyAnalyzed.push(...successful.map(r => r.insight!));

    const failed = analysisResult.filter(r => !r.success);
    failed.forEach((f, idx) => {
      errors.push({
        episodeId: metadata[idx].episode_id,
        error: f.error || 'Unknown error'
      });
    });

    const durationMs = performance.now() - startTime;
    const durationSec = (durationMs / 1000).toFixed(2);

    console.log(`[VersionManager] Reprocessing complete in ${durationSec}s`);
    console.log(`[VersionManager] Successfully updated ${successful.length} episodes to version ${targetVersion}`);
    console.log(`[VersionManager] Failed: ${failed.length} episodes`);

    return {
      episodes: newlyAnalyzed,
      stats: {
        totalEpisodes: metadata.length,
        cachedEpisodes: 0,
        newlyAnalyzed: successful.length,
        failed: failed.length,
        durationMs
      },
      errors
    };

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('[VersionManager] Fatal error during reprocessing:', errorMsg);
    throw new Error(`Framework version reprocessing failed: ${errorMsg}`);
  }
}

/**
 * Upgrade a single episode to current framework version
 *
 * @param episodeId - Episode ID to upgrade
 * @returns Updated EpisodeInsight
 */
export async function upgradeEpisodeToCurrentVersion(
  episodeId: string
): Promise<EpisodeInsight> {
  console.log(`[VersionManager] Upgrading episode ${episodeId} to version ${FRAMEWORK_VERSION}`);

  const existingEpisode = await getEpisode(episodeId);
  if (!existingEpisode) {
    throw new Error(`Episode ${episodeId} not found in database`);
  }

  // Convert to metadata for reprocessing
  const metadata: EpisodeMetadata = {
    episode_id: existingEpisode.episode_id,
    show_name: existingEpisode.show_name,
    title: existingEpisode.title,
    published_at: existingEpisode.published_at,
    transcript_url: existingEpisode.transcript_url || undefined
  };

  // Reanalyze with current framework version
  const updated = await analyzeEpisode(episodeId, metadata, FRAMEWORK_VERSION);

  // Save updated version
  await saveEpisode(updated);

  console.log(`[VersionManager] Episode ${episodeId} successfully upgraded to ${FRAMEWORK_VERSION}`);

  return updated;
}
