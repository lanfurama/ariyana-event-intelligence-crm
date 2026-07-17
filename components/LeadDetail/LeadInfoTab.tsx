import type React from 'react';
import { Check, Edit2, Loader2, Lock, Mail, X } from 'lucide-react';
import type { Lead, User } from '../../types';
import { StatusBadge, InfoItem, EditField, EditTextArea } from '../common';
import type { useLeadEdit } from './useLeadEdit';
import type { useLeadEmail } from './useLeadEmail';

interface LeadInfoTabProps {
  lead: Lead;
  user: User;
  edit: ReturnType<typeof useLeadEdit>;
  email: ReturnType<typeof useLeadEmail>;
}

export const LeadInfoTab: React.FC<LeadInfoTabProps> = ({ lead, user, edit, email }) => {
  const { isEditing, setIsEditing, editedLead, handleInputChange, handleSaveChanges } = edit;
  const { handleCheckInbox, checkingInbox, loadingReplies, emailReplies } = email;
  const canEdit = user.role === 'Director' || user.role === 'Sales';

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">Lead Details</h3>
        {canEdit && !isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-sm text-blue-600 flex items-center px-4 py-2 rounded-lg font-semibold border border-blue-200"
          >
            <Edit2 size={16} className="mr-2" /> Edit Info
          </button>
        )}
        {!canEdit && (
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg flex items-center font-semibold border border-slate-200">
            <Lock size={12} className="mr-1.5" /> Read Only
          </span>
        )}
        {isEditing && (
          <div className="flex space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="text-sm text-red-600 flex items-center px-4 py-2 rounded-lg font-semibold border border-red-200"
            >
              <X size={16} className="mr-2" /> Cancel
            </button>
            <button
              onClick={handleSaveChanges}
              className="text-sm bg-green-600 text-white flex items-center px-4 py-2 rounded-lg font-bold shadow-sm"
            >
              <Check size={16} className="mr-2" /> Save Changes
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-slate-500 block mb-1">Lead Status</label>
              <select
                value={editedLead.status}
                onChange={(e) => handleInputChange('status', e.target.value as Lead['status'])}
                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Qualified">Qualified</option>
                <option value="Won">Won</option>
                <option value="Lost">Lost</option>
              </select>
            </div>
            <EditField
              label="Company Name"
              value={editedLead.companyName}
              onChange={(v: string) => handleInputChange('companyName', v)}
            />
            <EditField
              label="Industry"
              value={editedLead.industry}
              onChange={(v: string) => handleInputChange('industry', v)}
            />
            <EditField
              label="Country"
              value={editedLead.country}
              onChange={(v: string) => handleInputChange('country', v)}
            />
            <EditField
              label="City"
              value={editedLead.city}
              onChange={(v: string) => handleInputChange('city', v)}
            />
            <EditField
              label="Website"
              value={editedLead.website}
              onChange={(v: string) => handleInputChange('website', v)}
            />
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Lead Type</label>
              <select
                value={editedLead.type || ''}
                onChange={(e) => handleInputChange('type', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              >
                <option value="">Regular Lead</option>
                <option value="CORP">CORP (Corporate Partner)</option>
                <option value="DMC">DMC (Destination Management Company)</option>
                <option value="HPNY2026">HPNY2026</option>
                <option value="LEAD2026FEB_THAIACC">LEAD2026FEB_THAIACC</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">
                Number of Delegates
              </label>
              <input
                type="number"
                value={editedLead.numberOfDelegates || ''}
                onChange={(e) =>
                  handleInputChange('numberOfDelegates', parseInt(e.target.value) || 0)
                }
                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Primary Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <EditField
                label="Key Person Name"
                value={editedLead.keyPersonName}
                onChange={(v: string) => handleInputChange('keyPersonName', v)}
              />
              <EditField
                label="Title"
                value={editedLead.keyPersonTitle}
                onChange={(v: string) => handleInputChange('keyPersonTitle', v)}
              />
              <EditField
                label="Email"
                value={editedLead.keyPersonEmail}
                onChange={(v: string) => handleInputChange('keyPersonEmail', v)}
              />
              <EditField
                label="Phone"
                value={editedLead.keyPersonPhone}
                onChange={(v: string) => handleInputChange('keyPersonPhone', v)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2">Secondary Contact</h4>
            <div className="grid grid-cols-2 gap-4">
              <EditField
                label="Name"
                value={editedLead.secondaryPersonName || ''}
                onChange={(v: string) => handleInputChange('secondaryPersonName', v)}
              />
              <EditField
                label="Title"
                value={editedLead.secondaryPersonTitle || ''}
                onChange={(v: string) => handleInputChange('secondaryPersonTitle', v)}
              />
              <EditField
                label="Email"
                value={editedLead.secondaryPersonEmail || ''}
                onChange={(v: string) => handleInputChange('secondaryPersonEmail', v)}
              />
            </div>
          </div>

          <div className="border-t pt-4 mt-4">
            <h4 className="text-sm font-bold text-slate-900 mb-2">History & Notes</h4>
            <EditTextArea
              label="Past Events History"
              value={editedLead.pastEventsHistory || ''}
              onChange={(v: string) => handleInputChange('pastEventsHistory', v)}
            />
            <EditTextArea
              label="Notes"
              value={editedLead.notes}
              onChange={(v: string) => handleInputChange('notes', v)}
            />
            <EditTextArea
              label="Research/Search Notes"
              value={editedLead.researchNotes || ''}
              onChange={(v: string) => handleInputChange('researchNotes', v)}
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-lg border-2 border-blue-100">
            <div>
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Status
              </span>
              <StatusBadge status={lead.status} />
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">
                Est. Delegates
              </span>
              <span className="text-lg font-bold text-slate-900">
                {lead.numberOfDelegates || 'N/A'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="Key Person" value={lead.keyPersonName} />
            <InfoItem label="Title" value={lead.keyPersonTitle} />
            <InfoItem label="Email" value={lead.keyPersonEmail || 'N/A'} isLink />
            <InfoItem label="Phone" value={lead.keyPersonPhone || 'N/A'} />
            <InfoItem label="Website" value={lead.website || 'N/A'} isLink />
            <InfoItem label="City" value={lead.city} />
            <InfoItem
              label="Lead Type"
              value={
                lead.type
                  ? lead.type === 'CORP'
                    ? 'CORP (Corporate Partner)'
                    : lead.type === 'DMC'
                      ? 'DMC (Destination Management Company)'
                      : lead.type
                  : 'Regular Lead'
              }
            />
          </div>

          {(lead.secondaryPersonName || lead.secondaryPersonEmail) && (
            <div className="border-t border-slate-100 pt-4 mt-2">
              <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Secondary Contact</h4>
              <div className="grid grid-cols-2 gap-4">
                <InfoItem label="Name" value={lead.secondaryPersonName || '-'} />
                <InfoItem label="Title" value={lead.secondaryPersonTitle || '-'} />
                <InfoItem label="Email" value={lead.secondaryPersonEmail || '-'} isLink />
              </div>
            </div>
          )}

          <div className="border-t border-slate-100 pt-4 mt-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Past Events History</h4>
            <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded">
              {lead.pastEventsHistory || 'No history recorded'}
            </p>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              General Notes
            </label>
            <div className="w-full mt-2 p-3 border border-slate-200 rounded-lg text-sm text-slate-700 bg-slate-50">
              {lead.notes}
            </div>
          </div>

          {lead.researchNotes && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-teal-600">
                Research & Search Data
              </label>
              <div className="w-full mt-2 p-3 border border-teal-100 bg-teal-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                {lead.researchNotes}
              </div>
            </div>
          )}

          {lead.emailHistory && lead.emailHistory.length > 0 && (
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email History
              </label>
              <ul className="mt-2 space-y-2">
                {lead.emailHistory.map((log) => (
                  <li key={log.id} className="text-xs p-2 bg-slate-50 rounded border border-slate-100">
                    <div className="flex justify-between">
                      <span className="font-bold">{log.subject}</span>
                      <span className="text-slate-400">
                        {new Date(log.date).toLocaleDateString()}
                      </span>
                    </div>
                    {log.attachments?.length ? (
                      <div className="text-slate-400 mt-1 italic">
                        Attached: {log.attachments.map((a) => a.name).join(', ')}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Email Replies */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Email Replies
              </label>
              {canEdit && (
                <button
                  onClick={handleCheckInbox}
                  disabled={checkingInbox}
                  className="text-xs px-2 py-1 bg-slate-900 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                >
                  {checkingInbox ? (
                    <>
                      <Loader2 size={12} className="animate-spin" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <Mail size={12} />
                      Check Inbox
                    </>
                  )}
                </button>
              )}
            </div>
            {loadingReplies ? (
              <div className="text-xs text-slate-400 p-2">Loading replies...</div>
            ) : emailReplies.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {emailReplies.map((reply) => (
                  <li key={reply.id} className="text-xs p-3 bg-green-50 rounded border border-green-100">
                    <div className="flex justify-between items-start mb-1">
                      <div>
                        <span className="font-bold text-green-900">
                          {reply.from_name || reply.from_email}
                        </span>
                        <span className="text-green-600 ml-2">({reply.from_email})</span>
                      </div>
                      <span className="text-green-500">
                        {new Date(reply.reply_date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="font-semibold text-green-800 mb-1">{reply.subject}</div>
                    <div className="text-green-700 mt-1 line-clamp-2">
                      {reply.body.substring(0, 200)}
                      {reply.body.length > 200 ? '...' : ''}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-slate-400 p-2 bg-slate-50 rounded border border-slate-100">
                No replies yet
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
