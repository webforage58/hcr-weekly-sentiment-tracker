/**
 * Performance Benchmarking Suite (Phase 5 / Task 5.1)
 *
 * Browser-run benchmarks that exercise the real episode pipeline while
 * using mocked episode discovery + analysis (no network / no Gemini calls).
 *
 * HOW TO USE:
 * 1. Start dev server: `npm run dev`
 * 2. Open browser console
 * 3. Run:
 *    - await window.performanceBenchTests.runAll({ mode: 'fast' })
 *    - await window.performanceBenchTests.bench24Weeks({ mode: 'realistic' })
 *    - await window.performanceBenchTests.bench52WeeksIncremental({ mode: 'fast' })
 *    - await window.performanceBenchTests.benchAggregationSpeed({ mode: 'fast' })
 */

import { processEpisodesInRange } from './services/episodeProcessor';
import { composeWeeklyReport } from './services/reportComposer';
import { getWeekWindows } from './utils/reportUtils';
import {
  clearAllEpisodes,
  clearAllWeeklyAggregations,
  clearAllSearchCache,
  getEpisodeCount,
  getWeeklyAggregationCount,
  getStorageEstimate
} from './services/episodeDB';
import { loadConfig, saveConfig, refreshConfig } from './constants/config';
import type { EpisodeInsight, EpisodeMetadata } from './types';

type BenchmarkMode = 'fast' | 'realistic';

interface BenchTimings {
  discoveryMs: number;
  analysisMs: number;
  compositionMs: number;
  totalMs: number;
}

interface BenchRunResult {
  mode: BenchmarkMode;
  dateRange: { start: string; end: string };
  episodesPerWeek: number;
  concurrency: number;
  mockDelaysMs: { searchMs: number; analysisMs: number };
  episodeProcessing: {
    durationMs: number;
    totalEpisodes: number;
    cachedEpisodes: number;
    newlyAnalyzed: number;
    failed: number;
    mockAnalyzeCalls: number;
  };
  weeklyComposition: {
    weeks: number;
    durationMs: number;
    cachedWeekHitsApprox: number;
    weeklyAggregationsInDb: number;
  };
  storageEstimate: {
    before: { usage: number; quota: number; percentage: number } | null;
    after: { usage: number; quota: number; percentage: number } | null;
  };
  memoryEstimate: {
    jsHeapUsedBytes: number | null;
    jsHeapTotalBytes: number | null;
  };
  timings: BenchTimings;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function getMemoryEstimate(): { jsHeapUsedBytes: number | null; jsHeapTotalBytes: number | null } {
  const anyPerf = performance as any;
  if (!anyPerf?.memory) {
    return { jsHeapUsedBytes: null, jsHeapTotalBytes: null };
  }
  return {
    jsHeapUsedBytes: typeof anyPerf.memory.usedJSHeapSize === 'number' ? anyPerf.memory.usedJSHeapSize : null,
    jsHeapTotalBytes: typeof anyPerf.memory.totalJSHeapSize === 'number' ? anyPerf.memory.totalJSHeapSize : null
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildMockEpisodes(
  startDate: string,
  endDate: string,
  episodesPerWeek: number
): EpisodeMetadata[] {
  const shows = [
    'This Week in Politics',
    'Politics Chat',
    'American Conversations',
    'What the Heck Just Happened'
  ];

  const windows = getWeekWindows(startDate, endDate);
  const offsets = [1, 3, 5, 2, 4];

  const episodes: EpisodeMetadata[] = [];

  windows.forEach((w, weekIndex) => {
    for (let i = 0; i < episodesPerWeek; i++) {
      const published_at = addDaysYmd(w.start, offsets[i % offsets.length]);
      if (published_at < startDate || published_at > endDate) continue;

      const show_name = shows[(weekIndex + i) % shows.length];
      const showSlug = slugify(show_name);
      const episode_id = `mock-${showSlug}-${published_at}-${weekIndex}-${i}`;

      episodes.push({
        episode_id,
        show_name,
        title: `${show_name} — ${published_at}`,
        published_at,
        transcript_url: `https://example.com/${episode_id}`
      });
    }
  });

  // Deterministic ordering helps repeatability
  episodes.sort((a, b) => a.published_at.localeCompare(b.published_at) || a.episode_id.localeCompare(b.episode_id));
  return episodes;
}

function createMockSearchEpisodesInRange(options: {
  episodesPerWeek: number;
  delayMs: number;
}): (startDate: string, endDate: string) => Promise<EpisodeMetadata[]> {
  return async (startDate, endDate) => {
    if (options.delayMs > 0) await delay(options.delayMs);
    return buildMockEpisodes(startDate, endDate, options.episodesPerWeek);
  };
}

function pickTopicsForEpisode(episodeId: string) {
  const topics = [
    'Immigration Policy',
    'Healthcare Reform',
    'Federal Shutdown',
    'Election Integrity',
    'Ukraine Aid',
    'Supreme Court',
    'Voting Rights',
    'Tax Policy'
  ];

  const hash = Array.from(episodeId).reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const pick = (idx: number) => topics[(hash + idx * 101) % topics.length];

  return [pick(0), pick(1), pick(2)];
}

function createMockAnalyzeEpisode(options: {
  delayMs: number;
  modelUsed?: string;
}): {
  analyze: (episodeId: string, meta: EpisodeMetadata, frameworkVersion?: string) => Promise<EpisodeInsight>;
  getCallCount: () => number;
} {
  let callCount = 0;

  const analyze = async (
    episodeId: string,
    meta: EpisodeMetadata,
    frameworkVersion: string = 'mock'
  ): Promise<EpisodeInsight> => {
    callCount += 1;
    if (options.delayMs > 0) await delay(options.delayMs);

    const [t1, t2, t3] = pickTopicsForEpisode(episodeId);
    const base = (episodeId.length * 13) % 40;

    return {
      episode_id: episodeId,
      show_name: meta.show_name,
      title: meta.title,
      published_at: meta.published_at,
      transcript_url: meta.transcript_url,
      topics: [
        {
          topic_name: t1,
          sentiment_score: 35 + base,
          confidence: 0.85,
          evidence_quotes: [`Evidence for ${t1} (${episodeId})`],
          prominence_score: 0.7
        },
        {
          topic_name: t2,
          sentiment_score: 45 + (base % 20),
          confidence: 0.8,
          evidence_quotes: [`Evidence for ${t2} (${episodeId})`],
          prominence_score: 0.55
        },
        {
          topic_name: t3,
          sentiment_score: 55 + (base % 15),
          confidence: 0.75,
          evidence_quotes: [`Evidence for ${t3} (${episodeId})`],
          prominence_score: 0.4
        }
      ],
      overall_sentiment: 45 + (base % 25),
      trump_admin_focus: true,
      key_quotes: [`Key quote (${episodeId})`],
      framework_version: frameworkVersion,
      processed_at: new Date().toISOString(),
      model_used: options.modelUsed ?? 'mock-gemini'
    };
  };

  return {
    analyze,
    getCallCount: () => callCount
  };
}

async function clearAllCaches(): Promise<void> {
  await clearAllEpisodes();
  await clearAllWeeklyAggregations();
  await clearAllSearchCache();
}

async function withTempConfig<T>(mutate: (config: ReturnType<typeof loadConfig>) => ReturnType<typeof loadConfig>, fn: () => Promise<T>): Promise<T> {
  const original = loadConfig();
  try {
    const next = mutate(original);
    saveConfig(next);
    refreshConfig();
    return await fn();
  } finally {
    saveConfig(original);
    refreshConfig();
  }
}

function modeToMockDelays(mode: BenchmarkMode): { searchMs: number; analysisMs: number } {
  if (mode === 'realistic') {
    return { searchMs: 2000, analysisMs: 6000 };
  }
  return { searchMs: 25, analysisMs: 75 };
}

async function runPipelineBenchmark(options: {
  startDate: string;
  endDate: string;
  episodesPerWeek: number;
  concurrency: number;
  mode: BenchmarkMode;
  includeWarmRerun?: boolean;
}): Promise<BenchRunResult> {
  const { searchMs, analysisMs } = modeToMockDelays(options.mode);

  const mockSearch = createMockSearchEpisodesInRange({
    episodesPerWeek: options.episodesPerWeek,
    delayMs: searchMs
  });
  const mockAnalyzer = createMockAnalyzeEpisode({ delayMs: analysisMs });

  return await withTempConfig(
    (config) => ({
      ...config,
      features: {
        ...config.features,
        enableAIExecutiveSummary: false
      },
      caching: {
        ...config.caching,
        enableWeeklyAggregationCache: true
      }
    }),
    async () => {
      await clearAllCaches();

      const storageBefore = await getStorageEstimate();
      const memoryBefore = getMemoryEstimate();

      const pipelineStart = performance.now();

      // Phase 1: Episode processing (discovery + cached check + analysis)
      const epStart = performance.now();
      const processResult = await processEpisodesInRange(options.startDate, options.endDate, {
        concurrency: options.concurrency,
        deps: {
          searchEpisodesInRange: mockSearch,
          analyzeEpisode: mockAnalyzer.analyze
        }
      });
      const epDurationMs = performance.now() - epStart;

      // Phase 2: Weekly report composition (same as UI loop)
      const windows = getWeekWindows(options.startDate, options.endDate);
      const composeStart = performance.now();
      for (const w of windows) {
        await composeWeeklyReport(w.start, w.end, w.priorStart, w.priorEnd);
      }
      const composeDurationMs = performance.now() - composeStart;

      const totalMs = performance.now() - pipelineStart;
      const storageAfter = await getStorageEstimate();
      const memoryAfter = getMemoryEstimate();

      const episodesInDb = await getEpisodeCount();
      const weeklyAggCount = await getWeeklyAggregationCount();

      // Approximate weekly cache hit rate by running a second pass if requested
      let cachedWeekHitsApprox = 0;
      if (options.includeWarmRerun) {
        const beforeAgg = await getWeeklyAggregationCount();
        const warmComposeStart = performance.now();
        for (const w of windows) {
          await composeWeeklyReport(w.start, w.end, w.priorStart, w.priorEnd);
        }
        const warmComposeMs = performance.now() - warmComposeStart;
        const afterAgg = await getWeeklyAggregationCount();

        // Cache should already exist for each week; count unchanged means "hit"
        cachedWeekHitsApprox = Math.max(0, Math.min(windows.length, afterAgg - beforeAgg === 0 ? windows.length : 0));

        console.log(
          `[PerformanceBench] Warm composition pass: ${warmComposeMs.toFixed(2)}ms for ${windows.length} weeks`
        );
      }

      const discoveryMs = searchMs; // simulated; included in episode processing timing
      const analysisMsTotal = epDurationMs;
      const compositionMs = composeDurationMs;

      console.log('\n=== Performance Benchmark Result ===');
      console.log(`Range: ${options.startDate} → ${options.endDate}`);
      console.log(`Mode: ${options.mode} (mock search ${searchMs}ms, analysis ${analysisMs}ms/episode)`);
      console.log(
        `Episodes: total ${processResult.stats.totalEpisodes}, cached ${processResult.stats.cachedEpisodes}, new ${processResult.stats.newlyAnalyzed}, failed ${processResult.stats.failed}`
      );
      console.log(`Mock analyze calls: ${mockAnalyzer.getCallCount()}`);
      console.log(`Episode processing: ${epDurationMs.toFixed(2)}ms`);
      console.log(`Weekly composition (${windows.length} weeks): ${composeDurationMs.toFixed(2)}ms`);
      console.log(`Total pipeline: ${totalMs.toFixed(2)}ms`);
      if (storageAfter && storageBefore) {
        console.log(
          `Storage: ${formatBytes(storageBefore.usage)} → ${formatBytes(storageAfter.usage)} ` +
          `(${storageAfter.percentage.toFixed(2)}% of quota)`
        );
      } else if (storageAfter) {
        console.log(`Storage: ${formatBytes(storageAfter.usage)} (${storageAfter.percentage.toFixed(2)}% of quota)`);
      }
      if (memoryAfter.jsHeapUsedBytes !== null) {
        console.log(
          `JS Heap: ${formatBytes(memoryAfter.jsHeapUsedBytes)} / ${formatBytes(memoryAfter.jsHeapTotalBytes ?? 0)}`
        );
      }

      return {
        mode: options.mode,
        dateRange: { start: options.startDate, end: options.endDate },
        episodesPerWeek: options.episodesPerWeek,
        concurrency: options.concurrency,
        mockDelaysMs: { searchMs, analysisMs },
        episodeProcessing: {
          durationMs: epDurationMs,
          totalEpisodes: processResult.stats.totalEpisodes,
          cachedEpisodes: processResult.stats.cachedEpisodes,
          newlyAnalyzed: processResult.stats.newlyAnalyzed,
          failed: processResult.stats.failed,
          mockAnalyzeCalls: mockAnalyzer.getCallCount()
        },
        weeklyComposition: {
          weeks: windows.length,
          durationMs: composeDurationMs,
          cachedWeekHitsApprox,
          weeklyAggregationsInDb: weeklyAggCount
        },
        storageEstimate: {
          before: storageBefore,
          after: storageAfter
        },
        memoryEstimate: memoryAfter,
        timings: {
          discoveryMs,
          analysisMs: analysisMsTotal,
          compositionMs,
          totalMs
        }
      };
    }
  );
}

async function bench24Weeks(options?: { mode?: BenchmarkMode; episodesPerWeek?: number; concurrency?: number }) {
  const mode = options?.mode ?? 'fast';
  const episodesPerWeek = options?.episodesPerWeek ?? 2;
  const concurrency = options?.concurrency ?? 10;

  // 24 weeks ≈ 168 days
  const startDate = '2025-01-01';
  const endDate = '2025-06-18';

  console.log('\n=== Bench: 24-week cold run ===');
  const cold = await runPipelineBenchmark({
    startDate,
    endDate,
    episodesPerWeek,
    concurrency,
    mode,
    includeWarmRerun: false
  });

  console.log('\n=== Bench: 24-week warm rerun (cache) ===');
  // Warm rerun: do NOT clear caches, but reuse mocks to ensure we never call real network.
  // We run this as a separate pipeline run without clearing caches by calling processEpisodesInRange directly.
  const { searchMs, analysisMs } = modeToMockDelays(mode);
  const mockSearch = createMockSearchEpisodesInRange({ episodesPerWeek, delayMs: searchMs });
  const mockAnalyzer = createMockAnalyzeEpisode({ delayMs: analysisMs });

  const warm = await withTempConfig(
    (config) => ({
      ...config,
      features: { ...config.features, enableAIExecutiveSummary: false },
      caching: { ...config.caching, enableWeeklyAggregationCache: true }
    }),
    async () => {
      const storageBefore = await getStorageEstimate();
      const start = performance.now();
      const result = await processEpisodesInRange(startDate, endDate, {
        concurrency,
        deps: {
          searchEpisodesInRange: mockSearch,
          analyzeEpisode: mockAnalyzer.analyze
        }
      });
      const durationMs = performance.now() - start;
      const storageAfter = await getStorageEstimate();

      console.log(
        `Warm episode processing: ${durationMs.toFixed(2)}ms ` +
        `(cached ${result.stats.cachedEpisodes}/${result.stats.totalEpisodes}, analyze calls ${mockAnalyzer.getCallCount()})`
      );

      return {
        durationMs,
        stats: result.stats,
        analyzeCalls: mockAnalyzer.getCallCount(),
        storage: { before: storageBefore, after: storageAfter }
      };
    }
  );

  return { cold, warm };
}

async function bench52WeeksIncremental(options?: { mode?: BenchmarkMode; episodesPerWeek?: number; concurrency?: number }) {
  const mode = options?.mode ?? 'fast';
  const episodesPerWeek = options?.episodesPerWeek ?? 2;
  const concurrency = options?.concurrency ?? 10;

  const baseStart = '2025-01-01';
  const baseEnd24w = '2025-06-18';
  const end52w = '2025-12-31';

  console.log('\n=== Bench: 24 weeks (populate cache) ===');
  await runPipelineBenchmark({
    startDate: baseStart,
    endDate: baseEnd24w,
    episodesPerWeek,
    concurrency,
    mode,
    includeWarmRerun: false
  });

  console.log('\n=== Bench: extend to 52 weeks (incremental) ===');
  // Extend range; cached episodes should be reused, and only new weeks analyzed.
  const { searchMs, analysisMs } = modeToMockDelays(mode);
  const mockSearch = createMockSearchEpisodesInRange({ episodesPerWeek, delayMs: searchMs });
  const mockAnalyzer = createMockAnalyzeEpisode({ delayMs: analysisMs });

  return await withTempConfig(
    (config) => ({
      ...config,
      features: { ...config.features, enableAIExecutiveSummary: false },
      caching: { ...config.caching, enableWeeklyAggregationCache: true }
    }),
    async () => {
      const start = performance.now();
      const result = await processEpisodesInRange(baseStart, end52w, {
        concurrency,
        deps: {
          searchEpisodesInRange: mockSearch,
          analyzeEpisode: mockAnalyzer.analyze
        }
      });
      const durationMs = performance.now() - start;

      console.log(
        `Incremental processing: ${durationMs.toFixed(2)}ms ` +
        `(cached ${result.stats.cachedEpisodes}/${result.stats.totalEpisodes}, new ${result.stats.newlyAnalyzed}, analyze calls ${mockAnalyzer.getCallCount()})`
      );
      return { durationMs, stats: result.stats, analyzeCalls: mockAnalyzer.getCallCount() };
    }
  );
}

async function benchAggregationSpeed(options?: { mode?: BenchmarkMode; episodesPerWeek?: number }) {
  const mode = options?.mode ?? 'fast';
  const episodesPerWeek = options?.episodesPerWeek ?? 2;

  const startDate = '2025-01-01';
  const endDate = '2025-06-18';

  console.log('\n=== Bench: Aggregation speed (composeWeeklyReport) ===');
  return await runPipelineBenchmark({
    startDate,
    endDate,
    episodesPerWeek,
    concurrency: 10,
    mode,
    includeWarmRerun: true
  });
}

async function runAll(options?: { mode?: BenchmarkMode }) {
  const mode = options?.mode ?? 'fast';
  const result24 = await bench24Weeks({ mode });
  const result52 = await bench52WeeksIncremental({ mode });
  const aggregation = await benchAggregationSpeed({ mode });

  return { result24, result52, aggregation };
}

// Expose in browser console
(window as any).performanceBenchTests = {
  bench24Weeks,
  bench52WeeksIncremental,
  benchAggregationSpeed,
  runAll
};

