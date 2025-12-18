import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileJson, Sparkles, AlertCircle, Loader2, Database, Check, X, XCircle, Settings, ChevronDown, ChevronUp } from 'lucide-react';
import { HCRReport } from '../types';
import { processEpisodesInRange, estimateProcessingTime } from '../services/episodeProcessor';
import { composeWeeklyReport } from '../services/reportComposer';
import { getWeekWindows, aggregateReports } from '../utils/reportUtils';
import { migrateWeeklyReportsToEpisodes, isMigrationNeeded, getMigrationStats } from '../utils/migration';
import { FRAMEWORK_VERSION } from '../constants/frameworkVersion';
import { getConfig, updateConfig, resetConfig, type AppConfig } from '../constants/config';

interface Props {
  onDataLoaded: (data: HCRReport) => void;
  onUseDemo: () => void;
}

type ProgressPhase = 'idle' | 'discovering' | 'analyzing' | 'composing' | 'cancelled';

interface ProgressState {
  phase: ProgressPhase;
  current: number;
  total: number;
  currentItem: string;
}

export const DashboardSetup: React.FC<Props> = ({ onDataLoaded, onUseDemo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Set defaults dynamically: 1 Month ago -> Today
  const today = new Date();
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(today.getMonth() - 1);

  const [startDate, setStartDate] = useState(oneMonthAgo.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(today.toISOString().split('T')[0]);
  
  // Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progress, setProgress] = useState<ProgressState>({
    phase: 'idle',
    current: 0,
    total: 0,
    currentItem: ''
  });
  const [episodeStats, setEpisodeStats] = useState<{
    total: number;
    cached: number;
    newCount: number;
    estimateSeconds: number;
  } | null>(null);

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationStats, setMigrationStats] = useState({ weeksInLocalStorage: 0, totalEpisodes: 0 });

  // Settings State
  const [showSettings, setShowSettings] = useState(false);
  const [config, setConfig] = useState<AppConfig>(getConfig());

  // Check if migration is needed on mount
  useEffect(() => {
    setShowMigration(isMigrationNeeded());
    if (isMigrationNeeded()) {
      setMigrationStats(getMigrationStats());
    }
  }, []);

  const processFile = (file: File) => {
    setError(null);
    if (file.type !== "application/json" && !file.name.endsWith('.json')) {
      setError("Please upload a valid JSON file.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (!json.top_issues || !json.run_window) {
          setError("JSON does not match the HCR Report Schema.");
          return;
        }
        onDataLoaded(json);
      } catch (err) {
        setError("Failed to parse JSON.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleMigration = async () => {
    setIsMigrating(true);
    setMigrationError(null);
    setMigrationComplete(false);

    try {
      console.log('Starting migration...');
      const result = await migrateWeeklyReportsToEpisodes({ dryRun: false, force: false });

      if (result.success) {
        setMigrationComplete(true);
        console.log('Migration completed successfully!');
        // Hide migration section after 3 seconds
        setTimeout(() => {
          setShowMigration(false);
        }, 3000);
      } else {
        setMigrationError(`Migration completed with errors: ${result.errors.join(', ')}`);
      }
    } catch (err: any) {
      console.error('Migration failed:', err);
      setMigrationError(err.message || 'Migration failed unexpectedly');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleGenerate = async () => {
    if (!startDate || !endDate) return;
    setError(null);

    const todayStr = new Date().toISOString().split('T')[0];
    if (startDate > todayStr || endDate > todayStr) {
        setError("Analysis dates cannot be in the future.");
        return;
    }

    // Validate date range (significantly increased from 4-week limit)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 365) {
      setError("Maximum date range is 52 weeks (1 year).");
      return;
    }

    if (start > end) {
      setError("Start date must be before or equal to end date.");
      return;
    }

    const windows = getWeekWindows(startDate, endDate);
    if (windows.length === 0) {
      setError("Invalid date range. Please select at least one week.");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setIsCancelling(false);
    setEpisodeStats(null);
    setProgress({
      phase: 'discovering',
      current: 0,
      total: 1,
      currentItem: "Discovering episodes..."
    });

    try {
      // NEW TWO-PHASE PIPELINE (replaced old week-by-week sequential processing)
      // Phase 1: Parallel episode processing with caching
      // Phase 2: Weekly report composition from cached episodes
      // This enables 52-week analysis vs. old 4-week limit

      const concurrency = 10;

      const processResult = await processEpisodesInRange(startDate, endDate, {
        concurrency,
        signal: controller.signal,
        onDiscoveryComplete: (total, cached, newCount) => {
          if (controller.signal.aborted) return;

          const estimateSeconds = estimateProcessingTime(total, cached, concurrency);
          setEpisodeStats({ total, cached, newCount, estimateSeconds });
          setProgress({
            phase: 'analyzing',
            current: 0,
            total: Math.max(total, 1),
            currentItem: total === 0
              ? "No episodes found in this range."
              : `Preparing to analyze ${newCount} new episode${newCount === 1 ? '' : 's'} (${cached} cached)`
          });
        },
        onProgress: (completed, total, episodeTitle, isCached) => {
          if (controller.signal.aborted) return;

          const label = isCached ? 'Loading cached episode' : 'Analyzing episode';
          setProgress({
            phase: 'analyzing',
            current: completed,
            total: Math.max(total, 1),
            currentItem: `${label} ${completed}/${total}: "${episodeTitle}"`
          });
        }
      });

      if (controller.signal.aborted) {
        throw new Error('Processing cancelled');
      }

      // Validate episode processing results
      if (processResult.stats.totalEpisodes === 0) {
        setError("No episodes found in the selected date range.");
        return;
      }

      if (processResult.stats.failed > 0) {
        console.warn(`Warning: ${processResult.stats.failed} episode(s) failed to process. Continuing with available data.`);
      }

      if (processResult.stats.failed === processResult.stats.totalEpisodes) {
        setError("All episodes failed to process. Please check your API key and try again.");
        return;
      }

      // Phase 2: Compose weekly reports from episode insights
      const reports: HCRReport[] = [];
      setProgress({
        phase: 'composing',
        current: 0,
        total: windows.length,
        currentItem: 'Composing weekly reports...'
      });

      for (let i = 0; i < windows.length; i++) {
        if (controller.signal.aborted) {
          throw new Error('Processing cancelled');
        }

        const w = windows[i];
        const report = await composeWeeklyReport(w.start, w.end, w.priorStart, w.priorEnd);
        reports.push(report);

        setProgress({
          phase: 'composing',
          current: i + 1,
          total: windows.length,
          currentItem: `Composing ${w.start} -> ${w.end}`
        });
      }

      // Validate weekly coverage - ensure all weeks have at least some episode data
      const weeksWithoutEpisodes = reports.filter(r => r.sources_analyzed.length === 0);
      if (weeksWithoutEpisodes.length > 0) {
        const weekList = weeksWithoutEpisodes.map(r => r.run_window.window_start).join(', ');
        console.warn(`Warning: ${weeksWithoutEpisodes.length} week(s) have no episode coverage: ${weekList}`);
      }

      if (weeksWithoutEpisodes.length === reports.length) {
        setError("No episode coverage found for any week in the selected range. Try a different date range.");
        return;
      }

      // Phase 3: Aggregate and display
      const finalReport = aggregateReports(reports);
      onDataLoaded(finalReport);

    } catch (err: any) {
      console.error(err);
      if (err?.message === 'Processing cancelled') {
        setError("Analysis cancelled.");
        setProgress({
          phase: 'cancelled',
          current: 0,
          total: 0,
          currentItem: ''
        });
      } else {
        setError(err?.message || "Failed to generate report. Please try again.");
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
      setIsCancelling(false);
      setProgress({
        phase: 'idle',
        current: 0,
        total: 0,
        currentItem: ''
      });
    }
  };

  const handleCancel = () => {
    if (!abortControllerRef.current) return;
    setIsCancelling(true);
    abortControllerRef.current.abort();
  };

  const progressPercent = progress.total > 0
    ? Math.min(100, Math.round((progress.current / progress.total) * 100))
    : progress.phase === 'discovering'
      ? 15
      : 0;

  const progressLabel = () => {
    switch (progress.phase) {
      case 'discovering':
        return 'Discovering Episodes';
      case 'analyzing':
        return 'Analyzing Episodes';
      case 'composing':
        return 'Composing Weekly Reports';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Processing';
    }
  };

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 animate-fade-in">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Left: Generate Card */}
        <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 flex flex-col">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <Sparkles className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 serif">Generate Analysis</h2>
              <p className="text-sm text-slate-500">Using Gemini AI & Google Search</p>
            </div>
          </div>

          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
              <input 
                type="date" 
                max={new Date().toISOString().split('T')[0]}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">Select beginning of analysis period</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">End Date</label>
              <input 
                type="date" 
                max={new Date().toISOString().split('T')[0]}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border-slate-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
              />
              <p className="text-xs text-slate-400 mt-1">Maximum 52 weeks (1 year) per analysis.</p>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isGenerating && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 mt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-900">{progressLabel()}</span>
                  <span className="text-slate-500">
                    {progress.total > 0 ? `${progress.current}/${progress.total}` : '...'}
                  </span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-200 ${progress.phase === 'composing' ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                <p className="text-xs text-slate-600 line-clamp-2">
                  {progress.currentItem || 'Working...'}
                </p>

                {episodeStats && (
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {episodeStats.cached} cached · {episodeStats.newCount} new
                    </span>
                    <span>
                      Estimated time: ~{episodeStats.estimateSeconds}s
                    </span>
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    onClick={handleCancel}
                    disabled={isCancelling}
                    className="text-sm text-rose-600 border border-rose-200 bg-white px-3 py-1.5 rounded-md hover:bg-rose-50 transition-colors flex items-center gap-2 disabled:opacity-60"
                  >
                    <XCircle className="w-4 h-4" />
                    {isCancelling ? 'Cancelling...' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="mt-8">
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-3 px-4 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {progress.phase === 'discovering'
                    ? "Discovering episodes..."
                    : progress.phase === 'composing'
                      ? "Composing report..."
                      : "Analyzing episodes..."}
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Run Analysis
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right: Upload or Demo */}
        <div className="flex flex-col gap-6">
          {/* Upload Area */}
          <div 
            className={`
              flex-1 border-2 border-dashed rounded-xl p-8 transition-colors cursor-pointer
              flex flex-col items-center justify-center gap-4 text-center
              ${isDragging ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50 bg-white/50'}
            `}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bg-slate-100 p-3 rounded-full">
              <UploadCloud className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <p className="font-medium text-slate-900">Upload existing report</p>
              <p className="text-sm text-slate-500">Drag & drop JSON file</p>
            </div>
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".json"
              onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
            />
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-[#f8fafc] px-2 text-slate-400">Or</span>
            </div>
          </div>

          <button 
            onClick={onUseDemo}
            className="w-full py-3 px-4 bg-white border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <FileJson className="w-5 h-5" />
            Load Sample Report
          </button>
        </div>

      </div>

      {/* Migration Section (conditionally shown) */}
      {showMigration && (
        <div className="max-w-4xl w-full mt-8">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-amber-100 p-2 rounded-lg shrink-0">
                <Database className="w-6 h-6 text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-amber-900 mb-2">
                  Data Migration Available
                </h3>
                <p className="text-sm text-amber-800 mb-4">
                  We've detected {migrationStats.weeksInLocalStorage} week(s) of cached data ({migrationStats.totalEpisodes} episodes)
                  in the old format. Migrate this data to the new episode-level storage system for better performance
                  and expanded analysis capabilities.
                </p>

                {migrationError && (
                  <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-start gap-2 mb-4">
                    <X className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{migrationError}</span>
                  </div>
                )}

                {migrationComplete && (
                  <div className="bg-emerald-50 text-emerald-700 p-3 rounded-lg text-sm flex items-center gap-2 mb-4">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>Migration completed successfully! Your data has been preserved in the new format.</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={handleMigration}
                    disabled={isMigrating || migrationComplete}
                    className="py-2 px-4 bg-amber-600 text-white font-medium rounded-lg hover:bg-amber-700 disabled:bg-amber-400 transition-colors flex items-center gap-2"
                  >
                    {isMigrating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Migrating...
                      </>
                    ) : migrationComplete ? (
                      <>
                        <Check className="w-4 h-4" />
                        Migration Complete
                      </>
                    ) : (
                      <>
                        <Database className="w-4 h-4" />
                        Migrate Data
                      </>
                    )}
                  </button>

                  {!migrationComplete && (
                    <button
                      onClick={() => setShowMigration(false)}
                      disabled={isMigrating}
                      className="py-2 px-4 bg-white border border-amber-300 text-amber-800 font-medium rounded-lg hover:bg-amber-50 transition-colors"
                    >
                      Skip for Now
                    </button>
                  )}
                </div>

                <p className="text-xs text-amber-700 mt-3">
                  Note: Your original LocalStorage data will be preserved as a backup and won't be deleted.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <div className="max-w-4xl w-full mt-8">
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Settings className="w-5 h-5 text-slate-600" />
              <h3 className="text-lg font-semibold text-slate-900">Advanced Settings</h3>
            </div>
            {showSettings ? (
              <ChevronUp className="w-5 h-5 text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-400" />
            )}
          </button>

          {showSettings && (
            <div className="px-6 py-4 border-t border-slate-200 space-y-6">
              {/* Processing Settings */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Processing</h4>
                <div className="space-y-4">
                  <div>
                    <label className="flex items-center justify-between text-sm font-medium text-slate-700 mb-2">
                      <span>Parallel Episodes (Concurrency)</span>
                      <span className="text-indigo-600 font-semibold">{config.processing.concurrency}</span>
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="20"
                      value={config.processing.concurrency}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value);
                        const newConfig = updateConfig('processing', 'concurrency', newValue);
                        setConfig(newConfig);
                      }}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Higher values = faster processing (uses more API quota)
                    </p>
                  </div>
                </div>
              </div>

              {/* Feature Toggles */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Features</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">AI Executive Summaries</span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Generate detailed narrative summaries using AI (slower, +2-3s per week)
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.features.enableAIExecutiveSummary}
                      onChange={(e) => {
                        const newConfig = updateConfig('features', 'enableAIExecutiveSummary', e.target.checked);
                        setConfig(newConfig);
                      }}
                      className="ml-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>

                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Detailed Progress</span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Show episode-by-episode progress during analysis
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.features.enableDetailedProgress}
                      onChange={(e) => {
                        const newConfig = updateConfig('features', 'enableDetailedProgress', e.target.checked);
                        setConfig(newConfig);
                      }}
                      className="ml-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* Caching Settings */}
              <div>
                <h4 className="font-semibold text-slate-900 mb-3">Caching</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex-1">
                      <span className="text-sm font-medium text-slate-900">Weekly Aggregation Cache</span>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Cache computed weekly reports for faster re-runs
                      </p>
                    </div>
                    <input
                      type="checkbox"
                      checked={config.caching.enableWeeklyAggregationCache}
                      onChange={(e) => {
                        const newConfig = updateConfig('caching', 'enableWeeklyAggregationCache', e.target.checked);
                        setConfig(newConfig);
                      }}
                      className="ml-3 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                    />
                  </label>
                </div>
              </div>

              {/* Reset Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={() => {
                    const defaultConfig = resetConfig();
                    setConfig(defaultConfig);
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Framework Version Footer */}
      <div className="text-center text-xs text-slate-400 mt-8">
        Framework Version: {FRAMEWORK_VERSION}
      </div>
    </div>
  );
};
