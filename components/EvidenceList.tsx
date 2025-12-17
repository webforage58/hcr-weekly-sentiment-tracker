import React, { useState } from 'react';
import { Quote, Radio, ChevronDown, ChevronUp } from 'lucide-react';
import { Evidence } from '../types';

export const EvidenceList: React.FC<{ evidence: Evidence[] }> = ({ evidence }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!evidence || evidence.length === 0) return null;

  return (
    <div className="mt-4 border-t border-gray-100 pt-3">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center text-xs font-semibold text-gray-500 hover:text-gray-800 transition-colors uppercase tracking-wide"
      >
        {isOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
        Evidence & Citations ({evidence.length})
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3">
          {evidence.map((item, idx) => (
            <div key={idx} className="bg-slate-50 p-3 rounded text-sm text-slate-700 border border-slate-100">
              <div className="flex items-start gap-2">
                {item.evidence_type === 'quote_excerpt' ? (
                  <Quote className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                ) : (
                  <Radio className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                )}
                <div>
                  <p className="italic mb-1">"{item.evidence_text}"</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold">{item.show_name}</span>
                    <span>•</span>
                    <span>{new Date(item.published_at).toLocaleDateString()}</span>
                    {item.offsets && (
                      <>
                        <span>•</span>
                        <span className="font-mono bg-slate-200 px-1 rounded">{item.offsets}</span>
                      </>
                    )}
                    <span className="ml-auto px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600 text-[10px] uppercase">
                      {item.evidence_type.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
