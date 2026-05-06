import type React from 'react';

interface RelatedOrganizationsProps {
  organizations: Record<string, string>[];
}

export const RelatedOrganizations: React.FC<RelatedOrganizationsProps> = ({ organizations }) => {
  if (organizations.length === 0) return null;
  const first = organizations[0];
  if (!first) return null;

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Thông tin tổ chức</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {Object.entries(first).map(
          ([key, value]) =>
            value &&
            value !== 'N/A' && (
              <div key={key} className="pb-2 border-b border-slate-100 last:border-0">
                <div className="text-xs text-slate-500 mb-0.5">
                  {key.replace(/([A-Z])/g, ' $1').trim()}
                </div>
                <div className="text-sm text-slate-800 break-words">
                  {typeof value === 'string' &&
                  (value.toLowerCase().includes('http') ||
                    value.toLowerCase().startsWith('www')) ? (
                    <a
                      href={value.startsWith('http') ? value : `https://${value}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline break-all"
                    >
                      {value}
                    </a>
                  ) : (
                    String(value)
                  )}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
};
