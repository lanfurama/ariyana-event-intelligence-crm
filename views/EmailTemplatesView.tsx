import React, { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  X,
  Save,
  FileText,
  Check,
  AlertCircle,
  Sparkles,
  Mail,
  Loader2
} from 'lucide-react';
import { EmailTemplate, EmailTemplateAttachment, Attachment } from '../types';
import { emailTemplatesApi } from '../services/apiService';

export const EmailTemplatesView = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', subject: '', body: '', leadType: '', language: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string; body?: string }>({});
  const [testEmail, setTestEmail] = useState('');
  const [testCc, setTestCc] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [bodyViewMode, setBodyViewMode] = useState<'code' | 'preview'>('preview');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attachmentLink, setAttachmentLink] = useState('');
  const [attachmentLinkName, setAttachmentLinkName] = useState('');
  const contentEditableRef = useRef<HTMLDivElement>(null);
  const isInternalEditRef = useRef(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  // Sync contentEditable innerHTML when switching to preview mode or when formData.body changes externally
  const prevBodyViewModeRef = useRef(bodyViewMode);
  const prevBodyRef = useRef(formData.body);

  useEffect(() => {
    if (showModal && bodyViewMode === 'preview' && contentEditableRef.current) {
      const switchedToPreview = prevBodyViewModeRef.current !== 'preview';
      const bodyChangedExternally = prevBodyRef.current !== formData.body && !isInternalEditRef.current;
      const isInitialLoad = !prevBodyRef.current && formData.body;

      // Only update innerHTML when:
      // 1. Switching from code mode to preview mode
      // 2. Body changed externally (not from user editing in preview mode)
      // 3. Initial load when modal opens
      if (switchedToPreview || bodyChangedExternally || isInitialLoad) {
        const newContent = formData.body || '<div style="padding: 20px; color: #666; text-align: center;">Click here to start editing your email template. Use variables like {{keyPersonName}}, {{companyName}}, etc.</div>';
        // Only update if different to avoid unnecessary DOM manipulation
        if (contentEditableRef.current.innerHTML !== newContent) {
          contentEditableRef.current.innerHTML = newContent;
        }
      }

      prevBodyViewModeRef.current = bodyViewMode;
      prevBodyRef.current = formData.body;
    } else {
      prevBodyViewModeRef.current = bodyViewMode;
      if (formData.body) {
        prevBodyRef.current = formData.body;
      }
    }
  }, [formData.body, bodyViewMode, showModal]);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const data = await emailTemplatesApi.getAll();
      console.log('Loaded templates:', data);
      console.log('Templates with attachments:', data.map(t => ({ id: t.id, name: t.name, attachmentsCount: t.attachments?.length || 0 })));
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      alert('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingTemplate(null);
    setFormData({ name: '', subject: '', body: '', leadType: '', language: '' });
    setFormErrors({});
    setBodyViewMode('preview');
    setTestEmail('');
    setAttachments([]);
    setAttachmentLink('');
    setAttachmentLinkName('');
    setShowModal(true);
    // Reset internal edit flag when opening modal
    isInternalEditRef.current = false;
  };

  const handleEdit = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      subject: template.subject,
      body: template.body,
      leadType: template.leadType || '',
      language: template.language || '',
    });
    setFormErrors({});
    setBodyViewMode('preview');
    setTestEmail('');
    setTestCc('');
    setShowModal(true);
    
    // Load attachments (both files and links)
    if (template.attachments && template.attachments.length > 0) {
      setAttachments(template.attachments.map(att => {
        // Check if it's a link (type === 'link')
        if (att.type === 'link') {
          return {
            name: att.name, // URL
            size: 0,
            type: 'link',
            file_data: att.file_data || att.name, // Display name
            is_link: true,
          };
        } else {
          return {
            name: att.name,
            size: att.size,
            type: att.type,
            file_data: att.file_data,
            is_link: false,
          };
        }
      }));
    } else {
      setAttachments([]);
    }
    setAttachmentLink('');
    setAttachmentLinkName('');
    
    // Reset internal edit flag when opening modal
    isInternalEditRef.current = false;
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await emailTemplatesApi.delete(id);
      await loadTemplates();
      setDeleteConfirm(null);
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  };

  const validateForm = (): boolean => {
    const errors: { name?: string; subject?: string; body?: string } = {};

    if (!formData.name.trim()) {
      errors.name = 'Template name is required';
    }
    if (!formData.subject.trim()) {
      errors.subject = 'Subject is required';
    }
    if (!formData.body.trim()) {
      errors.body = 'Body is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      // Save both file attachments and links
      const attachmentsData = attachments.map(att => {
        if (att.is_link) {
          // For links: name = URL, file_data = display name
          const displayName = att.file_data && att.file_data.trim() ? att.file_data.trim() : att.name;
          return {
            name: att.name, // URL
            size: 0,
            type: 'link',
            file_data: displayName, // Display name
          };
        } else {
          // For files: normal attachment
          return {
            name: att.name,
            size: att.size,
            type: att.type,
            file_data: att.file_data || '',
          };
        }
      });
      
      console.log('Saving attachments:', attachmentsData);

      if (editingTemplate) {
        // Update existing
        await emailTemplatesApi.update(editingTemplate.id, {
          name: formData.name.trim(),
          subject: formData.subject.trim(),
          body: formData.body.trim(),
          leadType: formData.leadType ? formData.leadType : undefined,
          language: formData.language ? formData.language.trim() : undefined,
          attachments: attachmentsData,
        });
      } else {
        // Create new
        const newTemplate: EmailTemplate = {
          id: `template-${Date.now()}`,
          name: formData.name.trim(),
          subject: formData.subject.trim(),
          body: formData.body.trim(),
          leadType: formData.leadType ? formData.leadType : undefined,
          language: formData.language ? formData.language.trim() : undefined,
          attachments: attachmentsData,
        };
        await emailTemplatesApi.create(newTemplate);
      }

      await loadTemplates();
      setShowModal(false);
      setFormData({ name: '', subject: '', body: '', leadType: '', language: '' });
      setEditingTemplate(null);
      setAttachments([]);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setFormData({ name: '', subject: '', body: '', leadType: '', language: '' });
    setEditingTemplate(null);
    setFormErrors({});
    setBodyViewMode('preview');
    setTestEmail('');
    setTestCc('');
    setAttachments([]);
    setAttachmentLink('');
    setAttachmentLinkName('');
  };

  const handleSendTest = async () => {
    // Sync body from contentEditable when in preview mode
    const body = bodyViewMode === 'preview' && contentEditableRef.current
      ? contentEditableRef.current.innerHTML
      : formData.body;
    if (!formData.subject.trim() || !body.trim()) {
      alert('Subject and body are required to send a test email');
      return;
    }
    const email = testEmail.trim();
    if (!email) {
      alert('Please enter an email address');
      return;
    }
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    if (!emailRegex.test(email)) {
      alert('Invalid email address');
      return;
    }
    
    // Validate CC emails if provided
    let ccEmails: string[] = [];
    if (testCc.trim()) {
      const ccList = testCc.split(',').map(e => e.trim()).filter(e => e);
      for (const ccEmail of ccList) {
        if (!emailRegex.test(ccEmail)) {
          alert(`Invalid CC email address: ${ccEmail}`);
          return;
        }
      }
      ccEmails = ccList;
    }
    
    setSendingTest(true);
    try {
      // Separate file attachments and links
      const fileAttachments = attachments.filter(att => !att.is_link).map(att => ({
        name: att.name,
        file_data: att.file_data || '',
        type: att.type,
      }));
      
      const links = attachments.filter(att => att.is_link);
      
      // Add links to email body if any - simple style like the image
      let emailBody = body;
      if (links.length > 0) {
        const linksHtml = links.map(link => {
          const linkName = link.file_data || link.name;
          const linkUrl = link.name;
          return `
            <div style="margin: 8px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
              <span style="font-size: 18px; margin-right: 8px; vertical-align: middle;">📁</span>
              <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
            </div>
          `;
        }).join('');
        emailBody = body + '<div style="margin-top: 5px;">' + linksHtml + '</div>';
      }
      
      console.log(`Sending test email with ${fileAttachments.length} file attachment(s) and ${links.length} link(s)...`);
      await emailTemplatesApi.sendTest(email, formData.subject, emailBody, fileAttachments, ccEmails);
      alert('Test email sent successfully');
    } catch (error: any) {
      console.error('Send test email error:', error);
      const errorMessage = error?.message || 'Failed to send test email';
      if (errorMessage.includes('timeout')) {
        alert('Email sending timed out. The attachments may be too large. Please try with smaller files or use links instead.');
      } else {
        alert(errorMessage);
      }
    } finally {
      setSendingTest(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setAttachments([...attachments, {
          name: file.name,
          size: file.size,
          type: file.type,
          file_data: base64,
          is_link: false,
        }]);
      };
      reader.onerror = () => {
        alert(`Error reading file "${file.name}". Please try again.`);
        e.target.value = '';
      };
      reader.readAsDataURL(file);
    }
    e.target.value = ''; // Reset input
  };

  const handleAddLink = () => {
    if (!attachmentLink.trim()) {
      alert('Please enter a link URL');
      return;
    }
    if (!attachmentLinkName.trim()) {
      alert('Please enter a name for the link');
      return;
    }
    
    setAttachments([...attachments, {
      name: attachmentLink.trim(),
      size: 0,
      type: 'link',
      is_link: true,
      file_data: attachmentLinkName.trim(),
    }]);
    setAttachmentLink('');
    setAttachmentLinkName('');
  };

  return (
    <div className="p-6 min-h-screen flex flex-col space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Email Templates</h2>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm font-semibold">
              {templates.length} {templates.length === 1 ? 'template' : 'templates'}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">Manage email templates for lead outreach</p>
        </div>

        <button
          onClick={handleCreate}
          className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold shrink-0 inline-flex items-center"
        >
          <Plus size={18} className="mr-2" /> New Template
        </button>
      </div>

      {/* Available Variables Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center">
          <Sparkles size={16} className="mr-2" />
          Biến có sẵn (Variables)
        </h3>
        <p className="text-xs text-blue-700 mb-2">
          Sử dụng các biến này trong template email. Khi gửi email, hệ thống sẽ tự động thay thế bằng thông tin thực tế của lead:
        </p>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {[
              { var: '{{companyName}}', desc: 'Tên công ty' },
              { var: '{{keyPersonName}}', desc: 'Tên người liên hệ' },
              { var: '{{keyPersonTitle}}', desc: 'Chức danh' },
              { var: '{{city}}', desc: 'Thành phố' },
              { var: '{{country}}', desc: 'Quốc gia' },
              { var: '{{industry}}', desc: 'Ngành nghề' }
            ].map((item) => (
              <div key={item.var} className="flex items-center gap-1.5 px-2 py-1 bg-blue-100 rounded">
                <code className="text-blue-800 text-xs font-mono">{item.var}</code>
                <span className="text-blue-600 text-[10px]">({item.desc})</span>
              </div>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-200">
            <p className="text-xs font-semibold text-blue-800 mb-2">Ví dụ sử dụng:</p>
            <div className="text-xs text-blue-700 space-y-2">
              <div>
                <p className="font-semibold mb-1">Template:</p>
                <div className="bg-white border border-blue-200 rounded p-2 space-y-1">
                  <p><strong>Subject:</strong> <code className="bg-blue-50 px-1 rounded">{'Xin chào {{keyPersonName}} từ {{companyName}}'}</code></p>
                  <p><strong>Body:</strong> <code className="bg-blue-50 px-1 rounded">{'Kính gửi Anh/Chị {{keyPersonName}}, {{keyPersonTitle}} tại {{companyName}}, {{city}}, {{country}}...'}</code></p>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-1">Với lead mẫu:</p>
                <div className="bg-white border border-blue-200 rounded p-2 text-[11px] space-y-0.5">
                  <p>• Tên công ty: <span className="font-semibold">ABC Corporation</span></p>
                  <p>• Người liên hệ: <span className="font-semibold">Nguyễn Văn A</span></p>
                  <p>• Chức danh: <span className="font-semibold">Giám đốc Marketing</span></p>
                  <p>• Thành phố: <span className="font-semibold">Hà Nội</span></p>
                  <p>• Quốc gia: <span className="font-semibold">Việt Nam</span></p>
                </div>
              </div>
              <div>
                <p className="font-semibold mb-1">Kết quả sau khi thay thế:</p>
                <div className="bg-green-50 border border-green-200 rounded p-2 space-y-1">
                  <p><strong>Subject:</strong> <span className="text-green-800">Xin chào Nguyễn Văn A từ ABC Corporation</span></p>
                  <p><strong>Body:</strong> <span className="text-green-800">Kính gửi Anh/Chị Nguyễn Văn A, Giám đốc Marketing tại ABC Corporation, Hà Nội, Việt Nam...</span></p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Table */}
      <div className="bg-white border border-slate-200 rounded-lg flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
            <span className="ml-3 text-slate-600">Loading templates...</span>
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-12">
            <Mail className="text-slate-300 mx-auto mb-3" size={48} />
            <p className="text-slate-700 font-medium">No email templates found</p>
            <p className="text-slate-500 text-sm mt-1">Create your first template to get started</p>
            <button
              onClick={handleCreate}
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold inline-flex items-center"
            >
              <Plus size={16} className="mr-2" /> Create Template
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Name</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Subject</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {templates.map((template) => (
                  <tr key={template.id}>
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{template.name}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-sm text-slate-700 max-w-md truncate">{template.subject}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleEdit(template)}
                          className="text-indigo-600 font-medium text-sm inline-flex items-center"
                        >
                          <Edit2 size={16} className="mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600 font-medium text-sm inline-flex items-center"
                        >
                          <X size={16} className="mr-1" /> Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingTemplate ? 'Edit Template' : 'Create New Template'}
                </h2>
                <p className="text-xs text-slate-600 mt-0.5">
                  {editingTemplate ? 'Update your email template' : 'Create a new email template for lead outreach'}
                </p>
              </div>
              <button
                onClick={handleCancel}
                className="text-slate-400 p-2 rounded-lg"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Template Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Template Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Introduction Email, Follow Up"
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${formErrors.name ? 'border-red-300' : 'border-slate-300'
                    }`}
                />
                {formErrors.name && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Subject <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g., Invitation to {{companyName}} - Host Your Next Event in Danang"
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${formErrors.subject ? 'border-red-300' : 'border-slate-300'
                    }`}
                />
                {formErrors.subject && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.subject}</p>
                )}
              </div>

              {/* Language */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Language (Optional)
                </label>
                <select
                  value={formData.language}
                  onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Default</option>
                  <option value="en">English</option>
                  <option value="vi">Vietnamese</option>
                  <option value="th">Thai</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Chọn ngôn ngữ của email template này để sau này gửi đúng theo ngôn ngữ của lead.
                </p>
              </div>

              {/* Lead Type */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Lead Type (Optional)
                </label>
                <select
                  value={formData.leadType}
                  onChange={(e) => setFormData({ ...formData, leadType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                >
                  <option value="">Default (for all leads)</option>
                  <option value="CORP">CORP (Corporate Partner)</option>
                  <option value="DMC">DMC (Destination Management Company)</option>
                  <option value="HPNY2026">HPNY2026</option>
                  <option value="LEAD2026FEB_THAIACC">LEAD2026FEB_THAIACC</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">
                  Select a lead type to assign this template to CORP, DMC, HPNY2026, or LEAD2026FEB_THAIACC leads. Leave empty for default templates.
                </p>
              </div>

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    File Attachments / Links (Optional)
                  </label>
                  <div className="flex gap-2">
                    <label className="cursor-pointer text-xs text-indigo-600 flex items-center hover:text-indigo-700">
                      <Plus size={14} className="mr-1" /> Add File
                      <input
                        type="file"
                        className="hidden"
                        onChange={handleFileUpload}
                        multiple
                      />
                    </label>
                  </div>
                </div>
                
                {/* Add Link Section */}
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={attachmentLinkName}
                      onChange={(e) => setAttachmentLinkName(e.target.value)}
                      placeholder="Link name (e.g., Download Brochure)"
                      className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <input
                      type="url"
                      value={attachmentLink}
                      onChange={(e) => setAttachmentLink(e.target.value)}
                      placeholder="Google Drive link or URL"
                      className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddLink}
                      className="px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                    >
                      Add Link
                    </button>
                  </div>
                </div>

                {attachments.length > 0 ? (
                  <div className="space-y-2">
                    {attachments.map((file, idx) => {
                      if (file.is_link) {
                        return (
                          <div key={idx} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-blue-900 truncate">{file.file_data}</div>
                              <a href={file.name} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                {file.name}
                              </a>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                              className="ml-2 text-slate-400 hover:text-red-600 p-1"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        );
                      }
                      const sizeInMB = file.size / (1024 * 1024);
                      const sizeDisplay = sizeInMB >= 1 
                        ? `${sizeInMB.toFixed(2)} MB` 
                        : `${(file.size / 1024).toFixed(2)} KB`;
                      return (
                        <div key={idx} className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">{file.name}</div>
                            <div className="text-xs text-slate-500">
                              {sizeDisplay} • {file.type || 'Unknown type'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))}
                            className="ml-2 text-slate-400 hover:text-red-600 p-1"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-2">No files or links attached. Add files or links above.</p>
                )}
              </div>

              {/* Body */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">
                    Email Body <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        // Save content from preview before switching
                        if (bodyViewMode === 'preview' && contentEditableRef.current) {
                          setFormData({ ...formData, body: contentEditableRef.current.innerHTML });
                        }
                        isInternalEditRef.current = false;
                        setBodyViewMode('code');
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded ${bodyViewMode === 'code'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      HTML Code
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        isInternalEditRef.current = false;
                        setBodyViewMode('preview');
                      }}
                      className={`px-3 py-1 text-xs font-medium rounded ${bodyViewMode === 'preview'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                        }`}
                    >
                      Preview
                    </button>
                  </div>
                </div>

                {bodyViewMode === 'code' ? (
                  <textarea
                    value={formData.body}
                    onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                    placeholder="<html>...\n\nUse HTML format with variables like {{keyPersonName}}, {{companyName}}, etc."
                    rows={15}
                    className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono ${formErrors.body ? 'border-red-300' : 'border-slate-300'
                      }`}
                  />
                ) : (
                  <div
                    className="w-full border rounded-lg border-slate-300 bg-white overflow-auto"
                    style={{ minHeight: '500px', maxHeight: '600px' }}
                  >
                    <div
                      ref={contentEditableRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        isInternalEditRef.current = true;
                        const html = e.currentTarget.innerHTML;
                        setFormData({ ...formData, body: html });
                      }}
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML;
                        setFormData({ ...formData, body: html });
                        isInternalEditRef.current = false;
                      }}
                      className="p-4 min-h-[500px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-inset"
                      style={{
                        fontFamily: 'Arial, sans-serif',
                        lineHeight: '1.6',
                        color: '#333'
                      }}
                    />
                  </div>
                )}

                {formErrors.body && (
                  <p className="text-xs text-red-600 mt-1">{formErrors.body}</p>
                )}
                <p className="text-xs text-slate-500 mt-1">
                  Use HTML format. Variables like {'{{companyName}}'}, {'{{keyPersonName}}'}, etc. will be replaced with actual lead data.
                </p>
              </div>

              {/* Preview Section - Only show when in code mode */}
              {bodyViewMode === 'code' && formData.subject && formData.body && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Quick Preview</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase">Subject:</span>
                      <p className="text-sm text-slate-900 mt-1 bg-white p-2 rounded border border-slate-200">
                        {formData.subject}
                      </p>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-500 uppercase">Body (HTML):</span>
                      <div className="text-xs text-slate-600 mt-1 bg-white p-3 rounded border border-slate-200 max-h-40 overflow-y-auto font-mono">
                        {formData.body.substring(0, 500)}{formData.body.length > 500 ? '...' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">Send this template to:</span>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm text-slate-600">CC (optional):</span>
                  <input
                    type="text"
                    value={testCc}
                    onChange={(e) => setTestCc(e.target.value)}
                    placeholder="email1@example.com, email2@example.com"
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm flex-1 min-w-48 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); handleSendTest(); }}
                    disabled={sendingTest}
                    className="px-3 py-2 text-indigo-600 border border-indigo-300 rounded-lg text-sm font-medium inline-flex items-center hover:bg-indigo-50 disabled:opacity-50"
                  >
                    {sendingTest ? <Loader2 size={16} className="mr-1 animate-spin" /> : <Mail size={16} className="mr-1" />}
                    Send Test
                  </button>
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={handleCancel}
                  className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold inline-flex items-center"
                >
                  <Save size={16} className="mr-2" />
                  {editingTemplate ? 'Update Template' : 'Create Template'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

