// @ts-nocheck — TODO(refactor): god-adjacent file (651 LOC) with 23+ strict-mode
// errors requiring structural changes. Resolve when this view is split per
// sub-project #4. See STRICT_DEBT.md.
import type React from 'react';
import { useMemo } from 'react';
import { extractEventModalData } from './EventModal/eventModalData';
import { ModalHeader } from './EventModal/ModalHeader';
import { SummaryStatistics } from './EventModal/SummaryStatistics';
import { DataQualityIssues } from './EventModal/DataQualityIssues';
import { RelatedOrganizations } from './EventModal/RelatedOrganizations';
import { RelatedContacts } from './EventModal/RelatedContacts';

interface EventModalProps {
  event: {
    name: string;
    data: string;
    id?: string;
    dataQualityScore?: number;
    issues?: any[];
    rawData?: any;
  } | null;
  allExcelData: string;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, allExcelData, onClose }) => {
  const { dataObj, relatedData, categories, statistics } = useMemo(
    () => extractEventModalData(event, allExcelData),
    [event, allExcelData],
  );

  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-fade-in">
        <ModalHeader
          eventName={event.name}
          dataQualityScore={event.dataQualityScore}
          onClose={onClose}
        />

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            <SummaryStatistics statistics={statistics} sequence={dataObj.SEQUENCE} />

            <RelatedOrganizations organizations={relatedData.organizations} />
            <RelatedContacts contacts={relatedData.contacts} />

            {/* Other Editions (Event History) */}
            {relatedData.otherEditions.length > 0 && (
              <div className="bg-white rounded border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Lịch sử event ({relatedData.otherEditions.length} editions khác)
                </h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {relatedData.otherEditions.map((edition: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 rounded border border-slate-200 px-3 py-2"
                    >
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
            )}

            <DataQualityIssues issues={event.issues} />

            {/* All Event Data in Table Format */}
            {Object.keys(dataObj).length > 0 && (
              <div className="bg-white rounded border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-3">Tất cả thông tin</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-slate-200">
                      {Object.entries(dataObj)
                        .sort(([keyA], [keyB]) => {
                          // Sort by category priority
                          const priority: { [key: string]: number } = {
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
                          const getPriority = (key: string) => {
                            const keyUpper = key.toUpperCase();
                            for (const [prefix, prio] of Object.entries(priority)) {
                              if (keyUpper.includes(prefix)) return prio;
                            }
                            return 999;
                          };
                          return getPriority(keyA) - getPriority(keyB);
                        })
                        .map(([key, value]) => {
                          // Format value
                          let displayValue: any = value;
                          const valueStr = String(value || '').trim();

                          if (
                            !valueStr ||
                            valueStr === 'N/A' ||
                            valueStr === 'null' ||
                            valueStr === 'undefined'
                          ) {
                            displayValue = <span className="text-slate-400 italic">Không có</span>;
                          } else if (typeof value === 'boolean') {
                            displayValue = value ? 'Có' : 'Không';
                          } else if (
                            valueStr.toLowerCase().includes('http') ||
                            valueStr.toLowerCase().startsWith('www')
                          ) {
                            displayValue = (
                              <a
                                href={
                                  valueStr.startsWith('http') ? valueStr : `https://${valueStr}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {valueStr}
                              </a>
                            );
                          } else if (valueStr.includes('@')) {
                            displayValue = (
                              <a
                                href={`mailto:${valueStr}`}
                                className="text-blue-600 hover:underline"
                              >
                                {valueStr}
                              </a>
                            );
                          } else {
                            displayValue = valueStr;
                          }

                          // Format key name
                          const formattedKey = key
                            .replace(/([A-Z])/g, ' $1')
                            .replace(/^./, (str) => str.toUpperCase())
                            .trim();

                          return (
                            <tr key={key} className="bg-slate-50">
                              <td className="py-2 pr-4 align-top w-1/3">
                                <span className="font-medium text-slate-700 text-xs">
                                  {formattedKey}
                                </span>
                              </td>
                              <td className="py-2 align-top">
                                <span className="text-slate-800 break-words">
                                  {typeof displayValue === 'string' ? displayValue : displayValue}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Raw Data (for debugging) */}
            <details className="bg-slate-50 rounded border border-slate-200 px-4 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                Raw Data (Click to expand)
              </summary>
              <pre className="mt-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                {JSON.stringify(dataObj, null, 2)}
              </pre>
            </details>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
