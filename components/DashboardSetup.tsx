import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, FileJson, Calendar, Sparkles, AlertCircle, Loader2, Database, Check, X } from 'lucide-react';
import { HCRReport } from '../types';
import { generateReport } from '../services/gemini';
import { storageService } from '../services/storage';
import { getWeekWindows, aggregateReports } from '../utils/reportUtils';
import { migrateWeeklyReportsToEpisodes, isMigrationNeeded, getMigrationStats } from '../utils/migration';

interface Props {
  onDataLoaded: (data: HCRReport) => void;
  onUseDemo: () => void;
}

export const DashboardSetup: React.FC<Props> = ({ onDataLoaded, onUseDemo }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [progress, setProgress] = useState("");

  // Migration State
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const [migrationError, setMigrationError] = useState<string | null>(null);
  const [showMigration, setShowMigration] = useState(false);
  const [migrationStats, setMigrationStats] = useState({ weeksInLocalStorage: 0, totalEpisodes: 0 });

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

    // Validate 4-week limit
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 28) {
      setError("To ensure fast generation, please select a date range of 4 weeks or less.");
      return;
    }

    setIsGenerating(true);
    setProgress("Calculating windows...");

    try {
      // Pass strings directly to handle local timezone correctly
      const windows = getWeekWindows(startDate, endDate);
      if (windows.length === 0) {
        throw new Error("Invalid date range. Please select at least one week.");
      }

      const reports: HCRReport[] = [];
      
      for (let i = 0; i < windows.length; i++) {
        const w = windows[i];
        
        // Check cache first
        const cached = storageService.getWeek(w.start);
        if (cached) {
          setProgress(`Loading cached Week ${i + 1} of ${windows.length}: ${w.start}...`);
          // Small delay for UI smoothness
          await new Promise(r => setTimeout(r, 300));
          reports.push(cached);
          continue;
        }

        setProgress(`Analyzing Week ${i + 1} of ${windows.length}: ${w.start} to ${w.end}...`);
        
        // Add artificial delay to avoid rate limits if any, though not strictly needed for basic usage
        if (i > 0) await new Promise(r => setTimeout(r, 1000));
        
        const report = await generateReport(w.start, w.end, w.priorStart, w.priorEnd);
        
        // Save to cache
        storageService.saveWeek(w.start, report);
        
        reports.push(report);
      }

      setProgress("Aggregating results...");
      const finalReport = aggregateReports(reports);
      onDataLoaded(finalReport);

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to generate report. Please try again.");
    } finally {
      setIsGenerating(false);
      setProgress("");
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
              <p className="text-xs text-slate-400 mt-1">Maximum 4 weeks allowed per run.</p>
            </div>

            {error && (
              <div className="bg-rose-50 text-rose-600 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
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
                  {progress || "Processing..."}
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
    </div>
  );
};
