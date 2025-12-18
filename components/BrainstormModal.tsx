
import React, { useEffect, useState, useRef } from 'react';
import { X, Loader2, TrendingUp, LineChart, Activity, Download } from 'lucide-react';
import { 
  ComposedChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { HCRReport, MarketAnalysisResult } from '../types';
import { generateMarketBrainstorm } from '../services/gemini';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  report: HCRReport;
}

export const BrainstormModal: React.FC<Props> = ({ isOpen, onClose, report }) => {
  const [data, setData] = useState<MarketAnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Custom date range state (defaults to report date range)
  const [startDate, setStartDate] = useState(report.run_window.window_start);
  const [endDate, setEndDate] = useState(report.run_window.window_end);

  // Keep defaults in sync when a new report is generated or modal is reopened.
  useEffect(() => {
    if (!isOpen) return;
    setStartDate(report.run_window.window_start);
    setEndDate(report.run_window.window_end);
    setData(null);
    setError(null);
  }, [isOpen, report.run_window.window_start, report.run_window.window_end]);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMarketBrainstorm(report, startDate, endDate);
      setData(result);
    } catch (err) {
      setError("Failed to generate market analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!contentRef.current || !data) return;

    const element = contentRef.current;
    const filename = `market-analysis-${report.run_window.window_end}.pdf`;
    
    const opt = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      // Standard html2pdf download works best in cross-origin frames where showSaveFilePicker is restricted
      html2pdf().set(opt).from(element).save();
    } catch (err: any) {
      console.error("Export failed:", err);
      alert("Export failed. Please try again.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[95vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-lg">
              <LineChart className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 serif">Market Correlation Analysis</h3>
              <p className="text-xs text-slate-500">Comparing HCR Sentiment vs. Actual Market Performance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {data && (
              <button 
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
                title="Export as PDF"
              >
                <Download className="w-4 h-4" />
                <span>Export PDF</span>
              </button>
            )}
            <button 
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {!data && !loading && !error && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-12">
              <div className="bg-indigo-50 p-6 rounded-full">
                <TrendingUp className="w-12 h-12 text-indigo-500" />
              </div>
              <div className="max-w-md w-full">
                <h4 className="text-xl font-semibold text-slate-900 mb-2">Quantify the Impact</h4>
                <p className="text-slate-500 mb-6">
                  The AI will retrieve <strong>actual market data</strong> (S&P 500, Yields, VIX) and analyze correlations with the political sentiment.
                </p>

                {/* Date Range Picker */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 mb-6 text-left">
                  <label className="block text-sm font-medium text-slate-700 mb-3">
                    Select Date Range for Market Data
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">Start Date</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-600 mb-1">End Date</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Default: Report range ({report.run_window.window_start} to {report.run_window.window_end})
                  </p>
                </div>

                <button
                  onClick={handleGenerate}
                  className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center justify-center gap-2 mx-auto"
                >
                  <LineChart className="w-5 h-5" />
                  Run Correlation Analysis
                </button>
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center h-full space-y-4 min-h-[400px]">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
              <div className="text-center">
                <p className="text-slate-900 font-medium">Analyzing Market Data...</p>
                <p className="text-slate-500 text-sm animate-pulse">Retrieving S&P 500, Bond Yields, and VIX history</p>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center h-full text-center min-h-[400px]">
              <p className="text-rose-600 mb-4">{error}</p>
              <button
                onClick={handleGenerate}
                className="px-4 py-2 bg-white border border-slate-300 rounded text-slate-700 hover:bg-slate-50"
              >
                Try Again
              </button>
            </div>
          )}

          {data && (
            <div className="space-y-6" ref={contentRef}>
              
              {/* Chart Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Chart 1: S&P 500 vs Sentiment */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 break-inside-avoid">
                  <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    S&P 500 Price vs. HCR Sentiment
                  </h4>
                  <div className="h-64 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.daily_data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(str) => str.slice(5)} 
                          tick={{fill: '#64748b'}} 
                          axisLine={false} 
                          tickLine={false}
                        />
                        <YAxis 
                          yAxisId="left" 
                          domain={['auto', 'auto']} 
                          orientation="left" 
                          tick={{fill: '#64748b'}}
                          axisLine={false}
                          tickLine={false}
                          hide={false}
                          width={40}
                        />
                        <YAxis 
                          yAxisId="right" 
                          domain={[0, 100]} 
                          orientation="right" 
                          hide={true} 
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          labelStyle={{fontWeight: 'bold', color: '#1e293b'}}
                        />
                        <Legend wrapperStyle={{paddingTop: '10px'}} />
                        <Area 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="hcr_sentiment" 
                          name="Sentiment (0-100)" 
                          fill="#c7d2fe" 
                          stroke="#6366f1" 
                          fillOpacity={0.2} 
                        />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="sp500_close" 
                          name="S&P 500" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          dot={{r: 3}}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Chart 2: Risk Indicators */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 break-inside-avoid">
                  <h4 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-500" />
                    Risk Indicators: VIX & 10Y Yield
                  </h4>
                  <div className="h-64 w-full text-xs">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={data.daily_data}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis 
                          dataKey="date" 
                          tickFormatter={(str) => str.slice(5)} 
                          tick={{fill: '#64748b'}} 
                          axisLine={false} 
                          tickLine={false}
                        />
                        <YAxis 
                          yAxisId="left" 
                          domain={['auto', 'auto']} 
                          orientation="left" 
                          tick={{fill: '#64748b'}}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                        />
                        <YAxis 
                          yAxisId="right" 
                          domain={['auto', 'auto']} 
                          orientation="right" 
                          tick={{fill: '#64748b'}}
                          axisLine={false}
                          tickLine={false}
                          width={30}
                        />
                        <Tooltip 
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          labelStyle={{fontWeight: 'bold', color: '#1e293b'}}
                        />
                        <Legend wrapperStyle={{paddingTop: '10px'}} />
                        <Line 
                          yAxisId="left"
                          type="monotone" 
                          dataKey="vix_close" 
                          name="VIX" 
                          stroke="#f59e0b" 
                          strokeWidth={2} 
                          dot={{r: 3}}
                        />
                        <Line 
                          yAxisId="right"
                          type="monotone" 
                          dataKey="tnx_yield" 
                          name="10Y Yield (%)" 
                          stroke="#64748b" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          dot={{r: 3}}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>

              {/* Text Analysis */}
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 break-inside-avoid">
                <div className="prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-p:text-slate-700 prose-li:text-slate-700">
                  <div className="whitespace-pre-wrap">{data.analysis_markdown}</div>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
             <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-900 font-medium">
               Close
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
