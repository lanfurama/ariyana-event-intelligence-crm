// @ts-nocheck — TODO(refactor): god file (1621 LOC) with 21+ strict-mode errors
// requiring structural changes. Resolve when this file is split per sub-project #4.
// See STRICT_DEBT.md.
import type React from 'react';
import { useState } from 'react';
import {
  Search,
  Mail,
  Plus,
  Loader2,
  Save,
  X,
  Check,
  ExternalLink,
  User as UserIcon,
  CheckCircle,
  Lock,
} from 'lucide-react';
import type { Lead, User } from '../types';
import { useLeadEdit } from './LeadDetail/useLeadEdit';
import { LeadInfoTab } from './LeadDetail/LeadInfoTab';
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
  const {
    enrichLoading,
    enrichResult,
    rateLimitCountdown,
    enrichCompanyName,
    setEnrichCompanyName,
    enrichKeyPerson,
    setEnrichKeyPerson,
    researchResults,
    handleEnrich,
    handleApproveEmail,
    handleRejectEmail,
    handleSaveEnrichment,
  } = useLeadEnrichment(lead, edit.editedLead, edit.setEditedLead, onSave);

  // Email state + handlers (owned by useLeadEmail)
  const email = useLeadEmail(lead, activeTab, edit.setEditedLead, onSave);
  const {
    emailLoading,
    draftedEmail,
    setDraftedEmail,
    emailSent,
    setEmailSent,
    selectedTemplate,
    setSelectedTemplate,
    emailCC,
    setEmailCC,
    attachments,
    setAttachments,
    emailRateLimitCountdown,
    emailTemplates,
    loadingTemplates,
    emailBodyViewMode,
    setEmailBodyViewMode,
    emailReplies,
    loadingReplies,
    checkingInbox,
    handleCheckInbox,
    handleTemplateChange,
    handleDraftEmail,
    handleFileUpload,
    handleSendEmail,
  } = email;

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

          {activeTab === 'enrich' && (
            <div className="space-y-3">
              <div className="bg-blue-50 px-2.5 py-2 rounded border border-blue-100">
                <p className="text-xs text-blue-800">
                  Use AI to research key person name and email for this lead.
                </p>
              </div>
              {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded px-2.5 py-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-yellow-800">
                        ⚠️ Rate Limit Exceeded
                      </p>
                      <p className="text-xs text-yellow-700 mt-0.5">
                        Please wait before trying again.
                      </p>
                    </div>
                    <div className="text-lg font-bold text-yellow-600">
                      {Math.floor(rateLimitCountdown / 60)}:
                      {(rateLimitCountdown % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}

              {!enrichResult && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Key Person Name (optional - AI will find if blank)
                    </label>
                    <input
                      type="text"
                      value={enrichKeyPerson}
                      onChange={(e) => setEnrichKeyPerson(e.target.value)}
                      placeholder="Enter key contact person name to search"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={enrichLoading}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={enrichCompanyName}
                      onChange={(e) => setEnrichCompanyName(e.target.value)}
                      placeholder="Enter company or organization (context for search)"
                      className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={enrichLoading}
                    />
                  </div>

                  <button
                    onClick={handleEnrich}
                    disabled={
                      enrichLoading ||
                      !canEdit ||
                      (rateLimitCountdown !== null && rateLimitCountdown > 0) ||
                      !enrichCompanyName.trim()
                    }
                    className="w-full py-2.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-semibold text-sm flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {enrichLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        Researching...
                      </>
                    ) : rateLimitCountdown !== null && rateLimitCountdown > 0 ? (
                      <>
                        <Loader2 size={16} />
                        Retry in {rateLimitCountdown}s
                      </>
                    ) : (
                      <>
                        <Search size={16} />
                        Research Key Person & Email
                      </>
                    )}
                  </button>
                </div>
              )}

              {enrichResult && (
                <div className="space-y-3">
                  <div className="bg-white border border-slate-200 rounded p-3">
                    <h4 className="font-bold text-slate-900 mb-2 text-base">AI Summary</h4>
                    <div
                      className="text-slate-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: enrichResult.text
                          .replace(
                            /\*\*(.*?)\*\*/g,
                            '<strong class="font-semibold text-slate-900">$1</strong>',
                          )
                          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                          .replace(
                            /^### (.*$)/gim,
                            '<h3 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h3>',
                          )
                          .replace(
                            /^## (.*$)/gim,
                            '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-3">$1</h2>',
                          )
                          .replace(
                            /^# (.*$)/gim,
                            '<h1 class="text-xl font-bold text-slate-900 mt-6 mb-4">$1</h1>',
                          )
                          .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed">')
                          .replace(/\n/g, '<br />')
                          .replace(/^(.+)$/, '<p class="mb-3 leading-relaxed">$1</p>'),
                      }}
                    />
                  </div>
                  {enrichResult.grounding && (
                    <div className="bg-slate-50 px-3 py-2 rounded border border-slate-200">
                      <h5 className="text-xs font-bold text-slate-500 uppercase mb-2 tracking-wider">
                        Sources
                      </h5>
                      <ul className="space-y-1.5">
                        {(() => {
                          // Extract domain from URI for duplicate detection
                          const getDomain = (uri: string): string => {
                            if (!uri) return '';
                            try {
                              let url = uri.trim();
                              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                                url = 'https://' + url;
                              }
                              const urlObj = new URL(url);
                              return urlObj.hostname.replace(/^www\./, '').toLowerCase();
                            } catch {
                              // Fallback: extract domain manually
                              const match = uri.match(/(?:https?:\/\/)?(?:www\.)?([^/]+)/);
                              return match ? match[1].toLowerCase() : uri.toLowerCase();
                            }
                          };

                          // Remove duplicates by domain
                          const seenDomains = new Set<string>();
                          const uniqueSources: any[] = [];

                          enrichResult.grounding.forEach((chunk: any) => {
                            if (!chunk.web?.uri) return;
                            const domain = getDomain(chunk.web.uri);
                            if (!seenDomains.has(domain)) {
                              seenDomains.add(domain);
                              uniqueSources.push(chunk);
                            }
                          });

                          return uniqueSources.map((chunk: any, i: number) => (
                            <li key={i} className="flex items-start">
                              <ExternalLink
                                size={14}
                                className="mr-2 mt-0.5 text-slate-400 flex-shrink-0"
                              />
                              <a
                                href={chunk.web.uri}
                                target="_blank"
                                rel="noreferrer"
                                className="text-xs text-blue-600 break-all flex-1"
                              >
                                {chunk.web.title || chunk.web.uri}
                              </a>
                            </li>
                          ));
                        })()}
                      </ul>
                    </div>
                  )}

                  {/* Key Person Research Results */}
                  {researchResults &&
                    (researchResults.name || researchResults.title || researchResults.email) && (
                      <div className="bg-brand-50/60 border border-brand-200 rounded-lg p-3 space-y-3">
                        <h4 className="font-bold text-brand-800 text-sm flex items-center">
                          <UserIcon size={16} className="mr-1.5" />
                          Key Person Research Results
                        </h4>

                        <div className="space-y-3">
                          {researchResults.name && (
                            <div className="flex items-start">
                              <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">
                                Name:
                              </span>
                              <span className="text-sm text-slate-900 font-medium">
                                {researchResults.name}
                              </span>
                            </div>
                          )}

                          {researchResults.title && (
                            <div className="flex items-start">
                              <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">
                                Title:
                              </span>
                              <span className="text-sm text-slate-900 font-medium">
                                {researchResults.title}
                              </span>
                            </div>
                          )}

                          {researchResults.email && (
                            <div className="space-y-2">
                              <div className="flex items-start">
                                <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">
                                  Email:
                                </span>
                                <div className="flex-1">
                                  <span className="text-sm text-slate-900 font-medium">
                                    {researchResults.email}
                                  </span>
                                  {researchResults.verificationStatus && (
                                    <div className="mt-2">
                                      {researchResults.verificationStatus === 'auto-approved' && (
                                        <div className="flex items-center text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                                          <CheckCircle size={14} className="mr-1" />
                                          Auto-approved: {researchResults.verificationReason}
                                        </div>
                                      )}
                                      {researchResults.verificationStatus === 'pending' && (
                                        <div className="space-y-2">
                                          <div className="flex items-center text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                            <Mail size={14} className="mr-1" />
                                            {researchResults.verificationReason}
                                          </div>
                                          {canEdit && (
                                            <div className="flex gap-2">
                                              <button
                                                onClick={handleApproveEmail}
                                                className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium flex items-center justify-center"
                                              >
                                                <Check size={14} className="mr-1" />
                                                Approve & Update
                                              </button>
                                              <button
                                                onClick={handleRejectEmail}
                                                className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium flex items-center justify-center"
                                              >
                                                <X size={14} className="mr-1" />
                                                Reject
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {researchResults.verificationStatus === 'approved' && (
                                        <div className="flex items-center text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                                          <CheckCircle size={14} className="mr-1" />
                                          Approved and updated to database
                                        </div>
                                      )}
                                      {researchResults.verificationStatus === 'rejected' && (
                                        <div className="flex items-center text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
                                          <X size={14} className="mr-1" />
                                          Rejected
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {canEdit && (
                    <button
                      onClick={handleSaveEnrichment}
                      className="w-full mt-2 py-2 bg-teal-600 text-white rounded flex items-center justify-center text-sm font-medium"
                    >
                      <Save size={14} className="mr-1.5" /> Update Content to Research Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'email' && canEdit && (
            <div className="space-y-4">
              <div className="bg-brand-50/70 p-4 rounded-lg border border-brand-200">
                <p className="text-sm text-brand-800">
                  Generate a personalized sales pitch using Gemini AI or use a template, then send
                  via your mail client.
                </p>
              </div>

              {emailRateLimitCountdown !== null && emailRateLimitCountdown > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
                      <p className="text-xs text-yellow-700 mt-1">
                        Please wait before trying again
                      </p>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {Math.floor(emailRateLimitCountdown / 60)}:
                      {(emailRateLimitCountdown % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Choose a Template
                </label>
                {loadingTemplates ? (
                  <div className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-500 flex items-center">
                    <Loader2 className="animate-spin mr-2" size={16} />
                    Loading templates...
                  </div>
                ) : emailTemplates.length === 0 ? (
                  <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 text-center">
                    No email templates found in database
                  </div>
                ) : (
                  <select
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none cursor-pointer"
                    value={selectedTemplate}
                    onChange={handleTemplateChange}
                  >
                    <option value="">-- Select Template --</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {!draftedEmail && (
                <div className="text-center">
                  <button
                    onClick={handleDraftEmail}
                    disabled={
                      emailLoading ||
                      (emailRateLimitCountdown !== null && emailRateLimitCountdown > 0)
                    }
                    className="w-full py-3 bg-brand-500 hover:bg-brand-600 text-white rounded-lg font-medium flex justify-center items-center shadow-sm disabled:opacity-50 transition-colors"
                  >
                    {emailLoading ? (
                      <Loader2 className="animate-spin mr-2" />
                    ) : (
                      <Mail className="mr-2" size={16} />
                    )}
                    {emailRateLimitCountdown !== null && emailRateLimitCountdown > 0
                      ? `Retry in ${emailRateLimitCountdown}s`
                      : 'Generate with AI'}
                  </button>
                </div>
              )}

              {draftedEmail && !emailSent && (
                <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[450px]">
                  <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-col space-y-2">
                    <div className="flex items-center text-xs text-slate-500 mb-1">
                      <span className="font-bold mr-1">To:</span>{' '}
                      {lead.keyPersonEmail || <span className="text-red-500">Missing Email</span>}
                    </div>
                    <div className="flex items-center text-xs text-slate-500 mb-1">
                      <span className="font-bold mr-1">CC:</span>
                      <input
                        type="text"
                        value={emailCC}
                        onChange={(e) => setEmailCC(e.target.value)}
                        placeholder="Nhập địa chỉ email CC, cách bởi dấu ,"
                        className="flex-1 text-xs text-slate-900 bg-white border border-slate-300 rounded px-2 py-1 outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
                      />
                    </div>
                    <input
                      value={draftedEmail.subject}
                      onChange={(e) =>
                        setDraftedEmail({ ...draftedEmail, subject: e.target.value })
                      }
                      className="text-sm font-bold text-slate-900 bg-transparent outline-none border-b border-transparent focus:border-brand-300"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col min-h-0 overflow-hidden">
                    <div className="flex items-center justify-between mb-2 shrink-0">
                      <label className="text-xs font-semibold text-slate-700">Email Body</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailBodyViewMode('code')}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            emailBodyViewMode === 'code'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          HTML Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailBodyViewMode('preview')}
                          className={`px-2 py-1 text-xs font-medium rounded ${
                            emailBodyViewMode === 'preview'
                              ? 'bg-slate-900 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>

                    {emailBodyViewMode === 'code' ? (
                      <textarea
                        className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 outline-none resize-none mb-2 font-mono min-h-0 overflow-auto"
                        value={draftedEmail.body}
                        onChange={(e) => setDraftedEmail({ ...draftedEmail, body: e.target.value })}
                        placeholder="<html>...\n\nUse HTML format with variables like {{keyPersonName}}, {{companyName}}, etc."
                      ></textarea>
                    ) : (
                      <div className="w-full flex-1 border border-slate-200 rounded-lg bg-white overflow-y-auto mb-2 min-h-0">
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const html = e.currentTarget.innerHTML;
                            setDraftedEmail({ ...draftedEmail, body: html });
                          }}
                          onBlur={(e) => {
                            const html = e.currentTarget.innerHTML;
                            setDraftedEmail({ ...draftedEmail, body: html });
                          }}
                          dangerouslySetInnerHTML={{
                            __html:
                              draftedEmail.body ||
                              '<div style="padding: 20px; color: #666; text-align: center;">Click here to start editing your email. Use variables like {{keyPersonName}}, {{companyName}}, etc.</div>',
                          }}
                          className="p-3 focus:outline-none focus:ring-2 focus:ring-brand-500/40 focus:ring-inset"
                          style={{
                            fontFamily: 'Arial, sans-serif',
                            lineHeight: '1.6',
                            color: '#333',
                            minHeight: '100%',
                          }}
                        />
                      </div>
                    )}

                    <div className="border-t border-slate-100 pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-bold text-slate-500">Attachments</label>
                        <label className="cursor-pointer text-xs text-blue-600 flex items-center">
                          <Plus size={12} className="mr-1" /> Add File
                          <input type="file" className="hidden" onChange={handleFileUpload} />
                        </label>
                      </div>
                      {attachments.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {attachments.map((file, idx) => {
                            const isLink = (file as any).is_link || file.type === 'link';
                            const fromTemplate = (file as any).fromTemplate;
                            return (
                              <span
                                key={idx}
                                className={`px-2 py-1 rounded text-xs flex items-center ${
                                  fromTemplate
                                    ? 'bg-brand-50 text-brand-700 border border-brand-200'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {isLink ? (
                                  <a
                                    href={file.name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink size={10} className="mr-1" />
                                    {file.name}
                                  </a>
                                ) : (
                                  <>
                                    {file.name}
                                    {fromTemplate && (
                                      <span className="ml-1 text-[10px] text-brand-600">
                                        (Template)
                                      </span>
                                    )}
                                  </>
                                )}
                                <button
                                  onClick={() =>
                                    setAttachments(attachments.filter((_, i) => i !== idx))
                                  }
                                  className="ml-1 text-slate-400 hover:text-slate-600"
                                >
                                  <X size={10} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No files attached.</p>
                      )}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end space-x-3">
                    <button
                      onClick={() => setDraftedEmail(null)}
                      className="text-sm text-slate-500 font-medium"
                    >
                      Discard
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={emailLoading}
                      className="text-sm bg-brand-500 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {emailLoading ? (
                        <>
                          <Loader2 size={14} className="mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Mail size={14} className="mr-2" />
                          Send Email
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
              {emailSent && (
                <div className="text-center py-10 bg-green-50 rounded-lg border border-green-100">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-green-800">Email Client Opened!</h3>
                  <p className="text-sm text-green-600 mt-1">
                    Lead status updated to &quot;Contacted&quot;.
                  </p>
                  <button
                    onClick={() => {
                      setDraftedEmail(null);
                      setEmailSent(false);
                    }}
                    className="mt-4 text-sm text-green-700 underline"
                  >
                    Draft Another
                  </button>
                </div>
              )}

              {/* Email Replies Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Email Replies</h3>
                  <button
                    onClick={handleCheckInbox}
                    disabled={checkingInbox}
                    className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {checkingInbox ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Check Inbox
                      </>
                    )}
                  </button>
                </div>
                {loadingReplies ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                    Loading replies...
                  </div>
                ) : emailReplies.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {emailReplies.map((reply) => (
                      <div
                        key={reply.id}
                        className="p-3 bg-green-50 rounded-lg border border-green-200"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-green-900 text-sm">
                              {reply.from_name || reply.from_email}
                            </div>
                            <div className="text-xs text-green-600">{reply.from_email}</div>
                          </div>
                          <div className="text-xs text-green-500">
                            {new Date(reply.reply_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-medium text-green-800 text-sm mb-1">
                          {reply.subject}
                        </div>
                        <div className="text-xs text-green-700 line-clamp-3">{reply.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-100">
                    <Mail className="mx-auto mb-2 text-slate-300" size={24} />
                    No replies yet. Click &quot;Check Inbox&quot; to check for new replies.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
