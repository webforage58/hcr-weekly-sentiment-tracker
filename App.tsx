
import React, { useState, useEffect, useRef } from 'react';
import { HCRReport } from './types';
import { ReportDashboard } from './components/ReportDashboard';
import { DashboardSetup } from './components/DashboardSetup';
import { SAMPLE_REPORT } from './constants';
import { LayoutDashboard, Download, Upload, Lock, ExternalLink, Key } from 'lucide-react';

// Declare the global AIStudio interface to match the environment and avoid property duplication errors
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    // Ensure aistudio is declared as optional and uses the AIStudio type to match environment modifiers
    aistudio?: AIStudio;
  }
}

export default function App() {
  const [data, setData] = useState<HCRReport | null>(null);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (window.aistudio) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        // Fallback for environments without the gate (though assumed available)
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleConnectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      // Assume success as per instructions to avoid race conditions
      setHasKey(true);
    }
  };

  const handleExport = () => {
    if (!data) return;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const dateStr = data.run_window.window_end;
    link.download = `hcr-sentiment-report-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (!json.top_issues || !json.run_window) {
          alert("Invalid JSON: Missing required HCR report fields.");
          return;
        }
        setData(json);
      } catch (err) {
        alert("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-slate-900">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center">
            <Lock className="w-8 h-8 text-indigo-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold serif">Private Access Only</h1>
            <p className="text-slate-500 text-sm">
              This application is private. To proceed, you must connect your own Google Gemini API key from a paid Google Cloud project.
            </p>
          </div>
          
          <div className="space-y-4 pt-4">
            <button
              onClick={handleConnectKey}
              className="w-full py-3 px-4 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg"
            >
              <Key className="w-5 h-5" />
              Connect API Key
            </button>
            
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Learn about billing and paid projects <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Still checking key state
  if (hasKey === null) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setData(null)}>
            <div className="bg-indigo-600 p-1.5 rounded text-white">
              <LayoutDashboard className="w-5 h-5" />
            </div>
            <span className="font-bold text-lg text-slate-900 tracking-tight serif">HCR Sentiment</span>
          </div>
          
          <div className="flex items-center gap-4">
            {data && (
              <>
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                  title="Export Report to JSON"
                >
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export JSON</span>
                </button>
                
                <button 
                  onClick={handleImportClick}
                  className="flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                  title="Import Historical Report"
                >
                  <Upload className="w-4 h-4" />
                  <span className="hidden sm:inline">Import JSON</span>
                </button>
                
                <div className="h-4 w-px bg-slate-200 mx-1" />
                
                <button 
                  onClick={() => setData(null)}
                  className="text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                >
                  New Analysis
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
      
      <input 
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".json"
        onChange={handleFileChange}
      />

      <main className="px-4 py-8 sm:px-6 lg:px-8">
        {!data ? (
          <DashboardSetup 
            onDataLoaded={(json) => setData(json)} 
            onUseDemo={() => setData(SAMPLE_REPORT)} 
          />
        ) : (
          <ReportDashboard data={data} />
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white mt-auto">
        <div className="max-w-6xl mx-auto py-6 px-4 flex flex-col md:flex-row justify-between items-center text-sm text-slate-500">
          <p>© {new Date().getFullYear()} Sentiment Tracker.</p>
          <p className="mt-2 md:mt-0 flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-slate-400" /> Private Session
          </p>
        </div>
      </footer>
    </div>
  );
}
