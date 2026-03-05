import React, { useState, useCallback, useMemo } from 'react';
import { BrainCircuit, Search, X } from 'lucide-react';
import type { Lead } from '../types';
import type { ParsedEnrichContact } from '../utils/leadEnrichUtils';
import { useLeadsNeedingEnrich } from '../hooks/useLeadsNeedingEnrich';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import {
  LeadsNeedingEnrichList,
  ResearchModal,
} from './IntelligentDataView/index';
import type { ResearchModalStatus } from './IntelligentDataView/index';

export interface IntelligentDataViewProps {
  leads: Lead[];
  onUpdateLead: (updated: Lead) => Promise<void>;
  loading?: boolean;
}

export const IntelligentDataView: React.FC<IntelligentDataViewProps> = ({
  leads,
  onUpdateLead,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [researchLead, setResearchLead] = useState<Lead | null>(null);
  const [researchParsed, setResearchParsed] = useState<ParsedEnrichContact | null>(null);
  const [researchStatus, setResearchStatus] = useState<ResearchModalStatus>('loading');
  const [researchResponseText, setResearchResponseText] = useState('');
  const [researchError, setResearchError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const {
    leadsNeedingEnrich,
    enrichLead,
    enrichingIds,
    enrichError,
    clearError,
  } = useLeadsNeedingEnrich(leads);

  const visibleLeads = useMemo(() => {
    let filtered = leadsNeedingEnrich;

    const trimmedSearch = searchTerm.trim();
    if (trimmedSearch) {
      const lowered = trimmedSearch.toLowerCase();
      filtered = filtered.filter((l) =>
        l.companyName?.toLowerCase().includes(lowered)
      );
    }

    if (typeFilter) {
      filtered = filtered.filter((l) => l.type === typeFilter);
    }

    return filtered;
  }, [leadsNeedingEnrich, searchTerm, typeFilter]);

  const filteredLeadsCount = visibleLeads.length;

  const [bulkResearching, setBulkResearching] = useState(false);

  const handleResearchAll = useCallback(async () => {
    if (bulkResearching || visibleLeads.length === 0) return;
    setBulkResearching(true);
    try {
      for (const lead of visibleLeads) {
        try {
          const result = await enrichLead(lead);
          const parsed = result.parsed;
          if (
            !parsed ||
            !(
              parsed.keyPersonName ||
              parsed.keyPersonTitle ||
              parsed.keyPersonEmail ||
              parsed.keyPersonPhone
            )
          ) {
            continue;
          }
          const updated: Lead = {
            ...lead,
            keyPersonName: parsed.keyPersonName ?? lead.keyPersonName,
            keyPersonTitle: parsed.keyPersonTitle ?? lead.keyPersonTitle,
            keyPersonEmail: parsed.keyPersonEmail ?? lead.keyPersonEmail,
            keyPersonPhone: parsed.keyPersonPhone ?? lead.keyPersonPhone,
            researchNotes: lead.researchNotes
              ? `${lead.researchNotes}\n[AI Enriched (bulk): ${new Date()
                  .toISOString()
                  .slice(0, 10)}]`
              : `[AI Enriched (bulk): ${new Date().toISOString().slice(0, 10)}]`,
          };
          await onUpdateLead(updated);
        } catch {
          // ignore individual lead failures and continue
        }
      }
    } finally {
      setBulkResearching(false);
    }
  }, [bulkResearching, visibleLeads, enrichLead, onUpdateLead]);

  const handleCloseResearchModal = useCallback(() => {
    setResearchLead(null);
    setResearchParsed(null);
    setResearchStatus('loading');
    setResearchResponseText('');
    setResearchError('');
    setSyncing(false);
  }, []);

  const handleResearch = useCallback(
    (lead: Lead) => {
      setResearchLead(lead);
      setResearchParsed(null);
      setResearchStatus('loading');
      setResearchResponseText('');
      setResearchError('');
      enrichLead(lead)
        .then((result) => {
          setResearchStatus(result.hasResult ? 'success' : 'no_result');
          setResearchResponseText(result.text);
          setResearchParsed(result.parsed);
        })
        .catch((err) => {
          setResearchStatus('error');
          setResearchError(err instanceof Error ? err.message : 'Lỗi nghiên cứu');
        });
    },
    [enrichLead]
  );

  const handleConfirmSync = useCallback(() => {
    if (!researchLead || !researchParsed) return;
    setSyncing(true);
    const updated: Lead = {
      ...researchLead,
      keyPersonName: researchParsed.keyPersonName ?? researchLead.keyPersonName,
      keyPersonTitle: researchParsed.keyPersonTitle ?? researchLead.keyPersonTitle,
      keyPersonEmail: researchParsed.keyPersonEmail ?? researchLead.keyPersonEmail,
      keyPersonPhone: researchParsed.keyPersonPhone ?? researchLead.keyPersonPhone,
      researchNotes: researchLead.researchNotes
        ? `${researchLead.researchNotes}\n[AI Enriched: ${new Date().toISOString().slice(0, 10)}]`
        : `[AI Enriched: ${new Date().toISOString().slice(0, 10)}]`,
    };
    onUpdateLead(updated)
      .then(() => handleCloseResearchModal())
      .catch((err) => {
        setResearchError(err instanceof Error ? err.message : 'Đồng bộ thất bại');
      })
      .finally(() => setSyncing(false));
  }, [researchLead, researchParsed, onUpdateLead, handleCloseResearchModal]);

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="p-6 min-h-screen overflow-y-auto space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BrainCircuit size={28} />
            Event Intelligence Dashboard
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Leads missing email — use AI to research and fill contact details.
          </p>
        </div>
      </div>

      {enrichError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start justify-between gap-3">
          <p className="text-sm text-red-800 flex-1">{enrichError}</p>
          <button
            type="button"
            onClick={clearError}
            className="p-1 rounded text-red-600 hover:bg-red-100"
            aria-label="Dismiss"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Search by company name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="text-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          >
            <option value="">All types</option>
            <option value="CORP">CORP</option>
            <option value="DMC">DMC</option>
            <option value="HPNY2026">HPNY2026</option>
            <option value="LEAD2026FEB_THAIACC">LEAD2026FEB_THAIACC</option>
            <option value="SUMMER_BEACH_2026">SUMMER_BEACH_2026</option>
          </select>
          <p className="text-sm text-slate-600">
            {filteredLeadsCount} lead{filteredLeadsCount !== 1 ? 's' : ''} need enrichment
          </p>
          <button
            type="button"
            onClick={handleResearchAll}
            disabled={bulkResearching || filteredLeadsCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {bulkResearching ? 'Researching all…' : 'Research all'}
          </button>
        </div>
      </div>

      <LeadsNeedingEnrichList
        leads={visibleLeads}
        enrichingIds={enrichingIds}
        onResearch={handleResearch}
      />

      <ResearchModal
        open={!!researchLead}
        onClose={handleCloseResearchModal}
        companyName={researchLead?.companyName ?? ''}
        status={researchStatus}
        responseText={researchResponseText}
        errorMessage={researchError}
        parsedContact={researchParsed}
        canSync={
          (researchStatus === 'success' || researchStatus === 'no_result') &&
          !!(researchParsed?.keyPersonEmail || researchParsed?.keyPersonPhone)
        }
        onConfirmSync={handleConfirmSync}
        syncing={syncing}
      />
    </div>
  );
};
