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
  getEpisode
} from './episodeDB';

/**
 * Options for episode processing
 */
export interface ProcessOptions {
  /** Maximum number of concurrent episode analyses (default: 10) */
  concurrency?: number;

  /** Force reprocessing of all episodes, even if cached (default: false) */
  forceReprocess?: boolean;

  /** Framework version to use for new analyses (default: "v2") */
  frameworkVersion?: string;

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
  frameworkVersion: 'v2',
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
    const searchResults = await searchEpisodesInRange(startDate, endDate);

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
    const { cached, uncached } = await categorizeEpisodes(
      searchResults,
      opts.forceReprocess
    );

    console.log(`[EpisodeProcessor] Cache status: ${cached.length} cached, ${uncached.length} new`);

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
            const insight = await analyzeEpisode(
              episodeMetadata.episode_id,
              episodeMetadata,
              opts.frameworkVersion
            );

            // Save to cache immediately
            await saveEpisode(insight);

            return { success: true, insight, error: null };
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
  forceReprocess: boolean
): Promise<{
  cached: EpisodeInsight[];
  uncached: EpisodeMetadata[];
}> {
  const cached: EpisodeInsight[] = [];
  const uncached: EpisodeMetadata[] = [];

  if (forceReprocess) {
    // Force reprocess: all episodes are uncached
    return { cached: [], uncached: searchResults };
  }

  // Check each episode in cache
  for (const metadata of searchResults) {
    const exists = await episodeExists(metadata.episode_id);

    if (exists) {
      // Retrieve from cache
      const episode = await getEpisode(metadata.episode_id);
      if (episode) {
        cached.push(episode);
      } else {
        // Exists but couldn't retrieve - treat as uncached
        uncached.push(metadata);
      }
    } else {
      uncached.push(metadata);
    }
  }

  return { cached, uncached };
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
