import type React from 'react';
import type { EventStatistics } from './eventModalData';

interface SummaryStatisticsProps {
  statistics: EventStatistics;
  sequence?: unknown;
}

export const SummaryStatistics: React.FC<SummaryStatisticsProps> = ({ statistics, sequence }) => {
  const shouldShow =
    statistics.totalEditions > 1 ||
    statistics.locations.size > 0 ||
    statistics.countries.size > 0 ||
    statistics.cities.size > 0;

  if (!shouldShow) return null;

  return (
    <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Tóm tắt</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statistics.totalEditions > 1 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Tổng số editions</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.totalEditions}</div>
          </div>
        )}
        {statistics.cities.size > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Thành phố</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.cities.size}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {Array.from(statistics.cities).slice(0, 2).join(', ')}
              {statistics.cities.size > 2 ? '...' : ''}
            </div>
          </div>
        )}
        {statistics.countries.size > 0 && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Quốc gia</div>
            <div className="text-lg font-semibold text-slate-900">{statistics.countries.size}</div>
            <div className="text-xs text-slate-600 mt-0.5">
              {Array.from(statistics.countries).slice(0, 2).join(', ')}
              {statistics.countries.size > 2 ? '...' : ''}
            </div>
          </div>
        )}
        {sequence !== undefined && sequence !== null && sequence !== '' && (
          <div>
            <div className="text-xs text-slate-500 mb-0.5">Sequence</div>
            <div className="text-lg font-semibold text-slate-900">{String(sequence)}</div>
          </div>
        )}
      </div>
    </div>
  );
};
