import type React from 'react';

interface OtherEditionsProps {
  otherEditions: Record<string, string>[];
}

export const OtherEditions: React.FC<OtherEditionsProps> = ({ otherEditions }) => {
  if (otherEditions.length === 0) return null;

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        Lịch sử event ({otherEditions.length} editions khác)
      </h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {otherEditions.map((edition, idx) => (
          <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
            <div className="font-medium text-sm text-slate-800 mb-1">
              {edition.EVENT ||
                edition.Event ||
                edition.eventName ||
                `Edition ${edition.SEQUENCE || idx + 1}`}
            </div>
            <div className="text-xs text-slate-600 space-y-0.5">
              {edition.YEAR && <div>Năm: {edition.YEAR}</div>}
              {edition.CITY && edition.COUNTRY && (
                <div>
                  Địa điểm: {edition.CITY}, {edition.COUNTRY}
                </div>
              )}
              {edition.SEQUENCE && <div>Sequence: {edition.SEQUENCE}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
