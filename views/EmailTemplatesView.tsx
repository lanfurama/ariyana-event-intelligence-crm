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
import { EmailTemplate } from '../types';
import { emailTemplatesApi } from '../services/apiService';

export const EmailTemplatesView = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', subject: '', body: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string; body?: string }>({});
  const [bodyViewMode, setBodyViewMode] = useState<'code' | 'preview'>('preview');
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
    setFormData({ name: '', subject: '', body: '' });
    setFormErrors({});
    setBodyViewMode('preview');
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
    });
    setFormErrors({});
    setBodyViewMode('preview');
    setShowModal(true);
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
      if (editingTemplate) {
        // Update existing
        await emailTemplatesApi.update(editingTemplate.id, formData);
      } else {
        // Create new
        const newTemplate: EmailTemplate = {
          id: `template-${Date.now()}`,
          name: formData.name.trim(),
          subject: formData.subject.trim(),
          body: formData.body.trim(),
        };
        await emailTemplatesApi.create(newTemplate);
      }

      await loadTemplates();
      setShowModal(false);
      setFormData({ name: '', subject: '', body: '' });
      setEditingTemplate(null);
    } catch (error) {
      console.error('Error saving template:', error);
      alert('Failed to save template');
    }
  };

  const handleCancel = () => {
    setShowModal(false);
    setFormData({ name: '', subject: '', body: '' });
    setEditingTemplate(null);
    setFormErrors({});
    setBodyViewMode('preview');
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
          Available Variables
        </h3>
        <p className="text-xs text-blue-700 mb-2">
          Use these placeholders in your templates (they will be replaced with actual lead data):
        </p>
        <div className="flex flex-wrap gap-2">
          {['{{companyName}}', '{{keyPersonName}}', '{{keyPersonTitle}}', '{{city}}', '{{country}}', '{{industry}}'].map((varName) => (
            <code key={varName} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-mono">
              {varName}
            </code>
          ))}
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
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-600">Body Preview</th>
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
                      <div className="text-sm text-slate-600 max-w-md line-clamp-2">
                        {template.body.substring(0, 100)}...
                      </div>
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

            <div className="p-4 border-t border-slate-200 flex justify-end gap-3">
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
      )}
    </div>
  );
};

