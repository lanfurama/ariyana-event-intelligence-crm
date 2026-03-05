import React, { useState, useEffect, useMemo } from 'react';
import { Loader2, Mail, Send, Users, TrendingUp, MessageSquare, BarChart3, PieChart, X, Calendar, Clock, CheckCircle2 } from 'lucide-react';
import { Lead, EmailLog } from '../types';
import { emailLogsApi, emailRepliesApi } from '../services/apiService';
import { PipelineBars, StatCard, EmailActivityChart, CountryPieChart } from '../components/common/Stats';

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
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

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

    const templateStats = useMemo(() => {
        // Lấy tất cả email log đã gửi trong khoảng thời gian đang filter
        let filteredLogs = allEmailLogs.filter(log => log.status === 'sent' && log.date);

        if (timeFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => {
                const logDate = log.date ? new Date(log.date) : null;
                if (!logDate) return false;
                switch (timeFilter) {
                    case 'today':
                        return logDate >= todayStart;
                    case 'yesterday':
                        return logDate >= yesterdayStart && logDate < todayStart;
                    case 'this-week':
                        return logDate >= weekStart;
                    case 'this-month':
                        return logDate >= monthStart;
                    default:
                        return true;
                }
            });
        }

        const perTemplate = new Map<string, { leadIds: Set<string>; lastSentAt?: Date }>();

        filteredLogs.forEach(log => {
            const subject = (log.subject || '(No subject)').trim() || '(No subject)';
            const entry = perTemplate.get(subject) || { leadIds: new Set<string>(), lastSentAt: undefined };
            if (log.lead_id) {
                entry.leadIds.add(log.lead_id);
            }
            const d = log.date ? new Date(log.date) : null;
            if (d && (!entry.lastSentAt || d > entry.lastSentAt)) {
                entry.lastSentAt = d;
            }
            perTemplate.set(subject, entry);
        });

        return Array.from(perTemplate.entries())
            .map(([subject, { leadIds, lastSentAt }]) => {
                const lastSentLabel = lastSentAt
                    ? lastSentAt.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    : '—';
                return {
                    template: subject,
                    // Số lượng lead unique đã được gửi email với template (subject) này trong khoảng filter
                    sentCount: leadIds.size,
                    lastSentLabel,
                };
            })
            .sort((a, b) => b.sentCount - a.sentCount);
    }, [allEmailLogs, timeFilter, todayStart, yesterdayStart, weekStart, monthStart]);

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

    const emailActivityData = useMemo(() => {
        return allEmailLogs.filter(log => log.status === 'sent');
    }, [allEmailLogs]);

    const templateChartData = useMemo(() => {
        return templateStats.slice(0, 5).map((t) => ({
            name: t.template.length > 40 ? t.template.substring(0, 40) + '...' : t.template,
            count: t.sentCount
        }));
    }, [templateStats]);

    // Template insights for selected template
    const templateInsights = useMemo(() => {
        if (!selectedTemplate) return null;

        // Filter logs matching the selected template subject
        // Match logic should be same as templateStats
        const templateLogs = allEmailLogs.filter(log => {
            if (log.status !== 'sent' || !log.date) return false;
            const logSubject = (log.subject || '(No subject)').trim() || '(No subject)';
            return logSubject === selectedTemplate;
        });

        // Get unique lead IDs that received this template
        const leadIds = new Set<string>();
        templateLogs.forEach(log => {
            if (log.lead_id) {
                leadIds.add(log.lead_id);
            }
        });

        // Get leads that received this template
        const leadsSent = leads.filter(lead => leadIds.has(lead.id));

        // Get replies for these leads (all time, not filtered by template)
        const repliesForTemplate = allEmailReplies.filter(reply => 
            leadIds.has(reply.lead_id)
        );

        // Country distribution - count by number of emails sent per country
        // Each email log counts, not unique leads
        const countryMap = new Map<string, number>();
        
        // Build lead country cache from ALL leads (not just leadsSent)
        const leadCountryMap = new Map<string, string>();
        leads.forEach(lead => {
            leadCountryMap.set(lead.id, (lead.country || 'Unknown').trim());
        });
        
        // Count emails per country
        templateLogs.forEach(log => {
            if (log.lead_id) {
                const country = leadCountryMap.get(log.lead_id) || 'Unknown';
                countryMap.set(country, (countryMap.get(country) || 0) + 1);
            } else {
                // If no lead_id, count as Unknown
                countryMap.set('Unknown', (countryMap.get('Unknown') || 0) + 1);
            }
        });
        
        const countryDistribution = Array.from(countryMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        // Verify: sum should equal totalSent
        const distributionSum = countryDistribution.reduce((sum, item) => sum + item.count, 0);
        if (distributionSum !== templateLogs.length) {
            console.warn('Country distribution sum mismatch:', {
                distributionSum,
                totalSent: templateLogs.length,
                difference: templateLogs.length - distributionSum
            });
        }

        // Reply rate
        const uniqueRepliedLeads = new Set(repliesForTemplate.map(r => r.lead_id)).size;
        const replyRate = leadIds.size > 0 
            ? ((uniqueRepliedLeads / leadIds.size) * 100).toFixed(1)
            : '0.0';

        // Time insights - analyze when emails were sent
        const timeOfDayMap = new Map<string, number>();
        const dayOfWeekMap = new Map<string, number>();
        const hourlyMap = new Map<number, number>();

        templateLogs.forEach(log => {
            if (log.date) {
                const logDate = new Date(log.date);
                const hour = logDate.getHours();
                const dayOfWeek = logDate.toLocaleDateString('en-US', { weekday: 'short' });
                
                // Time of day categories
                let timeCategory = '';
                if (hour >= 6 && hour < 12) timeCategory = 'Morning (6AM-12PM)';
                else if (hour >= 12 && hour < 18) timeCategory = 'Afternoon (12PM-6PM)';
                else if (hour >= 18 && hour < 22) timeCategory = 'Evening (6PM-10PM)';
                else timeCategory = 'Night (10PM-6AM)';

                timeOfDayMap.set(timeCategory, (timeOfDayMap.get(timeCategory) || 0) + 1);
                dayOfWeekMap.set(dayOfWeek, (dayOfWeekMap.get(dayOfWeek) || 0) + 1);
                hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
            }
        });

        const timeOfDayDistribution = Array.from(timeOfDayMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);

        const dayOfWeekDistribution = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            .map(day => ({
                name: day,
                count: dayOfWeekMap.get(day) || 0
            }));

        const hourlyDistribution = Array.from({ length: 24 }, (_, i) => ({
            hour: i,
            count: hourlyMap.get(i) || 0
        }));

        return {
            template: selectedTemplate,
            totalSent: templateLogs.length,
            uniqueLeads: leadIds.size,
            leadsSent,
            replies: repliesForTemplate,
            uniqueRepliedLeads,
            replyRate: parseFloat(replyRate),
            timelineData: [],
            countryDistribution,
            timeOfDayDistribution,
            dayOfWeekDistribution,
            hourlyDistribution,
            firstSent: templateLogs.length > 0 
                ? (() => {
                    const validDates: Date[] = [];
                    templateLogs.forEach(log => {
                        if (log.date) {
                            try {
                                const date = typeof log.date === 'string' ? new Date(log.date) : log.date;
                                if (date instanceof Date && !isNaN(date.getTime())) {
                                    validDates.push(date);
                                }
                            } catch (e) {
                                console.warn('Invalid date in email log:', log.date, e);
                            }
                        }
                    });
                    if (validDates.length === 0) return null;
                    validDates.sort((a, b) => a.getTime() - b.getTime());
                    return validDates[0];
                })()
                : null,
            lastSent: templateLogs.length > 0
                ? (() => {
                    const validDates: Date[] = [];
                    templateLogs.forEach(log => {
                        if (log.date) {
                            try {
                                const date = typeof log.date === 'string' ? new Date(log.date) : log.date;
                                if (date instanceof Date && !isNaN(date.getTime())) {
                                    validDates.push(date);
                                }
                            } catch (e) {
                                console.warn('Invalid date in email log:', log.date, e);
                            }
                        }
                    });
                    if (validDates.length === 0) return null;
                    validDates.sort((a, b) => b.getTime() - a.getTime());
                    return validDates[0];
                })()
                : null
        };
    }, [selectedTemplate, allEmailLogs, allEmailReplies, leads]);

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
        <div className="p-4 space-y-4 animate-fade-in max-w-7xl mx-auto">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Email Marketing Dashboard</h1>
                    <p className="text-sm text-slate-500 mt-1">Campaign performance & analytics</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {filterButtons.map(({ key, label }) => (
                        <button
                            key={key}
                            onClick={() => setTimeFilter(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                timeFilter === key
                                    ? 'bg-indigo-600 text-white shadow-md'
                                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Key Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Total Leads"
                    value={stats.total}
                    icon={<Users size={20} />}
                    color="indigo"
                />
                <StatCard
                    title="Emails Sent"
                    value={totalEmailsSent}
                    icon={<Send size={20} />}
                    subtitle={`${sentEmailsCount} leads contacted`}
                    color="blue"
                />
                <StatCard
                    title="Email Replies"
                    value={emailRepliesStats.total}
                    icon={<MessageSquare size={20} />}
                    subtitle={`${emailRepliesStats.replyRate}% reply rate`}
                    color="green"
                />
                <StatCard
                    title="Unique Replies"
                    value={emailRepliesStats.uniqueLeads}
                    icon={<TrendingUp size={20} />}
                    subtitle={`${leads.length > 0 ? ((emailRepliesStats.uniqueLeads / leads.length) * 100).toFixed(1) : 0}% of leads`}
                    color="purple"
                />
            </div>

            {/* Email Activity Chart */}
            <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                    <div className="flex items-center gap-2">
                        <BarChart3 size={18} className="text-indigo-600" />
                        <h2 className="text-base font-semibold text-slate-900">Email Activity (Last 7 Days)</h2>
                    </div>
                </div>
                <div className="p-4">
                    <EmailActivityChart emailLogs={emailActivityData} />
                </div>
            </div>

            {/* Template Performance - Split Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Template Chart */}
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-2">
                            <PieChart size={18} className="text-indigo-600" />
                            <h2 className="text-base font-semibold text-slate-900">Top Email Templates</h2>
                        </div>
                    </div>
                    <div className="p-4">
                        {templateChartData.length > 0 ? (
                            <div className="space-y-3">
                                {templateChartData.map((item, idx) => {
                                    const fullTemplate = templateStats.find(t => {
                                        const shortName = t.template.length > 40 
                                            ? t.template.substring(0, 40) + '...'
                                            : t.template;
                                        return shortName === item.name;
                                    });
                                    if (!fullTemplate) return null;
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => setSelectedTemplate(fullTemplate.template)}
                                            className="cursor-pointer hover:bg-indigo-50/50 rounded-lg p-2 -m-2 transition-colors"
                                        >
                                            <PipelineBars data={[item]} />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-8 text-center text-sm text-slate-500">No template data</div>
                        )}
                    </div>
                </div>

                {/* Template Table */}
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <div className="flex items-center gap-2">
                            <Mail size={18} className="text-indigo-600" />
                            <h2 className="text-base font-semibold text-slate-900">Template Details</h2>
                        </div>
                    </div>
                    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-slate-50 z-10">
                                <tr className="border-b border-slate-200">
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Template</th>
                                    <th className="text-right py-3 px-4 font-semibold text-slate-700">Leads</th>
                                    <th className="text-left py-3 px-4 font-semibold text-slate-700">Last Sent</th>
                                </tr>
                            </thead>
                            <tbody>
                                {templateStats.map((row, idx) => (
                                    <tr 
                                        key={row.template} 
                                        onClick={() => setSelectedTemplate(row.template)}
                                        className={`border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                                    >
                                        <td className="py-3 px-4">
                                            <div className="font-medium text-slate-900 max-w-xs truncate" title={row.template}>
                                                {row.template}
                                            </div>
                                        </td>
                                        <td className="py-3 px-4 text-right">
                                            <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-1 rounded-md bg-indigo-100 text-indigo-700 font-semibold text-xs tabular-nums">
                                                {row.sentCount}
                                            </span>
                                        </td>
                                        <td className="py-3 px-4 text-slate-600 text-xs">{row.lastSentLabel}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {templateStats.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-slate-500">No templates</div>
                    )}
                </div>
            </div>

            {/* Country Distribution by Type */}
            {leadByTypeStats.length > 0 && (
                <div className="border border-slate-200 rounded-xl bg-white shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white">
                        <h2 className="text-base font-semibold text-slate-900">Geographic Distribution by Lead Type</h2>
                    </div>
                    <div className="p-4 space-y-4">
                        {leadByTypeStats.map((row) => {
                            const countries = (countryByType.get(row.type) || []).slice(0, 6);
                            if (countries.length === 0) return null;
                            return (
                                <div key={row.type} className="border-l-4 border-indigo-500 pl-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-semibold text-slate-900">{row.type}</p>
                                        <span className="text-xs text-slate-500">
                                            {row.sentCount} sent • Last: {row.lastSentLabel}
                                        </span>
                                    </div>
                                    <PipelineBars data={countries} compact />
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Email Replies Summary */}
            <div className="border border-slate-200 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-green-200">
                    <div className="flex items-center gap-2">
                        <MessageSquare size={18} className="text-green-600" />
                        <h2 className="text-base font-semibold text-slate-900">Email Replies Performance</h2>
                    </div>
                </div>
                <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Total Replies</div>
                            <div className="text-3xl font-bold text-green-600 tabular-nums">{emailRepliesStats.total}</div>
                            <div className="text-xs text-slate-500 mt-1">All time: {emailRepliesStats.allTime}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Unique Leads Replied</div>
                            <div className="text-3xl font-bold text-green-600 tabular-nums">{emailRepliesStats.uniqueLeads}</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {leads.length > 0 ? ((emailRepliesStats.uniqueLeads / leads.length) * 100).toFixed(1) : 0}% of total leads
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-green-200">
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Reply Rate</div>
                            <div className="text-3xl font-bold text-green-600 tabular-nums">{emailRepliesStats.replyRate}%</div>
                            <div className="text-xs text-slate-500 mt-1">
                                {totalEmailsSent > 0 ? `${emailRepliesStats.total} / ${totalEmailsSent} emails` : 'No emails sent'}
                            </div>
                        </div>
                    </div>
                    {emailRepliesStats.allTime === 0 && (
                        <div className="mt-4 text-center text-sm text-slate-500 bg-white rounded-lg p-4 border border-green-200">
                            No email replies yet. Keep engaging with your leads!
                        </div>
                    )}
                </div>
            </div>

            {/* Template Insights Modal */}
            {selectedTemplate && templateInsights && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
                        {/* Modal Header */}
                        <div className="px-4 py-3 border-b border-slate-200 flex justify-between items-start bg-gradient-to-r from-indigo-50 to-white">
                            <div className="flex-1 min-w-0 pr-4">
                                <h2 className="text-lg font-bold text-slate-900 mb-1">Template Insights</h2>
                                <p className="text-sm font-semibold text-slate-900 break-words">{selectedTemplate}</p>
                            </div>
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="text-slate-400 hover:text-slate-600 p-2 rounded-lg hover:bg-white transition-colors flex-shrink-0"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-y-auto px-6 py-4">
                            <p className="text-sm text-slate-600 mb-4">
                                A summary of the performance for the selected email template is shown below:
                            </p>
                            
                            {/* Main Content: Statistics Snapshot + Chart */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Statistics Snapshot Table */}
                                <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                                    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                        <h3 className="text-sm font-semibold text-slate-900">Statistics Snapshot</h3>
                                    </div>
                                    <div className="p-4">
                                        <table className="w-full text-sm">
                                            <tbody className="space-y-2">
                                                <tr className="border-b border-slate-100">
                                                    <td className="py-2.5 pr-4 font-medium text-slate-700 align-top w-1/3">Email Subject:</td>
                                                    <td className="py-2.5 text-slate-900 break-words">{templateInsights.template}</td>
                                                </tr>
                                                <tr className="border-b border-slate-100">
                                                    <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Total Sent:</td>
                                                    <td className="py-2.5 text-slate-900 font-semibold tabular-nums">{templateInsights.totalSent} emails</td>
                                                </tr>
                                                {templateInsights.firstSent && (
                                                    <tr className="border-b border-slate-100">
                                                        <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Start Sending:</td>
                                                        <td className="py-2.5 text-slate-900">
                                                            {templateInsights.firstSent.toLocaleDateString('en-US', { 
                                                                month: 'long', 
                                                                day: 'numeric', 
                                                                year: 'numeric' 
                                                            })}, {templateInsights.firstSent.toLocaleTimeString('en-US', { 
                                                                hour: 'numeric', 
                                                                minute: '2-digit',
                                                                hour12: true 
                                                            })}
                                                        </td>
                                                    </tr>
                                                )}
                                                {templateInsights.lastSent && (
                                                    <tr className="border-b border-slate-100">
                                                        <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Finished Sending:</td>
                                                        <td className="py-2.5 text-slate-900">
                                                            {templateInsights.lastSent.toLocaleDateString('en-US', { 
                                                                month: 'long', 
                                                                day: 'numeric', 
                                                                year: 'numeric' 
                                                            })}, {templateInsights.lastSent.toLocaleTimeString('en-US', { 
                                                                hour: 'numeric', 
                                                                minute: '2-digit',
                                                                hour12: true 
                                                            })}
                                                        </td>
                                                    </tr>
                                                )}
                                                {templateInsights.firstSent && templateInsights.lastSent && (
                                                    <tr className="border-b border-slate-100">
                                                        <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Sending Time:</td>
                                                        <td className="py-2.5 text-slate-900">
                                                            {(() => {
                                                                const firstTime = templateInsights.firstSent.getTime();
                                                                const lastTime = templateInsights.lastSent.getTime();
                                                                const diff = Math.abs(lastTime - firstTime);
                                                                
                                                                const totalSeconds = Math.floor(diff / 1000);
                                                                const minutes = Math.floor(totalSeconds / 60);
                                                                const seconds = totalSeconds % 60;
                                                                
                                                                if (minutes > 0) {
                                                                    return `${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? `, ${seconds} second${seconds !== 1 ? 's' : ''}` : ''}`;
                                                                }
                                                                return `${seconds} second${seconds !== 1 ? 's' : ''}`;
                                                            })()}
                                                        </td>
                                                    </tr>
                                                )}
                                                <tr className="border-b border-slate-100">
                                                    <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Sent To:</td>
                                                    <td className="py-2.5 text-slate-900 tabular-nums">
                                                        {templateInsights.uniqueLeads} of {templateInsights.uniqueLeads}
                                                    </td>
                                                </tr>
                                                {templateInsights.replies.length > 0 && (
                                                    <tr className="border-b border-slate-100">
                                                        <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Replied:</td>
                                                        <td className="py-2.5 text-slate-900 tabular-nums">
                                                            {templateInsights.replies.length} / {templateInsights.uniqueRepliedLeads} Unique Replies
                                                        </td>
                                                    </tr>
                                                )}
                                                {templateInsights.replyRate > 0 && (
                                                    <tr className="border-b border-slate-100">
                                                        <td className="py-2.5 pr-4 font-medium text-slate-700 align-top">Reply Rate:</td>
                                                        <td className="py-2.5 text-slate-900 font-semibold tabular-nums">
                                                            {templateInsights.replyRate.toFixed(2)}%
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Right: Email Campaign Summary Chart */}
                                {templateInsights.countryDistribution.length > 0 && (
                                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                                        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                            <h3 className="text-sm font-semibold text-slate-900">Geographic Distribution Chart</h3>
                                        </div>
                                        <div className="p-6">
                                            <CountryPieChart data={templateInsights.countryDistribution} />
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

