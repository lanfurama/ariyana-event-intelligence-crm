import React from 'react';
import { BrainCircuit, Loader2 } from 'lucide-react';

interface BatchAnalysisControlsProps {
  eventsCount: number;
  loading: boolean;
  researchingEditions: Set<string>;
  rateLimitCountdown: number | null;
  onAnalyze: () => void;
}

export const BatchAnalysisControls: React.FC<BatchAnalysisControlsProps> = ({
  eventsCount,
  loading,
  researchingEditions,
  rateLimitCountdown,
  onAnalyze,
}) => {
  if (eventsCount === 0) return null;

  const isDisabled =
    loading ||
    researchingEditions.size > 0 ||
    eventsCount === 0 ||
    (rateLimitCountdown !== null && rateLimitCountdown > 0);

  return (
    <div className="bg-white p-3 rounded-lg shadow-sm border border-slate-200 flex items-center justify-between gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-700">
          {eventsCount} event{eventsCount > 1 ? 's' : ''} ready to analyze
        </p>
        {loading && (
          <p className="text-xs text-blue-600 mt-0.5">
            Analyzing events... This may take a few minutes.
          </p>
        )}
      </div>
      <button
        onClick={onAnalyze}
        disabled={isDisabled}
        className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed shrink-0 transition-colors"
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span>Analyzing...</span>
          </>
        ) : researchingEditions.size > 0 ? (
          <>
            <Loader2 className="animate-spin" size={16} />
            <span>Researching...</span>
          </>
        ) : (
          <>
            <BrainCircuit size={16} />
            {rateLimitCountdown !== null && rateLimitCountdown > 0
              ? `Retry in ${rateLimitCountdown}s`
              : 'Analyze Events'}
          </>
        )}
      </button>
    </div>
  );
};
