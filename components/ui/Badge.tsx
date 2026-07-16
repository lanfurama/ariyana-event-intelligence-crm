import type React from 'react';

export type BadgeTone =
  | 'slate'
  | 'gold'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'sky'
  | 'violet'
  | 'indigo';

const TONE_CLASSES: Record<BadgeTone, string> = {
  slate: 'bg-slate-100 text-slate-600 border-slate-200',
  gold: 'bg-brand-50 text-brand-700 border-brand-200',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  sky: 'bg-sky-50 text-sky-700 border-sky-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200',
  indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

interface BadgeProps {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ tone = 'slate', className = '', children }) => (
  <span
    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${TONE_CLASSES[tone]} ${className}`}
  >
    {children}
  </span>
);
