import React from 'react';
import { Sparkles } from 'lucide-react';

interface ScoringCriteria {
  history: boolean;
  region: boolean;
  contact: boolean;
  delegates: boolean;
  iccaQualification: boolean;
}

interface ScoringCriteriaPanelProps {
  scoringCriteria: ScoringCriteria;
  onCriteriaChange: (criteria: ScoringCriteria) => void;
}

export const ScoringCriteriaPanel: React.FC<ScoringCriteriaPanelProps> = ({
  scoringCriteria,
  onCriteriaChange,
}) => {
  return (
    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">Scoring Criteria</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onCriteriaChange({
              history: true,
              region: true,
              contact: true,
              delegates: true,
              iccaQualification: true
            })}
            className="px-2.5 py-1 text-xs font-medium text-white bg-indigo-600 rounded"
          >
            All On
          </button>
          <button
            onClick={() => onCriteriaChange({
              history: false,
              region: false,
              contact: false,
              delegates: false,
              iccaQualification: false
            })}
            className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded"
          >
            All Off
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={scoringCriteria.history}
            onChange={(e) => onCriteriaChange({ ...scoringCriteria, history: e.target.checked })}
            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
          />
          <span className="text-xs font-medium text-slate-700">History (25đ)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={scoringCriteria.region}
            onChange={(e) => onCriteriaChange({ ...scoringCriteria, region: e.target.checked })}
            className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
          />
          <span className="text-xs font-medium text-slate-700">Region (25đ)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={scoringCriteria.contact}
            onChange={(e) => onCriteriaChange({ ...scoringCriteria, contact: e.target.checked })}
            className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
          />
          <span className="text-xs font-medium text-slate-700">Contact (25đ)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={scoringCriteria.delegates}
            onChange={(e) => onCriteriaChange({ ...scoringCriteria, delegates: e.target.checked })}
            className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
          />
          <span className="text-xs font-medium text-slate-700">Delegates (25đ)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer px-2 py-1 rounded">
          <input
            type="checkbox"
            checked={scoringCriteria.iccaQualification}
            onChange={(e) => onCriteriaChange({ ...scoringCriteria, iccaQualification: e.target.checked })}
            className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
          />
          <span className="text-xs font-medium text-slate-700">ICCA Qual</span>
        </label>
      </div>
    </div>
  );
};
