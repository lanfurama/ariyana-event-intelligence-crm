// @ts-nocheck — TODO(refactor): god file (1621 LOC) with 21+ strict-mode errors
// requiring structural changes. Resolve when this file is split per sub-project #4.
// See STRICT_DEBT.md.
import type React from 'react';
import { useState } from 'react';
import { Search, Mail, X, Lock } from 'lucide-react';
import type { Lead, User } from '../types';
import { useLeadEdit } from './LeadDetail/useLeadEdit';
import { LeadInfoTab } from './LeadDetail/LeadInfoTab';
import { LeadEnrichTab } from './LeadDetail/LeadEnrichTab';
import { LeadEmailTab } from './LeadDetail/LeadEmailTab';
import { useLeadEnrichment } from './LeadDetail/useLeadEnrichment';
import { useLeadEmail } from './LeadDetail/useLeadEmail';
import { useEscapeKey } from '../hooks/useEscapeKey';

export const LeadDetail = ({
  lead,
  onClose,
  onSave,
  user,
}: {
  lead: Lead;
  onClose: () => void;
  onSave: (l: Lead) => void;
  user: User;
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'enrich' | 'email'>('info');

  const edit = useLeadEdit(lead, onSave);

  // Enrichment state + handlers (owned by useLeadEnrichment)
  const enrichment = useLeadEnrichment(lead, edit.editedLead, edit.setEditedLead, onSave);

  // Email state + handlers (owned by useLeadEmail)
  const email = useLeadEmail(lead, activeTab, edit.setEditedLead, onSave);

  const canEdit = user.role === 'Director' || user.role === 'Sales';

  useEscapeKey(true, onClose);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-slate-200">
        <div className="px-3 py-2 border-b border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{lead.companyName}</h2>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              {lead.industry} • {lead.country}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 p-1.5 rounded-lg hover:bg-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex border-b border-slate-200 bg-white">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 ${
              activeTab === 'info'
                ? 'text-brand-700 border-b-2 border-brand-500 bg-brand-50/50'
                : 'text-slate-500'
            }`}
          >
            <span>Contact Info</span>
          </button>

          <button
            onClick={() => setActiveTab('enrich')}
            className={`flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 ${
              activeTab === 'enrich'
                ? 'text-brand-700 border-b-2 border-brand-500 bg-brand-50/50'
                : 'text-slate-500'
            }`}
          >
            <Search size={14} /> <span>Google Enrich</span>
          </button>

          {canEdit ? (
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 ${
                activeTab === 'email'
                  ? 'text-brand-700 border-b-2 border-brand-500 bg-brand-50/50'
                  : 'text-slate-500'
              }`}
            >
              <Mail size={14} /> <span>Send Mail</span>
            </button>
          ) : (
            <div
              className="flex-1 py-2 font-semibold text-xs flex justify-center items-center gap-1.5 text-slate-300 cursor-not-allowed bg-slate-50"
              title="Viewer Only"
            >
              <Lock size={14} /> <span>Send Mail</span>
            </div>
          )}
        </div>

        <div className="p-3 flex-1 overflow-y-auto">
          {activeTab === 'info' && <LeadInfoTab lead={lead} user={user} edit={edit} email={email} />}

          {activeTab === 'enrich' && <LeadEnrichTab enrichment={enrichment} canEdit={canEdit} />}

          {activeTab === 'email' && canEdit && <LeadEmailTab lead={lead} email={email} />}
        </div>
      </div>
    </div>
  );
};
