import type React from 'react';
import { useMemo } from 'react';
import type { DataIssue } from '../../api/src/utils/dataQuality';
import { extractEventModalData } from './EventModal/eventModalData';
import { ModalHeader } from './EventModal/ModalHeader';
import { SummaryStatistics } from './EventModal/SummaryStatistics';
import { DataQualityIssues } from './EventModal/DataQualityIssues';
import { RelatedOrganizations } from './EventModal/RelatedOrganizations';
import { RelatedContacts } from './EventModal/RelatedContacts';
import { OtherEditions } from './EventModal/OtherEditions';
import { AllEventDataTable } from './EventModal/AllEventDataTable';

interface EventModalProps {
  event: {
    name: string;
    data: string;
    id?: string;
    dataQualityScore?: number;
    issues?: DataIssue[];
    rawData?: Record<string, unknown>;
  } | null;
  allExcelData: string;
  onClose: () => void;
}

export const EventModal: React.FC<EventModalProps> = ({ event, allExcelData, onClose }) => {
  const { dataObj, relatedData, statistics } = useMemo(
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

            <OtherEditions otherEditions={relatedData.otherEditions} />

            <DataQualityIssues issues={event.issues} />

            <AllEventDataTable dataObj={dataObj} />

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
