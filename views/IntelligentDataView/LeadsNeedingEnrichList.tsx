import React from 'react';
import { Users } from 'lucide-react';
import type { Lead } from '../../types';
import { EnrichRow } from './EnrichRow';

export interface LeadsNeedingEnrichListProps {
  leads: Lead[];
  enrichingIds: Set<string>;
  onResearch: (lead: Lead) => void;
  searchTerm?: string;
}

export const LeadsNeedingEnrichList: React.FC<LeadsNeedingEnrichListProps> = ({
  leads,
  enrichingIds,
  onResearch,
  searchTerm = '',
}) => {
  const filtered = searchTerm.trim()
    ? leads.filter((l) =>
        l.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : leads;

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-10 text-center">
        <Users size={48} className="mx-auto mb-3 text-slate-300" />
        <h3 className="text-lg font-semibold text-slate-800 mb-1">
          {leads.length === 0 ? 'No leads need enrichment' : 'No matches'}
        </h3>
        <p className="text-sm text-slate-600 max-w-sm mx-auto">
          {leads.length === 0
            ? 'All leads have email filled. Add new leads without email in ICCA Leads to see them here.'
            : 'Try a different search term.'}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px]">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Company
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Industry
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Country
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Missing
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead) => (
              <EnrichRow
                key={lead.id}
                lead={lead}
                onResearch={onResearch}
                isEnriching={enrichingIds.has(lead.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
