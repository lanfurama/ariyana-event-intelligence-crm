import type React from 'react';

interface RelatedContactsProps {
  contacts: Record<string, string>[];
}

function renderValue(valueStr: string): React.ReactNode {
  if (valueStr.includes('@')) {
    return (
      <a href={`mailto:${valueStr}`} className="text-blue-600 hover:underline">
        {valueStr}
      </a>
    );
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
  return valueStr;
}

export const RelatedContacts: React.FC<RelatedContactsProps> = ({ contacts }) => {
  if (contacts.length === 0) return null;

  return (
    <div className="bg-white rounded border border-slate-200 px-4 py-3">
      <h3 className="text-sm font-semibold text-slate-700 mb-2">
        Thông tin liên hệ (từ sheet Contacts)
      </h3>
      <div className="space-y-3">
        {contacts.map((contact, idx) => (
          <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
            <div className="text-xs font-medium text-slate-600 mb-2">Contact #{idx + 1}</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(contact)
                    .filter(
                      ([, value]) =>
                        value && String(value).trim() && String(value).trim() !== 'N/A',
                    )
                    .map(([key, value]) => {
                      const formattedKey = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (str) => str.toUpperCase())
                        .trim();
                      const valueStr = String(value).trim();
                      return (
                        <tr key={key} className="bg-white">
                          <td className="py-1 pr-4 align-top w-1/3">
                            <span className="font-medium text-slate-700 text-xs">
                              {formattedKey}
                            </span>
                          </td>
                          <td className="py-1 align-top">
                            <span className="text-slate-800 break-words">
                              {renderValue(valueStr)}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
