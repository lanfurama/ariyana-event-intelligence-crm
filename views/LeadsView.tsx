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
        <div className="p-6 w-full max-w-full flex flex-col space-y-5 overflow-hidden min-h-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900 tracking-tight drop-shadow-sm">Leads</h2>
                    <p className="text-sm font-medium text-slate-600 mt-1">Manage and track your event leads</p>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        onClick={handleExportExcel}
                        className="glass-card hover:bg-white/80 text-emerald-700 border-emerald-200/50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shrink-0 inline-flex items-center shadow-sm"
                    >
                        <FileSpreadsheet size={18} className="mr-2" /> Export Excel
                    </button>

                    {(user.role === 'Director' || user.role === 'Sales') && (
                        <>
                            <button
                                onClick={() => setShowEmailModal(true)}
                                className="glass-card hover:bg-white/80 text-indigo-700 border-indigo-200/50 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shrink-0 inline-flex items-center shadow-sm"
                            >
                                <Mail size={18} className="mr-2" /> Send Mail to All
                            </button>
                            <button
                                onClick={onAddLead}
                                className="bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-lg hover:shadow-slate-900/30 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 active:scale-95 shrink-0 inline-flex items-center"
                            >
                                <Plus size={18} className="mr-2" /> Add Lead
                            </button>
                        </>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-xl px-4 py-3 shrink-0">
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    <div className="text-center py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Total</div>
                        <div className="text-xl font-black text-slate-900 leading-tight">{filteredLeads.length}</div>
                    </div>
                    <div className="text-center py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div className="text-[10px] text-green-600/80 font-bold uppercase tracking-wider">Sent</div>
                        <div className="text-xl font-black text-green-700 leading-tight">{emailStats.sent}</div>
                    </div>
                    <div className="text-center py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div className="text-[10px] text-orange-600/80 font-bold uppercase tracking-wider">Not Sent</div>
                        <div className="text-xl font-black text-orange-700 leading-tight">{emailStats.notSent}</div>
                    </div>
                    <div className="text-center py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div className="text-[10px] text-indigo-600/80 font-bold uppercase tracking-wider">With Info</div>
                        <div className="text-xl font-black text-indigo-700 leading-tight">{keyPersonStats.withInfo}</div>
                    </div>
                    <div className="text-center py-1.5 px-2 rounded-lg hover:bg-white/40 transition-colors">
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Without Info</div>
                        <div className="text-xl font-black text-slate-500 leading-tight">{keyPersonStats.withoutInfo}</div>
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-xl p-4 shrink-0">
                <div className="flex flex-col xl:flex-row gap-4">
                    {/* Search Input - Flex 1 */}
                    <div className="relative flex-1 min-w-[280px]">
                        <input
                            type="text"
                            placeholder="Search by company, city, person, or industry..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="glass-input w-full pl-11 pr-4 py-2.5 rounded-xl text-sm font-medium text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary/50"
                        />
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
                    </div>

                    {/* Filters & Actions - Flex 2 */}
                    <div className="flex flex-col md:flex-row gap-4 flex-[2] xl:items-center justify-between">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 w-full">
                            <div className="relative">
                                <select
                                    value={countryFilter}
                                    onChange={(e) => setCountryFilter(e.target.value)}
                                    className="glass-input appearance-none w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-white/60 focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="all">All Countries</option>
                                    {availableCountries.map(country => (
                                        <option key={country} value={country}>{country}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>

                            <div className="relative">
                                <select
                                    value={industryFilter}
                                    onChange={(e) => setIndustryFilter(e.target.value)}
                                    className="glass-input appearance-none w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-white/60 focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="all">All Industries</option>
                                    {availableIndustries.map(industry => (
                                        <option key={industry} value={industry}>{industry}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>

                            <div className="relative">
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="glass-input appearance-none w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-white/60 focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="New">New</option>
                                    <option value="Contacted">Contacted</option>
                                    <option value="Qualified">Qualified</option>
                                    <option value="Proposal">Proposal</option>
                                    <option value="Negotiation">Negotiation</option>
                                    <option value="Won">Won</option>
                                    <option value="Lost">Lost</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>

                            <div className="relative">
                                <select
                                    value={emailFilter}
                                    onChange={(e) => setEmailFilter(e.target.value as typeof emailFilter)}
                                    className="glass-input appearance-none w-full rounded-xl px-4 py-2.5 pr-10 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-white/60 focus:ring-2 focus:ring-primary/50"
                                >
                                    <option value="all">All Email</option>
                                    <option value="sent">Sent</option>
                                    <option value="unsent">Not Sent</option>
                                    <option value="no-key-person-email">No Contact</option>
                                    <option value="has-key-person-email">Has Contact</option>
                                    <option value="replied">Replied</option>
                                </select>
                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" size={16} />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 whitespace-nowrap pl-2 border-l border-slate-200/50 md:border-l-0 xl:border-l">
                            <div className="text-sm font-medium text-slate-500">
                                <span className="font-bold text-slate-900">{filteredLeads.length}</span> results
                            </div>
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
                                    className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-all hover:text-slate-900"
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 space-y-3 pr-1 pb-2">
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
                            <div key={lead.id} className="group relative glass-card p-5 rounded-2xl hover:bg-white/50 transition-all duration-300 border border-white/20 shadow-sm">
                                <div className="flex flex-col md:flex-row items-center gap-6">
                                    {/* Company Section - 30% */}
                                    <div className="flex-1 w-full md:w-[30%] flex items-start gap-4">
                                        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${avatarColor} flex items-center justify-center text-white shadow-lg shrink-0`}>
                                            <Building2 size={24} />
                                        </div>
                                        <div className="min-w-0">
                                            <h3 className="text-lg font-bold text-slate-900 truncate leading-tight group-hover:text-primary transition-colors">
                                                {lead.companyName}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                                                {lead.city && (
                                                    <div className="flex items-center text-xs font-semibold text-slate-500 bg-slate-100/50 px-2 py-1 rounded-md">
                                                        <MapPin size={12} className="mr-1" />
                                                        {lead.city}, {lead.country}
                                                    </div>
                                                )}
                                                {lead.website && (
                                                    <a href={lead.website} target="_blank" rel="noopener noreferrer" className="flex items-center text-xs font-semibold text-blue-600 hover:underline bg-blue-50/50 px-2 py-1 rounded-md">
                                                        <Globe size={12} className="mr-1" />
                                                        Website
                                                    </a>
                                                )}
                                            </div>
                                            {lead.industry && (
                                                <span className="inline-block mt-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                                                    {lead.industry}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Key Person Section - 25% */}
                                    <div className="flex-1 w-full md:w-[25%] border-l border-slate-100 pl-6 border-dashed">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                                <UserIcon size={20} />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-bold text-slate-900">{lead.keyPersonName || 'No Contact'}</div>
                                                <div className="text-xs font-medium text-slate-500 truncate max-w-full">
                                                    {lead.keyPersonTitle || 'N/A'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    {lead.keyPersonEmail && <div className="w-1.5 h-1.5 rounded-full bg-green-500" title="Email available"></div>}
                                                    {lead.keyPersonPhone && <div className="w-1.5 h-1.5 rounded-full bg-blue-500" title="Phone available"></div>}
                                                    {lead.keyPersonLinkedIn && <div className="w-1.5 h-1.5 rounded-full bg-blue-700" title="LinkedIn available"></div>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Score & Metrics - 20% */}
                                    <div className="flex-1 w-full md:w-[20%] flex items-center justify-center border-l border-slate-100 px-4 border-dashed">
                                        <div className="flex flex-col items-center gap-2 w-full">
                                            <div className="flex items-center justify-between w-full">
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Score</span>
                                                {lead.leadScore ? (
                                                    <span className={`text-sm font-black ${lead.leadScore >= 70 ? 'text-green-600' :
                                                        lead.leadScore >= 40 ? 'text-orange-500' : 'text-red-500'
                                                        }`}>{lead.leadScore}</span>
                                                ) : <span className="text-xs text-slate-300">--</span>}
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full ${(lead.leadScore || 0) >= 70 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                                                        (lead.leadScore || 0) >= 40 ? 'bg-gradient-to-r from-orange-400 to-orange-600' :
                                                            'bg-gradient-to-r from-red-400 to-red-600'
                                                        }`}
                                                    style={{ width: `${lead.leadScore || 0}%` }}
                                                ></div>
                                            </div>
                                            <div className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">
                                                {lead.status || 'New'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actions & Status - 25% */}
                                    <div className="flex-1 w-full md:w-[25%] flex items-center justify-end gap-3 border-l border-slate-100 pl-6 border-dashed">

                                        {/* Status Icons */}
                                        <div className="flex items-center gap-2 mr-2">
                                            <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-xl transition-all ${emailStatus.hasEmail ? 'bg-green-50 text-green-600 shadow-sm border border-green-100' : 'bg-slate-50 text-slate-300'
                                                }`} title={emailStatus.hasEmail ? `Sent ${emailStatus.count} times` : 'Not sent'}>
                                                <Mail size={18} />
                                                {emailStatus.hasEmail && <span className="text-[9px] font-bold mt-0.5">{emailStatus.count}</span>}
                                            </div>

                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleMarkReply(lead.id);
                                                }}
                                                disabled={replied || isMarking}
                                                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all ${replied ? 'bg-blue-50 text-blue-600 shadow-sm border border-blue-100' :
                                                    isMarking ? 'bg-slate-100 text-slate-400 animate-pulse' :
                                                        'bg-slate-50 text-slate-300 hover:bg-blue-50 hover:text-blue-500 cursor-pointer'
                                                    }`}
                                                title={replied ? 'Replied' : 'Mark Reply'}
                                            >
                                                {isMarking ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                                            </button>
                                        </div>

                                        <button
                                            onClick={() => onSelectLead(lead)}
                                            className="ml-auto glass-input hover:bg-white text-slate-600 hover:text-primary p-2.5 rounded-xl transition-all shadow-sm hover:shadow active:scale-95"
                                        >
                                            <ChevronRight size={20} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 bg-white/50 rounded-2xl border border-dashed border-slate-300/50">
                        <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4 shadow-inner">
                            <Search className="text-slate-300" size={40} />
                        </div>
                        <h3 className="text-lg font-bold text-slate-700">No leads found</h3>
                        <p className="text-sm text-slate-500 mt-1 max-w-xs text-center">
                            We couldn't find any leads matching your current filters. Try adjusting your search criteria.
                        </p>
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setCountryFilter('all');
                                setIndustryFilter('all');
                                setStatusFilter('all');
                                setEmailFilter('all');
                            }}
                            className="mt-6 px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl shadow-sm hover:bg-slate-50 transition-all flex items-center gap-2"
                        >
                            <X size={16} />
                            Clear all filters
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
                                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
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
                                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
                            >
                                Close
                            </button>
                            {preparedEmails.length > 0 && (
                                <button
                                    onClick={handleSendEmails}
                                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
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
