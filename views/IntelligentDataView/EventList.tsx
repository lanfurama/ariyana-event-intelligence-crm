import React from 'react';
import { Search, Check, Loader2, X, FileText, Sparkles } from 'lucide-react';

interface OrganizationProgress {
  companyName: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  result?: any;
  error?: string;
}

interface Event {
  name: string;
  data: string;
  id?: string;
  rawData?: any;
  dataQualityScore?: number;
  issues?: any[];
  eventHistory?: string;
  editions?: any[];
  organizationName?: string;
}

interface FilteredEvent {
  event: Event;
  idx: number;
  progress?: OrganizationProgress;
  wasAnalyzed: boolean;
  wasSkipped: boolean;
  skipReason?: string | null;
}

interface EventListProps {
  filteredEvents: FilteredEvent[];
  savedToDatabase: Set<string>;
  researchingEditions: Set<string>;
  onEventClick: (event: {
    name: string;
    data: string;
    id?: string;
    dataQualityScore?: number;
    issues?: any[];
    rawData?: any;
  }) => void;
  onResearchEditions: (eventName: string, editions: any[]) => void;
}

export const EventList: React.FC<EventListProps> = ({
  filteredEvents,
  savedToDatabase,
  researchingEditions,
  onEventClick,
  onResearchEditions,
}) => {
  if (filteredEvents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">#</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[300px]">Event Name</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-28">Status</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">Score</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-32">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                  <Search size={48} className="mx-auto mb-3 text-slate-300" />
                  <p className="text-sm font-medium">No events match your filters</p>
                  <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">#</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[300px]">Event Name</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-28">Status</th>
              <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">Score</th>
              <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {filteredEvents.map(({ event, idx, progress, wasSkipped, skipReason }) => (
              <tr
                key={event.id || idx}
                className={`${
                  progress?.status === 'completed'
                    ? 'bg-green-50/30'
                    : progress?.status === 'analyzing'
                    ? 'bg-blue-50/30'
                    : progress?.status === 'error'
                    ? 'bg-red-50/30'
                    : wasSkipped
                    ? 'bg-amber-50/30'
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-600">{idx + 1}</td>

                {/* Event Name */}
                <td className="px-4 py-3">
                  <div className="flex items-center space-x-2">
                    {progress?.status === 'completed' && (
                      <Check className="text-green-600 flex-shrink-0" size={16} />
                    )}
                    {progress?.status === 'analyzing' && (
                      <Loader2 className="animate-spin text-blue-600 flex-shrink-0" size={16} />
                    )}
                    {progress?.status === 'error' && (
                      <X className="text-red-600 flex-shrink-0" size={16} />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900 truncate">
                        {progress?.result?.companyName || event.name}
                      </div>
                      {progress?.result?.industry && (
                        <div className="text-xs text-slate-500 mt-0.5 truncate">
                          {progress.result.industry}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Status */}
                <td className="px-4 py-3">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                        progress?.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : progress?.status === 'analyzing'
                          ? 'bg-blue-100 text-blue-800'
                          : progress?.status === 'error'
                          ? 'bg-red-100 text-red-800'
                          : wasSkipped
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {progress?.status === 'completed'
                        ? 'Completed'
                        : progress?.status === 'analyzing'
                        ? 'Analyzing'
                        : progress?.status === 'error'
                        ? 'Error'
                        : wasSkipped
                        ? 'Not Analyzed'
                        : 'Pending'}
                    </span>
                    {wasSkipped && skipReason && (
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200"
                        title={skipReason}
                      >
                        ⚠️ {skipReason}
                      </span>
                    )}
                    {progress?.status === 'completed' && progress.result && (() => {
                      const eventName = (progress.result.companyName || event.name || '').toLowerCase().trim();
                      return savedToDatabase.has(eventName) ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                          ✓ Đã lưu vào database
                        </span>
                      ) : null;
                    })()}
                  </div>
                </td>

                {/* Score */}
                <td className="px-4 py-3">
                  {progress?.status === 'completed' && progress.result ? (
                    <div className="flex items-center space-x-1">
                      <span className="text-base font-bold text-indigo-600">
                        {progress.result.totalScore || 0}
                      </span>
                      <span className="text-xs text-slate-500">/100</span>
                    </div>
                  ) : event.dataQualityScore !== undefined ? (
                    <span
                      className={`text-sm font-semibold ${
                        event.dataQualityScore >= 80
                          ? 'text-green-600'
                          : event.dataQualityScore >= 60
                          ? 'text-yellow-600'
                          : 'text-red-600'
                      }`}
                    >
                      {event.dataQualityScore}%
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">-</span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center justify-center gap-2">
                    {progress?.status === 'completed' && progress.result && (
                      <>
                        <button
                          onClick={() =>
                            onEventClick({
                              name: progress.result.companyName || event.name,
                              data: event.data,
                              id: event.id,
                              dataQualityScore: event.dataQualityScore,
                              issues: event.issues,
                              rawData: event.rawData,
                            })
                          }
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                          title="View Details"
                        >
                          <FileText size={16} />
                        </button>
                        {(() => {
                          // Check for editions in result or event
                          const editions = progress.result.editions || event.editions || [];
                          const hasEditions = Array.isArray(editions) && editions.length > 0;

                          if (hasEditions) {
                            const eventName = progress.result.companyName || event.name;
                            const isResearching = Array.from(researchingEditions).some((key) =>
                              key.includes(eventName)
                            );

                            return (
                              <button
                                onClick={() => {
                                  if (!isResearching) {
                                    onResearchEditions(eventName, editions);
                                  }
                                }}
                                disabled={isResearching}
                                className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Research Edition Leadership"
                              >
                                {isResearching ? (
                                  <Loader2 className="animate-spin" size={16} />
                                ) : (
                                  <Sparkles size={16} />
                                )}
                              </button>
                            );
                          }
                          return null;
                        })()}
                      </>
                    )}
                    {event.rawData && !progress?.result && (
                      <button
                        onClick={() =>
                          onEventClick({
                            name: event.name,
                            data: event.data,
                            id: event.id,
                            dataQualityScore: event.dataQualityScore,
                            issues: event.issues,
                            rawData: event.rawData,
                          })
                        }
                        className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                        title="View Raw Data"
                      >
                        <Search size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
