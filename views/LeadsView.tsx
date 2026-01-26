import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Search,
    Mail,
    Plus,
    ChevronRight,
    Loader2,
    Send,
    X,
    CheckCircle,
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
import * as XLSX from 'xlsx';
import { LeadsSkeleton } from '../components/common/LeadsSkeleton';

interface LeadsViewProps {
    leads: Lead[];
    onSelectLead: (lead: Lead) => void;
    onUpdateLead: (lead: Lead) => void;
    user: User;
    onAddLead?: () => void;
    loading?: boolean;
}

export const LeadsView: React.FC<LeadsViewProps> = ({ leads, onSelectLead, onUpdateLead, user, onAddLead, loading }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [emailFilter, setEmailFilter] = useState<'all' | 'sent' | 'unsent' | 'no-key-person-email' | 'has-key-person-email' | 'replied'>('all');
    const [countryFilter, setCountryFilter] = useState<string>('all');
    const [industryFilter, setIndustryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all');
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

            if (emailFilter === 'all') return true;

            if (emailFilter === 'no-key-person-email') {
                return !lead.keyPersonEmail || lead.keyPersonEmail.trim() === '';
            }

            if (emailFilter === 'has-key-person-email') {
                return !!(lead.keyPersonEmail && lead.keyPersonEmail.trim() !== '');
            }

            const emailStatus = getEmailStatus(lead.id);
            if (emailFilter === 'sent') {
                return emailStatus.hasEmail;
            } else if (emailFilter === 'unsent') {
                return !emailStatus.hasEmail;
            }

            if (emailFilter === 'replied') {
                return emailStatus.hasEmail && hasReplied(lead.id);
            }

            return true;
        });
    }, [leads, searchTerm, emailFilter, countryFilter, industryFilter, statusFilter, emailLogs, emailReplies]);

    useEffect(() => {
        loadEmailLogs();
        loadEmailReplies();
    }, [leads]);

    useEffect(() => {
        if (showEmailModal) {
            loadEmailTemplates();
        }
    }, [showEmailModal]);

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

    const preparedEmails = useMemo(() => {
        if (!selectedTemplateId || filteredLeads.length === 0 || emailTemplates.length === 0) {
            return [];
        }

        const template = emailTemplates.find(t => t.id === selectedTemplateId);
        if (!template) return [];

        return filteredLeads
            .filter(lead => {
                if (!lead.keyPersonEmail) return false;
                const emailStatus = getEmailStatus(lead.id);
                return !emailStatus.hasEmail;
            })
            .map(lead => {
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

                return { lead, subject, body };
            });
    }, [selectedTemplateId, filteredLeads, emailTemplates]);

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

    const handleSendEmails = async () => {
        if (preparedEmails.length === 0) {
            alert('No emails prepared. Please select a template and ensure leads have email addresses.');
            return;
        }

        if (!confirm(`Are you sure you want to send ${preparedEmails.length} email(s)?`)) {
            return;
        }

        setSendingEmails(true);
        try {
            const leadIds = preparedEmails.map(p => p.lead.id);
            const emails = preparedEmails.map(p => ({
                leadId: p.lead.id,
                subject: p.subject,
                body: p.body,
            }));

            const result = await leadsApi.sendEmails(leadIds, emails);

            if (result.success) {
                const summary = result.summary;
                let message = `Email campaign completed!\n\n`;
                message += `✅ Sent: ${summary.sent} of ${summary.attempted}\n`;
                if (summary.failures && summary.failures.length > 0) {
                    message += `❌ Failed: ${summary.failures.length}\n`;
                }
                if (summary.message) {
                    message += `\n${summary.message}`;
                }
                alert(message);

                if (result.updatedLeads && result.updatedLeads.length > 0) {
                    result.updatedLeads.forEach(updatedLead => {
                        onUpdateLead(updatedLead);
                    });
                }

                await loadEmailLogs();

                setShowEmailModal(false);
                setSelectedTemplateId('');
            } else {
                alert('Failed to send emails. Please try again.');
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
                        className="bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center transition-colors shadow-sm"
                    >
                        <FileSpreadsheet size={14} className="mr-1.5" /> Export
                    </button>

                    {(user.role === 'Director' || user.role === 'Sales') && (
                        <>
                            <button
                                onClick={() => setShowEmailModal(true)}
                                className="bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center transition-colors shadow-sm"
                            >
                                <Mail size={14} className="mr-1.5" /> Send Mail
                            </button>
                            <button
                                onClick={onAddLead}
                                className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 inline-flex items-center transition-colors shadow-sm"
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
                                <option value="all">All Status</option>
                                <option value="New">New</option>
                                <option value="Contacted">Contacted</option>
                                <option value="Qualified">Qualified</option>
                                <option value="Proposal">Proposal</option>
                                <option value="Negotiation">Negotiation</option>
                                <option value="Won">Won</option>
                                <option value="Lost">Lost</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="relative">
                            <select
                                value={emailFilter}
                                onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
                                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-700 cursor-pointer focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:bg-white transition-colors"
                            >
                                <option value="all">All Email</option>
                                <option value="sent">Sent</option>
                                <option value="unsent">Not Sent</option>
                                <option value="no-key-person-email">No Contact</option>
                                <option value="has-key-person-email">Has Contact</option>
                                <option value="replied">Replied</option>
                            </select>
                            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                        </div>

                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs font-medium text-slate-500">
                                <span className="font-bold text-slate-900">{filteredLeads.length}</span> results
                            </span>
                            {(searchTerm || countryFilter !== 'all' || industryFilter !== 'all' || statusFilter !== 'all' || emailFilter !== 'all') && (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setCountryFilter('all');
                                        setIndustryFilter('all');
                                        setStatusFilter('all');
                                        setEmailFilter('all');
                                    }}
                                    title="Clear filters"
                                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
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
                ) : filteredLeads.length > 0 ? (
                    filteredLeads.map((lead) => {
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
                                className="group relative bg-white border border-slate-200 rounded-lg p-3 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
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
                                            {lead.industry && (
                                                <span className="text-[10px] uppercase font-semibold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                                                    {lead.industry}
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
                                                    className="flex items-center text-xs text-indigo-600 hover:text-indigo-700"
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
                                                        : 'bg-slate-50 text-slate-300 hover:bg-slate-100'
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
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"
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
                                setEmailFilter('all');
                            }}
                            className="mt-4 px-4 py-2 bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
                        >
                            <X size={12} />
                            Clear filters
                        </button>
                    </div>
                )}
            </div>

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

                                    {selectedTemplateId && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Template Preview</h3>
                                            {(() => {
                                                const template = emailTemplates.find(t => t.id === selectedTemplateId);
                                                if (!template) return null;
                                                return (
                                                    <div className="space-y-3">
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
                                                    Prepared Emails ({preparedEmails.length} of {filteredLeads.length} leads with email)
                                                </h3>
                                                <span className="text-xs text-slate-500">
                                                    {filteredLeads.length - preparedEmails.length} leads without email will be skipped
                                                </span>
                                            </div>
                                            <div className="space-y-3 max-h-96 overflow-y-auto">
                                                {preparedEmails.map((prepared, idx) => (
                                                    <div key={prepared.lead.id} className="bg-white border border-slate-200 rounded-lg p-4">
                                                        <div className="flex items-start justify-between mb-2">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">
                                                                        {idx + 1}
                                                                    </span>
                                                                    <span className="font-semibold text-slate-900">{prepared.lead.companyName}</span>
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
                                                                <p className="text-sm text-slate-700 mt-0.5 line-clamp-2">
                                                                    {prepared.body.substring(0, 150)}...
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {selectedTemplateId && preparedEmails.length === 0 && filteredLeads.some(l => l.keyPersonEmail) && (
                                        <div className="text-center py-8 text-slate-500">
                                            <Loader2 className="animate-spin text-indigo-600 mx-auto mb-2" size={24} />
                                            <p>Preparing emails...</p>
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
                                            Sending...
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
        </div>
    );
};
