import React, { useState, useEffect, useMemo } from 'react';
import { Loader2 } from 'lucide-react';
import { Lead, EmailLog } from '../types';
import { emailLogsApi, emailRepliesApi } from '../services/apiService';
import { PipelineBars } from '../components/common/Stats';

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

    const normalizeType = (t: string | undefined) => (t != null && String(t).trim() !== '' ? String(t).trim() : 'Regular');

    const leadIdsByType = useMemo(() => {
        const map = new Map<string, Set<string>>();
        leads.forEach(lead => {
            const type = normalizeType(lead.type);
            if (!map.has(type)) map.set(type, new Set());
            map.get(type)!.add(lead.id);
        });
        return map;
    }, [leads]);

    const sentLogsByLead = useMemo(() => {
        const map = new Map<string, { count: number; lastSent?: Date; dates: Date[] }>();
        allEmailLogs.forEach(log => {
            if (log.status === 'sent' && log.lead_id) {
                const existing = map.get(log.lead_id) || { count: 0, dates: [] };
                existing.count += 1;
                const d = log.date ? new Date(log.date) : null;
                if (d) {
                    existing.dates.push(d);
                    if (!existing.lastSent || d > existing.lastSent) existing.lastSent = d;
                }
                map.set(log.lead_id, existing);
            }
        });
        return map;
    }, [allEmailLogs]);

    const now = useMemo(() => new Date(), []);
    const todayStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()), [now]);
    const yesterdayStart = useMemo(() => { const d = new Date(todayStart); d.setDate(d.getDate() - 1); return d; }, [todayStart]);
    const weekStart = useMemo(() => { const d = new Date(todayStart); d.setDate(d.getDate() - 7); return d; }, [todayStart]);
    const monthStart = useMemo(() => new Date(now.getFullYear(), now.getMonth(), 1), [now]);

    const leadByTypeStats = useMemo(() => {
        const filteredLeadIds = new Set(filteredEmailLogs.map(log => log.leadId));
        const types = Array.from(leadIdsByType.keys()).sort();

        return types.map(type => {
            const leadIds = leadIdsByType.get(type)!;
            const totalLeads = leadIds.size;
            const sentInPeriod = leadIds.size > 0 ? [...leadIds].filter(id => filteredLeadIds.has(id)).length : 0;
            let lastSentAt: Date | undefined;
            leadIds.forEach(leadId => {
                const data = sentLogsByLead.get(leadId);
                if (data?.lastSent && (!lastSentAt || data.lastSent > lastSentAt)) lastSentAt = data.lastSent;
            });
            const lastSentLabel = lastSentAt ? lastSentAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

            return {
                type,
                totalLeads,
                leadIds,
                sentCount: sentInPeriod,
                lastSentAt,
                lastSentLabel,
            };
        });
    }, [leadIdsByType, filteredEmailLogs, sentLogsByLead]);

    const countryByType = useMemo(() => {
        const capitalize = (s: string) => s.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const map = new Map<string, { name: string; count: number }[]>();
        leadIdsByType.forEach((leadIds, type) => {
            const countryMap = new Map<string, number>();
            leads.forEach(lead => {
                if (leadIds.has(lead.id)) {
                    const raw = (lead.country || 'Unknown').trim();
                    const key = raw.toLowerCase();
                    countryMap.set(key, (countryMap.get(key) || 0) + 1);
                }
            });
            const arr = Array.from(countryMap.entries())
                .map(([k, count]) => ({ name: capitalize(k), count }))
                .sort((a, b) => b.count - a.count);
            map.set(type, arr);
        });
        return map;
    }, [leads, leadIdsByType]);

    const countryStats = useMemo(() => {
        const filteredLeadIds = new Set(filteredEmailLogs.map(log => log.leadId));
        const capitalizeWords = (str: string): string => {
            return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        };
        const countryMap = new Map<string, number>();
        leads.forEach(lead => {
            if (filteredLeadIds.has(lead.id)) {
                const countryRaw = (lead.country || 'Unknown').trim();
                const countryKey = countryRaw.toLowerCase();
                countryMap.set(countryKey, (countryMap.get(countryKey) || 0) + 1);
            }
        });
        return Array.from(countryMap.entries())
            .map(([countryKey, count]) => ({ name: capitalizeWords(countryKey), count }))
            .sort((a, b) => b.count - a.count);
    }, [leads, filteredEmailLogs]);

    if (loading) {
        return (
            <div className="p-3 space-y-3 animate-fade-in max-w-7xl mx-auto">
                <div className="flex items-center justify-center h-48 rounded-lg border border-slate-200 bg-white">
                    <div className="flex flex-col items-center gap-2">
                        <Loader2 className="animate-spin text-slate-600" size={24} />
                        <span className="text-slate-600 text-sm">Loading…</span>
                    </div>
                </div>
            </div>
        );
    }

    const filterButtons = [
        { key: 'all', label: 'All Time' },
        { key: 'today', label: 'Today' },
        { key: 'yesterday', label: 'Yesterday' },
        { key: 'this-week', label: 'This Week' },
        { key: 'this-month', label: 'This Month' },
    ] as const;

    return (
        <div className="p-3 space-y-3 animate-fade-in max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h1 className="text-xl font-semibold text-slate-900">Dashboard</h1>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {filterButtons.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTimeFilter(key)}
                            className={`px-2.5 py-1 rounded text-xs font-medium ${timeFilter === key
                                ? 'bg-slate-800 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600 border border-slate-200 rounded-lg bg-slate-50/50 px-3 py-2">
                <span><strong className="text-slate-900">{stats.total}</strong> leads</span>
                <span><strong className="text-slate-900">{totalEmailsSent}</strong> emails sent</span>
            </div>

            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-900">By lead type</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-200 bg-slate-50/80">
                                <th className="text-left py-2 px-3 font-medium text-slate-700">Type</th>
                                <th className="text-right py-2 px-3 font-medium text-slate-700">Total leads</th>
                                <th className="text-right py-2 px-3 font-medium text-slate-700">Leads sent mail</th>
                                <th className="text-left py-2 px-3 font-medium text-slate-700">Last sent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {leadByTypeStats.map((row) => (
                                <tr key={row.type} className="border-b border-slate-100 hover:bg-slate-50/50">
                                    <td className="py-2 px-3 font-medium text-slate-900">{row.type}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">{row.totalLeads}</td>
                                    <td className="py-2 px-3 text-right tabular-nums text-slate-700">{row.sentCount}</td>
                                    <td className="py-2 px-3 text-slate-600">{row.lastSentLabel}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {leadByTypeStats.length === 0 && (
                    <div className="px-3 py-6 text-center text-sm text-slate-500">No leads</div>
                )}
            </div>

            {leadByTypeStats.length > 0 && (
                <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <div className="px-3 py-2 border-b border-slate-200">
                        <h2 className="text-sm font-semibold text-slate-900">Country by type</h2>
                    </div>
                    <div className="p-3 space-y-3">
                        {leadByTypeStats.map((row) => {
                            const countries = (countryByType.get(row.type) || []).slice(0, 6);
                            if (countries.length === 0) return null;
                            return (
                                <div key={row.type}>
                                    <p className="text-xs font-medium text-slate-500 mb-1.5">{row.type}</p>
                                    <PipelineBars data={countries} compact />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                <div className="px-3 py-2 border-b border-slate-200">
                    <h2 className="text-sm font-semibold text-slate-900">Email replies</h2>
                </div>
                <div className="px-3 py-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <span><strong className="text-slate-900">{emailRepliesStats.total}</strong> replies</span>
                    <span><strong className="text-slate-900">{emailRepliesStats.uniqueLeads}</strong> leads replied</span>
                    <span><strong className="text-slate-900">{emailRepliesStats.replyRate}%</strong> rate</span>
                </div>
                {emailRepliesStats.allTime === 0 && (
                    <div className="px-3 pb-3 text-sm text-slate-500">No email replies yet</div>
                )}
            </div>
        </div>
    );
};

