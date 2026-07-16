import type React from 'react';
import { useMemo } from 'react';
import type { EmailLog } from '../../types';

/**
 * Chart color notes (dataviz method):
 * - Every chart here plots ONE measure, so marks use a single hue —
 *   brand.chart (#B08A2E), validated for chroma + 3:1 contrast on white.
 * - Identity comes from the row/axis label, never from cycled hues.
 * - Values are direct-labeled, so a contrast WARN never hides data.
 */

/** Sent-emails-per-day vertical bar chart (last 14 days) with hover tooltips. */
export const EmailActivityChart = ({ emailLogs }: { emailLogs: EmailLog[] }) => {
  const dailyActivity = useMemo(() => {
    const now = new Date();
    const days: { dateKey: string; label: string; longLabel: string; count: number }[] = [];
    const activityMap = new Map<string, number>();

    for (let i = 13; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      days.push({
        dateKey,
        label: `${date.getDate()}/${date.getMonth() + 1}`,
        longLabel: date.toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }),
        count: 0,
      });
      activityMap.set(dateKey, 0);
    }

    emailLogs.forEach((log) => {
      if (log.status === 'sent' && log.date) {
        const dateKey = new Date(log.date).toISOString().split('T')[0];
        if (activityMap.has(dateKey)) {
          activityMap.set(dateKey, (activityMap.get(dateKey) || 0) + 1);
        }
      }
    });

    return days.map((day) => ({ ...day, count: activityMap.get(day.dateKey) || 0 }));
  }, [emailLogs]);

  const max = Math.max(...dailyActivity.map((d) => d.count));

  if (max === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-sm text-slate-500">
        No emails sent in the last 14 days
      </div>
    );
  }

  return (
    <div role="img" aria-label={`Emails sent per day over the last 14 days, peak ${max}`}>
      <div className="flex items-end gap-1.5 h-36 border-b border-slate-200">
        {dailyActivity.map((d) => {
          const pct = Math.round((d.count / max) * 100);
          const isPeak = d.count === max;
          return (
            <div key={d.dateKey} className="relative group flex-1 h-full flex flex-col justify-end">
              {/* Selective direct label: peak day only */}
              {isPeak && (
                <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-slate-700 tabular-nums">
                  {d.count}
                </span>
              )}
              <div
                className="w-full rounded-t bg-brand-chart group-hover:bg-brand-700 transition-colors"
                style={{ height: `${Math.max(pct, d.count > 0 ? 3 : 0)}%` }}
                aria-label={`${d.longLabel}: ${d.count} emails`}
              />
              {/* Hover tooltip */}
              <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white shadow-lg">
                {d.count} email{d.count === 1 ? '' : 's'} · {d.longLabel}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-1">
        {dailyActivity.map((d) => (
          <div
            key={d.dateKey}
            className="flex-1 text-center text-[10px] text-slate-400 tabular-nums truncate"
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Labeled horizontal magnitude bars — one measure, one hue, direct-labeled.
 * Pass `max` when rows are rendered as separate instances (e.g. clickable
 * wrappers) so all bars share one scale — otherwise every bar is 100%.
 */
export const PipelineBars = ({
  data,
  compact,
  max: sharedMax,
}: {
  data: { name: string; count: number }[];
  compact?: boolean;
  max?: number;
}) => {
  const max = sharedMax || Math.max(...data.map((d) => d.count)) || 1;

  const space = compact ? 'space-y-1.5' : 'space-y-3';
  const barHeight = compact ? 'h-2' : 'h-2.5';
  const textSize = compact ? 'text-xs' : 'text-sm';
  const marginBar = compact ? 'mb-1' : 'mb-1.5';

  return (
    <div className={space}>
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100);
        return (
          <div key={d.name}>
            <div className={`flex items-center justify-between gap-3 ${marginBar}`}>
              <div className={`${textSize} font-medium text-slate-700 truncate`} title={d.name}>
                {d.name}
              </div>
              <div className={`${textSize} font-semibold text-slate-900 tabular-nums shrink-0`}>
                {d.count}
              </div>
            </div>
            <div className={`${barHeight} rounded-full bg-slate-100 overflow-hidden`}>
              <div
                className="h-full bg-brand-chart rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%` }}
                aria-label={`${d.name} ${d.count}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Country distribution as ranked horizontal bars (replaces the old 12-hue pie):
 * top 10 shown, the tail folded into "Other", counts + shares direct-labeled.
 */
export const CountryBars = ({ data }: { data: { name: string; count: number }[] }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);
  if (total === 0) {
    return <div className="py-6 text-center text-sm text-slate-500">No data</div>;
  }

  const TOP = 10;
  const top = data.slice(0, TOP);
  const rest = data.slice(TOP);
  const rows = [...top];
  if (rest.length > 0) {
    rows.push({
      name: `Other (${rest.length} countries)`,
      count: rest.reduce((s, r) => s + r.count, 0),
    });
  }
  const max = Math.max(...rows.map((r) => r.count)) || 1;

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const pct = Math.round((row.count / max) * 100);
        const share = ((row.count / total) * 100).toFixed(1);
        return (
          <div key={row.name} className="grid grid-cols-[minmax(0,11rem)_1fr_auto] items-center gap-3">
            <div className="text-xs font-medium text-slate-700 truncate" title={row.name}>
              {row.name}
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-brand-chart rounded-full"
                style={{ width: `${pct}%` }}
                aria-label={`${row.name}: ${row.count}`}
              />
            </div>
            <div className="text-xs text-slate-600 tabular-nums whitespace-nowrap">
              <span className="font-semibold text-slate-900">{row.count}</span>
              <span className="text-slate-400"> · {share}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const StatCard = ({
  title,
  value,
  icon,
  subtitle,
  color = 'slate',
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  color?:
    | 'gold'
    | 'blue'
    | 'green'
    | 'orange'
    | 'purple'
    | 'indigo'
    | 'cyan'
    | 'teal'
    | 'emerald'
    | 'sky'
    | 'slate';
}) => {
  const colorClasses = {
    gold: 'bg-brand-50 border-brand-200 text-brand-700',
    blue: 'bg-sky-50 border-sky-200 text-sky-600',
    green: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    orange: 'bg-amber-50 border-amber-200 text-amber-600',
    purple: 'bg-violet-50 border-violet-200 text-violet-600',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-600',
    teal: 'bg-teal-50 border-teal-200 text-teal-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    sky: 'bg-sky-50 border-sky-200 text-sky-600',
    slate: 'bg-slate-100 border-slate-200 text-slate-700',
  };

  return (
    <div className="bg-white border border-slate-200 shadow-sm p-3 rounded-lg">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</p>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div
          className={`h-10 w-10 rounded-lg ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};
