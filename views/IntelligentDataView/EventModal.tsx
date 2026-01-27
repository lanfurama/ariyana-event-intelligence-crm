import React, { useMemo } from 'react';
import { X } from 'lucide-react';

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
  const { dataObj, relatedData, categories, statistics } = useMemo(() => {
    if (!event) {
      return { dataObj: {}, relatedData: {}, categories: {}, statistics: {} };
    }

    // Get rawData object if available, otherwise parse from data string
    const rawData = event.rawData || {};
    const dataObj: { [key: string]: any } = {};

    // If we have rawData object, use it directly
    if (Object.keys(rawData).length > 0) {
      Object.entries(rawData).forEach(([key, value]) => {
        // Include all values except _sheet, but show null/undefined as empty string
        if (key !== '_sheet') {
          dataObj[key] = value !== null && value !== undefined ? value : '';
        }
      });
    } else {
      // Otherwise parse from data string
      event.data.split(', ').forEach((part: string) => {
        const [key, ...valueParts] = part.split(': ');
        const value = valueParts.join(': ').trim();
        if (key.trim()) {
          dataObj[key.trim()] = value || '';
        }
      });
    }

    // Find related data from other sheets using allExcelData
    const relatedData: { [key: string]: any[] } = {
      organizations: [],
      contacts: [],
      otherEditions: [],
      suppliers: [],
    };

    if (allExcelData) {
      const lines = allExcelData.split('\n');
      const seriesId = dataObj.SERIESID || dataObj.SeriesID || dataObj.seriesId;
      const ecode = dataObj.ECODE || dataObj.Ecode || dataObj.ecode;

      lines.forEach((line: string) => {
        if (!line.trim()) return;

        // Parse line format: "Row X (Sheet: Y): Field1: Value1, Field2: Value2, ..."
        const rowMatch = line.match(/Row \d+ \(Sheet: ([^)]+)\):\s*(.+)/);
        if (rowMatch) {
          const sheetName = rowMatch[1].toLowerCase();
          const dataPart = rowMatch[2];
          const fields: { [key: string]: string } = {};

          // Parse fields
          dataPart.split(', ').forEach((pair: string) => {
            const match = pair.match(/([^:]+):\s*(.+)/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim();
              fields[key] = value;
            }
          });

          // Check if this row is related to current event
          const isRelated =
            (seriesId &&
              (fields.SERIESID === seriesId ||
                fields.SeriesID === seriesId ||
                fields.seriesId === seriesId)) ||
            (ecode &&
              (fields.ECODE === ecode ||
                fields.Ecode === ecode ||
                fields.ecode === ecode)) ||
            (dataObj.SERIESNAME &&
              fields.SERIESNAME &&
              fields.SERIESNAME.toLowerCase().includes(
                dataObj.SERIESNAME.toLowerCase().substring(0, 20)
              ));

          if (isRelated) {
            if (sheetName.includes('org')) {
              relatedData.organizations.push(fields);
            } else if (sheetName.includes('contact')) {
              relatedData.contacts.push(fields);
            } else if (sheetName.includes('edition') && fields.ECODE !== ecode) {
              relatedData.otherEditions.push(fields);
            } else if (sheetName.includes('supplier')) {
              relatedData.suppliers.push(fields);
            }
          }
        }
      });
    }

    // Categorize fields
    const categories: { [key: string]: { [key: string]: any } } = {
      'Event Information': {},
      Organization: {},
      Location: {},
      'Dates & Timing': {},
      'Event Details': {},
      'Contact & Website': {},
      Statistics: {},
      Other: {},
    };

    // Field mapping to categories
    Object.entries(dataObj).forEach(([key, value]) => {
      const keyUpper = key.toUpperCase();
      if (
        keyUpper.includes('SERIES') ||
        keyUpper.includes('ORGANIZATION') ||
        keyUpper.includes('ORG')
      ) {
        categories['Organization'][key] = value;
      } else if (
        keyUpper.includes('CITY') ||
        keyUpper.includes('COUNTRY') ||
        keyUpper.includes('LOCATION') ||
        keyUpper.includes('VENUE')
      ) {
        categories['Location'][key] = value;
      } else if (
        keyUpper.includes('DATE') ||
        keyUpper.includes('YEAR') ||
        keyUpper.includes('TIME') ||
        keyUpper.includes('START') ||
        keyUpper.includes('END')
      ) {
        categories['Dates & Timing'][key] = value;
      } else if (
        keyUpper.includes('EMAIL') ||
        keyUpper.includes('PHONE') ||
        keyUpper.includes('CONTACT') ||
        keyUpper.includes('URL') ||
        keyUpper.includes('WEBSITE') ||
        keyUpper.includes('WEB')
      ) {
        categories['Contact & Website'][key] = value;
      } else if (
        keyUpper.includes('ATTEND') ||
        keyUpper.includes('DELEGATE') ||
        keyUpper.includes('PARTICIPANT') ||
        keyUpper.includes('SEQUENCE') ||
        keyUpper.includes('COUNT')
      ) {
        categories['Statistics'][key] = value;
      } else if (
        keyUpper.includes('EVENT') ||
        keyUpper.includes('NAME') ||
        keyUpper.includes('TITLE') ||
        keyUpper.includes('CODE') ||
        keyUpper.includes('ID')
      ) {
        categories['Event Information'][key] = value;
      } else if (
        keyUpper.includes('EXHIBITION') ||
        keyUpper.includes('COMMERCIAL') ||
        keyUpper.includes('POSTER') ||
        keyUpper.includes('TYPE') ||
        keyUpper.includes('CATEGORY')
      ) {
        categories['Event Details'][key] = value;
      } else {
        categories['Other'][key] = value;
      }
    });

    // Calculate statistics
    const totalEditions = relatedData.otherEditions.length + 1; // +1 for current event
    const locations = new Set<string>();
    const countries = new Set<string>();
    const cities = new Set<string>();

    // Extract location info from current event and related editions
    [dataObj, ...relatedData.otherEditions].forEach((event: any) => {
      if (event.CITY || event.City || event.city) {
        cities.add(event.CITY || event.City || event.city);
      }
      if (event.COUNTRY || event.Country || event.country) {
        countries.add(event.COUNTRY || event.Country || event.country);
      }
      if (event.LOCATION || event.Location || event.location) {
        locations.add(event.LOCATION || event.Location || event.location);
      }
    });

    return {
      dataObj,
      relatedData,
      categories,
      statistics: { totalEditions, locations, countries, cities },
    };
  }, [event, allExcelData]);

  if (!event) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-fade-in">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-slate-900 mb-1">{event.name}</h2>
            {event.dataQualityScore !== undefined && (
              <div className="flex items-center space-x-2 mt-1">
                <span className="text-xs text-slate-500">Data Quality:</span>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded ${
                    event.dataQualityScore >= 80
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : event.dataQualityScore >= 60
                      ? 'bg-yellow-50 text-yellow-700 border border-yellow-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {event.dataQualityScore}%
                </span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-3">
            {/* Summary Statistics */}
            {(statistics.totalEditions > 1 ||
              statistics.locations.size > 0 ||
              statistics.countries.size > 0 ||
              statistics.cities.size > 0) && (
              <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">Tóm tắt</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {statistics.totalEditions > 1 && (
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Tổng số editions</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {statistics.totalEditions}
                      </div>
                    </div>
                  )}
                  {statistics.cities.size > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Thành phố</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {statistics.cities.size}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {Array.from(statistics.cities)
                          .slice(0, 2)
                          .join(', ')}
                        {statistics.cities.size > 2 ? '...' : ''}
                      </div>
                    </div>
                  )}
                  {statistics.countries.size > 0 && (
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Quốc gia</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {statistics.countries.size}
                      </div>
                      <div className="text-xs text-slate-600 mt-0.5">
                        {Array.from(statistics.countries)
                          .slice(0, 2)
                          .join(', ')}
                        {statistics.countries.size > 2 ? '...' : ''}
                      </div>
                    </div>
                  )}
                  {dataObj.SEQUENCE && (
                    <div>
                      <div className="text-xs text-slate-500 mb-0.5">Sequence</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {dataObj.SEQUENCE}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Related Organizations */}
            {relatedData.organizations.length > 0 && (
              <div className="bg-white rounded border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Thông tin tổ chức
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {relatedData.organizations[0] &&
                    Object.entries(relatedData.organizations[0]).map(
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
                        )
                    )}
                </div>
              </div>
            )}

            {/* Related Contacts */}
            {relatedData.contacts.length > 0 && (
              <div className="bg-white rounded border border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700 mb-2">
                  Thông tin liên hệ (từ sheet Contacts)
                </h3>
                <div className="space-y-3">
                  {relatedData.contacts.map((contact: any, idx: number) => (
                    <div
                      key={idx}
                      className="bg-slate-50 rounded border border-slate-200 px-3 py-2"
                    >
                      <div className="text-xs font-medium text-slate-600 mb-2">
                        Contact #{idx + 1}
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <tbody className="divide-y divide-slate-200">
                            {Object.entries(contact)
                              .filter(
                                ([_, value]) =>
                                  value &&
                                  String(value).trim() &&
                                  String(value).trim() !== 'N/A'
                              )
                              .map(([key, value]) => {
                                const formattedKey = key
                                  .replace(/([A-Z])/g, ' $1')
                                  .replace(/^./, (str) => str.toUpperCase())
                                  .trim();
                                const valueStr = String(value).trim();
                                let displayValue: any = valueStr;

                                if (valueStr.includes('@')) {
                                  displayValue = (
                                    <a
                                      href={`mailto:${valueStr}`}
                                      className="text-blue-600 hover:underline"
                                    >
                                      {valueStr}
                                    </a>
                                  );
                                } else if (
                                  valueStr.toLowerCase().includes('http') ||
                                  valueStr.toLowerCase().startsWith('www')
                                ) {
                                  displayValue = (
                                    <a
                                      href={
                                        valueStr.startsWith('http')
                                          ? valueStr
                                          : `https://${valueStr}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-blue-600 hover:underline break-all"
                                    >
                                      {valueStr}
                                    </a>
                                  );
                                }

                                return (
                                  <tr key={key} className="bg-white">
                                    <td className="py-1 pr-4 align-top w-1/3">
                                      <span className="font-medium text-slate-700 text-xs">
                                        {formattedKey}
                                      </span>
                                    </td>
                                    <td className="py-1 align-top">
                                      <span className="text-slate-800 break-words">
                                        {typeof displayValue === 'string'
                                          ? displayValue
                                          : displayValue}
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
            )}

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

            {/* Data Quality Issues */}
            {event.issues &&
              Array.isArray(event.issues) &&
              event.issues.length > 0 && (
                <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-700 mb-2">
                    Vấn đề về chất lượng dữ liệu
                  </h3>
                  <div className="space-y-2">
                    {event.issues.filter((i: any) => i.severity === 'critical').length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-red-700 mb-1">Quan trọng:</div>
                        {event.issues
                          .filter((i: any) => i.severity === 'critical')
                          .map((issue: any, idx: number) => (
                            <div key={idx} className="text-sm text-red-700 mb-1 pl-3">
                              • {issue.message}
                            </div>
                          ))}
                      </div>
                    )}
                    {event.issues.filter((i: any) => i.severity === 'warning').length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-amber-700 mb-1">Cảnh báo:</div>
                        {event.issues
                          .filter((i: any) => i.severity === 'warning')
                          .map((issue: any, idx: number) => (
                            <div key={idx} className="text-sm text-amber-700 mb-1 pl-3">
                              • {issue.message}
                            </div>
                          ))}
                      </div>
                    )}
                    {event.issues.filter((i: any) => i.severity === 'info').length > 0 && (
                      <div>
                        <div className="text-xs font-medium text-slate-600 mb-1">Thông tin:</div>
                        {event.issues
                          .filter((i: any) => i.severity === 'info')
                          .map((issue: any, idx: number) => (
                            <div key={idx} className="text-sm text-slate-600 mb-1 pl-3">
                              • {issue.message}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                            displayValue = (
                              <span className="text-slate-400 italic">Không có</span>
                            );
                          } else if (typeof value === 'boolean') {
                            displayValue = value ? 'Có' : 'Không';
                          } else if (
                            valueStr.toLowerCase().includes('http') ||
                            valueStr.toLowerCase().startsWith('www')
                          ) {
                            displayValue = (
                              <a
                                href={valueStr.startsWith('http') ? valueStr : `https://${valueStr}`}
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
