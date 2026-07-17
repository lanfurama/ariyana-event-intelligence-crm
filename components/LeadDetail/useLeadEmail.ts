import type { ChangeEvent, Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { Lead, EmailTemplate, EmailTemplateAttachment, EmailReply } from '../../types';
import * as GeminiService from '../../services/geminiService';
import { emailTemplatesApi, emailRepliesApi, leadsApi } from '../../services/apiService';
import { mapLeadFromDB } from '../../utils/leadUtils';
import { applyTemplatePlaceholders } from './leadDetailHelpers';

interface AttachmentItem {
  name: string;
  size: number;
  type: string;
  file_data?: string;
  is_link?: boolean;
  fromTemplate?: boolean;
}

export function useLeadEmail(
  lead: Lead,
  activeTab: 'info' | 'enrich' | 'email',
  setEditedLead: Dispatch<SetStateAction<Lead>>,
  onSave: (l: Lead) => void,
) {
  const [emailLoading, setEmailLoading] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{ subject: string; body: string } | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [emailCC, setEmailCC] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [emailRateLimitCountdown, setEmailRateLimitCountdown] = useState<number | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [emailBodyViewMode, setEmailBodyViewMode] = useState<'code' | 'preview'>('preview');
  const [emailReplies, setEmailReplies] = useState<EmailReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);

  // Email rate-limit countdown
  useEffect(() => {
    if (emailRateLimitCountdown !== null && emailRateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setEmailRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (emailRateLimitCountdown === 0) {
      setEmailRateLimitCountdown(null);
    }
  }, [emailRateLimitCountdown]);

  const loadEmailTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templates = await emailTemplatesApi.getAll();
      console.log(
        'Loaded templates with attachments:',
        templates.map((t) => ({
          id: t.id,
          name: t.name,
          attachmentsCount: t.attachments?.length || 0,
        })),
      );
      setEmailTemplates(templates);

      // Auto-select template based on lead type if available and no template is selected
      if (templates.length > 0 && !selectedTemplate && !draftedEmail) {
        const leadHasNoType = lead.type == null || String(lead.type || '').trim() === '';
        const templateHasNoType = (t: EmailTemplate) =>
          t.leadType == null || String(t.leadType || '').trim() === '';

        let selectedTemplateId: string;
        if (leadHasNoType) {
          selectedTemplateId = templates.find(templateHasNoType)?.id ?? templates[0].id;
        } else {
          const matchingTemplate = templates.find((t) => t.leadType === lead.type);
          selectedTemplateId =
            matchingTemplate?.id ?? templates.find(templateHasNoType)?.id ?? templates[0].id;
        }

        setSelectedTemplate(selectedTemplateId);

        // Auto-fill email with selected template
        const template = templates.find((t) => t.id === selectedTemplateId) || templates[0];
        if (template) {
          const subject = applyTemplatePlaceholders(template.subject, lead);
          const body = applyTemplatePlaceholders(template.body, lead);

          setDraftedEmail({ subject, body });

          // Load attachments from template (both files and links)
          const templateAttachments = (template.attachments || []).map(
            (att: EmailTemplateAttachment) => {
              console.log('Template attachment:', {
                name: att.name,
                type: att.type,
                hasFileData: !!att.file_data,
                fileDataLength: att.file_data?.length || 0,
              });
              return {
                name: att.name,
                size: att.size || 0,
                type: att.type || (att.file_data ? 'application/octet-stream' : 'link'),
                file_data: att.file_data,
                is_link: att.type === 'link',
                fromTemplate: true,
              };
            },
          );
          console.log(
            'Template attachments loaded:',
            templateAttachments.length,
            'from template:',
            template.name,
          );
          setAttachments(templateAttachments);

          setEmailSent(false);
        }
      }
    } catch (error) {
      console.error('Error loading email templates:', error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadEmailReplies = async () => {
    setLoadingReplies(true);
    try {
      const replies = await emailRepliesApi.getAll(lead.id);
      setEmailReplies(replies);
    } catch (error) {
      console.error('Error loading email replies:', error);
    } finally {
      setLoadingReplies(false);
    }
  };

  const handleCheckInbox = async () => {
    setCheckingInbox(true);
    try {
      const result = await emailRepliesApi.checkInbox({ maxEmails: 50 });
      alert(`✅ Checked inbox: ${result.processedCount} new reply(ies) found`);
      await loadEmailReplies(); // Reload replies after checking
    } catch (error: any) {
      console.error('Error checking inbox:', error);
      alert(`❌ Error checking inbox: ${error.message || 'Unknown error'}`);
    } finally {
      setCheckingInbox(false);
    }
  };

  // Auto-load templates and replies when email tab opens
  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailTemplates();
      loadEmailReplies();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, lead.id]);

  const handleTemplateChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const tmplId = e.target.value;
    setSelectedTemplate(tmplId);
    if (!tmplId) {
      setAttachments([]);
      return;
    }

    const template = emailTemplates.find((t) => t.id === tmplId);
    if (template) {
      const subject = applyTemplatePlaceholders(template.subject, lead);
      const body = applyTemplatePlaceholders(template.body, lead);

      // Load attachments from template (both files and links)
      const templateAttachments = (template.attachments || []).map((att) => ({
        name: att.name,
        size: att.size || 0,
        type: att.type || (att.file_data ? 'application/octet-stream' : 'link'),
        file_data: att.file_data,
        is_link: att.type === 'link',
        fromTemplate: true,
      }));
      console.log(
        'Template attachments loaded from dropdown:',
        templateAttachments,
        'from template:',
        template.name,
      );

      setDraftedEmail({ subject, body });
      setAttachments(templateAttachments);
      setEmailSent(false);
    }
  };

  const handleDraftEmail = async () => {
    setEmailLoading(true);
    setEmailRateLimitCountdown(null);
    try {
      const result = await GeminiService.draftSalesEmail(
        lead.keyPersonName,
        lead.companyName,
        lead.keyPersonTitle,
        lead.notes || 'Annual Conference',
      );
      setDraftedEmail(result);
      setSelectedTemplate(''); // clear template selection if AI generates
      setEmailSent(false);
    } catch (e: any) {
      console.error(e);
      if (GeminiService.isRateLimitError(e)) {
        const retryDelay = GeminiService.extractRetryDelay(e);
        if (retryDelay) {
          setEmailRateLimitCountdown(retryDelay);
        } else {
          alert(`Rate limit exceeded. Please try again later.`);
        }
      } else {
        alert('Drafting failed. Please try again.');
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        setAttachments([
          ...attachments,
          {
            name: file.name,
            size: file.size,
            type: file.type,
            file_data: base64Data,
            fromTemplate: false,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendEmail = async () => {
    if (!lead.keyPersonEmail) {
      alert(
        "No email address found for this contact. Please add an email address in the 'Info' tab.",
      );
      return;
    }

    if (!draftedEmail) {
      alert('No email content to send.');
      return;
    }

    if (!confirm(`Are you sure you want to send this email to ${lead.keyPersonEmail}?`)) {
      return;
    }

    setEmailLoading(true);
    try {
      console.log(
        'All attachments before filtering:',
        attachments.map((a) => ({
          name: a.name,
          type: a.type,
          is_link: (a as any).is_link,
          hasFileData: !!a.file_data,
          fileDataLength: a.file_data?.length || 0,
        })),
      );

      // Separate links and file attachments (like test mail does)
      const links = attachments.filter((att) => (att as any).is_link || att.type === 'link');
      const fileAttachments = attachments
        .filter((att) => {
          const isLink = (att as any).is_link || att.type === 'link';
          const hasFileData = att.file_data && att.file_data.trim().length > 0;
          return !isLink && hasFileData;
        })
        .map((att) => ({
          name: att.name,
          file_data: att.file_data!,
          type: att.type || 'application/octet-stream',
        }));

      // Add links to email body if any (like test mail does)
      let emailBody = draftedEmail.body;
      if (links.length > 0) {
        const linksHtml = links
          .map((link) => {
            const linkName = link.file_data || link.name;
            const linkUrl = link.name;
            return `
                        <div style="margin: 8px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
                            <span style="font-size: 18px; margin-right: 8px; vertical-align: middle;">📁</span>
                            <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
                        </div>
                    `;
          })
          .join('');
        emailBody = draftedEmail.body + '<div style="margin-top: 5px;">' + linksHtml + '</div>';
      }

      console.log(
        'Sending email with file attachments:',
        fileAttachments.length,
        'and links:',
        links.length,
      );
      console.log(
        'File attachments:',
        fileAttachments.map((a) => ({
          name: a.name,
          type: a.type,
          dataLength: a.file_data.length,
        })),
      );

      const result = await leadsApi.sendEmail(
        lead.id,
        draftedEmail.subject,
        emailBody,
        emailCC && emailCC.trim() ? emailCC.trim() : undefined,
        fileAttachments.length > 0 ? fileAttachments : undefined,
      );

      if (result.success && result.updatedLead) {
        const mappedLead = mapLeadFromDB(result.updatedLead);
        setEditedLead(mappedLead);
        onSave(mappedLead);
        setEmailSent(true);
        setAttachments([]);
        setEmailCC('');
        alert('Email sent successfully!');
      } else {
        const errMsg = (result as any)?.summary?.failures?.[0]?.error ?? 'Unknown error';
        alert(`Failed to send email: ${errMsg}`);
      }
    } catch (error: any) {
      console.error('Error sending email:', error);
      alert(`Error sending email: ${error.message || 'Unknown error'}`);
    } finally {
      setEmailLoading(false);
    }
  };

  return {
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
    loadEmailTemplates,
    loadEmailReplies,
    handleCheckInbox,
    handleTemplateChange,
    handleDraftEmail,
    handleFileUpload,
    handleSendEmail,
  };
}
