import type React from 'react';

interface CardProps {
  className?: string;
  children: React.ReactNode;
}

/** Base surface for grouped content. */
export const Card: React.FC<CardProps> = ({ className = '', children }) => (
  <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

interface CardHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div
    className={`flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 ${className}`}
  >
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
);
