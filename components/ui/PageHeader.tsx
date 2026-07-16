import type React from 'react';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/** Consistent page-level header: title left, actions right. */
export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  actions,
  className = '',
}) => (
  <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
    <div className="min-w-0">
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </div>
);
