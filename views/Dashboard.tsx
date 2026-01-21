import React, { useState, useEffect, useMemo } from 'react';
import {
    Users,
    MessageSquare,
    Search,
    Send,
    Plus,
    CheckCircle,
    TrendingUp,
    MapPin,
    Loader2
} from 'lucide-react';
import { Lead, EmailLog, EmailReply } from '../types';
import { emailLogsApi, emailRepliesApi } from '../services/apiService';
import { StatCard, PipelineBars, EmailActivityChart } from '../components/common/Stats';

interface DashboardProps {
    leads: Lead[];
    loading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ leads, loading }) => {
    const [emailLogs, setEmailLogs] = useState<Array<{ leadId: string, count: number, lastSent?: Date }>>([]);
    const [allEmailLogs, setAllEmailLogs] = useState<EmailLog[]>([]);
    const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
    const [allEmailReplies, setAllEmailReplies] = useState<any[]>([]);
    const [loadingEmailReplies, setLoadingEmailReplies] = useState(false);
    const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'this-week' | 'this-month'>('all');

    useEffect(() => {
        loadEmailLogs();
        loadEmailReplies();
    }, []);

    const loadEmailLogs = async () => {
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
        setLoadingEmailReplies(true);
        try {
            const replies = await emailRepliesApi.getAll();
            setAllEmailReplies(replies);
        } catch (error) {
            console.error('Error loading email replies:', error);
        } finally {
            setLoadingEmailReplies(false);
        }
    };

    const stats = {
        total: leads.length,
        vietnam: leads.filter(l => l.vietnamEvents > 0).length,
        new: leads.filter(l => l.status === 'New').length,
        qualified: leads.filter(l => l.status === 'Qualified').length
    };

    const filteredEmailLogs = useMemo(() => {
        if (timeFilter === 'all') {
            return emailLogs;
        }

        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const yesterdayEnd = new Date(todayStart);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        const sentLogs = allEmailLogs.filter(log => log.status === 'sent' && log.date);
        let filteredLogs: EmailLog[] = [];

        switch (timeFilter) {
            case 'today':
                filteredLogs = sentLogs.filter(log => {
                    const logDate = new Date(log.date);
                    return logDate >= todayStart;
                });
                break;
            case 'yesterday':
                filteredLogs = sentLogs.filter(log => {
                    const logDate = new Date(log.date);
                    return logDate >= yesterdayStart && logDate < todayStart;
                });
                break;
            case 'this-week':
                filteredLogs = sentLogs.filter(log => {
                    const logDate = new Date(log.date);
                    return logDate >= weekStart;
                });
                break;
            case 'this-month':
                filteredLogs = sentLogs.filter(log => {
                    const logDate = new Date(log.date);
                    return logDate >= monthStart;
                });
                break;
        }

        const logsByLead = new Map<string, { count: number, lastSent?: Date }>();
        filteredLogs.forEach(log => {
            if (log.lead_id) {
                const existing = logsByLead.get(log.lead_id) || { count: 0 };
                existing.count += 1;
                const logDate = log.date ? new Date(log.date) : null;
                if (logDate && (!existing.lastSent || logDate > existing.lastSent)) {
                    existing.lastSent = logDate;
                }
                logsByLead.set(log.lead_id, existing);
            }
        });

        return Array.from(logsByLead.entries()).map(([leadId, data]) => ({
            leadId,
            ...data
        }));
    }, [timeFilter, allEmailLogs, emailLogs]);

    const leadsWithEmails = new Set(filteredEmailLogs.map(log => log.leadId));
    const sentEmailsCount = leadsWithEmails.size;
    const unsentEmailsCount = leads.length - sentEmailsCount;
    const totalEmailsSent = filteredEmailLogs.reduce((sum, log) => sum + log.count, 0);

    const emailRepliesStats = useMemo(() => {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);
        const weekStart = new Date(todayStart);
        weekStart.setDate(weekStart.getDate() - 7);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let filteredReplies = allEmailReplies;

        if (timeFilter !== 'all') {
            filteredReplies = allEmailReplies.filter(reply => {
                const replyDate = reply.reply_date ? new Date(reply.reply_date) : null;
                if (!replyDate) return false;

                switch (timeFilter) {
                    case 'today':
                        return replyDate >= todayStart;
                    case 'yesterday':
                        return replyDate >= yesterdayStart && replyDate < todayStart;
                    case 'this-week':
                        return replyDate >= weekStart;
                    case 'this-month':
                        return replyDate >= monthStart;
                    default:
                        return true;
                }
            });
        }

        const totalReplies = filteredReplies.length;
        const uniqueLeadsReplied = new Set(filteredReplies.map(r => r.lead_id)).size;

        const replyRate = totalEmailsSent > 0
            ? ((totalReplies / totalEmailsSent) * 100).toFixed(1)
            : '0.0';

        const today = allEmailReplies.filter(r => {
            const replyDate = r.reply_date ? new Date(r.reply_date) : null;
            return replyDate && replyDate >= todayStart;
        }).length;

        const yesterday = allEmailReplies.filter(r => {
            const replyDate = r.reply_date ? new Date(r.reply_date) : null;
            return replyDate && replyDate >= yesterdayStart && replyDate < todayStart;
        }).length;

        const thisWeek = allEmailReplies.filter(r => {
            const replyDate = r.reply_date ? new Date(r.reply_date) : null;
            return replyDate && replyDate >= weekStart;
        }).length;

        const thisMonth = allEmailReplies.filter(r => {
            const replyDate = r.reply_date ? new Date(r.reply_date) : null;
            return replyDate && replyDate >= monthStart;
        }).length;

        return {
            total: totalReplies,
            uniqueLeads: uniqueLeadsReplied,
            replyRate: parseFloat(replyRate),
            breakdown: { today, yesterday, thisWeek, thisMonth },
            allTime: allEmailReplies.length
        };
    }, [allEmailReplies, timeFilter, totalEmailsSent]);

    const countryStats = useMemo(() => {
        const countryMap = new Map<string, number>();

        const capitalizeWords = (str: string): string => {
            return str
                .toLowerCase()
                .split(' ')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
        };

        const filteredLeadIds = new Set(filteredEmailLogs.map(log => log.leadId));

        leads.forEach(lead => {
            if (filteredLeadIds.has(lead.id)) {
                const countryRaw = (lead.country || 'Unknown').trim();
                const countryKey = countryRaw.toLowerCase();
                const countryDisplay = capitalizeWords(countryRaw);
                countryMap.set(countryKey, (countryMap.get(countryKey) || 0) + 1);
            }
        });

        return Array.from(countryMap.entries())
            .map(([countryKey, count]) => ({
                name: capitalizeWords(countryKey),
                count
            }))
            .sort((a, b) => b.count - a.count);
    }, [leads, filteredEmailLogs]);

    if (loading) {
        return (
            <div className="p-4 space-y-4 animate-fade-in max-w-7xl mx-auto">
                <div className="flex items-start justify-between gap-4 mb-1">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                    </div>
                </div>
                <div className="flex items-center justify-center h-48 bg-white rounded-lg border border-slate-200">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-slate-600" size={24} />
                        <span className="text-slate-600 text-sm">Loading…</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-4 animate-fade-in max-w-7xl mx-auto">
            <div className="flex items-start justify-between gap-4 mb-1">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
                </div>
            </div>

            <div className="glass-card rounded-lg p-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-slate-700">Filter:</span>
                    <div className="flex items-center gap-2 flex-wrap">
                        {[
                            { key: 'all', label: 'All Time' },
                            { key: 'today', label: 'Today' },
                            { key: 'yesterday', label: 'Yesterday' },
                            { key: 'this-week', label: 'This Week' },
                            { key: 'this-month', label: 'This Month' }
                        ].map(({ key, label }) => (
                            <button
                                key={key}
                                onClick={() => setTimeFilter(key as typeof timeFilter)}
                                className={`px-3 py-1.5 rounded text-xs font-semibold transition-all shadow-sm ${timeFilter === key
                                    ? 'bg-slate-900 text-white shadow-md ring-1 ring-slate-700'
                                    : 'glass-input text-slate-600 hover:bg-white/80'
                                    }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    title="Total Leads"
                    value={stats.total}
                    icon={<Users size={18} />}
                    color="blue"
                />
                <StatCard
                    title="Vietnam Events"
                    value={stats.vietnam}
                    icon={<Search size={18} />}
                    color="green"
                />
                <StatCard
                    title="New Opportunities"
                    value={stats.new}
                    icon={<Plus size={18} />}
                    color="orange"
                />
                <StatCard
                    title="Qualified"
                    value={stats.qualified}
                    icon={<CheckCircle size={18} />}
                    color="purple"
                />
            </div>

            <div className="glass-card rounded-lg overflow-hidden">
                <div className="bg-blue-600/5 px-4 py-3 border-b border-white/20">
                    <div className="flex items-center gap-2">
                        <Send size={18} className="text-blue-600" />
                        <h3 className="text-base font-bold text-slate-900">Email Sent</h3>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <StatCard
                            title="Total Emails Sent"
                            value={totalEmailsSent}
                            icon={<Send size={18} />}
                            color="blue"
                        />
                        <StatCard
                            title="Leads Contacted"
                            value={sentEmailsCount}
                            icon={<Users size={18} />}
                            subtitle={`${unsentEmailsCount} not contacted`}
                            color="indigo"
                        />
                    </div>
                </div>
            </div>

            <div className="glass-card rounded-lg overflow-hidden">
                <div className="bg-green-600/5 px-4 py-3 border-b border-white/20">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={18} className="text-green-600" />
                        <h3 className="text-base font-bold text-slate-900">Email Replies</h3>
                    </div>
                </div>

                <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <StatCard
                            title="Total Replies"
                            value={emailRepliesStats.total}
                            icon={<MessageSquare size={18} />}
                            color="green"
                        />
                        <StatCard
                            title="Leads Replied"
                            value={emailRepliesStats.uniqueLeads}
                            icon={<CheckCircle size={18} />}
                            color="emerald"
                        />
                        <StatCard
                            title="Reply Rate"
                            value={`${emailRepliesStats.replyRate}%`}
                            icon={<TrendingUp size={18} />}
                            color="teal"
                        />
                    </div>

                    {emailRepliesStats.allTime === 0 && (
                        <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
                            <p className="text-sm text-slate-600">No email replies yet</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-lg overflow-hidden">
                <div className="bg-purple-600/5 px-4 py-3 border-b border-white/20">
                    <div className="flex items-center gap-2">
                        <MapPin size={18} className="text-purple-600" />
                        <h3 className="text-base font-bold text-slate-900">Country Distribution</h3>
                    </div>
                </div>

                <div className="p-4">
                    {stats.total === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                            <p className="text-sm text-slate-600">No leads yet</p>
                        </div>
                    ) : countryStats.length === 0 ? (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                            <p className="text-sm text-slate-600">No country data available</p>
                        </div>
                    ) : (
                        <PipelineBars data={countryStats} />
                    )}
                </div>
            </div>
        </div>
    );
};

