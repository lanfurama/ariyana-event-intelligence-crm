import type React from 'react';
import {
  Check,
  CheckCircle,
  ExternalLink,
  Loader2,
  Mail,
  Save,
  Search,
  User as UserIcon,
  X,
} from 'lucide-react';
import type { useLeadEnrichment } from './useLeadEnrichment';

interface LeadEnrichTabProps {
  enrichment: ReturnType<typeof useLeadEnrichment>;
  canEdit: boolean;
}

export const LeadEnrichTab: React.FC<LeadEnrichTabProps> = ({ enrichment, canEdit }) => {
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
  } = enrichment;

  return (
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
              <p className="text-xs font-semibold text-yellow-800">⚠️ Rate Limit Exceeded</p>
              <p className="text-xs text-yellow-700 mt-0.5">Please wait before trying again.</p>
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
  );
};
