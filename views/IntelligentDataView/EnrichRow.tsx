import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import type { Lead } from '../../types';
import { isLeadMissingPersonInfo } from '../../utils/leadEnrichUtils';

function missingBadges(lead: Lead): { name: boolean; email: boolean; phone: boolean } {
  const nameOk = !!lead.keyPersonName?.trim();
  const emailOk =
    !!lead.keyPersonEmail?.trim() &&
    !/^(info|contact|admin|support)@/i.test(lead.keyPersonEmail.trim());
  const phoneOk = !!lead.keyPersonPhone?.trim();
  return { name: !nameOk, email: !emailOk, phone: !phoneOk };
}

export interface EnrichRowProps {
  lead: Lead;
  onResearch: (lead: Lead) => void;
  isEnriching: boolean;
}

export const EnrichRow: React.FC<EnrichRowProps> = ({ lead, onResearch, isEnriching }) => {
  const missing = missingBadges(lead);
  return (
    <tr className="border-b border-slate-200 hover:bg-slate-50/50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium text-slate-900">{lead.companyName}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{lead.industry || '—'}</td>
      <td className="px-4 py-3 text-sm text-slate-600">{lead.country || '—'}</td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {missing.name && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
              No name
            </span>
          )}
          {missing.email && (
            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs font-medium">
              No email
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onResearch(lead)}
          disabled={isEnriching}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isEnriching ? (
            <Loader2 className="animate-spin" size={16} />
          ) : (
            <Search size={16} />
          )}
          {isEnriching ? 'Researching…' : 'Research'}
        </button>
      </td>
    </tr>
  );
};
