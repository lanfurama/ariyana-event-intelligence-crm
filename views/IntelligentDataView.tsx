import React, { useState, useCallback } from 'react';
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
            Leads missing key person info — use AI to research and fill contact details.
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
        <p className="text-sm text-slate-600 self-center">
          {leadsNeedingEnrich.length} lead{leadsNeedingEnrich.length !== 1 ? 's' : ''} need
          enrichment
        </p>
      </div>

      <LeadsNeedingEnrichList
        leads={leadsNeedingEnrich}
        enrichingIds={enrichingIds}
        onResearch={handleResearch}
        searchTerm={searchTerm}
      />

      <ResearchModal
        open={!!researchLead}
        onClose={handleCloseResearchModal}
        companyName={researchLead?.companyName ?? ''}
        status={researchStatus}
        responseText={researchResponseText}
        errorMessage={researchError}
        canSync={researchStatus === 'success' || researchStatus === 'no_result'}
        onConfirmSync={handleConfirmSync}
        syncing={syncing}
      />
    </div>
  );
};
