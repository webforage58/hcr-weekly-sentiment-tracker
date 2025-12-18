import type { AppConfig } from '../constants/config';
import type { ProcessResult } from '../services/episodeProcessor';
import type { HCRReport } from '../types';
import { getEpisodeCount, getStorageEstimate, getWeeklyAggregationCount } from '../services/episodeDB';

type RunLabel = 'cold' | 'warm';

export interface RealWorldRunLoggerContext {
  startDate: string;
  endDate: string;
  weeksTotal: number;
  frameworkVersion?: string;
  configSnapshot?: Pick<AppConfig, 'processing' | 'caching' | 'features'>;
}

interface StorageSnapshot {
  usage: number;
  quota: number;
  percentage: number;
}

interface DbCountsSnapshot {
  episodes: number;
  weeklyAggregations: number;
}

interface MemorySnapshot {
  supported: boolean;
  sampleIntervalMs: number;
  peakUsedBytes: number | null;
  finalUsedBytes: number | null;
}

interface RunSnapshot {
  label: RunLabel;
  context: RealWorldRunLoggerContext;
  startedAtIso: string;
  endedAtIso: string | null;
  durationsMs: {
    total: number | null;
    episodeProcessing: number | null;
    weeklyComposition: number | null;
  };
  episodeProcessing: {
    stats: ProcessResult['stats'] | null;
    errors: ProcessResult['errors'] | null;
  };
  weeklyComposition: {
    weeksComposed: number | null;
    weeksWithoutEpisodes: number | null;
  };
  storage: { before: StorageSnapshot | null; after: StorageSnapshot | null };
  dbCounts: { before: DbCountsSnapshot | null; after: DbCountsSnapshot | null };
  memory: MemorySnapshot;
  fatalError: string | null;
}

export interface RealWorld52WeekTestLogger {
  arm(label: RunLabel): void;
  beginIfArmed(context: RealWorldRunLoggerContext): Promise<RunLabel | null>;
  recordEpisodeProcessing(label: RunLabel, result: ProcessResult, durationMs: number): void;
  recordWeeklyComposition(label: RunLabel, reports: HCRReport[], durationMs: number): void;
  finish(label: RunLabel): Promise<void>;
  fail(label: RunLabel, error: unknown): Promise<void>;
  reset(): void;
  getStateMdChecklistBlock(): string;
  printStateMdChecklistBlock(): void;
}

const GLOBAL_LOGGER_KEY = '__HCR_REAL_WORLD_52_WEEK_LOGGER__';

declare global {
  interface Window {
    __HCR_REAL_WORLD_52_WEEK_LOGGER__?: RealWorld52WeekTestLogger;
  }
}

export function setActiveRealWorld52WeekTestLogger(logger: RealWorld52WeekTestLogger | null): void {
  if (typeof window === 'undefined') return;
  if (logger) {
    (window as any)[GLOBAL_LOGGER_KEY] = logger;
  } else {
    delete (window as any)[GLOBAL_LOGGER_KEY];
  }
}

export function getActiveRealWorld52WeekTestLogger(): RealWorld52WeekTestLogger | null {
  if (typeof window === 'undefined') return null;
  return (window as any)[GLOBAL_LOGGER_KEY] ?? null;
}

function formatBytes(bytes: number | null): string {
  if (!Number.isFinite(bytes ?? NaN)) return 'unknown';
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes as number;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function formatSeconds(ms: number | null): string {
  if (ms === null) return 'unknown';
  return `${(ms / 1000).toFixed(2)}s`;
}

function checkbox(checked: boolean): string {
  return checked ? '[x]' : '[ ]';
}

function getMemoryUsedBytes(): number | null {
  const anyPerf = performance as any;
  if (!anyPerf?.memory) return null;
  const used = anyPerf.memory.usedJSHeapSize;
  return typeof used === 'number' ? used : null;
}

function createEmptyRun(label: RunLabel, context: RealWorldRunLoggerContext): RunSnapshot {
  return {
    label,
    context,
    startedAtIso: new Date().toISOString(),
    endedAtIso: null,
    durationsMs: { total: null, episodeProcessing: null, weeklyComposition: null },
    episodeProcessing: { stats: null, errors: null },
    weeklyComposition: { weeksComposed: null, weeksWithoutEpisodes: null },
    storage: { before: null, after: null },
    dbCounts: { before: null, after: null },
    memory: {
      supported: getMemoryUsedBytes() !== null,
      sampleIntervalMs: 1000,
      peakUsedBytes: null,
      finalUsedBytes: null
    },
    fatalError: null
  };
}

async function snapshotStorage(): Promise<StorageSnapshot | null> {
  const estimate = await getStorageEstimate();
  if (!estimate) return null;
  return estimate;
}

async function snapshotDbCounts(): Promise<DbCountsSnapshot | null> {
  try {
    const [episodes, weeklyAggregations] = await Promise.all([
      getEpisodeCount(),
      getWeeklyAggregationCount()
    ]);
    return { episodes, weeklyAggregations };
  } catch {
    return null;
  }
}

export function createRealWorld52WeekTestLogger(options?: { memorySampleIntervalMs?: number }): RealWorld52WeekTestLogger {
  let armedLabel: RunLabel | null = null;
  const runs: Record<RunLabel, RunSnapshot | null> = { cold: null, warm: null };
  let activeLabel: RunLabel | null = null;
  let totalStartPerfMs: number | null = null;
  let memoryTimer: number | null = null;

  const memorySampleIntervalMs = options?.memorySampleIntervalMs ?? 1000;

  function stopMemorySampling(run: RunSnapshot) {
    if (memoryTimer !== null) {
      window.clearInterval(memoryTimer);
      memoryTimer = null;
    }
    run.memory.finalUsedBytes = getMemoryUsedBytes();
  }

  function startMemorySampling(run: RunSnapshot) {
    const supported = getMemoryUsedBytes() !== null;
    run.memory.supported = supported;
    run.memory.sampleIntervalMs = memorySampleIntervalMs;
    if (!supported) return;

    run.memory.peakUsedBytes = getMemoryUsedBytes();
    if (memoryTimer !== null) window.clearInterval(memoryTimer);
    memoryTimer = window.setInterval(() => {
      const used = getMemoryUsedBytes();
      if (typeof used !== 'number') return;
      if (run.memory.peakUsedBytes === null || used > run.memory.peakUsedBytes) {
        run.memory.peakUsedBytes = used;
      }
    }, memorySampleIntervalMs);
  }

  function getRunOrThrow(label: RunLabel): RunSnapshot {
    const run = runs[label];
    if (!run) throw new Error(`Run "${label}" not started`);
    return run;
  }

  function renderRunChecklist(run: RunSnapshot): string {
    const stats = run.episodeProcessing.stats;
    const errors = run.episodeProcessing.errors ?? [];

    const totalEpisodes = stats?.totalEpisodes ?? null;
    const cachedEpisodes = stats?.cachedEpisodes ?? null;
    const newlyAnalyzed = stats?.newlyAnalyzed ?? null;

    const approxEpisodeApiCalls = newlyAnalyzed ?? null;
    const approxSearchApiCalls = run.label === 'cold' ? 1 : 0;
    const approxSummaryCalls =
      run.context.configSnapshot?.features.enableAIExecutiveSummary
        ? run.context.weeksTotal
        : 0;
    const approxTotalApiCalls =
      approxEpisodeApiCalls === null
        ? null
        : approxEpisodeApiCalls + approxSearchApiCalls + approxSummaryCalls;

    const completedSuccessfully = run.fatalError === null && run.endedAtIso !== null;
    const noEpisodeErrors = (stats?.failed ?? 0) === 0;
    const cacheHitRate =
      totalEpisodes && cachedEpisodes !== null ? `${((cachedEpisodes / totalEpisodes) * 100).toFixed(1)}%` : 'unknown';

    const storageAfter = run.storage.after?.usage ?? null;
    const storageBefore = run.storage.before?.usage ?? null;
    const storageDelta =
      storageAfter !== null && storageBefore !== null ? storageAfter - storageBefore : null;

    const labelTitle = run.label === 'cold' ? 'First Run (Cold Cache)' : 'Second Run (Warm Cache)';
    const timeTarget = run.label === 'cold' ? 90 : 5;
    const timeElapsedSec = run.durationsMs.total !== null ? run.durationsMs.total / 1000 : null;
    const meetsTimeTarget = timeElapsedSec !== null ? timeElapsedSec <= timeTarget : false;

    const expectedApiLine =
      run.label === 'cold'
        ? 'expected: ~100 (1 search + ~1 per uncached episode)'
        : 'expected: 0 (fully cached)';

    const memoryPeakLine =
      run.memory.supported && run.memory.peakUsedBytes !== null
        ? `${formatBytes(run.memory.peakUsedBytes)} (sampled)`
        : 'See browser DevTools (peak)';

    return [
      `**${labelTitle}**:`,
      `- ${checkbox(completedSuccessfully)} Analysis completed successfully`,
      `- [ ] Started at (UTC): ${run.startedAtIso}`,
      `- [ ] Ended at (UTC): ${run.endedAtIso ?? 'unknown'}`,
      `- ${checkbox(meetsTimeTarget)} Time elapsed: ${formatSeconds(run.durationsMs.total)} (target: <${timeTarget}s)`,
      `  - breakdown: episode_processing=${formatSeconds(run.durationsMs.episodeProcessing)}, weekly_composition=${formatSeconds(run.durationsMs.weeklyComposition)}`,
      `- ${checkbox(approxTotalApiCalls !== null)} API calls made (approx): ${approxTotalApiCalls ?? 'unknown'} (${expectedApiLine})`,
      `  - breakdown: search=${approxSearchApiCalls}, episode_analysis=${approxEpisodeApiCalls ?? 'unknown'}, exec_summary=${approxSummaryCalls}`,
      `- ${checkbox(storageAfter !== null)} Storage used: ${storageAfter !== null ? formatBytes(storageAfter) : 'unknown'} ` +
        `(Δ ${storageDelta !== null ? formatBytes(storageDelta) : 'unknown'}, target: <15MB)`,
      `- [ ] Memory peak: ${memoryPeakLine}`,
      `- ${checkbox(run.weeklyComposition.weeksComposed !== null)} All ${run.context.weeksTotal} weeks have reports: ` +
        `${run.weeklyComposition.weeksComposed === run.context.weeksTotal ? 'Yes' : 'No/Unknown'}`,
      `- ${checkbox(noEpisodeErrors)} No episode processing errors: ${noEpisodeErrors ? 'Yes' : 'No'} ` +
        `${errors.length > 0 ? `(failed=${errors.length})` : ''}`,
      run.label === 'warm'
        ? `- [ ] Cache hit rate (episodes): ${cacheHitRate}`
        : ''
    ]
      .filter(Boolean)
      .join('\n');
  }

  function renderChecklistBlock(): string {
    const cold = runs.cold;
    const warm = runs.warm;
    const context = cold?.context ?? warm?.context ?? null;
    const testDate = new Date().toISOString().slice(0, 10);

    const configLine = context?.configSnapshot
      ? `concurrency=${context.configSnapshot.processing.concurrency}, weeklyCache=${context.configSnapshot.caching.enableWeeklyAggregationCache}, aiSummary=${context.configSnapshot.features.enableAIExecutiveSummary}`
      : 'unknown';

    const header = [
      '### 52-Week Test Results',
      '',
      `**Test Date**: ${testDate}`,
      context ? `**Date Range**: ${context.startDate} to ${context.endDate}` : `**Date Range**: YYYY-MM-DD to YYYY-MM-DD`,
      context ? `**Weeks**: ${context.weeksTotal}` : '**Weeks**: 52',
      `**Config**: ${configLine}`,
      ''
    ].join('\n');

    const coldIntro = cold?.episodeProcessing.stats
      ? `**Episodes Analyzed**: ${cold.episodeProcessing.stats.totalEpisodes} (new ${cold.episodeProcessing.stats.newlyAnalyzed}, cached ${cold.episodeProcessing.stats.cachedEpisodes})`
      : '**Episodes Analyzed**: X';

    const sections: string[] = [
      header,
      coldIntro,
      ''
    ];

    if (cold) {
      sections.push(renderRunChecklist(cold));
    } else {
      sections.push('**First Run (Cold Cache)**:\n- [ ] (run not recorded yet)');
    }

    sections.push('');

    if (warm) {
      sections.push(renderRunChecklist(warm));
    } else {
      sections.push('**Second Run (Warm Cache)**:\n- [ ] (run not recorded yet)');
    }

    sections.push('');
    sections.push('**UI Performance**:');
    sections.push('- [ ] Dashboard renders smoothly with 52 weeks');
    sections.push('- [ ] Chart interactions responsive');
    sections.push('- [ ] Export completes without freezing');
    sections.push('- [ ] Import loads 52-week report correctly');

    return sections.join('\n');
  }

  function printChecklistBlock() {
    const block = renderChecklistBlock();
    console.log('\n===== BEGIN state.md checklist block =====\n');
    console.log(block);
    console.log('\n===== END state.md checklist block =====\n');
  }

  async function beginIfArmed(context: RealWorldRunLoggerContext): Promise<RunLabel | null> {
    if (armedLabel === null) return null;
    const label = armedLabel;
    armedLabel = null;
    activeLabel = label;

    const run = createEmptyRun(label, context);
    runs[label] = run;

    try {
      run.storage.before = await snapshotStorage();
      run.dbCounts.before = await snapshotDbCounts();
    } catch {
      // Best-effort snapshots only
    }

    startMemorySampling(run);
    totalStartPerfMs = performance.now();
    return label;
  }

  function recordEpisodeProcessing(label: RunLabel, result: ProcessResult, durationMs: number): void {
    const run = getRunOrThrow(label);
    run.episodeProcessing.stats = result.stats;
    run.episodeProcessing.errors = result.errors;
    run.durationsMs.episodeProcessing = durationMs;
  }

  function recordWeeklyComposition(label: RunLabel, reports: HCRReport[], durationMs: number): void {
    const run = getRunOrThrow(label);
    run.weeklyComposition.weeksComposed = reports.length;
    run.weeklyComposition.weeksWithoutEpisodes = reports.filter(r => r.sources_analyzed.length === 0).length;
    run.durationsMs.weeklyComposition = durationMs;
  }

  async function finish(label: RunLabel): Promise<void> {
    const run = getRunOrThrow(label);
    run.endedAtIso = new Date().toISOString();
    if (totalStartPerfMs !== null) {
      run.durationsMs.total = performance.now() - totalStartPerfMs;
    }

    stopMemorySampling(run);

    try {
      run.storage.after = await snapshotStorage();
      run.dbCounts.after = await snapshotDbCounts();
    } catch {
      // Best-effort snapshots only
    }

    activeLabel = null;
    totalStartPerfMs = null;

    printChecklistBlock();
  }

  async function fail(label: RunLabel, error: unknown): Promise<void> {
    const run = getRunOrThrow(label);
    run.fatalError = error instanceof Error ? error.message : String(error);
    await finish(label);
  }

  function arm(label: RunLabel): void {
    armedLabel = label;
  }

  function reset(): void {
    armedLabel = null;
    activeLabel = null;
    totalStartPerfMs = null;
    runs.cold = null;
    runs.warm = null;
    if (memoryTimer !== null) {
      window.clearInterval(memoryTimer);
      memoryTimer = null;
    }
  }

  return {
    arm,
    beginIfArmed,
    recordEpisodeProcessing,
    recordWeeklyComposition,
    finish,
    fail,
    reset,
    getStateMdChecklistBlock: renderChecklistBlock,
    printStateMdChecklistBlock: printChecklistBlock
  };
}
