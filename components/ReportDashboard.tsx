import React, { useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell 
} from 'recharts';
import { 
  ArrowUpRight, ArrowDownRight, Minus, AlertTriangle, ShieldCheck, Calendar, Radio, LineChart 
} from 'lucide-react';
import { HCRReport, IssueEntry } from '../types';
import { SentimentBadge } from './SentimentBadge';
import { EvidenceList } from './EvidenceList';
import { BrainstormModal } from './BrainstormModal';

interface Props {
  data: HCRReport;
}

export const ReportDashboard: React.FC<Props> = ({ data }) => {
  const [showBrainstorm, setShowBrainstorm] = useState(false);

  const getBarColor = (score: number) => {
    if (score >= 60) return '#10b981'; // emerald-500
    if (score <= 40) return '#f43f5e'; // rose-500
    return '#f59e0b'; // amber-500
  };

  const chartData = data.top_issues.map(i => ({
    name: i.issue_name.length > 20 ? i.issue_name.substring(0, 18) + '...' : i.issue_name,
    fullName: i.issue_name,
    score: i.sentiment_index === 'unknown' ? 0 : i.sentiment_index,
    isUnknown: i.sentiment_index === 'unknown'
  }));

  const getDeltaIcon = (delta: number | "unknown") => {
    if (delta === "unknown") return <Minus className="w-4 h-4 text-gray-400" />;
    if (delta > 0) return <ArrowUpRight className="w-4 h-4 text-green-600" />;
    if (delta < 0) return <ArrowDownRight className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      <BrainstormModal 
        isOpen={showBrainstorm} 
        onClose={() => setShowBrainstorm(false)} 
        report={data} 
      />

      {/* Header Meta */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 serif">Executive Report</h2>
          <div className="flex items-center gap-2 text-slate-500 text-sm mt-1">
            <Calendar className="w-4 h-4" />
            <span>{data.run_window.window_start} to {data.run_window.window_end}</span>
            <span className="hidden md:inline">•</span>
            <span className="hidden md:inline">Generated: {new Date(data.generated_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Hallucination Risk</div>
              <div className={`text-sm font-semibold flex items-center justify-end gap-1 ${
                data.quality_flags.hallucination_risk === 'low' ? 'text-green-600' : 'text-amber-600'
              }`}>
                {data.quality_flags.hallucination_risk === 'low' ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {data.quality_flags.hallucination_risk.toUpperCase()}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-right">
               <div className="text-xs text-slate-500 uppercase font-bold tracking-wider">Sources</div>
               <div className="text-sm font-semibold">{data.sources_analyzed.length} Episodes</div>
            </div>
          </div>
          
          <button 
            onClick={() => setShowBrainstorm(true)}
            className="ml-4 px-4 py-2 bg-slate-900 text-white text-sm font-semibold rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm"
          >
            <LineChart className="w-4 h-4" />
            Market Analysis
          </button>
        </div>
      </div>

      {/* Summary & Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Executive Summary */}
        <div className="lg:col-span-1 bg-slate-900 text-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4 serif border-b border-slate-700 pb-2">Executive Summary</h3>
          <ul className="space-y-4">
            {data.executive_summary.map((point, idx) => (
              <li key={idx} className="flex items-start gap-3 text-sm leading-relaxed text-slate-300">
                <span className="text-indigo-400 font-bold mt-1">•</span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Sentiment Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 p-6 min-w-0">
          <h3 className="text-lg font-bold mb-6 text-slate-900 serif">Sentiment Index: Top Issues</h3>
          <div className="h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}} 
                  interval={0}
                />
                <YAxis 
                  domain={[0, 100]} 
                  hide={false} 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: '#64748b', fontSize: 12}}
                />
                <Tooltip 
                  cursor={{fill: '#f1f5f9'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                />
                <ReferenceLine y={50} stroke="#94a3b8" strokeDasharray="3 3" />
                <Bar dataKey="score" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.isUnknown ? '#cbd5e1' : getBarColor(entry.score)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between items-center text-xs text-slate-400 mt-4 px-4">
            <span>0 = Extremely Negative</span>
            <span>50 = Neutral</span>
            <span>100 = Extremely Positive</span>
          </div>
        </div>
      </div>

      {/* Top 5 Issues Detail Cards */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 mb-4 serif px-1">Top Issues Breakdown</h3>
        <div className="grid grid-cols-1 gap-6">
          {data.top_issues.map((issue) => (
            <div key={issue.issue_id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center justify-center bg-slate-50 w-12 h-12 rounded-lg border border-slate-100 shrink-0">
                      <span className="text-xs text-slate-400 uppercase font-bold">Rank</span>
                      <span className="text-xl font-bold text-slate-900">{issue.rank_this_week}</span>
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-slate-900 leading-tight">{issue.issue_name}</h4>
                      <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                        <span className="flex items-center gap-1">
                          {getDeltaIcon(issue.delta_vs_prior_week)}
                          {issue.delta_vs_prior_week !== 'unknown' && Math.abs(issue.delta_vs_prior_week as number)} pts vs last week
                        </span>
                        <span>•</span>
                        <span>{(issue.confidence * 100).toFixed(0)}% Confidence</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <SentimentBadge score={issue.sentiment_index} label={issue.sentiment_label} size="lg" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-slate-600 mb-2">
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <strong className="block text-slate-900 mb-1">Why Top 5?</strong>
                    {issue.why_this_week}
                  </div>
                  <div className="bg-slate-50 p-3 rounded border border-slate-100">
                    <strong className="block text-slate-900 mb-1">What Changed?</strong>
                    {issue.what_changed_week_over_week}
                  </div>
                </div>

                <EvidenceList evidence={issue.evidence} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Narrative Shifts & Movements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-12">
        {/* Narrative Shifts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-slate-900 serif flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-600" />
            Narrative Shifts
          </h3>
          {data.narrative_shifts.length === 0 ? (
            <p className="text-slate-500 italic">No major narrative shifts detected this week.</p>
          ) : (
            <div className="space-y-6">
              {data.narrative_shifts.map((shift, idx) => (
                <div key={idx}>
                  <h5 className="font-semibold text-slate-800 mb-1">{shift.shift}</h5>
                  <p className="text-sm text-slate-600 mb-2">{shift.why_it_changed}</p>
                  <EvidenceList evidence={shift.supporting_evidence} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Momentum */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-bold mb-4 text-slate-900 serif">Momentum Tracker</h3>
          
          <div className="mb-6">
            <h4 className="text-xs font-bold text-green-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ArrowUpRight className="w-4 h-4" /> Gaining Attention
            </h4>
            {data.issues_gaining_importance.length === 0 ? (
              <p className="text-sm text-slate-400">None</p>
            ) : (
              <ul className="space-y-3">
                {data.issues_gaining_importance.map((item, i) => (
                  <li key={i} className="text-sm border-l-2 border-green-200 pl-3">
                    <span className="font-semibold text-slate-800">{item.issue_name}</span>
                    <p className="text-slate-500 text-xs mt-0.5">{item.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <ArrowDownRight className="w-4 h-4" /> Losing Attention
            </h4>
            {data.issues_losing_importance.length === 0 ? (
              <p className="text-sm text-slate-400">None</p>
            ) : (
              <ul className="space-y-3">
                {data.issues_losing_importance.map((item, i) => (
                  <li key={i} className="text-sm border-l-2 border-red-200 pl-3">
                    <span className="font-semibold text-slate-800">{item.issue_name}</span>
                    <p className="text-slate-500 text-xs mt-0.5">{item.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
