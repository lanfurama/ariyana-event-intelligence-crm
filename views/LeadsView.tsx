import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Search,
    Mail,
    Plus,
    ChevronRight,
    Loader2,
    Send,
    X,
    CheckCircle,
    XCircle,
    Circle,
    FileSpreadsheet,
    ChevronDown,
    Building2,
    MapPin,
    User as UserIcon,
    Globe,
    Phone,
    Linkedin,
    MoreHorizontal,
    ExternalLink
} from 'lucide-react';
import { Lead, EmailTemplate, User, EmailLog } from '../types';
import { emailLogsApi, emailRepliesApi, emailTemplatesApi, leadsApi } from '../services/apiService';
import { mapLeadFromDB, mapLeadToDB } from '../utils/leadUtils';
import * as XLSX from 'xlsx';
import { LeadsSkeleton } from '../components/common/LeadsSkeleton';

const TestEmailInput = React.memo<{
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    disabled: boolean;
}>(({ value, onChange, disabled }) => (
    <input
        type="email"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder="Nhập email để test (ví dụ: test@example.com)"
        className="flex-1 px-3 py-2 text-sm border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
    />
));
TestEmailInput.displayName = 'TestEmailInput';

interface LeadsViewProps {
    leads: Lead[];
    onSelectLead: (lead: Lead) => void;
    onUpdateLead: (lead: Lead) => void;
    onRefreshLeads?: () => Promise<void>;
    user: User;
    onAddLead?: () => void;
    loading?: boolean;
}

export const LeadsView: React.FC<LeadsViewProps> = ({ leads, onSelectLead, onUpdateLead, onRefreshLeads, user, onAddLead, loading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [emailFilter, setEmailFilter] = useState<'all' | 'has-key-person' | 'no-key-person'>('all');
    const [countryFilter, setCountryFilter] = useState<string>('all');
    const [industryFilter, setIndustryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
    const [loadingTemplates, setLoadingTemplates] = useState(false);
    const [emailLogs, setEmailLogs] = useState<Array<{ leadId: string, count: number, lastSent?: Date }>>([]);
    const [allEmailLogs, setAllEmailLogs] = useState<EmailLog[]>([]);
    const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
    const [emailReplies, setEmailReplies] = useState<Array<{ leadId: string }>>([]);
    const [markingReplies, setMarkingReplies] = useState<Set<string>>(new Set());
    const [sendingEmails, setSendingEmails] = useState(false);
    const [sendingProgress, setSendingProgress] = useState<Record<string, 'pending' | 'sending' | 'sent' | 'failed'>>({});
    const [showAddLeadModal, setShowAddLeadModal] = useState(false);
    const [newLeadData, setNewLeadData] = useState<Partial<Lead>>({
        companyName: '',
        industry: '',
        country: '',
        city: '',
        website: '',
        keyPersonName: '',
        keyPersonTitle: '',
        keyPersonEmail: '',
        keyPersonPhone: '',
        keyPersonLinkedIn: '',
        status: 'New',
        notes: '',
        totalEvents: 0,
        vietnamEvents: 0,
    });
    const [templateTargetLeadType, setTemplateTargetLeadType] = useState<
        'auto' | 'all' | 'normal' | 'DMC' | 'CORP' | 'HPNY2026' | 'LEAD2026FEB_THAIACC' | 'SUMMER_BEACH_2026'
    >('auto');
    const [savingLead, setSavingLead] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [testEmail, setTestEmail] = useState('');
    const [sendingTestEmail, setSendingTestEmail] = useState(false);
    const itemsPerPage = 20;

    const getEmailStatus = (leadId: string) => {
        const log = emailLogs.find(l => l.leadId === leadId);
        return log ? { hasEmail: true, count: log.count, lastSent: log.lastSent } : { hasEmail: false, count: 0 };
    };

    const hasReplied = (leadId: string) => {
        return emailReplies.some(r => r.leadId === leadId);
    };

    const availableCountries = useMemo(() => {
        const countries = new Set<string>();
        leads.forEach(lead => {
            if (lead.country) countries.add(lead.country);
        });
        return Array.from(countries).sort();
    }, [leads]);

    const availableIndustries = useMemo(() => {
        const industries = new Set<string>();
        leads.forEach(lead => {
            if (lead.industry) industries.add(lead.industry);
        });
        return Array.from(industries).sort();
    }, [leads]);

    const filteredLeads = useMemo(() => {
        return leads.filter(lead => {
            const searchLower = searchTerm.toLowerCase();
            const matchesSearch =
                (lead.companyName || '').toLowerCase().includes(searchLower) ||
                (lead.city || '').toLowerCase().includes(searchLower) ||
                (lead.keyPersonName || '').toLowerCase().includes(searchLower) ||
                (lead.industry || '').toLowerCase().includes(searchLower);

            if (!matchesSearch) return false;

            if (countryFilter !== 'all' && lead.country !== countryFilter) {
                return false;
            }

            if (industryFilter !== 'all' && lead.industry !== industryFilter) {
                return false;
            }

            if (statusFilter !== 'all' && lead.status !== statusFilter) {
                return false;
            }

            if (typeFilter !== 'all') {
                if (typeFilter === 'normal') {
                    if (lead.type != null && String(lead.type || '').trim() !== '') return false;
                } else if (lead.type !== typeFilter) {
                    return false;
                }
            }

            if (emailFilter === 'all') return true;

            const hasEmail = !!(lead.keyPersonEmail && lead.keyPersonEmail.trim() !== '');
            const hasName = !!(lead.keyPersonName && lead.keyPersonName.trim() !== '');

            if (emailFilter === 'has-key-person') {
                return hasEmail && hasName;
            }
            if (emailFilter === 'no-key-person') {
                return !hasEmail || !hasName;
            }

            return true;
        });
    }, [leads, searchTerm, emailFilter, countryFilter, industryFilter, statusFilter, typeFilter, emailLogs, emailReplies]);

    const paginatedLeads = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredLeads.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredLeads, currentPage]);

    const totalPages = useMemo(() => {
        return Math.ceil(filteredLeads.length / itemsPerPage);
    }, [filteredLeads.length]);

    useEffect(() => {
        if (currentPage > totalPages && totalPages > 0) {
            setCurrentPage(1);
        }
    }, [totalPages, currentPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, countryFilter, industryFilter, statusFilter, typeFilter, emailFilter]);

    useEffect(() => {
        loadEmailLogs();
        loadEmailReplies();
    }, [leads]);

    useEffect(() => {
        if (showEmailModal) {
            loadEmailTemplates();
        }
    }, [showEmailModal]);

    useEffect(() => {
        setTemplateTargetLeadType('auto');
        setTestEmail('');
    }, [selectedTemplateId]);

    const loadEmailLogs = async () => {
        if (leads.length === 0) return;

        setLoadingEmailLogs(true);
        try {
            const allLogs = await emailLogsApi.getAll();
            setAllEmailLogs(allLogs);

            const logsByLead = new Map<string, { count: number, lastSent?: Date }>();

            allLogs.forEach(log => {
                if (log.status === 'sent' && log.lead_id) {
                    const existing = logsByLead.get(log.lead_id) || { count: 0 };
                    existing.count += 1;

                    const logDate = log.date ? new Date(log.date) : null;
                    if (logDate && (!existing.lastSent || logDate > existing.lastSent)) {
                        existing.lastSent = logDate;
                    }

                    logsByLead.set(log.lead_id, existing);
                }
            });

            const logsArray = Array.from(logsByLead.entries()).map(([leadId, data]) => ({
                leadId,
                ...data
            }));

            setEmailLogs(logsArray);
        } catch (error) {
            console.error('Error loading email logs:', error);
        } finally {
            setLoadingEmailLogs(false);
        }
    };

    const loadEmailReplies = async () => {
        if (leads.length === 0) return;

        try {
            const allReplies = await emailRepliesApi.getAll();
            const leadIdsWithReplies = new Set(allReplies.map(reply => reply.lead_id));
            setEmailReplies(Array.from(leadIdsWithReplies).map(leadId => ({ leadId })));
        } catch (error) {
            console.error('Error loading email replies:', error);
        }
    };

    const handleMarkReply = async (leadId: string) => {
        if (hasReplied(leadId)) {
            return;
        }

        setMarkingReplies(prev => new Set(prev).add(leadId));
        try {
            await emailRepliesApi.create(leadId);
            await loadEmailReplies();
        } catch (error: any) {
            console.error('Error marking reply:', error);
            alert(`Error marking reply: ${error.message || 'Unknown error'}`);
        } finally {
            setMarkingReplies(prev => {
                const newSet = new Set(prev);
                newSet.delete(leadId);
                return newSet;
            });
        }
    };

    const handleAddLeadSubmit = async () => {
        if (!newLeadData.companyName?.trim()) {
            alert('Vui lòng nhập tên công ty');
            return;
        }

        setSavingLead(true);
        try {
            const leadToCreate: Lead = {
                id: `new-${Date.now()}`,
                companyName: newLeadData.companyName || '',
                industry: newLeadData.industry || '',
                country: newLeadData.country || '',
                city: newLeadData.city || '',
                website: newLeadData.website || '',
                keyPersonName: newLeadData.keyPersonName || '',
                keyPersonTitle: newLeadData.keyPersonTitle || '',
                keyPersonEmail: newLeadData.keyPersonEmail || '',
                keyPersonPhone: newLeadData.keyPersonPhone || '',
                keyPersonLinkedIn: newLeadData.keyPersonLinkedIn || '',
                status: newLeadData.status || 'New',
                notes: newLeadData.notes || '',
                totalEvents: newLeadData.totalEvents || 0,
                vietnamEvents: newLeadData.vietnamEvents || 0,
            };

            const mappedLead = mapLeadToDB(leadToCreate);
            const createdLead = await leadsApi.create(mappedLead);
            const mappedBack = mapLeadFromDB(createdLead);

            onUpdateLead(mappedBack);
            if (onRefreshLeads) {
                await onRefreshLeads();
            }

            setShowAddLeadModal(false);
            setNewLeadData({
                companyName: '',
                industry: '',
                country: '',
                city: '',
                website: '',
                keyPersonName: '',
                keyPersonTitle: '',
                keyPersonEmail: '',
                keyPersonPhone: '',
                keyPersonLinkedIn: '',
                status: 'New',
                notes: '',
                totalEvents: 0,
                vietnamEvents: 0,
            });
            alert('Đã thêm lead thành công!');
        } catch (error: any) {
            console.error('Error creating lead:', error);
            alert(`Lỗi khi thêm lead: ${error.message || 'Unknown error'}`);
        } finally {
            setSavingLead(false);
        }
    };

    const loadEmailTemplates = async () => {
        setLoadingTemplates(true);
        try {
            const templates = await emailTemplatesApi.getAll();
            setEmailTemplates(templates);
            if (templates.length > 0 && !selectedTemplateId) {
                setSelectedTemplateId(templates[0].id);
            }
        } catch (error) {
            console.error('Error loading email templates:', error);
        } finally {
            setLoadingTemplates(false);
        }
    };

    // Helper: Map country to language
    const getLanguageFromCountry = (country: string | null | undefined): string | null => {
        if (!country) return null;
        const normalized = country.trim().toLowerCase();
        const countryToLanguage: Record<string, string> = {
            'vietnam': 'vi',
            'việt nam': 'vi',
            'thailand': 'th',
            'thái lan': 'th',
            'singapore': 'en',
            'malaysia': 'en',
            'indonesia': 'en',
            'philippines': 'en',
            'philippine': 'en',
            'united states': 'en',
            'usa': 'en',
            'us': 'en',
            'united kingdom': 'en',
            'uk': 'en',
            'australia': 'en',
            'new zealand': 'en',
            'canada': 'en',
            'china': 'zh',
            'chinese': 'zh',
            'taiwan': 'zh',
            'japan': 'ja',
            'korea': 'ko',
            'south korea': 'ko',
        };
        return countryToLanguage[normalized] || null;
    };

    const preparedEmails = useMemo(() => {
        if (!selectedTemplateId || filteredLeads.length === 0 || emailTemplates.length === 0) {
            return [];
        }

        const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId);
        if (!selectedTemplate) return [];

        const templateHasNoType = (t: EmailTemplate) =>
            t.leadType == null || String(t.leadType || '').trim() === '';

        return filteredLeads
            .filter(lead => {
                // Chỉ check có email, không quan tâm status của lead
                if (!lead.keyPersonEmail) return false;

                // Chỉ quan tâm đã gửi với template này chưa (so sánh subject)
                // Không quan tâm status của lead (New, Contacted, etc.)
                const hasSentThisTemplate = allEmailLogs.some(
                    log =>
                        log.status === 'sent' &&
                        log.lead_id === lead.id &&
                        log.subject === selectedTemplate.subject
                );
                if (hasSentThisTemplate) return false;

                // Filter theo language của template nếu template có language
                if (selectedTemplate.language && selectedTemplate.language.trim() !== '') {
                    const templateLang = selectedTemplate.language.toLowerCase();
                    const leadLanguage = getLanguageFromCountry(lead.country);
                    const leadCountryNormalized = lead.country ? lead.country.trim().toLowerCase() : '';
                    
                    if (templateLang === 'en') {
                        // Template EN: gửi cho tất cả các quốc gia TRỪ Vietnam
                        if (leadCountryNormalized === 'vietnam' || leadCountryNormalized === 'việt nam') {
                            return false; // Exclude Vietnam
                        }
                        // Các quốc gia khác đều OK (bao gồm cả các quốc gia không có trong map)
                    } else {
                        // Template có language khác (vi, th, zh, ja, ko): chỉ match đúng language
                        if (leadLanguage !== templateLang) {
                            return false; // Lead country không match với template language
                        }
                    }
                }

                if (templateTargetLeadType === 'all') {
                    return true;
                }

                if (templateTargetLeadType !== 'auto') {
                    if (templateTargetLeadType === 'normal') {
                        return lead.type == null || String(lead.type || '').trim() === '';
                    }
                    return lead.type === templateTargetLeadType;
                }

                // AUTO: dùng leadType của template đang chọn
                const leadHasNoType = lead.type == null || String(lead.type || '').trim() === '';
                if (selectedTemplate.leadType == null || String(selectedTemplate.leadType || '').trim() === '') {
                    // template cho regular leads (lead.type null/empty)
                    return leadHasNoType;
                }

                // template có leadType cụ thể => chỉ match đúng type đó
                return lead.type === selectedTemplate.leadType;
            })
            .map(lead => {
                const template = selectedTemplate;

                let subject = template.subject;
                let body = template.body;

                subject = subject.replace(/\{\{companyName\}\}/g, lead.companyName || '');
                subject = subject.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
                subject = subject.replace(/\{\{city\}\}/g, lead.city || '');
                subject = subject.replace(/\{\{country\}\}/g, lead.country || '');

                body = body.replace(/\{\{companyName\}\}/g, lead.companyName || '');
                body = body.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
                body = body.replace(/\{\{keyPersonTitle\}\}/g, lead.keyPersonTitle || '');
                body = body.replace(/\{\{city\}\}/g, lead.city || '');
                body = body.replace(/\{\{country\}\}/g, lead.country || '');
                body = body.replace(/\{\{industry\}\}/g, lead.industry || '');

                // Tách links và file attachments
                const links = (template.attachments || []).filter(att => att.type === 'link');
                const fileAttachments = (template.attachments || [])
                    .filter(att => att.type !== 'link')
                    .map(att => ({
                        name: att.name,
                        file_data: att.file_data || '',
                        type: att.type || 'application/octet-stream',
                    }));

                // Thêm links vào body HTML (giống như backend)
                let finalBody = body;
                if (links.length > 0) {
                    const linksHtml = links.map(link => {
                        const linkName = link.file_data || link.name;
                        const linkUrl = link.name;
                        return `
                            <div style="margin: 4px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
                                <span style="font-size: 18px; margin-right: 8px; vertical-align: middle;">📁</span>
                                <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
                            </div>
                        `;
                    }).join('');
                    finalBody = body + '<div style="margin-top: 2px;">' + linksHtml + '</div>';
                }

                return { lead, subject, body: finalBody, attachments: fileAttachments };
            });
    }, [selectedTemplateId, filteredLeads, emailTemplates, templateTargetLeadType, allEmailLogs]);

    const emailStats = useMemo(() => {
        const sentCount = filteredLeads.filter(lead => {
            const status = getEmailStatus(lead.id);
            return status.hasEmail;
        }).length;
        const notSentCount = filteredLeads.length - sentCount;
        return { sent: sentCount, notSent: notSentCount };
    }, [filteredLeads, emailLogs]);

    const keyPersonStats = useMemo(() => {
        const withKeyPersonInfo = filteredLeads.filter(lead => {
            return !!(lead.keyPersonEmail || lead.keyPersonPhone || lead.keyPersonLinkedIn);
        }).length;
        return { withInfo: withKeyPersonInfo, withoutInfo: filteredLeads.length - withKeyPersonInfo };
    }, [filteredLeads]);

    const emailTimeStats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const sentLogs = allEmailLogs.filter(log => log.status === 'sent' && log.date);

        const today = sentLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= todayStart;
        }).length;

        const yesterday = sentLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= yesterdayStart && logDate < todayStart;
        }).length;

        const thisWeek = sentLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= weekStart;
        }).length;

        const thisMonth = sentLogs.filter(log => {
            const logDate = new Date(log.date);
            return logDate >= monthStart;
        }).length;

        return { today, yesterday, thisWeek, thisMonth };
    }, [allEmailLogs]);

    const handleTestEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setTestEmail(e.target.value);
    }, []);

    const handleSendTestEmail = async () => {
        if (!selectedTemplateId || !testEmail.trim()) {
            alert('Vui lòng chọn template và nhập email test');
            return;
        }

        const selectedTemplate = emailTemplates.find(t => t.id === selectedTemplateId);
        if (!selectedTemplate) {
            alert('Template không tồn tại');
            return;
        }

        const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
        if (!emailRegex.test(testEmail.trim())) {
            alert('Email không hợp lệ');
            return;
        }

        setSendingTestEmail(true);
        try {
            // Prepare subject và body với sample data
            let subject = selectedTemplate.subject;
            let body = selectedTemplate.body;

            // Replace với sample data
            subject = subject.replace(/\{\{companyName\}\}/g, 'Sample Company');
            subject = subject.replace(/\{\{keyPersonName\}\}/g, 'John Doe');
            subject = subject.replace(/\{\{city\}\}/g, 'Danang');
            subject = subject.replace(/\{\{country\}\}/g, 'Vietnam');

            body = body.replace(/\{\{companyName\}\}/g, 'Sample Company');
            body = body.replace(/\{\{keyPersonName\}\}/g, 'John Doe');
            body = body.replace(/\{\{keyPersonTitle\}\}/g, 'CEO');
            body = body.replace(/\{\{city\}\}/g, 'Danang');
            body = body.replace(/\{\{country\}\}/g, 'Vietnam');
            body = body.replace(/\{\{industry\}\}/g, 'Technology');

            // Thêm links vào body nếu có
            const links = (selectedTemplate.attachments || []).filter(att => att.type === 'link');
            if (links.length > 0) {
                    const linksHtml = links.map(link => {
                        const linkName = link.file_data || link.name;
                        const linkUrl = link.name;
                        return `
                            <div style="margin: 4px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
                                <span style="font-size: 18px; margin-right: 8px; vertical-align: middle; display: inline-block;">📁</span>
                                <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
                            </div>
                        `;
                    }).join('');
                body = body + '<div style="margin-top: 2px;">' + linksHtml + '</div>';
            }

            // Lấy file attachments
            const fileAttachments = (selectedTemplate.attachments || [])
                .filter(att => att.type !== 'link')
                .map(att => ({
                    name: att.name,
                    file_data: att.file_data || '',
                    type: att.type || 'application/octet-stream',
                }));

            await emailTemplatesApi.sendTest(testEmail.trim(), subject, body, fileAttachments);
            alert('Test email đã được gửi thành công!');
            setTestEmail('');
        } catch (error: any) {
            console.error('Error sending test email:', error);
            alert(`Lỗi khi gửi test email: ${error?.message || 'Unknown error'}`);
        } finally {
            setSendingTestEmail(false);
        }
    };

    const handleSendEmails = async () => {
        if (preparedEmails.length === 0) {
            alert('No emails prepared. Please select a template and ensure leads have email addresses.');
            return;
        }

        if (!confirm(`Are you sure you want to send ${preparedEmails.length} email(s)?`)) {
            return;
        }

        setSendingEmails(true);
        const initialProgress: Record<string, 'pending' | 'sending' | 'sent' | 'failed'> = {};
        preparedEmails.forEach(p => { initialProgress[p.lead.id] = 'pending'; });
        setSendingProgress(initialProgress);

        let sentCount = 0;
        let failedCount = 0;
        const updatedLeads: Lead[] = [];

        try {
            for (const prepared of preparedEmails) {
                setSendingProgress(prev => ({ ...prev, [prepared.lead.id]: 'sending' }));

                try {
                    const result = await leadsApi.sendEmail(
                        prepared.lead.id, 
                        prepared.subject, 
                        prepared.body,
                        undefined, // cc
                        prepared.attachments // attachments từ template
                    );
                    if (result.success && result.updatedLead) {
                        setSendingProgress(prev => ({ ...prev, [prepared.lead.id]: 'sent' }));
                        updatedLeads.push(mapLeadFromDB(result.updatedLead));
                        sentCount += 1;
                    } else {
                        setSendingProgress(prev => ({ ...prev, [prepared.lead.id]: 'failed' }));
                        failedCount += 1;
                        const errMsg = (result as any)?.summary?.failures?.[0]?.error ?? 'Unknown error';
                        alert(`Failed to send to ${prepared.lead.companyName}: ${errMsg}`);
                    }
                } catch (err: any) {
                    setSendingProgress(prev => ({ ...prev, [prepared.lead.id]: 'failed' }));
                    failedCount += 1;
                    alert(`Failed to send to ${prepared.lead.companyName}: ${err?.message ?? 'Unknown error'}`);
                }
            }

            let message = `Email campaign completed!\n\n`;
            message += `✅ Sent: ${sentCount}\n`;
            if (failedCount > 0) message += `❌ Failed: ${failedCount}\n`;
            alert(message);

            for (const lead of updatedLeads) {
                await onUpdateLead(lead);
            }
            if (onRefreshLeads) {
                await onRefreshLeads();
            }
            await loadEmailLogs();

            if (failedCount === 0) {
                setShowEmailModal(false);
                setSelectedTemplateId('');
                setSendingProgress({});
            }
        } catch (error: any) {
            console.error('Error sending emails:', error);
            alert(`Error sending emails: ${error.message || 'Unknown error'}`);
        } finally {
            setSendingEmails(false);
        }
    };

    const handleExportExcel = () => {
        try {
            const exportData = filteredLeads.map(lead => {
                const emailStatus = getEmailStatus(lead.id);
                const replied = hasReplied(lead.id);

                return {
                    'Company Name': lead.companyName || '',
                    'Country': lead.country || '',
                    'Website': lead.website || '',
                    'Key Person Name': lead.keyPersonName || '',
                    'Key Person Title': lead.keyPersonTitle || '',
                    'Key Person Email': lead.keyPersonEmail || '',
                    'Key Person Phone': lead.keyPersonPhone || '',
                    'Total Events': lead.totalEvents || 0,
                    'Vietnam Events': lead.vietnamEvents || 0,
                    'Status': lead.status || '',
                    'Email Sent': emailStatus.hasEmail ? 'Yes' : 'No',
                    'Email Count': emailStatus.count || 0,
                    'Last Email Sent': emailStatus.lastSent ? new Date(emailStatus.lastSent).toLocaleDateString() : '',
                    'Replied': replied ? 'Yes' : 'No',
                    'Notes': lead.notes || ''
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Leads');

            const colWidths = [
                { wch: 25 },
                { wch: 15 },
                { wch: 30 },
                { wch: 20 },
                { wch: 25 },
                { wch: 30 },
                { wch: 20 },
                { wch: 12 },
                { wch: 15 },
                { wch: 15 },
                { wch: 12 },
                { wch: 12 },
                { wch: 18 },
                { wch: 10 },
                { wch: 50 }
            ];
            ws['!cols'] = colWidths;

            const dateStr = new Date().toISOString().split('T')[0];
            const filterLabel = emailFilter !== 'all' ? `_${emailFilter}` : '';
            const filename = `leads_export${filterLabel}_${dateStr}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (error: any) {
            console.error('Error exporting to Excel:', error);
            alert(`Error exporting to Excel: ${error.message || 'Unknown error'}`);
        }
    };

    return (
        <div className="p-4 w-full max-w-full flex flex-col space-y-3 overflow-hidden min-h-0">
            {/* Header - Compact */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 shrink-0">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Manage and track your event leads</p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={handleExportExcel}
                        className="bg-white border border-emerald-200 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center shadow-sm"
                    >
                        <FileSpreadsheet size={14} className="mr-1.5" /> Export
                    </button>

                    {(user.role === 'Director' || user.role === 'Sales') && (
                        <>
                            <button
                                onClick={() => setShowEmailModal(true)}
                                className="bg-white border border-indigo-200 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center shadow-sm"
                            >
                                <Mail size={14} className="mr-1.5" /> Send Mail
                            </button>
                            <button
                                onClick={() => setShowAddLeadModal(true)}
                                className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center shadow-sm"
                            >
                                <Plus size={14} className="mr-1.5" /> Add Lead
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Stats - Compact inline */}
            <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shrink-0 shadow-sm">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-slate-500">Total:</span>
                        <span className="text-sm font-bold text-slate-900">{filteredLeads.length}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        <span className="text-xs font-medium text-slate-500">Sent:</span>
                        <span className="text-sm font-bold text-green-700">{emailStats.sent}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                        <span className="text-xs font-medium text-slate-500">Not Sent:</span>
                        <span className="text-sm font-bold text-orange-700">{emailStats.notSent}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span className="text-xs font-medium text-slate-500">With Info:</span>
                        <span className="text-sm font-bold text-indigo-700">{keyPersonStats.withInfo}</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-slate-300"></span>
                        <span className="text-xs font-medium text-slate-500">Without Info:</span>
                        <span className="text-sm font-bold text-slate-600">{keyPersonStats.withoutInfo}</span>
                    </div>
                </div>
            </div>

            {/* Search & Filters - Compact */}
            <div className="bg-white border border-slate-200 rounded-lg p-3 shrink-0 shadow-sm">
                <div className="flex flex-col lg:flex-row gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 min-w-[200px]">
                        <input
                            type="text"
                            placeholder="Search company, city, person, industry..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <select
                                value={countryFilter}
                                onChange={(e) => setCountryFilter(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All Countries</option>
                                {availableCountries.map(country => (
                                    <option key={country} value={country}>{country}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="relative">
                            <select
                                value={industryFilter}
                                onChange={(e) => setIndustryFilter(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All Industries</option>
                                {availableIndustries.map(industry => (
                                    <option key={industry} value={industry}>{industry}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All</option>
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="relative">
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All Types</option>
                                <option value="normal">Normal</option>
                                <option value="DMC">DMC</option>
                                <option value="CORP">CORP</option>
                                <option value="HPNY2026">HPNY2026</option>
                                <option value="LEAD2026FEB_THAIACC">LEAD2026FEB_THAIACC</option>
                                <option value="SUMMER_BEACH_2026">SUMMER_BEACH_2026</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="relative">
                            <select
                                value={emailFilter}
                                onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All</option>
                                <option value="has-key-person">Has key_person_email & key_person_name</option>
                                <option value="no-key-person">No key_person_email & key_person_name</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs font-medium text-slate-500">
                                <span className="font-bold text-slate-900">{filteredLeads.length}</span> results
                            </span>
                            {(searchTerm || countryFilter !== 'all' || industryFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all' || emailFilter !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setCountryFilter('all');
                                        setIndustryFilter('all');
                                        setStatusFilter('all');
                                        setTypeFilter('all');
                                        setEmailFilter('all');
                                    }}
                                    title="Clear filters"
                                    className="p-1.5 bg-slate-100 text-slate-600 rounded-lg"
                                >
                                    <X size={12} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-2 pr-1 pb-2">
                {loading ? (
                    <LeadsSkeleton />
                ) : paginatedLeads.length > 0 ? (
                    paginatedLeads.map((lead) => {
                        // Generate a consistent color for the company avatar based on the name
                        const getAvatarColor = (name: string) => {
                            const colors = [
                                'from-blue-500 to-indigo-600',
                                'from-emerald-500 to-teal-600',
                                'from-orange-500 to-red-600',
                                'from-purple-500 to-violet-600',
                                'from-pink-500 to-rose-600',
                                'from-cyan-500 to-blue-600',
                            ];
                            const index = name.length % colors.length;
                            return colors[index];
                        };
                        const avatarColor = getAvatarColor(lead.companyName || '');

                        const emailStatus = getEmailStatus(lead.id);
                        const replied = hasReplied(lead.id);
                        const isMarking = markingReplies.has(lead.id);

                        return (
                            <div 
                                key={lead.id} 
                                className="group relative bg-white border border-slate-200 rounded-lg p-3 cursor-pointer"
                                onClick={() => onSelectLead(lead)}
                            >
                                <div className="flex items-center gap-3">
                                    {/* Company Avatar */}
                                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white shadow-sm shrink-0`}>
                                        <Building2 size={18} />
                                    </div>

                                    {/* Company Info - 35% */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-sm font-bold text-slate-900 truncate">
                                                {lead.companyName}
                                            </h3>
                                            {lead.industry && lead.industry !== 'Unknown' && lead.industry.toUpperCase() !== 'UNKNOWN' && (
                                                <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                                    {lead.industry}
                                                </span>
                                            )}
                                            {lead.type && (
                                                <span className={`text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                                    lead.type === 'CORP' 
                                                        ? 'bg-blue-100 text-blue-700' 
                                                        : lead.type === 'DMC' 
                                                        ? 'bg-purple-100 text-purple-700' 
                                                        : lead.type === 'HPNY2026'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : lead.type === 'LEAD2026FEB_THAIACC'
                                                        ? 'bg-emerald-100 text-emerald-700'
                                                        : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                    {lead.type}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {lead.city && (
                                                <div className="flex items-center text-xs text-slate-500">
                                                    <MapPin size={10} className="mr-1" />
                                                    {lead.city}{lead.country && `, ${lead.country}`}
                                                </div>
                                            )}
                                            {lead.website && (
                                                <a 
                                                    href={lead.website} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer" 
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="flex items-center text-xs text-indigo-600"
                                                >
                                                    <Globe size={10} className="mr-1" />
                                                    Website
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Key Person - 25% */}
                                    <div className="flex-1 min-w-0 hidden md:block">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                                <UserIcon size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-xs font-semibold text-slate-900 truncate">
                                                    {lead.keyPersonName || 'No Contact'}
                                                </div>
                                                <div className="text-[10px] text-slate-500 truncate">
                                                    {lead.keyPersonTitle || 'N/A'}
                                                </div>
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    {lead.keyPersonEmail && <div className="w-1 h-1 rounded-full bg-green-500" title="Email"></div>}
                                                    {lead.keyPersonPhone && <div className="w-1 h-1 rounded-full bg-blue-500" title="Phone"></div>}
                                                    {lead.keyPersonLinkedIn && <div className="w-1 h-1 rounded-full bg-blue-700" title="LinkedIn"></div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score - 15% */}
                                    <div className="flex items-center gap-3 min-w-[80px]">
                                        <div className="flex flex-col items-center gap-1 w-full">
                                            {lead.leadScore !== null && lead.leadScore !== undefined ? (
                                                <>
                                                    <div className="flex items-center justify-between w-full">
                                                        <span className="text-[10px] font-medium text-slate-400">Score</span>
                                                        <span className={`text-xs font-bold ${lead.leadScore >= 70 ? 'text-green-600' :
                                                            lead.leadScore >= 40 ? 'text-orange-500' : 'text-red-500'
                                                            }`}>{lead.leadScore}</span>
                                                    </div>
                                                    <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full ${(lead.leadScore || 0) >= 70 ? 'bg-green-500' :
                                                                (lead.leadScore || 0) >= 40 ? 'bg-orange-500' : 'bg-red-500'
                                                                }`}
                                                            style={{ width: `${lead.leadScore || 0}%` }}
                                                        ></div>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-[10px] text-slate-300">--</span>
                                            )}
                                            <span className="text-[10px] font-medium text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                                {lead.status || 'New'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Status Icons & Actions - 15% */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className={`relative flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                            emailStatus.hasEmail 
                                                ? 'bg-green-50 text-green-600 border border-green-200' 
                                                : 'bg-slate-50 text-slate-300'
                                        }`} 
                                        title={emailStatus.hasEmail ? `Sent ${emailStatus.count} times` : 'Not sent'}
                                        onClick={(e) => e.stopPropagation()}
                                        >
                                            <Mail size={14} />
                                            {emailStatus.hasEmail && emailStatus.count > 1 && (
                                                <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                                                    {emailStatus.count}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleMarkReply(lead.id);
                                            }}
                                            disabled={replied || isMarking}
                                            className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                                                replied 
                                                    ? 'bg-blue-50 text-blue-600 border border-blue-200' 
                                                    : isMarking 
                                                        ? 'bg-slate-100 text-slate-400' 
                                                        : 'bg-slate-50 text-slate-300'
                                            }`}
                                            title={replied ? 'Replied' : 'Mark Reply'}
                                        >
                                            {isMarking ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                                        </button>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onSelectLead(lead);
                                            }}
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 rounded-lg"
                                        >
                                            <ChevronRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 bg-white rounded-lg border border-dashed border-slate-200">
                        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                            <Search className="text-slate-300" size={32} />
                        </div>
                        <h3 className="text-sm font-bold text-slate-700">No leads found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
                            No leads match your current filters. Try adjusting your search criteria.
                        </p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setCountryFilter('all');
                                setIndustryFilter('all');
                                setStatusFilter('all');
                                setTypeFilter('all');
                                setEmailFilter('all');
                            }}
                            className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-sm flex items-center gap-2"
                        >
                            <X size={12} />
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

            {filteredLeads.length > itemsPerPage && (
                <div className="bg-white border border-slate-200 rounded-lg px-4 py-3 shrink-0 shadow-sm flex items-center justify-between">
                    <div className="text-xs text-slate-600">
                        Showing <span className="font-semibold text-slate-900">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                        <span className="font-semibold text-slate-900">{Math.min(currentPage * itemsPerPage, filteredLeads.length)}</span> of{' '}
                        <span className="font-semibold text-slate-900">{filteredLeads.length}</span> leads
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum;
                                if (totalPages <= 5) {
                                    pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                    pageNum = i + 1;
                                } else if (currentPage >= totalPages - 2) {
                                    pageNum = totalPages - 4 + i;
                                } else {
                                    pageNum = currentPage - 2 + i;
                                }
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                                            currentPage === pageNum
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                );
                            })}
                        </div>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {showEmailModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Send Mail to All Leads</h2>
                                <p className="text-sm text-slate-600 mt-1">
                                    Select an email template and preview prepared emails (not sending yet)
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowEmailModal(false);
                                    setSelectedTemplateId('');
                                    setTestEmail('');
                                }}
                                className="text-slate-400 p-2 rounded-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingTemplates ? (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                                    <span className="ml-3 text-slate-600">Loading email templates...</span>
                                </div>
                            ) : emailTemplates.length === 0 ? (
                                <div className="text-center py-12">
                                    <Mail className="text-slate-300 mx-auto mb-3" size={48} />
                                    <p className="text-slate-700 font-medium">No email templates found</p>
                                    <p className="text-slate-500 text-sm mt-1">Please create an email template first</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Select Email Template
                                        </label>
                                        <select
                                            value={selectedTemplateId}
                                            onChange={(e) => setSelectedTemplateId(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        >
                                            {emailTemplates.map(template => (
                                                <option key={template.id} value={template.id}>
                                                    {template.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">
                                            Lead type để gửi template
                                        </label>
                                        <select
                                            value={templateTargetLeadType}
                                            onChange={(e) => setTemplateTargetLeadType(e.target.value as typeof templateTargetLeadType)}
                                            className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                        >
                                            <option value="auto">Auto (dùng leadType của template)</option>
                                            <option value="all">All lead types (có email, chưa gửi)</option>
                                            <option value="normal">Normal (lead không có type)</option>
                                            <option value="DMC">DMC</option>
                                            <option value="CORP">CORP</option>
                                            <option value="HPNY2026">HPNY2026</option>
                                            <option value="LEAD2026FEB_THAIACC">LEAD2026FEB_THAIACC</option>
                                            <option value="SUMMER_BEACH_2026">SUMMER_BEACH_2026</option>
                                        </select>
                                    </div>

                                    {/* Test Email Section */}
                                    {selectedTemplateId && (
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h3 className="text-sm font-semibold text-blue-900 mb-3">Send Test Email</h3>
                                            <div className="flex gap-2">
                                                <TestEmailInput
                                                    value={testEmail}
                                                    onChange={handleTestEmailChange}
                                                    disabled={sendingTestEmail}
                                                />
                                                <button
                                                    onClick={handleSendTestEmail}
                                                    disabled={sendingTestEmail || !testEmail.trim()}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {sendingTestEmail ? (
                                                        <>
                                                            <Loader2 size={16} className="mr-2 animate-spin" />
                                                            Sending...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Mail size={16} className="mr-2" />
                                                            Send Test
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                            <p className="text-xs text-blue-700 mt-2">
                                                Gửi email test với template đã chọn để kiểm tra trước khi gửi hàng loạt
                                            </p>
                                        </div>
                                    )}

                                    {selectedTemplateId && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Template Preview</h3>
                                            {(() => {
                                                const template = emailTemplates.find(t => t.id === selectedTemplateId);
                                                if (!template) return null;
                                                return (
                                                    <div className="space-y-3">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            {template.leadType && (
                                                                <span className="text-xs font-semibold px-2 py-1 bg-blue-100 text-blue-700 rounded">
                                                                    Lead Type: {template.leadType}
                                                                </span>
                                                            )}
                                                            {template.language && (
                                                                <span className="text-xs font-semibold px-2 py-1 bg-green-100 text-green-700 rounded">
                                                                    Language: {template.language.toUpperCase()}
                                                                </span>
                                                            )}
                                                            {template.language && (
                                                                <span className="text-xs text-slate-600">
                                                                    {template.language.toLowerCase() === 'en' 
                                                                        ? '(Gửi cho tất cả các quốc gia trừ Vietnam)'
                                                                        : `(Chỉ gửi cho leads từ country có language ${template.language.toUpperCase()})`
                                                                    }
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500 uppercase">Subject:</span>
                                                            <p className="text-sm text-slate-900 mt-1">{template.subject}</p>
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-medium text-slate-500 uppercase">Body:</span>
                                                            <div className="text-sm text-slate-900 mt-1 bg-white p-3 rounded border border-slate-200 max-h-40 overflow-y-auto" dangerouslySetInnerHTML={{ __html: template.body }} />
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    )}

                                    {preparedEmails.length > 0 && (
                                        <div>
                                            <div className="flex items-center justify-between mb-3">
                                                <h3 className="text-sm font-semibold text-slate-700">
                                                    Prepared Emails ({preparedEmails.length} leads matching this template)
                                                </h3>
                                                <span className="text-xs text-slate-500">
                                                    {filteredLeads.length - preparedEmails.length} leads in list do not match this template
                                                </span>
                                            </div>
                                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                                {preparedEmails.map((prepared, idx) => {
                                                    const status = sendingProgress[prepared.lead.id];
                                                    return (
                                                    <div key={prepared.lead.id} className={`bg-white border rounded-lg p-4 ${status === 'sending' ? 'border-indigo-300 ring-1 ring-indigo-200' : status === 'sent' ? 'border-green-200' : status === 'failed' ? 'border-red-200' : 'border-slate-200'}`}>
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-900">{prepared.lead.companyName}</span>
                                                                    {status && (
                                                                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                                                                            {status === 'pending' && <><Circle size={14} className="text-slate-400" /> Pending</>}
                                                                            {status === 'sending' && <><Loader2 size={14} className="text-indigo-600 animate-spin" /> Sending...</>}
                                                                            {status === 'sent' && <><CheckCircle size={14} className="text-green-600" /> Sent</>}
                                                                            {status === 'failed' && <><XCircle size={14} className="text-red-600" /> Failed</>}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <p className="text-xs text-slate-500 mt-1 ml-8">
                                                                    To: {prepared.lead.keyPersonEmail} ({prepared.lead.keyPersonName})
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="ml-8 space-y-2">
                                                            <div>
                                                                <span className="text-xs font-medium text-slate-500">Subject:</span>
                                                                <p className="text-sm text-slate-900 mt-0.5">{prepared.subject}</p>
                                                            </div>
                                                            <div>
                                                                <span className="text-xs font-medium text-slate-500">Body Preview:</span>
                                                                <div
                                                                    className="text-sm text-slate-900 mt-0.5 bg-white p-3 rounded border border-slate-200 max-h-40 overflow-y-auto"
                                                                    dangerouslySetInnerHTML={{ __html: prepared.body }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {selectedTemplateId && preparedEmails.length === 0 && filteredLeads.some(l => l.keyPersonEmail) && (
                                        <div className="text-center py-8 text-slate-500">
                                            <Mail className="text-slate-300 mx-auto mb-2" size={32} />
                                            <p>No leads match this template or all matching leads have already been emailed.</p>
                                            {(() => {
                                                const t = emailTemplates.find(x => x.id === selectedTemplateId);
                                                const baseTypeLabel = t?.leadType ? `${t.leadType} leads` : 'Regular leads';
                                                const languageLabel = t?.language ? ` (${t.language.toUpperCase()})` : '';

                                                let languageDesc = '';
                                                if (t?.language) {
                                                    if (t.language.toLowerCase() === 'en') {
                                                        languageDesc = ' từ tất cả các quốc gia (trừ Vietnam)';
                                                    } else {
                                                        languageDesc = ` từ country có language ${t.language.toUpperCase()}`;
                                                    }
                                                }

                                                let effectiveLabel: string;
                                                if (templateTargetLeadType === 'all') {
                                                    effectiveLabel = `all leads with email (chưa gửi)${languageDesc}`;
                                                } else if (templateTargetLeadType === 'normal') {
                                                    effectiveLabel = `normal leads (không có type)${languageDesc}`;
                                                } else if (templateTargetLeadType === 'auto') {
                                                    effectiveLabel = `${baseTypeLabel}${languageLabel}`;
                                                } else {
                                                    effectiveLabel = `${templateTargetLeadType} leads${languageLabel}`;
                                                }

                                                return <p className="text-xs mt-1">This template currently targets {effectiveLabel}.</p>;
                                            })()}
                                        </div>
                                    )}

                                    {selectedTemplateId && !filteredLeads.some(l => l.keyPersonEmail) && (
                                        <div className="text-center py-8">
                                            <Mail className="text-slate-300 mx-auto mb-2" size={32} />
                                            <p className="text-slate-500">No leads with email addresses found</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowEmailModal(false);
                                    setSelectedTemplateId('');
                                    setTestEmail('');
                                }}
                                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                            >
                                Close
                            </button>
                            {preparedEmails.length > 0 && (
                                <button
                                    onClick={handleSendEmails}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                                    disabled={sendingEmails}
                                >
                                    {sendingEmails ? (
                                        <>
                                            <Loader2 size={16} className="mr-2 animate-spin" />
                                            Sending ({Object.values(sendingProgress).filter(s => s === 'sent' || s === 'failed').length}/{preparedEmails.length})
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} className="mr-2" />
                                            Send Emails ({preparedEmails.length})
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Lead Modal */}
            {showAddLeadModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
                            <div>
                                <h2 className="text-2xl font-bold text-slate-900">Thêm Lead Mới</h2>
                                <p className="text-sm text-slate-600 mt-1">Nhập thông tin lead mới</p>
                            </div>
                            <button
                                onClick={() => {
                                    setShowAddLeadModal(false);
                                    setNewLeadData({
                                        companyName: '',
                                        industry: '',
                                        country: '',
                                        city: '',
                                        website: '',
                                        keyPersonName: '',
                                        keyPersonTitle: '',
                                        keyPersonEmail: '',
                                        keyPersonPhone: '',
                                        keyPersonLinkedIn: '',
                                        status: 'New',
                                        notes: '',
                                        totalEvents: 0,
                                        vietnamEvents: 0,
                                    });
                                }}
                                className="text-slate-400 p-2 rounded-lg hover:bg-slate-100"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-xs font-medium text-slate-500 block mb-1">
                                            Tên Công Ty <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={newLeadData.companyName || ''}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, companyName: e.target.value })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Nhập tên công ty"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Ngành</label>
                                        <input
                                            type="text"
                                            value={newLeadData.industry || ''}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, industry: e.target.value })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Nhập ngành"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Quốc Gia</label>
                                        <input
                                            type="text"
                                            value={newLeadData.country || ''}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, country: e.target.value })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Nhập quốc gia"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Thành Phố</label>
                                        <input
                                            type="text"
                                            value={newLeadData.city || ''}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, city: e.target.value })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Nhập thành phố"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Website</label>
                                        <input
                                            type="text"
                                            value={newLeadData.website || ''}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, website: e.target.value })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="https://example.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 block mb-1">Trạng Thái</label>
                                        <select
                                            value={newLeadData.status || 'New'}
                                            onChange={(e) => setNewLeadData({ ...newLeadData, status: e.target.value as Lead['status'] })}
                                            className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        >
                                            <option value="New">New</option>
                                            <option value="Contacted">Contacted</option>
                                            <option value="Qualified">Qualified</option>
                                            <option value="Won">Won</option>
                                            <option value="Lost">Lost</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="text-sm font-bold text-slate-900 mb-3">Thông Tin Liên Hệ</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 block mb-1">Tên Người Liên Hệ</label>
                                            <input
                                                type="text"
                                                value={newLeadData.keyPersonName || ''}
                                                onChange={(e) => setNewLeadData({ ...newLeadData, keyPersonName: e.target.value })}
                                                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Nhập tên"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 block mb-1">Chức Danh</label>
                                            <input
                                                type="text"
                                                value={newLeadData.keyPersonTitle || ''}
                                                onChange={(e) => setNewLeadData({ ...newLeadData, keyPersonTitle: e.target.value })}
                                                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="Nhập chức danh"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 block mb-1">Email</label>
                                            <input
                                                type="email"
                                                value={newLeadData.keyPersonEmail || ''}
                                                onChange={(e) => setNewLeadData({ ...newLeadData, keyPersonEmail: e.target.value })}
                                                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="email@example.com"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 block mb-1">Số Điện Thoại</label>
                                            <input
                                                type="text"
                                                value={newLeadData.keyPersonPhone || ''}
                                                onChange={(e) => setNewLeadData({ ...newLeadData, keyPersonPhone: e.target.value })}
                                                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="+84..."
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-medium text-slate-500 block mb-1">LinkedIn</label>
                                            <input
                                                type="text"
                                                value={newLeadData.keyPersonLinkedIn || ''}
                                                onChange={(e) => setNewLeadData({ ...newLeadData, keyPersonLinkedIn: e.target.value })}
                                                className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="LinkedIn URL"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <label className="text-xs font-medium text-slate-500 block mb-1">Ghi Chú</label>
                                    <textarea
                                        rows={3}
                                        value={newLeadData.notes || ''}
                                        onChange={(e) => setNewLeadData({ ...newLeadData, notes: e.target.value })}
                                        className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                        placeholder="Nhập ghi chú..."
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-200 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowAddLeadModal(false);
                                    setNewLeadData({
                                        companyName: '',
                                        industry: '',
                                        country: '',
                                        city: '',
                                        website: '',
                                        keyPersonName: '',
                                        keyPersonTitle: '',
                                        keyPersonEmail: '',
                                        keyPersonPhone: '',
                                        keyPersonLinkedIn: '',
                                        status: 'New',
                                        notes: '',
                                        totalEvents: 0,
                                        vietnamEvents: 0,
                                    });
                                }}
                                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold"
                                disabled={savingLead}
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleAddLeadSubmit}
                                disabled={savingLead || !newLeadData.companyName?.trim()}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-semibold inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {savingLead ? (
                                    <>
                                        <Loader2 size={16} className="mr-2 animate-spin" />
                                        Đang lưu...
                                    </>
                                ) : (
                                    <>
                                        <Plus size={16} className="mr-2" />
                                        Thêm Lead
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
