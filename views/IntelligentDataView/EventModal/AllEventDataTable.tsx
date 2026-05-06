import type React from 'react';

interface AllEventDataTableProps {
  dataObj: Record<string, unknown>;
}

const SORT_PRIORITY: Record<string, number> = {
  EVENT: 1,
  SERIES: 2,
  NAME: 3,
  TITLE: 4,
  CITY: 5,
  COUNTRY: 6,
  LOCATION: 7,
  YEAR: 8,
  DATE: 9,
  START: 10,
  END: 11,
  EMAIL: 12,
  PHONE: 13,
  CONTACT: 14,
  WEBSITE: 15,
  URL: 16,
  ATTEND: 17,
  DELEGATE: 18,
  TOTATTEND: 19,
  REGATTEND: 20,
  SEQUENCE: 21,
  CODE: 22,
  ID: 23,
};

function getPriority(key: string): number {
  const keyUpper = key.toUpperCase();
  for (const [prefix, prio] of Object.entries(SORT_PRIORITY)) {
    if (keyUpper.includes(prefix)) return prio;
  }
  return 999;
}

function renderCellValue(value: unknown): React.ReactNode {
  const valueStr = String(value ?? '').trim();

  if (!valueStr || valueStr === 'N/A' || valueStr === 'null' || valueStr === 'undefined') {
    return <span className="text-slate-400 italic">Không có</span>;
  }
  if (typeof value === 'boolean') {
    return value ? 'Có' : 'Không';
  }
  if (valueStr.toLowerCase().includes('http') || valueStr.toLowerCase().startsWith('www')) {
    return (
      <a
        href={valueStr.startsWith('http') ? valueStr : `https://${valueStr}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-600 hover:underline break-all"
      >
        {valueStr}
      </a>
    );
  }
  if (valueStr.includes('@')) {
    return (
      <a href={`mailto:${valueStr}`} className="text-blue-600 hover:underline">
        {valueStr}
      </a>
    );
  }
  return valueStr;
}

export const AllEventDataTable: React.FC<AllEventDataTableProps> = ({ dataObj }) => {
  if (Object.keys(dataObj).length === 0) return null;

  const sortedEntries = Object.entries(dataObj).sort(
    ([keyA], [keyB]) => getPriority(keyA) - getPriority(keyB),
  );

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Tất cả thông tin</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-200">
            {sortedEntries.map(([key, value]) => {
              const formattedKey = key
                .replace(/([A-Z])/g, ' $1')
                .replace(/^./, (str) => str.toUpperCase())
                .trim();
              return (
                <tr key={key} className="bg-slate-50">
                  <td className="py-2 pr-4 align-top w-1/3">
                    <span className="font-medium text-slate-700 text-xs">{formattedKey}</span>
                  </td>
                  <td className="py-2 align-top">
                    <span className="text-slate-800 break-words">{renderCellValue(value)}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
