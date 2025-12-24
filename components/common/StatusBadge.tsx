import React from 'react';

export const StatusBadge = ({ status }: { status: string }) => {
  const dotColors: Record<string, string> = {
    New: 'bg-blue-500',
    Contacted: 'bg-amber-500',
    Qualified: 'bg-violet-500',
    Won: 'bg-emerald-500',
    Lost: 'bg-rose-500',
  };
  const dot = dotColors[status] || 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-medium border border-slate-200 bg-white text-slate-700">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      <span className="uppercase tracking-wide">{status}</span>
    </span>
  );
};










