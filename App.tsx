import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Search, 
  Mail, 
  Plus, 
  ChevronRight, 
  Loader2, 
  Film,
  Upload,
  Send,
  Bot,
  Save,
  Edit2,
  X,
  Check,
  ExternalLink,
  BrainCircuit,
  FileText,
  Download,
  FileSpreadsheet,
  LogOut,
  Lock,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  Star,
  User as UserIcon,
  Calendar,
  MapPin,
  Sparkles,
  CheckCircle,
  TrendingUp,
  Menu
} from 'lucide-react';
import { INITIAL_LEADS, EMAIL_TEMPLATES, USERS } from './constants';
import { Lead, ChatMessage, User, EmailTemplate } from './types';
import * as GeminiService from './services/geminiService';
import * as GPTService from './services/gptService';
import { extractRetryDelay as extractGeminiRetryDelay, isRateLimitError as isGeminiRateLimitError } from './services/geminiService';
import { extractRetryDelay, isRateLimitError } from './services/gptService';
import { chatMessagesApi, type ChatMessageDB } from './services/apiService';
import { usersApi, leadsApi, emailTemplatesApi, emailLogsApi, emailRepliesApi } from './services/apiService';

// Import components
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { StatusBadge, InfoItem, EditField, EditTextArea } from './components/common';
import { mapLeadFromDB, mapLeadToDB } from './utils/leadUtils';
import { formatMarkdown, formatInlineMarkdown } from './utils/markdownUtils';

// --- Components ---
// LoginView is now imported from components/LoginView
// Sidebar and NavItem are now imported from components/Sidebar and components/common/NavItem

// mapLeadFromDB and mapLeadToDB are now imported from utils/leadUtils

// 2. Dashboard View
const Dashboard = ({ leads, loading }: { leads: Lead[], loading?: boolean }) => {
  const [emailLogs, setEmailLogs] = useState<Array<{leadId: string, count: number, lastSent?: Date}>>([]);
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLog[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [allEmailReplies, setAllEmailReplies] = useState<any[]>([]);
  const [loadingEmailReplies, setLoadingEmailReplies] = useState(false);
  const [timeFilter, setTimeFilter] = useState<'all' | 'today' | 'yesterday' | 'this-week' | 'this-month'>('all');

  // Load email logs and replies on mount
  useEffect(() => {
    loadEmailLogs();
    loadEmailReplies();
  }, []);

  const loadEmailLogs = async () => {
    setLoadingEmailLogs(true);
    try {
      const allLogs = await emailLogsApi.getAll();
      setAllEmailLogs(allLogs);
      
      // Group by lead_id and count sent emails
      const logsByLead = new Map<string, {count: number, lastSent?: Date}>();
      
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

  // Filter email logs by time period
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

    // Group filtered logs by lead_id
    const logsByLead = new Map<string, {count: number, lastSent?: Date}>();
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

  // Calculate email statistics
  const leadsWithEmails = new Set(filteredEmailLogs.map(log => log.leadId));
  const sentEmailsCount = leadsWithEmails.size;
  const unsentEmailsCount = leads.length - sentEmailsCount;
  const totalEmailsSent = filteredEmailLogs.reduce((sum, log) => sum + log.count, 0);

  // Calculate email replies statistics by time period
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
    
    // Calculate reply rate (replies / emails sent)
    const replyRate = totalEmailsSent > 0 
      ? ((totalReplies / totalEmailsSent) * 100).toFixed(1)
      : '0.0';

    // Calculate replies by time period for breakdown
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

  // Calculate country statistics - filtered by time period
  const countryStats = useMemo(() => {
    const countryMap = new Map<string, number>();
    
    // Helper function to capitalize first letter of each word
    const capitalizeWords = (str: string): string => {
      return str
        .toLowerCase()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    };
    
    // Get lead IDs that have emails sent in the filtered time period
    const filteredLeadIds = new Set(filteredEmailLogs.map(log => log.leadId));
    
    // Only count leads that have emails sent in the filtered period
    leads.forEach(lead => {
      if (filteredLeadIds.has(lead.id)) {
        // Normalize country name: trim, lowercase for grouping, then capitalize for display
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
      // Show all countries, not just top 10
  }, [leads, filteredEmailLogs]);

  const chartData = [
    { name: 'New', count: stats.new },
    { name: 'Contacted', count: leads.filter(l => l.status === 'Contacted').length },
    { name: 'Qualified', count: stats.qualified },
    { name: 'Won', count: leads.filter(l => l.status === 'Won').length },
  ];

  const emailChartData = [
    { name: 'Sent', count: sentEmailsCount },
    { name: 'Not Sent', count: unsentEmailsCount },
  ];

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
            <span className="text-slate-600 text-sm">Đang tải…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 animate-fade-in max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        </div>
      </div>

      {/* Time Filter */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-slate-700">Lọc:</span>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { key: 'all', label: 'Tất cả' },
              { key: 'today', label: 'Hôm nay' },
              { key: 'yesterday', label: 'Hôm qua' },
              { key: 'this-week', label: 'Tuần này' },
              { key: 'this-month', label: 'Tháng này' }
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTimeFilter(key as typeof timeFilter)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  timeFilter === key
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard 
          title="Tổng số leads" 
          value={stats.total} 
          icon={<Users size={18} />}
          color="blue"
        />
        <StatCard 
          title="Sự kiện Việt Nam" 
          value={stats.vietnam} 
          icon={<Search size={18} />}
          color="green"
        />
        <StatCard 
          title="Cơ hội mới" 
          value={stats.new} 
          icon={<Plus size={18} />}
          color="orange"
        />
        <StatCard 
          title="Đã đủ điều kiện" 
          value={stats.qualified} 
          icon={<CheckCircle size={18} />}
          color="purple"
        />
      </div>

      {/* Email Sent Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Send size={18} className="text-blue-600" />
            <h3 className="text-base font-semibold text-slate-900">Email đã gửi</h3>
          </div>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard 
              title="Tổng email đã gửi" 
              value={totalEmailsSent} 
              icon={<Send size={18} />}
              color="blue"
            />
            <StatCard 
              title="Leads đã liên hệ" 
              value={sentEmailsCount} 
              icon={<Users size={18} />}
              subtitle={`${unsentEmailsCount} chưa liên hệ`}
              color="indigo"
            />
          </div>
        </div>
      </div>

      {/* Email Replies Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-green-50 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-green-600" />
            <h3 className="text-base font-semibold text-slate-900">Phản hồi Email</h3>
          </div>
        </div>
        
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <StatCard 
              title="Tổng phản hồi" 
              value={emailRepliesStats.total} 
              icon={<MessageSquare size={18} />}
              color="green"
            />
            <StatCard 
              title="Leads đã phản hồi" 
              value={emailRepliesStats.uniqueLeads} 
              icon={<CheckCircle size={18} />}
              color="emerald"
            />
            <StatCard 
              title="Tỷ lệ phản hồi" 
              value={`${emailRepliesStats.replyRate}%`} 
              icon={<TrendingUp size={18} />}
              color="teal"
            />
          </div>

          {emailRepliesStats.allTime === 0 && (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600">Chưa có phản hồi email</p>
            </div>
          )}
        </div>
      </div>

      {/* Country Distribution Section */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="bg-purple-50 px-4 py-3 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-purple-600" />
            <h3 className="text-base font-semibold text-slate-900">Phân bố theo Quốc gia</h3>
          </div>
        </div>
        
        <div className="p-4">
          {stats.total === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600">Chưa có leads</p>
            </div>
          ) : countryStats.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
              <p className="text-sm text-slate-600">Không có dữ liệu quốc gia</p>
            </div>
          ) : (
            <PipelineBars data={countryStats} />
          )}
        </div>
      </div>
    </div>
  );
};

const EmailActivityChart = ({ emailLogs }: { emailLogs: EmailLog[] }) => {
  const dailyActivity = useMemo(() => {
    const now = new Date();
    const days = [];
    const activityMap = new Map<string, number>();

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateKey = date.toISOString().split('T')[0];
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const dayNumber = date.getDate();
      days.push({ dateKey, label: `${dayName} ${dayNumber}`, count: 0 });
      activityMap.set(dateKey, 0);
    }

    // Count emails per day
    emailLogs.forEach(log => {
      if (log.status === 'sent' && log.date) {
        const logDate = new Date(log.date);
        const dateKey = logDate.toISOString().split('T')[0];
        const existing = activityMap.get(dateKey) || 0;
        activityMap.set(dateKey, existing + 1);
      }
    });

    // Update days with counts
    return days.map(day => ({
      ...day,
      count: activityMap.get(day.dateKey) || 0
    }));
  }, [emailLogs]);

  const max = Math.max(...dailyActivity.map(d => d.count)) || 1;

  return (
    <div className="space-y-3">
      {dailyActivity.map((d) => {
        const pct = max > 0 ? Math.round((d.count / max) * 100) : 0;
        return (
          <div key={d.dateKey} className="grid grid-cols-[80px_1fr_44px] items-center gap-3">
            <div className="text-xs font-medium text-slate-700">{d.label}</div>
            <div className="h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              <div
                className="h-full bg-slate-900 rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-xs font-semibold text-slate-900 text-right tabular-nums">{d.count}</div>
          </div>
        );
      })}
    </div>
  );
};

const PipelineBars = ({ data }: { data: { name: string, count: number }[] }) => {
  const max = Math.max(...data.map(d => d.count)) || 1;

  const colors = [
    { bg: 'bg-purple-500', dot: 'bg-purple-500' },
    { bg: 'bg-pink-500', dot: 'bg-pink-500' },
    { bg: 'bg-indigo-500', dot: 'bg-indigo-500' },
    { bg: 'bg-blue-500', dot: 'bg-blue-500' },
    { bg: 'bg-cyan-500', dot: 'bg-cyan-500' },
    { bg: 'bg-teal-500', dot: 'bg-teal-500' },
    { bg: 'bg-emerald-500', dot: 'bg-emerald-500' },
  ];

  return (
    <div className="space-y-3">
      {data.map((d, index) => {
        const pct = Math.round((d.count / max) * 100);
        const color = colors[index % colors.length];
        
        return (
          <div key={d.name}>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${color.dot}`}></div>
                <div className="text-sm font-medium text-slate-700">{d.name}</div>
              </div>
              <div className="text-sm font-semibold text-slate-900 tabular-nums">{d.count}</div>
            </div>
            <div className="h-3 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
              <div
                className={`h-full ${color.bg} rounded-full transition-all duration-500 ease-out`}
                style={{ width: `${pct}%` }}
                aria-label={`${d.name} ${d.count}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const StatCard = ({
  title,
  value,
  icon,
  subtitle,
  color = 'slate',
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'indigo' | 'cyan' | 'teal' | 'emerald' | 'slate';
}) => {
  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-600',
    green: 'bg-green-50 border-green-200 text-green-600',
    orange: 'bg-orange-50 border-orange-200 text-orange-600',
    purple: 'bg-purple-50 border-purple-200 text-purple-600',
    indigo: 'bg-indigo-50 border-indigo-200 text-indigo-600',
    cyan: 'bg-cyan-50 border-cyan-200 text-cyan-600',
    teal: 'bg-teal-50 border-teal-200 text-teal-600',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-600',
    slate: 'bg-slate-100 border-slate-200 text-slate-700',
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-slate-200">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-1">{title}</p>
          <p className="text-2xl font-bold text-slate-900 tracking-tight tabular-nums">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className={`h-10 w-10 rounded-lg ${colorClasses[color]} flex items-center justify-center flex-shrink-0`}>
          {icon}
        </div>
      </div>
    </div>
  );
};

// 3. Leads View
const LeadsView = ({ leads, onSelectLead, onUpdateLead, user, onAddLead }: { leads: Lead[], onSelectLead: (lead: Lead) => void, onUpdateLead: (lead: Lead) => void, user: User, onAddLead?: () => void }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [emailFilter, setEmailFilter] = useState<'all' | 'sent' | 'unsent' | 'no-key-person-email' | 'has-key-person-email' | 'replied'>('all');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [emailLogs, setEmailLogs] = useState<Array<{leadId: string, count: number, lastSent?: Date}>>([]);
  const [allEmailLogs, setAllEmailLogs] = useState<EmailLog[]>([]);
  const [loadingEmailLogs, setLoadingEmailLogs] = useState(false);
  const [sendingEmails, setSendingEmails] = useState(false);
  const [emailReplies, setEmailReplies] = useState<Array<{leadId: string}>>([]);
  const [markingReplies, setMarkingReplies] = useState<Set<string>>(new Set());

  // Helper to get email status for a lead
  const getEmailStatus = (leadId: string) => {
    const log = emailLogs.find(l => l.leadId === leadId);
    return log ? { hasEmail: true, count: log.count, lastSent: log.lastSent } : { hasEmail: false, count: 0 };
  };

  // Check if lead has replied
  const hasReplied = (leadId: string) => {
    return emailReplies.some(r => r.leadId === leadId);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      // Search filter
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (lead.companyName || '').toLowerCase().includes(searchLower) ||
        (lead.city || '').toLowerCase().includes(searchLower) ||
        (lead.keyPersonName || '').toLowerCase().includes(searchLower) ||
        (lead.industry || '').toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;

      // Email filter
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
        // Must have sent email AND have reply
        return emailStatus.hasEmail && hasReplied(lead.id);
      }
      
      return true;
    });
  }, [leads, searchTerm, emailFilter, emailLogs, emailReplies]);

  // Load email logs on mount
  useEffect(() => {
    loadEmailLogs();
    loadEmailReplies();
  }, [leads]);

  // Load email replies
  const loadEmailReplies = async () => {
    if (leads.length === 0) return;
    
    try {
      const allReplies = await emailRepliesApi.getAll();
      // Store lead IDs that have replies
      const leadIdsWithReplies = new Set(allReplies.map(reply => reply.lead_id));
      setEmailReplies(Array.from(leadIdsWithReplies).map(leadId => ({ leadId })));
    } catch (error) {
      console.error('Error loading email replies:', error);
    }
  };

  // Handle marking reply
  const handleMarkReply = async (leadId: string) => {
    if (hasReplied(leadId)) {
      // Already replied, do nothing or show message
      return;
    }

    setMarkingReplies(prev => new Set(prev).add(leadId));
    try {
      await emailRepliesApi.create(leadId);
      // Reload replies to update UI
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

  // Load email templates when modal opens
  useEffect(() => {
    if (showEmailModal) {
      loadEmailTemplates();
    }
  }, [showEmailModal]);

  const loadEmailLogs = async () => {
    if (leads.length === 0) return;
    
    setLoadingEmailLogs(true);
    try {
      // Load all email logs
      const allLogs = await emailLogsApi.getAll();
      
      // Store all logs for time-based statistics
      setAllEmailLogs(allLogs);
      
      // Group by lead_id and count sent emails
      const logsByLead = new Map<string, {count: number, lastSent?: Date}>();
      
      allLogs.forEach(log => {
        if (log.status === 'sent' && log.lead_id) {
          const existing = logsByLead.get(log.lead_id) || { count: 0 };
          existing.count += 1;
          
          // Track most recent sent date
          const logDate = log.date ? new Date(log.date) : null;
          if (logDate && (!existing.lastSent || logDate > existing.lastSent)) {
            existing.lastSent = logDate;
          }
          
          logsByLead.set(log.lead_id, existing);
        }
      });
      
      // Convert to array format
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

  // Prepare emails using useMemo to avoid infinite loops
  const preparedEmails = useMemo(() => {
    if (!selectedTemplateId || filteredLeads.length === 0 || emailTemplates.length === 0) {
      return [];
    }

    const template = emailTemplates.find(t => t.id === selectedTemplateId);
    if (!template) return [];

    return filteredLeads
      .filter(lead => {
        // Only leads with email
        if (!lead.keyPersonEmail) return false;
        // Skip leads that already have sent emails
        const emailStatus = getEmailStatus(lead.id);
        return !emailStatus.hasEmail;
      })
      .map(lead => {
        // Replace template variables with lead data
        let subject = template.subject;
        let body = template.body;

        // Replace common placeholders
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

  // Calculate email stats
  const emailStats = useMemo(() => {
    const sentCount = filteredLeads.filter(lead => {
      const status = getEmailStatus(lead.id);
      return status.hasEmail;
    }).length;
    const notSentCount = filteredLeads.length - sentCount;
    return { sent: sentCount, notSent: notSentCount };
  }, [filteredLeads, emailLogs]);

  // Calculate key person info stats
  const keyPersonStats = useMemo(() => {
    const withKeyPersonInfo = filteredLeads.filter(lead => {
      // Check if lead has at least one of: email, phone, or linkedin
      return !!(lead.keyPersonEmail || lead.keyPersonPhone || lead.keyPersonLinkedIn);
    }).length;
    return { withInfo: withKeyPersonInfo, withoutInfo: filteredLeads.length - withKeyPersonInfo };
  }, [filteredLeads]);

  // Calculate email stats by time period
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

        // Update leads if any were updated
        if (result.updatedLeads && result.updatedLeads.length > 0) {
          result.updatedLeads.forEach(updatedLead => {
            onUpdateLead(updatedLead);
          });
        }

        // Reload email logs to show new sent emails
        await loadEmailLogs();

        // Close modal and reset
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

  return (
    <div className="p-6 min-h-screen flex flex-col space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">Leads</h2>
          <p className="text-sm text-slate-600 mt-1">Manage and track your event leads</p>
        </div>
        
        {/* Only Director and Sales can add manual leads */}
        {(user.role === 'Director' || user.role === 'Sales') && (
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowEmailModal(true)}
              className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shrink-0 inline-flex items-center"
            >
              <Mail size={18} className="mr-2" /> Send Mail to All
            </button>
            <button 
              onClick={onAddLead}
              className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shrink-0 inline-flex items-center"
            >
              <Plus size={18} className="mr-2" /> Add Lead
            </button>
          </div>
        )}
      </div>

      {/* Search and Filters */}
      <div className="bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-3">
          <div className="relative flex-1 w-full md:w-auto">
            <input 
              type="text"
              placeholder="Search by company, city, person, or industry..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300 hover:border-slate-300"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={18} />
          </div>
          {/* Email Filter */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setEmailFilter('all')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'all'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setEmailFilter('sent')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'sent'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Sent
            </button>
            <button
              onClick={() => setEmailFilter('unsent')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'unsent'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Not Sent
            </button>
            <button
              onClick={() => setEmailFilter('no-key-person-email')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'no-key-person-email'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              No Key Person Email
            </button>
            <button
              onClick={() => setEmailFilter('has-key-person-email')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'has-key-person-email'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Has Key Person Email
            </button>
            <button
              onClick={() => setEmailFilter('replied')}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                emailFilter === 'replied'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Replied
            </button>
          </div>
          <div className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{filteredLeads.length}</span> of <span className="font-semibold text-slate-900">{leads.length}</span> leads
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full">
            <thead className="bg-white border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Key Person</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-900">{lead.companyName}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{lead.city}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{lead.country}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="text-sm text-slate-900">{lead.keyPersonName}</div>
                      {lead.keyPersonTitle && (
                        <div className="text-xs text-slate-500 mt-0.5">{lead.keyPersonTitle}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {(() => {
                        const emailStatus = getEmailStatus(lead.id);
                        if (emailStatus.hasEmail) {
                          return (
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-green-700 bg-green-100">
                                Sent
                              </span>
                              <span className="text-xs text-slate-500">
                                {emailStatus.count}x
                              </span>
                            </div>
                          );
                        } else {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-slate-500 bg-slate-50">
                              Not sent
                            </span>
                          );
                        }
                      })()}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const emailStatus = getEmailStatus(lead.id);
                          const replied = hasReplied(lead.id);
                          const isMarking = markingReplies.has(lead.id);
                          
                          // Only show reply button if email was sent
                          if (emailStatus.hasEmail) {
                            return (
                              <button
                                onClick={() => handleMarkReply(lead.id)}
                                disabled={replied || isMarking}
                                className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                  replied
                                    ? 'bg-green-100 text-green-700 cursor-default'
                                    : isMarking
                                    ? 'bg-slate-100 text-slate-500 cursor-wait'
                                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                                }`}
                                title={replied ? 'Already marked as replied' : 'Mark as replied'}
                              >
                                {isMarking ? (
                                  <>
                                    <Loader2 size={12} className="mr-1 animate-spin" />
                                    Marking...
                                  </>
                                ) : replied ? (
                                  <>
                                    <CheckCircle size={12} className="mr-1" />
                                    Replied
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle size={12} className="mr-1" />
                                    Mark Reply
                                  </>
                                )}
                              </button>
                            );
                          }
                          return null;
                        })()}
                        <button 
                          onClick={() => onSelectLead(lead)}
                          className="text-sm text-slate-600 hover:text-slate-900 font-medium inline-flex items-center"
                        >
                          View
                          <ChevronRight size={14} className="ml-1" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center">
                      <Search className="text-slate-300 mb-2" size={32} />
                      <p className="text-sm text-slate-600 font-medium">No leads found</p>
                      <p className="text-xs text-slate-500 mt-1">Try adjusting your search terms</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Email Template Selection Modal */}
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
                  {/* Template Selection */}
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

                  {/* Template Preview */}
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

                  {/* Prepared Emails List */}
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

// StatusBadge is now imported from components/common/StatusBadge

// 4. Lead Detail Modal (Enrichment + Email + Edit)
const LeadDetail = ({ lead, onClose, onSave, user }: { lead: Lead, onClose: () => void, onSave: (l: Lead) => void, user: User }) => {
  const [activeTab, setActiveTab] = useState<'info' | 'enrich' | 'email'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);
  
  // Enrichment States
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{text: string, grounding: any} | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [enrichCompanyName, setEnrichCompanyName] = useState(lead.companyName || '');
  const [enrichKeyPerson, setEnrichKeyPerson] = useState(lead.keyPersonName || '');
  const [enrichCity, setEnrichCity] = useState(lead.city || '');
  
  // Research results for key person
  const [researchResults, setResearchResults] = useState<{
    name?: string;
    title?: string;
    email?: string;
    verificationStatus?: 'pending' | 'approved' | 'rejected' | 'auto-approved';
    verificationReason?: string;
  } | null>(null);
  
  // Email States
  const [emailLoading, setEmailLoading] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{subject: string, body: string} | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [emailRateLimitCountdown, setEmailRateLimitCountdown] = useState<number | null>(null);
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [emailBodyViewMode, setEmailBodyViewMode] = useState<'code' | 'preview'>('preview');
  const [emailReplies, setEmailReplies] = useState<EmailReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [checkingInbox, setCheckingInbox] = useState(false);

  const canEdit = user.role === 'Director' || user.role === 'Sales';

  // Sync when prop lead changes
  useEffect(() => {
    setEditedLead(lead);
    setEnrichCompanyName(lead.companyName || '');
    setEnrichKeyPerson(lead.keyPersonName || '');
    setEnrichCity(lead.city || '');
  }, [lead]);

  // Load email templates and replies when email tab is opened
  useEffect(() => {
    if (activeTab === 'email') {
      loadEmailTemplates();
      loadEmailReplies();
    }
  }, [activeTab, lead.id]);

  const loadEmailTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const templates = await emailTemplatesApi.getAll();
      setEmailTemplates(templates);
      
      // Auto-select first template if available and no template is selected
      if (templates.length > 0 && !selectedTemplate && !draftedEmail) {
        const firstTemplateId = templates[0].id;
        setSelectedTemplate(firstTemplateId);
        
        // Auto-fill email with first template
        const template = templates[0];
        if (template) {
          let subject = template.subject;
          let body = template.body;

          // Replace common placeholders (support both {{variable}} and [variable] formats)
          subject = subject.replace(/\{\{companyName\}\}/g, lead.companyName || '');
          subject = subject.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
          subject = subject.replace(/\{\{city\}\}/g, lead.city || '');
          subject = subject.replace(/\{\{country\}\}/g, lead.country || '');
          subject = subject.replace(/\[Company Name\]/g, lead.companyName || '');
          subject = subject.replace(/\[Key Person Name\]/g, lead.keyPersonName || '');

          body = body.replace(/\{\{companyName\}\}/g, lead.companyName || '');
          body = body.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
          body = body.replace(/\{\{keyPersonTitle\}\}/g, lead.keyPersonTitle || '');
          body = body.replace(/\{\{city\}\}/g, lead.city || '');
          body = body.replace(/\{\{country\}\}/g, lead.country || '');
          body = body.replace(/\{\{industry\}\}/g, lead.industry || '');
          body = body.replace(/\[Company Name\]/g, lead.companyName || '');
          body = body.replace(/\[Key Person Name\]/g, lead.keyPersonName || '');

          setDraftedEmail({ subject, body });
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

  const handleInputChange = (field: keyof Lead, value: any) => {
    setEditedLead(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    onSave(editedLead);
    setIsEditing(false);
  };

  // Countdown effect for rate limit (enrichment)
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  // Countdown effect for rate limit (email)
  useEffect(() => {
    if (emailRateLimitCountdown !== null && emailRateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setEmailRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (emailRateLimitCountdown === 0) {
      setEmailRateLimitCountdown(null);
    }
  }, [emailRateLimitCountdown]);

  // Helper function to extract domain from website URL
  const extractDomain = (website: string | null | undefined): string | null => {
    if (!website) return null;
    try {
      // Remove protocol if present
      let url = website.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      const urlObj = new URL(url);
      return urlObj.hostname.replace('www.', '').toLowerCase();
    } catch {
      // If URL parsing fails, try to extract domain manually
      const match = website.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
      return match ? match[1].toLowerCase() : null;
    }
  };

  // Helper function to verify email
  const verifyEmail = (email: string, companyWebsite: string | null | undefined): {
    status: 'pending' | 'approved' | 'rejected' | 'auto-approved';
    reason: string;
  } => {
    if (!email) {
      return { status: 'rejected', reason: 'No email provided' };
    }

    const emailLower = email.toLowerCase().trim();
    const emailDomain = emailLower.split('@')[1];

    if (!emailDomain) {
      return { status: 'rejected', reason: 'Invalid email format' };
    }

    // Case 1: Domain matches company website - auto approve
    const companyDomain = extractDomain(companyWebsite || editedLead.website);
    if (companyDomain && emailDomain === companyDomain) {
      return { 
        status: 'auto-approved', 
        reason: `Domain matches company website (${emailDomain})` 
      };
    }

    // Case 2: Gmail + name - requires manual review
    if (emailDomain === 'gmail.com' || emailDomain === 'googlemail.com') {
      return { 
        status: 'pending', 
        reason: 'Gmail address - requires manual review' 
      };
    }

    // Other cases - pending for manual review
    return { 
      status: 'pending', 
      reason: `Domain ${emailDomain} - requires manual review` 
    };
  };

  // Parse research result to extract key person info
  // Key person should be someone with important role: Sales, Marketing, Director, Manager, etc.
  const parseResearchResult = (text: string): {
    name?: string;
    title?: string;
    email?: string;
  } => {
    const result: { name?: string; title?: string; email?: string } = {};
    
    console.log('🔍 [Parse] Parsing research result:', text.substring(0, 1000));
    
    // First, try to parse structured format from prompt (more flexible patterns)
    const structuredPatterns = [
      // Pattern 1: Standard format with KEY PERSON CONTACT
      /KEY PERSON CONTACT:[\s\S]*?Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
      // Pattern 2: With dashes or bullets
      /KEY PERSON CONTACT:[\s\S]*?Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
      // Pattern 3: Without KEY PERSON CONTACT header
      /Name:\s*([^\n]+)[\s\S]*?Title:\s*([^\n]+)[\s\S]*?Email:\s*([^\n]+)/i,
      // Pattern 4: With different spacing
      /Name\s*:\s*([^\n]+)[\s\S]*?Title\s*:\s*([^\n]+)[\s\S]*?Email\s*:\s*([^\n]+)/i,
    ];
    
    for (const pattern of structuredPatterns) {
      const structuredMatch = text.match(pattern);
      
      if (structuredMatch) {
        const name = structuredMatch[1]?.trim();
        const title = structuredMatch[2]?.trim();
        const email = structuredMatch[3]?.trim();
        
        // Check if not "Not found"
        if (name && name.toLowerCase() !== 'not found' && name.length > 0 && !name.toLowerCase().includes('not available')) {
          result.name = name;
        }
        if (title && title.toLowerCase() !== 'not found' && title.length > 0 && !title.toLowerCase().includes('not available')) {
          result.title = title;
        }
        if (email && email.toLowerCase() !== 'not found' && email.includes('@') && !email.toLowerCase().includes('not available')) {
          // Clean email (remove any trailing punctuation or text)
          const cleanEmail = email.replace(/[^\w@.-]+$/, '').trim();
          if (cleanEmail.includes('@')) {
            result.email = cleanEmail;
          }
        }
        
        if (result.name || result.title || result.email) {
          console.log('✅ [Parse] Found structured format:', result);
          // Continue to try to find missing fields
        }
      }
    }
    
    // Extract all emails from text (more comprehensive)
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const allEmails = text.match(emailRegex) || [];
    
    if (allEmails.length > 0) {
      // Filter out generic emails like info@, contact@, noreply@
      const personEmails = allEmails.filter(e => {
        const local = e.split('@')[0].toLowerCase();
        return !['info', 'contact', 'noreply', 'no-reply', 'admin', 'webmaster', 'support', 'web', 'mail', 'hello', 'general'].includes(local);
      });
      
      // If we have a name, try to find email that matches the name
      if (result.name && personEmails.length > 0) {
        const nameWords = result.name.toLowerCase().split(/\s+/);
        const matchingEmail = personEmails.find(email => {
          const emailLocal = email.split('@')[0].toLowerCase();
          return nameWords.some(word => emailLocal.includes(word) || word.includes(emailLocal));
        });
        if (matchingEmail) {
          result.email = matchingEmail;
        } else {
          result.email = personEmails[0];
        }
      } else if (personEmails.length > 0) {
        result.email = personEmails[0];
      } else if (allEmails.length > 0) {
        // Use first email if no person-specific found
        result.email = allEmails[0];
      }
    }

    // Important titles/keywords for key persons
    const importantTitles = [
      'sales', 'marketing', 'business development', 'bd', 'revenue', 'commercial',
      'director', 'manager', 'head', 'lead', 'vp', 'vice president', 'president',
      'ceo', 'cmo', 'cso', 'chief', 'executive', 'coordinator', 'specialist',
      'account manager', 'client relations', 'partnership', 'outreach', 'engagement',
      'events', 'conference', 'meeting', 'secretary general', 'organizing'
    ];
    
    // Try multiple patterns to extract name and title
    const patterns = [
      // Pattern 1: "Name, Title" (e.g., "John Smith, Sales Director")
      new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*[,;]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`, 'gi'),
      // Pattern 2: "Title Name" (e.g., "Sales Director John Smith")
      new RegExp(`([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)\\s+([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)`, 'gi'),
      // Pattern 3: "Name is Title" (e.g., "John Smith is Sales Director")
      new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s+(?:is|as|the|serves as)\\s+([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`, 'gi'),
      // Pattern 4: "Name - Title" (e.g., "John Smith - Sales Director")
      new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*[-–—]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`, 'gi'),
      // Pattern 5: "Name (Title)" (e.g., "John Smith (Sales Director)")
      new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)\\s*\\(([^)]*(?:${importantTitles.join('|')})[^)]*)\\)`, 'gi'),
    ];

    let bestMatch: { name?: string; title?: string } | null = null;
    
    for (const pattern of patterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        let name = '';
        let title = '';
        
        // Extract based on pattern type
        if (pattern.source.includes('Name.*Title') || pattern.source.includes('Name.*Title')) {
          name = match[1]?.trim() || '';
          title = match[2]?.trim() || '';
        } else if (pattern.source.includes('Title.*Name')) {
          title = match[1]?.trim() || '';
          name = match[2]?.trim() || '';
        } else {
          name = match[1]?.trim() || '';
          title = match[2]?.trim() || '';
        }
        
        // Validate
        if (name && title) {
          const nameWords = name.split(/\s+/).filter(w => w.length > 0);
          const titleLower = title.toLowerCase();
          const hasImportantTitle = importantTitles.some(keyword => titleLower.includes(keyword));
          
          // More lenient: accept if name has at least 2 words and title seems relevant
          if (nameWords.length >= 2 && (hasImportantTitle || title.length > 5)) {
            // Check if name looks valid (starts with capital letters)
            if (nameWords.every(w => /^[A-Z]/.test(w.trim()))) {
              bestMatch = { name, title };
              console.log('✅ [Parse] Found match:', bestMatch);
              break;
            }
          }
        }
      }
      if (bestMatch) break;
    }

    if (bestMatch) {
      result.name = bestMatch.name;
      result.title = bestMatch.title;
      
      // Try to find email near this name/title match
      if (!result.email && result.name) {
        const nameEscaped = result.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Find text around the name (within 200 characters)
        const nameIndex = text.search(new RegExp(nameEscaped, 'i'));
        if (nameIndex !== -1) {
          const contextStart = Math.max(0, nameIndex - 100);
          const contextEnd = Math.min(text.length, nameIndex + result.name.length + 200);
          const context = text.substring(contextStart, contextEnd);
          
          // Find email in this context
          const contextEmails = context.match(emailRegex);
          if (contextEmails && contextEmails.length > 0) {
            const personEmails = contextEmails.filter(e => {
              const local = e.split('@')[0].toLowerCase();
              return !['info', 'contact', 'noreply', 'no-reply', 'admin', 'webmaster', 'support', 'web', 'mail', 'hello', 'general'].includes(local);
            });
            if (personEmails.length > 0) {
              result.email = personEmails[0];
            } else {
              result.email = contextEmails[0];
            }
          }
        }
      }
    }

    // If we have key person name from input, use it
    if (enrichKeyPerson && enrichKeyPerson.trim() && !result.name) {
      result.name = enrichKeyPerson.trim();
      // Try to find title associated with this name
      const nameEscaped = enrichKeyPerson.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = new RegExp(`(${nameEscaped})\\s*[,;]\\s*([^,;\\n]*(?:${importantTitles.join('|')})[^,;\\n]*)`, 'i');
      const match = text.match(namePattern);
      if (match && match[2]) {
        result.title = match[2].trim();
      }
      
      // Try to find email near this name
      if (!result.email) {
        const nameIndex = text.search(new RegExp(nameEscaped, 'i'));
        if (nameIndex !== -1) {
          const contextStart = Math.max(0, nameIndex - 100);
          const contextEnd = Math.min(text.length, nameIndex + enrichKeyPerson.length + 200);
          const context = text.substring(contextStart, contextEnd);
          
          const contextEmails = context.match(emailRegex);
          if (contextEmails && contextEmails.length > 0) {
            const personEmails = contextEmails.filter(e => {
              const local = e.split('@')[0].toLowerCase();
              return !['info', 'contact', 'noreply', 'no-reply', 'admin', 'webmaster', 'support', 'web', 'mail', 'hello', 'general'].includes(local);
            });
            if (personEmails.length > 0) {
              result.email = personEmails[0];
            } else {
              result.email = contextEmails[0];
            }
          }
        }
      }
    }

    console.log('📋 [Parse] Final result:', result);
    return result;
  };

  const handleEnrich = async () => {
    if (!enrichCompanyName || enrichCompanyName.trim() === '') {
      alert('Please enter a company name to search');
      return;
    }
    
    setEnrichLoading(true);
    setRateLimitCountdown(null);
    setResearchResults(null);
    try {
      const result = await GeminiService.enrichLeadData(
        enrichCompanyName.trim(), 
        enrichKeyPerson.trim() || '', 
        enrichCity.trim() || ''
      );
      setEnrichResult(result);
      
      // Parse result to extract key person info
      const parsedInfo = parseResearchResult(result.text);
      
      // Verify email if found
      let verificationStatus: 'pending' | 'approved' | 'rejected' | 'auto-approved' = 'pending';
      let verificationReason = '';
      
      if (parsedInfo.email) {
        const verification = verifyEmail(parsedInfo.email, editedLead.website);
        verificationStatus = verification.status;
        verificationReason = verification.reason;
        
        // Auto-approve and update if domain matches
        if (verificationStatus === 'auto-approved') {
          const updatedLead = { ...editedLead };
          
          // Update key person info if found
          if (parsedInfo.name) {
            updatedLead.keyPersonName = parsedInfo.name;
          }
          if (parsedInfo.title) {
            updatedLead.keyPersonTitle = parsedInfo.title;
          }
          if (parsedInfo.email) {
            updatedLead.keyPersonEmail = parsedInfo.email;
          }
          
          // Add to research notes
          const notesUpdate = `[AI Research ${new Date().toLocaleDateString()}]: Found key person - ${parsedInfo.name || 'N/A'}, ${parsedInfo.title || 'N/A'}, ${parsedInfo.email} (Auto-approved: ${verificationReason})`;
          updatedLead.researchNotes = (updatedLead.researchNotes || '') + '\n\n' + notesUpdate;
          
          setEditedLead(updatedLead);
          onSave(updatedLead);
        }
      }
      
      setResearchResults({
        name: parsedInfo.name,
        title: parsedInfo.title,
        email: parsedInfo.email,
        verificationStatus,
        verificationReason
      });
    } catch (e: any) {
      console.error(e);
      if (isGeminiRateLimitError(e)) {
        const retryDelay = extractGeminiRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        } else {
          alert(`Rate limit exceeded. Please try again later.`);
        }
      } else {
        alert(`Enrichment failed: ${e.message || "Please check API Key/Connection"}`);
      }
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleApproveEmail = () => {
    if (!researchResults || !researchResults.email) return;
    
    const updatedLead = { ...editedLead };
    
    // Update key person info if found
    if (researchResults.name) {
      updatedLead.keyPersonName = researchResults.name;
    }
    if (researchResults.title) {
      updatedLead.keyPersonTitle = researchResults.title;
    }
    if (researchResults.email) {
      updatedLead.keyPersonEmail = researchResults.email;
    }
    
    // Add to research notes
    const notesUpdate = `[AI Research ${new Date().toLocaleDateString()}]: Found key person - ${researchResults.name || 'N/A'}, ${researchResults.title || 'N/A'}, ${researchResults.email} (Approved)`;
    updatedLead.researchNotes = (updatedLead.researchNotes || '') + '\n\n' + notesUpdate;
    
    setEditedLead(updatedLead);
    setResearchResults(prev => prev ? { ...prev, verificationStatus: 'approved' } : null);
    
    // Save to database
    onSave(updatedLead);
  };

  const handleRejectEmail = () => {
    if (!researchResults) return;
    setResearchResults(prev => prev ? { ...prev, verificationStatus: 'rejected' } : null);
  };

  const handleSaveEnrichment = () => {
    if (enrichResult) {
      const updatedNotes = (editedLead.researchNotes || '') + '\n\n' + `[AI Search ${new Date().toLocaleDateString()}]: ` + enrichResult.text;
      const newLead = { ...editedLead, researchNotes: updatedNotes };
      setEditedLead(newLead);
      onSave(newLead);
      alert("Search results saved to Research Notes.");
    }
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tmplId = e.target.value;
    setSelectedTemplate(tmplId);
    if (!tmplId) return;

    const template = emailTemplates.find(t => t.id === tmplId);
    if (template) {
      // Replace template variables with lead data
      let subject = template.subject;
      let body = template.body;

      // Replace common placeholders (support both {{variable}} and [variable] formats)
      subject = subject.replace(/\{\{companyName\}\}/g, lead.companyName || '');
      subject = subject.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
      subject = subject.replace(/\{\{city\}\}/g, lead.city || '');
      subject = subject.replace(/\{\{country\}\}/g, lead.country || '');
      subject = subject.replace(/\[Company Name\]/g, lead.companyName || '');
      subject = subject.replace(/\[Key Person Name\]/g, lead.keyPersonName || '');

      body = body.replace(/\{\{companyName\}\}/g, lead.companyName || '');
      body = body.replace(/\{\{keyPersonName\}\}/g, lead.keyPersonName || '');
      body = body.replace(/\{\{keyPersonTitle\}\}/g, lead.keyPersonTitle || '');
      body = body.replace(/\{\{city\}\}/g, lead.city || '');
      body = body.replace(/\{\{country\}\}/g, lead.country || '');
      body = body.replace(/\{\{industry\}\}/g, lead.industry || '');
      body = body.replace(/\[Company Name\]/g, lead.companyName || '');
      body = body.replace(/\[Key Person Name\]/g, lead.keyPersonName || '');

      setDraftedEmail({ subject, body });
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
        lead.notes || "Annual Conference"
      );
      setDraftedEmail(result);
      setSelectedTemplate(''); // clear template selection if AI generates
      setEmailSent(false);
    } catch (e: any) {
      console.error(e);
      if (isGeminiRateLimitError(e)) {
        const retryDelay = extractGeminiRetryDelay(e);
        if (retryDelay) {
          setEmailRateLimitCountdown(retryDelay);
        } else {
          alert(`Rate limit exceeded. Please try again later.`);
        }
      } else {
        alert("Drafting failed. Please try again.");
      }
    } finally {
      setEmailLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachments([...attachments, { name: file.name, size: file.size, type: file.type }]);
    }
  };

  const handleSendEmail = async () => {
    if (!lead.keyPersonEmail) {
      alert("No email address found for this contact. Please add an email address in the 'Info' tab.");
      return;
    }

    if (draftedEmail) {
      let body = draftedEmail.body;
      if (attachments.length > 0) {
        body += "\n\n[Attached Files]:\n" + attachments.map(a => `- ${a.name} (Link)`).join('\n');
      }

      const subject = encodeURIComponent(draftedEmail.subject);
      const encodedBody = encodeURIComponent(body);
      const mailtoLink = `mailto:${lead.keyPersonEmail}?subject=${subject}&body=${encodedBody}`;
      
      // Open email client
      window.open(mailtoLink, '_blank');

      // Create email log in database with lead_id
      try {
        const emailLogId = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const emailLog = {
          id: emailLogId,
          lead_id: lead.id,
          date: new Date().toISOString(),
          subject: draftedEmail.subject,
          status: 'sent' as const,
        };
        
        await emailLogsApi.create(emailLog);
        console.log('✅ Email log created in database:', emailLogId);
        
        // Also create attachments if any
        if (attachments.length > 0) {
          for (const attachment of attachments) {
            try {
              await emailLogsApi.createAttachment(emailLogId, {
                email_log_id: emailLogId,
                name: attachment.name,
                size: attachment.size,
                type: attachment.type,
              });
            } catch (attachError) {
              console.error('Error creating attachment log:', attachError);
            }
          }
        }
      } catch (error) {
        console.error('❌ Error creating email log in database:', error);
        // Continue even if log creation fails - don't block user
      }

      // Update local state
      const newHistory = [
        ...(editedLead.emailHistory || []),
        {
          id: Date.now().toString(),
          date: new Date().toISOString(),
          subject: draftedEmail.subject,
          status: 'sent' as const,
          attachments: attachments
        }
      ];

      const newLead = {
        ...editedLead,
        status: 'Contacted' as const,
        lastContacted: new Date().toISOString().split('T')[0],
        emailHistory: newHistory
      };
      setEditedLead(newLead);
      onSave(newLead);
      setEmailSent(true);
      setAttachments([]);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right border-l border-slate-200">
        <div className="p-4 border-b-2 border-slate-200 flex justify-between items-center bg-gradient-to-r from-slate-50 to-white">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">{lead.companyName}</h2>
            <p className="text-sm text-slate-600 font-medium mt-0.5">{lead.industry} • {lead.country}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b-2 border-slate-200 bg-white">
          <button 
            onClick={() => setActiveTab('info')} 
            className={`flex-1 py-3 font-semibold text-sm transition-all duration-200 flex justify-center items-center space-x-2 ${
              activeTab === 'info' 
                ? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Contact Info</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('enrich')} 
            className={`flex-1 py-3 font-semibold text-sm transition-all duration-200 flex justify-center items-center space-x-2 ${
              activeTab === 'enrich' 
                ? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50/50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Search size={16} /> <span>Google Enrich</span>
          </button>
          
          {canEdit ? (
            <button 
              onClick={() => setActiveTab('email')} 
              className={`flex-1 py-3 font-semibold text-sm transition-all duration-200 flex justify-center items-center space-x-2 ${
                activeTab === 'email' 
                  ? 'text-blue-600 border-b-3 border-blue-600 bg-blue-50/50' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Mail size={16} /> <span>AI Email</span>
            </button>
          ) : (
             <div className="flex-1 py-3 font-semibold text-sm flex justify-center items-center space-x-2 text-slate-300 cursor-not-allowed bg-slate-50" title="Viewer Only">
               <Lock size={16} /> <span>AI Email</span>
             </div>
          )}
        </div>

        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                 <h3 className="text-lg font-bold text-slate-900 tracking-tight">Lead Details</h3>
                 {canEdit && !isEditing && (
                   <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 flex items-center hover:bg-blue-50 px-4 py-2 rounded-lg font-semibold transition-all border border-blue-200 hover:border-blue-300">
                     <Edit2 size={16} className="mr-2" /> Edit Info
                   </button>
                 )}
                 {!canEdit && (
                   <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg flex items-center font-semibold border border-slate-200">
                     <Lock size={12} className="mr-1.5" /> Read Only
                   </span>
                 )}
                 {isEditing && (
                   <div className="flex space-x-2">
                     <button onClick={() => setIsEditing(false)} className="text-sm text-red-600 flex items-center hover:bg-red-50 px-4 py-2 rounded-lg font-semibold transition-all border border-red-200 hover:border-red-300">
                       <X size={16} className="mr-2" /> Cancel
                     </button>
                     <button onClick={handleSaveChanges} className="text-sm bg-green-600 text-white flex items-center hover:bg-green-700 px-4 py-2 rounded-lg font-bold transition-all shadow-sm">
                       <Check size={16} className="mr-2" /> Save Changes
                     </button>
                   </div>
                 )}
              </div>

              {isEditing ? (
                 <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                     <div className="col-span-2">
                        <label className="text-xs font-medium text-slate-500 block mb-1">Lead Status</label>
                        <select 
                          value={editedLead.status} 
                          onChange={(e) => handleInputChange('status', e.target.value)}
                          className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                          <option value="New">New</option>
                          <option value="Contacted">Contacted</option>
                          <option value="Qualified">Qualified</option>
                          <option value="Won">Won</option>
                          <option value="Lost">Lost</option>
                        </select>
                     </div>
                     <EditField label="Company Name" value={editedLead.companyName} onChange={(v) => handleInputChange('companyName', v)} />
                     <EditField label="Industry" value={editedLead.industry} onChange={(v) => handleInputChange('industry', v)} />
                     <EditField label="Country" value={editedLead.country} onChange={(v) => handleInputChange('country', v)} />
                     <EditField label="City" value={editedLead.city} onChange={(v) => handleInputChange('city', v)} />
                     <EditField label="Website" value={editedLead.website} onChange={(v) => handleInputChange('website', v)} />
                     <div>
                        <label className="text-xs font-medium text-slate-500 block mb-1">Number of Delegates</label>
                        <input 
                          type="number" 
                          value={editedLead.numberOfDelegates || ''} 
                          onChange={(e) => handleInputChange('numberOfDelegates', parseInt(e.target.value) || 0)}
                          className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                     </div>
                   </div>
                   
                   <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-bold text-slate-900 mb-2">Primary Contact</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <EditField label="Key Person Name" value={editedLead.keyPersonName} onChange={(v) => handleInputChange('keyPersonName', v)} />
                        <EditField label="Title" value={editedLead.keyPersonTitle} onChange={(v) => handleInputChange('keyPersonTitle', v)} />
                        <EditField label="Email" value={editedLead.keyPersonEmail} onChange={(v) => handleInputChange('keyPersonEmail', v)} />
                        <EditField label="Phone" value={editedLead.keyPersonPhone} onChange={(v) => handleInputChange('keyPersonPhone', v)} />
                      </div>
                   </div>

                   <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-bold text-slate-900 mb-2">Secondary Contact</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <EditField label="Name" value={editedLead.secondaryPersonName || ''} onChange={(v) => handleInputChange('secondaryPersonName', v)} />
                        <EditField label="Title" value={editedLead.secondaryPersonTitle || ''} onChange={(v) => handleInputChange('secondaryPersonTitle', v)} />
                        <EditField label="Email" value={editedLead.secondaryPersonEmail || ''} onChange={(v) => handleInputChange('secondaryPersonEmail', v)} />
                      </div>
                   </div>

                   <div className="border-t pt-4 mt-4">
                      <h4 className="text-sm font-bold text-slate-900 mb-2">History & Notes</h4>
                      <EditTextArea label="Past Events History" value={editedLead.pastEventsHistory || ''} onChange={(v) => handleInputChange('pastEventsHistory', v)} />
                      <EditTextArea label="Notes" value={editedLead.notes} onChange={(v) => handleInputChange('notes', v)} />
                      <EditTextArea label="Research/Search Notes" value={editedLead.researchNotes || ''} onChange={(v) => handleInputChange('researchNotes', v)} />
                   </div>
                 </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-4 bg-gradient-to-r from-blue-50 to-slate-50 p-4 rounded-lg border-2 border-blue-100">
                     <div>
                       <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Status</span>
                       <StatusBadge status={lead.status} />
                     </div>
                     <div className="text-right">
                       <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block mb-1.5">Est. Delegates</span>
                       <span className="text-lg font-bold text-slate-900">{lead.numberOfDelegates || 'N/A'}</span>
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <InfoItem label="Key Person" value={lead.keyPersonName} />
                    <InfoItem label="Title" value={lead.keyPersonTitle} />
                    <InfoItem label="Email" value={lead.keyPersonEmail || 'N/A'} isLink />
                    <InfoItem label="Phone" value={lead.keyPersonPhone || 'N/A'} />
                    <InfoItem label="Website" value={lead.website || 'N/A'} isLink />
                    <InfoItem label="City" value={lead.city} />
                  </div>

                  {(lead.secondaryPersonName || lead.secondaryPersonEmail) && (
                    <div className="border-t border-slate-100 pt-4 mt-2">
                       <h4 className="text-xs font-bold text-slate-500 uppercase mb-3">Secondary Contact</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <InfoItem label="Name" value={lead.secondaryPersonName || '-'} />
                          <InfoItem label="Title" value={lead.secondaryPersonTitle || '-'} />
                          <InfoItem label="Email" value={lead.secondaryPersonEmail || '-'} isLink />
                       </div>
                    </div>
                  )}

                  <div className="border-t border-slate-100 pt-4 mt-2">
                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Past Events History</h4>
                    <p className="text-sm text-slate-700 bg-slate-50 p-3 rounded">{lead.pastEventsHistory || 'No history recorded'}</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">General Notes</label>
                    <div className="w-full mt-2 p-3 border border-slate-200 rounded-lg text-sm text-slate-700 bg-slate-50">
                      {lead.notes}
                    </div>
                  </div>
                  
                  {lead.researchNotes && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-teal-600">Research & Search Data</label>
                      <div className="w-full mt-2 p-3 border border-teal-100 bg-teal-50 rounded-lg text-sm text-slate-700 whitespace-pre-wrap">
                        {lead.researchNotes}
                      </div>
                    </div>
                  )}
                  
                  {lead.emailHistory && lead.emailHistory.length > 0 && (
                     <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email History</label>
                      <ul className="mt-2 space-y-2">
                        {lead.emailHistory.map(log => (
                           <li key={log.id} className="text-xs p-2 bg-slate-50 rounded border border-slate-100">
                              <div className="flex justify-between">
                                <span className="font-bold">{log.subject}</span>
                                <span className="text-slate-400">{new Date(log.date).toLocaleDateString()}</span>
                              </div>
                              {log.attachments?.length ? <div className="text-slate-400 mt-1 italic">Attached: {log.attachments.map(a => a.name).join(', ')}</div> : null}
                           </li>
                        ))}
                      </ul>
                     </div>
                  )}

                  {/* Email Replies */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Replies</label>
                      {canEdit && (
                        <button
                          onClick={handleCheckInbox}
                          disabled={checkingInbox}
                          className="text-xs px-2 py-1 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                        >
                          {checkingInbox ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Checking...
                            </>
                          ) : (
                            <>
                              <Mail size={12} />
                              Check Inbox
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    {loadingReplies ? (
                      <div className="text-xs text-slate-400 p-2">Loading replies...</div>
                    ) : emailReplies.length > 0 ? (
                      <ul className="mt-2 space-y-2">
                        {emailReplies.map(reply => (
                          <li key={reply.id} className="text-xs p-3 bg-green-50 rounded border border-green-100">
                            <div className="flex justify-between items-start mb-1">
                              <div>
                                <span className="font-bold text-green-900">{reply.from_name || reply.from_email}</span>
                                <span className="text-green-600 ml-2">({reply.from_email})</span>
                              </div>
                              <span className="text-green-500">{new Date(reply.reply_date).toLocaleDateString()}</span>
                            </div>
                            <div className="font-semibold text-green-800 mb-1">{reply.subject}</div>
                            <div className="text-green-700 mt-1 line-clamp-2">{reply.body.substring(0, 200)}{reply.body.length > 200 ? '...' : ''}</div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-xs text-slate-400 p-2 bg-slate-50 rounded border border-slate-100">No replies yet</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'enrich' && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <p className="text-sm text-blue-800">
                  Use AI to find the latest contact details and past events for this lead. Enter or edit the information below before searching.
                </p>
              </div>
              {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">⚠️ Rate Limit Exceeded</p>
                      <p className="text-xs text-yellow-700 mt-1">You've exceeded your API quota. Please wait before trying again.</p>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}

              {!enrichResult && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      Company Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={enrichCompanyName}
                      onChange={(e) => setEnrichCompanyName(e.target.value)}
                      placeholder="Enter company or organization name"
                      className="w-full p-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-300 font-medium"
                      disabled={enrichLoading}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      Key Person Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={enrichKeyPerson}
                      onChange={(e) => setEnrichKeyPerson(e.target.value)}
                      placeholder="Enter key contact person name"
                      className="w-full p-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-300 font-medium"
                      disabled={enrichLoading}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">
                      City/Location (Optional)
                    </label>
                    <input
                      type="text"
                      value={enrichCity}
                      onChange={(e) => setEnrichCity(e.target.value)}
                      placeholder="Enter city or location"
                      className="w-full p-3 bg-white border-2 border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all hover:border-slate-300 font-medium"
                      disabled={enrichLoading}
                    />
                  </div>

                  <button 
                    onClick={handleEnrich}
                    disabled={enrichLoading || !canEdit || (rateLimitCountdown !== null && rateLimitCountdown > 0) || !enrichCompanyName.trim()}
                    className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-semibold flex justify-center items-center shadow-lg shadow-blue-500/30 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:from-slate-400 disabled:to-slate-400 transition-all duration-200"
                  >
                    {enrichLoading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Searching...
                      </>
                    ) : rateLimitCountdown !== null && rateLimitCountdown > 0 ? (
                      <>
                        <Loader2 className="mr-2" size={18} />
                        Retry in {rateLimitCountdown}s
                      </>
                    ) : (
                      <>
                        <Search className="mr-2" size={18} />
                        Search Live Data
                      </>
                    )}
                  </button>
                </div>
              )}

              {enrichResult && (
                <div className="space-y-4">
                  <div className="bg-white border border-slate-200 rounded-lg p-5">
                    <h4 className="font-bold text-slate-900 mb-3 text-lg">AI Summary</h4>
                    <div 
                      className="text-slate-700 prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ 
                        __html: enrichResult.text
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-slate-900">$1</strong>')
                          .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
                          .replace(/^### (.*$)/gim, '<h3 class="text-base font-bold text-slate-900 mt-4 mb-2">$1</h3>')
                          .replace(/^## (.*$)/gim, '<h2 class="text-lg font-bold text-slate-900 mt-5 mb-3">$1</h2>')
                          .replace(/^# (.*$)/gim, '<h1 class="text-xl font-bold text-slate-900 mt-6 mb-4">$1</h1>')
                          .replace(/\n\n/g, '</p><p class="mb-3 leading-relaxed">')
                          .replace(/\n/g, '<br />')
                          .replace(/^(.+)$/, '<p class="mb-3 leading-relaxed">$1</p>')
                      }} 
                    />
                  </div>
                  {enrichResult.grounding && (
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                      <h5 className="text-xs font-bold text-slate-500 uppercase mb-3 tracking-wider">Sources</h5>
                      <ul className="space-y-2">
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
                              const match = uri.match(/(?:https?:\/\/)?(?:www\.)?([^\/]+)/);
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
                              <ExternalLink size={14} className="mr-2 mt-0.5 text-slate-400 flex-shrink-0" />
                              <a 
                                href={chunk.web.uri} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-xs text-blue-600 hover:text-blue-800 hover:underline break-all flex-1"
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
                  {researchResults && (researchResults.name || researchResults.title || researchResults.email) && (
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-200 rounded-lg p-5 space-y-4">
                      <h4 className="font-bold text-indigo-900 flex items-center">
                        <UserIcon size={18} className="mr-2" />
                        Key Person Research Results
                      </h4>
                      
                      <div className="space-y-3">
                        {researchResults.name && (
                          <div className="flex items-start">
                            <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">Name:</span>
                            <span className="text-sm text-slate-900 font-medium">{researchResults.name}</span>
                          </div>
                        )}
                        
                        {researchResults.title && (
                          <div className="flex items-start">
                            <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">Title:</span>
                            <span className="text-sm text-slate-900 font-medium">{researchResults.title}</span>
                          </div>
                        )}
                        
                        {researchResults.email && (
                          <div className="space-y-2">
                            <div className="flex items-start">
                              <span className="text-sm font-semibold text-slate-600 w-24 flex-shrink-0">Email:</span>
                              <div className="flex-1">
                                <span className="text-sm text-slate-900 font-medium">{researchResults.email}</span>
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
                                              className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 flex items-center justify-center"
                                            >
                                              <Check size={14} className="mr-1" />
                                              Approve & Update
                                            </button>
                                            <button
                                              onClick={handleRejectEmail}
                                              className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 flex items-center justify-center"
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
                      className="w-full mt-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center justify-center text-sm font-medium"
                    >
                      <Save size={16} className="mr-2" /> Update Content to Research Notes
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'email' && canEdit && (
            <div className="space-y-4">
               <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <p className="text-sm text-purple-800">
                  Generate a personalized sales pitch using Gemini AI or use a template, then send via your mail client.
                </p>
              </div>
              
              {emailRateLimitCountdown !== null && emailRateLimitCountdown > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
                      <p className="text-xs text-yellow-700 mt-1">Please wait before trying again</p>
                    </div>
                    <div className="text-2xl font-bold text-yellow-600">
                      {Math.floor(emailRateLimitCountdown / 60)}:{(emailRateLimitCountdown % 60).toString().padStart(2, '0')}
                    </div>
                  </div>
                </div>
              )}

              {!draftedEmail && (
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-2">Choose a Template</label>
                    {loadingTemplates ? (
                      <div className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-500 flex items-center">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Loading templates...
                      </div>
                    ) : emailTemplates.length === 0 ? (
                      <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-500 text-center">
                        No email templates found in database
                      </div>
                    ) : (
                      <select 
                        className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none cursor-pointer hover:border-slate-400 transition-colors"
                        value={selectedTemplate}
                        onChange={handleTemplateChange}
                      >
                        <option value="">-- Select Template --</option>
                        {emailTemplates.map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                  
                  <div className="text-center text-xs text-slate-400">OR</div>
                  
                  <button 
                    onClick={handleDraftEmail}
                    disabled={emailLoading || (emailRateLimitCountdown !== null && emailRateLimitCountdown > 0)}
                    className="w-full py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium flex justify-center items-center shadow-sm disabled:opacity-50"
                  >
                    {emailLoading ? <Loader2 className="animate-spin mr-2" /> : <Mail className="mr-2" size={16} />}
                    {emailRateLimitCountdown !== null && emailRateLimitCountdown > 0 
                      ? `Retry in ${emailRateLimitCountdown}s` 
                      : 'Generate with AI'}
                  </button>
                </div>
              )}

              {draftedEmail && !emailSent && (
                <div className="border border-slate-200 rounded-lg overflow-hidden flex flex-col h-[450px]">
                  <div className="bg-slate-50 p-3 border-b border-slate-200 flex flex-col space-y-2">
                    <div className="flex items-center text-xs text-slate-500 mb-1">
                      <span className="font-bold mr-1">To:</span> {lead.keyPersonEmail || <span className="text-red-500">Missing Email</span>}
                    </div>
                    <input 
                      value={draftedEmail.subject}
                      onChange={(e) => setDraftedEmail({...draftedEmail, subject: e.target.value})}
                      className="text-sm font-bold text-slate-900 bg-transparent outline-none border-b border-transparent focus:border-purple-300"
                    />
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-700">Email Body</label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setEmailBodyViewMode('code')}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            emailBodyViewMode === 'code'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          HTML Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setEmailBodyViewMode('preview')}
                          className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                            emailBodyViewMode === 'preview'
                              ? 'bg-purple-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          Preview
                        </button>
                      </div>
                    </div>
                    
                    {emailBodyViewMode === 'code' ? (
                      <textarea 
                        className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none mb-2 transition-colors font-mono" 
                        value={draftedEmail.body}
                        onChange={(e) => setDraftedEmail({...draftedEmail, body: e.target.value})}
                        placeholder="<html>...\n\nUse HTML format with variables like {{keyPersonName}}, {{companyName}}, etc."
                      ></textarea>
                    ) : (
                      <div 
                        className="w-full flex-1 border border-slate-200 rounded-lg bg-white overflow-auto mb-2"
                        style={{ minHeight: '300px' }}
                      >
                        <div
                          contentEditable
                          suppressContentEditableWarning
                          onInput={(e) => {
                            const html = e.currentTarget.innerHTML;
                            setDraftedEmail({...draftedEmail, body: html});
                          }}
                          onBlur={(e) => {
                            const html = e.currentTarget.innerHTML;
                            setDraftedEmail({...draftedEmail, body: html});
                          }}
                          dangerouslySetInnerHTML={{ __html: draftedEmail.body || '<div style="padding: 20px; color: #666; text-align: center;">Click here to start editing your email. Use variables like {{keyPersonName}}, {{companyName}}, etc.</div>' }}
                          className="p-3 min-h-[300px] focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-inset"
                          style={{
                            fontFamily: 'Arial, sans-serif',
                            lineHeight: '1.6',
                            color: '#333'
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="border-t border-slate-100 pt-2">
                       <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-bold text-slate-500">Attachments</label>
                          <label className="cursor-pointer text-xs text-blue-600 hover:underline flex items-center">
                            <Plus size={12} className="mr-1" /> Add File
                            <input type="file" className="hidden" onChange={handleFileUpload} />
                          </label>
                       </div>
                       {attachments.length > 0 ? (
                         <div className="flex flex-wrap gap-2">
                           {attachments.map((file, idx) => (
                             <span key={idx} className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-xs flex items-center">
                               {file.name}
                               <button onClick={() => setAttachments(attachments.filter((_, i) => i !== idx))} className="ml-1 text-slate-400 hover:text-red-500"><X size={10}/></button>
                             </span>
                           ))}
                         </div>
                       ) : <p className="text-xs text-slate-400 italic">No files attached.</p>}
                    </div>
                  </div>
                  <div className="bg-slate-50 p-3 border-t border-slate-200 flex justify-end space-x-3">
                    <button 
                       onClick={() => setDraftedEmail(null)}
                       className="text-sm text-slate-500 font-medium hover:text-slate-700"
                    >
                      Discard
                    </button>
                    <button 
                       onClick={handleSendEmail}
                       className="text-sm bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 flex items-center"
                    >
                       <ExternalLink size={14} className="mr-2" /> Open Mail App & Send
                    </button>
                  </div>
                </div>
              )}
              {emailSent && (
                <div className="text-center py-10 bg-green-50 rounded-lg border border-green-100">
                  <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Check size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-green-800">Email Client Opened!</h3>
                  <p className="text-sm text-green-600 mt-1">Lead status updated to "Contacted".</p>
                  <button 
                    onClick={() => { setDraftedEmail(null); setEmailSent(false); }}
                    className="mt-4 text-sm text-green-700 underline"
                  >
                    Draft Another
                  </button>
                </div>
              )}

              {/* Email Replies Section */}
              <div className="border-t border-slate-200 pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-900">Email Replies</h3>
                  <button
                    onClick={handleCheckInbox}
                    disabled={checkingInbox}
                    className="text-xs px-3 py-1.5 bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                  >
                    {checkingInbox ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Checking...
                      </>
                    ) : (
                      <>
                        <Mail size={14} />
                        Check Inbox
                      </>
                    )}
                  </button>
                </div>
                {loadingReplies ? (
                  <div className="text-center py-4 text-slate-400 text-sm">
                    <Loader2 className="animate-spin mx-auto mb-2" size={20} />
                    Loading replies...
                  </div>
                ) : emailReplies.length > 0 ? (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {emailReplies.map(reply => (
                      <div key={reply.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold text-green-900 text-sm">
                              {reply.from_name || reply.from_email}
                            </div>
                            <div className="text-xs text-green-600">{reply.from_email}</div>
                          </div>
                          <div className="text-xs text-green-500">
                            {new Date(reply.reply_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="font-medium text-green-800 text-sm mb-1">{reply.subject}</div>
                        <div className="text-xs text-green-700 line-clamp-3">{reply.body}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-slate-400 text-sm bg-slate-50 rounded-lg border border-slate-100">
                    <Mail className="mx-auto mb-2 text-slate-300" size={24} />
                    No replies yet. Click "Check Inbox" to check for new replies.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// InfoItem, EditField, EditTextArea are now imported from components/common

// 5. Intelligent Data View
interface ParsedReport {
  partA: {
    table: string[][];
    headers: string[];
  } | null;
  partB: string;
  partC: any[] | null;
  rawText: string;
}

interface OrganizationProgress {
  companyName: string;
  status: 'pending' | 'analyzing' | 'completed' | 'error';
  result?: any;
  error?: string;
}

interface EmailSendSummary {
  attempted: number;
  sent: number;
  failures: { eventName: string; email?: string; error: string }[];
  skipped?: boolean;
  message?: string;
}

const IntelligentDataView = ({ onSaveToLeads }: { onSaveToLeads: (newLeads: Lead[]) => void }) => {
  const [inputMode, setInputMode] = useState<'existing' | 'import'>('existing');
  const [importData, setImportData] = useState('');
  const [report, setReport] = useState('');
  const [parsedReport, setParsedReport] = useState<ParsedReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState<Lead[]>([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [existingLeads, setExistingLeads] = useState<Lead[]>([]);
  const [editionResearchCache, setEditionResearchCache] = useState<Map<string, { chairman: string; secretary: string }>>(new Map());
  const [researchingEditions, setResearchingEditions] = useState<Set<string>>(new Set());
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelSummary, setExcelSummary] = useState<any>(null);
  const [uploadingExcel, setUploadingExcel] = useState(false);
  const [organizationProgress, setOrganizationProgress] = useState<OrganizationProgress[]>([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set()); // Track expanded organizations
  const [eventsList, setEventsList] = useState<Array<{
    name: string;
    data: string;
    id?: string;
    rawData?: any;
    dataQualityScore?: number;
    issues?: any[];
    eventHistory?: string;
    editions?: any[];
    organizationName?: string;
  }>>([]); // List of events to analyze
  const [analysisError, setAnalysisError] = useState<string | null>(null); // Track analysis errors
  const [selectedEventForModal, setSelectedEventForModal] = useState<{ name: string; data: string; id?: string; dataQualityScore?: number; issues?: any[]; rawData?: any } | null>(null); // Event selected for modal view
  const [allExcelData, setAllExcelData] = useState<string>(''); // Store all Excel textData for cross-sheet lookup
  const [excelContacts, setExcelContacts] = useState<any[]>([]); // Store contacts from org_contacts sheet
  const [emailSendSummary, setEmailSendSummary] = useState<EmailSendSummary | null>(null);
  const [analyzingEvents, setAnalyzingEvents] = useState<Set<string>>(new Set()); // Track which events are currently being analyzed
  const [completedLeadsMap, setCompletedLeadsMap] = useState<Map<string, any>>(new Map()); // Map event name -> lead result
  const [completingDataMap, setCompletingDataMap] = useState<Map<string, boolean>>(new Map()); // Track which events are being auto-filled
  const [savedToDatabase, setSavedToDatabase] = useState<Set<string>>(new Set()); // Track which events have been saved to database
  const [searchTerm, setSearchTerm] = useState(''); // Search filter for events
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all'); // Priority filter
  const [sortBy, setSortBy] = useState<'score' | 'name' | 'status'>('score'); // Sort option
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc'); // Sort order
  // Scoring criteria toggles - all enabled by default (auto on)
  const [scoringCriteria, setScoringCriteria] = useState({
    history: true,
    region: true,
    contact: true,
    delegates: true,
    iccaQualification: true
  });
  
  // Helper function to calculate data quality score
  const calculateDataQuality = (result: any): number => {
    if (!result) return 0;
    let score = 0;
    let totalFields = 0;
    
    // Required fields (weight: 2)
    const requiredFields = ['companyName', 'industry', 'country', 'city'];
    requiredFields.forEach(field => {
      totalFields += 2;
      if (result[field] && result[field] !== 'N/A' && result[field].trim() !== '') score += 2;
    });
    
    // Important fields (weight: 1.5)
    const importantFields = ['website', 'keyPersonName', 'keyPersonEmail', 'keyPersonPhone'];
    importantFields.forEach(field => {
      totalFields += 1.5;
      if (result[field] && result[field] !== 'N/A' && result[field].trim() !== '') score += 1.5;
    });
    
    // Additional fields (weight: 1)
    const additionalFields = ['keyPersonTitle', 'numberOfDelegates', 'pastEventsHistory'];
    additionalFields.forEach(field => {
      totalFields += 1;
      if (result[field] && result[field] !== 'N/A' && result[field].trim() !== '') score += 1;
    });
    
    return totalFields > 0 ? Math.round((score / totalFields) * 100) : 0;
  };
  
  // Helper function to detect enriched fields
  const getEnrichedFields = (result: any): string[] => {
    const enriched: string[] = [];
    const notes = result.notes || '';
    
    // Check if notes mention enrichment
    if (notes.toLowerCase().includes('enriched') || notes.toLowerCase().includes('ai enriched')) {
      // Try to detect which fields were enriched
      if (notes.toLowerCase().includes('contact')) enriched.push('Contact Info');
      if (notes.toLowerCase().includes('website')) enriched.push('Website');
      if (notes.toLowerCase().includes('industry')) enriched.push('Industry');
      if (notes.toLowerCase().includes('location')) enriched.push('Location');
    }
    
    return enriched;
  };
  
  // Toggle expand/collapse
  const toggleExpand = (orgName: string) => {
    setExpandedOrgs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(orgName)) {
        newSet.delete(orgName);
      } else {
        newSet.add(orgName);
      }
      return newSet;
    });
  };

  // Fetch existing leads from database when component mounts or mode changes to 'existing'
  useEffect(() => {
    if (inputMode === 'existing') {
      const fetchExistingLeads = async () => {
        try {
          const fetchedLeads = await leadsApi.getAll();
          const mappedLeads = fetchedLeads.map(mapLeadFromDB);
          setExistingLeads(mappedLeads);
          
          // Mark events that are already in database
          const existingNames = new Set(mappedLeads.map(l => l.companyName?.toLowerCase().trim()).filter(Boolean));
          setSavedToDatabase(prev => {
            const newSet = new Set(prev);
            existingNames.forEach(name => newSet.add(name));
            return newSet;
          });
        } catch (error: any) {
          console.error('Error fetching leads for analysis:', error);
          // Fallback to INITIAL_LEADS if API fails
          setExistingLeads(INITIAL_LEADS);
        }
      };
      fetchExistingLeads();
    }
  }, [inputMode]);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);


  // Generate final report from batch results
  const generateFinalReport = (results: any[], totalEvents: number, skippedCount: number = 0): string => {
    // Sort by totalScore descending
    const sortedResults = [...results].sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0));
    
    // Show all events, but prioritize those with score >= 30
    // Include all events to allow user to see all results
    const qualifiedEvents = sortedResults.filter(event => (event.totalScore || 0) >= 30);
    const topEvents = sortedResults.slice(0, 20); // Top 20 events (or all if less than 20)

    let report = `# Phân tích và chọn lọc Events\n\n`;
    report += `**Tổng số events đã import:** ${totalEvents}\n`;
    if (skippedCount > 0) {
      report += `**Số events bị SKIP (không ICCA qualified):** ${skippedCount}\n`;
    }
    report += `**Số events đã phân tích:** ${results.length}\n`;
    report += `**Số events PHÙ HỢP (Score ≥ 30):** ${qualifiedEvents.length}\n`;
    report += `**Top events được đề xuất:** ${topEvents.length}\n\n`;

    report += `## PHẦN A: XẾP HẠNG EVENTS PHÙ HỢP NHẤT\n\n`;
    report += `*Hiển thị tất cả events đã phân tích (ưu tiên events có điểm ≥ 30)*\n\n`;
    report += `| Hạng | Tên Event | Điểm tổng | Điểm lịch sử | Điểm khu vực | Điểm liên hệ | Điểm quy mô | Lý do điểm | Chiến lược tiếp theo |\n`;
    report += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

    topEvents.forEach((event, idx) => {
      report += `| ${idx + 1} | ${event.companyName || 'Unknown'} | ${event.totalScore || 0} | ${event.historyScore || 0} | ${event.regionScore || 0} | ${event.contactScore || 0} | ${event.delegatesScore || 0} | ${event.notes || 'N/A'} | ${event.nextStepStrategy || 'N/A'} |\n`;
    });

    report += `\n## PHẦN B: EMAIL HÀNH ĐỘNG\n\n`;
    topEvents.slice(0, 3).forEach((event, idx) => {
      report += `**Email ${idx + 1}: ${event.companyName || 'Event'}**\n`;
      report += `Subject: Invitation to Host Your Next Conference in Danang, Vietnam\n`;
      report += `Body: Dear ${event.keyPersonName || 'Sir/Madam'},\n\n`;
      report += `We are reaching out from Ariyana Convention Centre Danang, the prestigious venue that successfully hosted APEC 2017. Based on your event's history and patterns, we believe Danang would be an excellent destination for your next conference.\n\n`;
      report += `${event.notes || 'This event shows great potential for hosting in Vietnam.'}\n\n`;
      report += `We would be delighted to discuss how we can support your event in 2026 or 2027.\n\n`;
      report += `Best regards,\nAriyana Convention Centre Team\n\n`;
    });

    report += `\n## PART C: STRUCTURED DATA (JSON)\n\n`;
    report += `\`\`\`json\n${JSON.stringify(topEvents, null, 2)}\n\`\`\`\n`;

    return report;
  };

  // Parse report into structured parts
  const parseReport = (reportText: string): ParsedReport => {
    const result: ParsedReport = {
      partA: null,
      partB: '',
      partC: null,
      rawText: reportText
    };

    // Extract PART A: Table
    const partAMatch = reportText.match(/PART A:[\s\S]*?STRATEGIC ANALYSIS[\s\S]*?(\|.*?\|[\s\S]*?)(?=PART B:|$)/i);
    if (partAMatch) {
      const tableText = partAMatch[1];
      const lines = tableText.split('\n').filter(line => line.trim().startsWith('|') && !line.includes(':---'));
      if (lines.length > 0) {
        const headers = lines[0].split('|').map(h => h.trim()).filter(h => h);
        const rows = lines.slice(1).map(line => 
          line.split('|').map(cell => cell.trim()).filter((_, i) => i > 0 && i <= headers.length)
        );
        result.partA = { headers, table: rows };
      }
    }

    // Extract PART B: Emails
    const partBMatch = reportText.match(/PART B:[\s\S]*?ACTIONABLE EMAILS[\s\S]*?(.*?)(?=PART C:|$)/i);
    if (partBMatch) {
      result.partB = partBMatch[1].trim();
    }

    // Extract PART C or PART D: JSON (Excel uses PART D)
    // Try multiple patterns to find JSON
    let jsonMatch = null;
    
    // Pattern 1: PART D with STRUCTURED DATA
    jsonMatch = reportText.match(/PART D:[\s\S]*?STRUCTURED DATA[\s\S]*?```json([\s\S]*?)```/i);
    
    // Pattern 2: PART C with STRUCTURED DATA
    if (!jsonMatch) {
      jsonMatch = reportText.match(/PART C:[\s\S]*?STRUCTURED DATA[\s\S]*?```json([\s\S]*?)```/i);
    }
    
    // Pattern 3: Any ```json block
    if (!jsonMatch) {
      jsonMatch = reportText.match(/```json([\s\S]*?)```/);
    }
    
    // Pattern 4: JSON array directly (without code blocks)
    if (!jsonMatch) {
      const jsonArrayMatch = reportText.match(/\[[\s\S]*?\{[\s\S]*?\}[\s\S]*?\]/);
      if (jsonArrayMatch) {
        jsonMatch = [null, jsonArrayMatch[0]];
      }
    }
    
    // Pattern 5: Look for JSON after "PART D" or "PART C" anywhere
    if (!jsonMatch) {
      const partMatch = reportText.match(/(?:PART [CD]:[\s\S]*?)(\[[\s\S]*?\{[\s\S]*?\}[\s\S]*?\])/i);
      if (partMatch) {
        jsonMatch = [null, partMatch[1]];
      }
    }
    
    if (jsonMatch && jsonMatch[1]) {
      try {
        const jsonText = jsonMatch[1].trim();
        // Clean up if it has markdown code block markers
        const cleanedJson = jsonText.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        result.partC = JSON.parse(cleanedJson);
        console.log(`✅ [Parse Report] Successfully parsed ${Array.isArray(result.partC) ? result.partC.length : 0} items from JSON`);
      } catch (e) {
        console.error('❌ [Parse Report] Failed to parse JSON from report:', e);
        console.error('JSON text preview:', jsonMatch[1].substring(0, 500));
        // Try to extract valid JSON array manually
        try {
          const jsonArrayStart = reportText.indexOf('[');
          const jsonArrayEnd = reportText.lastIndexOf(']');
          if (jsonArrayStart >= 0 && jsonArrayEnd > jsonArrayStart) {
            const potentialJson = reportText.substring(jsonArrayStart, jsonArrayEnd + 1);
            result.partC = JSON.parse(potentialJson);
            console.log(`✅ [Parse Report] Fallback: Successfully parsed ${Array.isArray(result.partC) ? result.partC.length : 0} items`);
          }
        } catch (e2) {
          console.error('❌ [Parse Report] Fallback parsing also failed:', e2);
        }
      }
    } else {
      console.warn('⚠️  [Parse Report] No JSON found in report. Looking for JSON patterns...');
      // Debug: log report structure
      const hasPartD = /PART D:/i.test(reportText);
      const hasPartC = /PART C:/i.test(reportText);
      const hasJsonBlock = /```json/i.test(reportText);
      const hasJsonArray = /\[[\s\S]*?\{/i.test(reportText);
      console.log('Report structure:', { hasPartD, hasPartC, hasJsonBlock, hasJsonArray });
    }

    return result;
  };

  const downloadSampleCSV = () => {
    const headers = "Company Name,Industry,Country,City,Website,Key Person Name,Key Person Title,Key Person Email,Key Person Phone,Vietnam Events Count,Past Events History";
    const sampleRow = "\nExample Association,Technology,Singapore,Singapore,https://example.org,John Doe,Director,john@example.org,+6512345678,2,2023: Bangkok; 2022: Jakarta";
    const blob = new Blob([headers + sampleRow], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.setAttribute('download', 'ariyana_leads_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if it's an Excel file
    const isExcel = file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || 
                    file.type === 'application/vnd.ms-excel' || 
                    file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    
    if (isExcel) {
      // Handle Excel file upload
      setExcelFile(file);
      setImportData(''); // Clear CSV data
      handleExcelUpload(file);
      return;
    }

    // Handle CSV file
    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert("Please upload a .csv or Excel (.xls, .xlsx) file.");
      return;
    }

    setExcelFile(null);
    setExcelSummary(null);
    setEmailSendSummary(null);
    
    // Use CSV import API for proper cleaning
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const response = await fetch('/api/v1/csv-import/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload CSV file');
      }
      
      const result = await response.json();
      console.log('✅ [CSV Import] File processed:', result);
      
      // Set cleaned data
      setImportData(result.textData || '');
      setExcelSummary(result.summary || null);
      setAllExcelData(result.textData || ''); // Store all data for cross-sheet lookup in modal
      
      // Use events from API response (with data quality analysis)
      const responseEvents = result.events || result.organizations; // Prefer events, fallback to organizations for backward compatibility
      if (responseEvents && Array.isArray(responseEvents)) {
        const events = responseEvents.map((eventData: any) => ({
          name: eventData.name,
          data: Object.entries(eventData.rawData || {})
            .filter(([key]) => key !== '_sheet')
            .map(([key, value]) => `${key}: ${value || 'N/A'}`)
            .join(', '),
          rawData: eventData.rawData || {}, // Keep raw data object for better parsing in modal
          id: eventData.name.toLowerCase().replace(/\s+/g, '_'),
          dataQualityScore: eventData.dataQualityScore,
          issues: eventData.issues || [],
        }));
        setEventsList(events);
        console.log(`✅ [CSV Import] Loaded ${events.length} events with data quality analysis`);
      } else {
        // Fallback: parse manually if API doesn't return organizations
        const events = parseEventsFromData(result.textData || '', result.summary);
        setEventsList(events);
      }
    } catch (error: any) {
      console.error('❌ [CSV Import] Error:', error);
      // Fallback to simple text read
    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setImportData(evt.target.result as string);
      }
    };
    reader.readAsText(file);
    }
  };

  const handleExcelUpload = async (file: File) => {
    setUploadingExcel(true);
    setExcelSummary(null);
    setImportData('');
    setEmailSendSummary(null);
    
    try {
      console.log('📊 [Excel Upload] Uploading file:', file.name);
      
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch('/api/v1/excel-import/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(error.error || 'Failed to upload Excel file');
      }
      
      const result = await response.json();
      console.log('✅ [Excel Upload] File processed successfully:', result);
      if (result.emailResults) {
        console.log('📬 [Excel Upload] Email automation summary:', result.emailResults);
      }
      
      setExcelSummary(result.summary);
      setImportData(result.textData); // Set cleaned text data for analysis
      setAllExcelData(result.textData || ''); // Store all data for cross-sheet lookup in scoreEventLocally
      setEmailSendSummary(result.emailResults || null);
      setExcelContacts(result.contacts || []); // Store contacts from org_contacts sheet
      console.log(`📇 [Excel Upload] Loaded ${result.contacts?.length || 0} contacts from org_contacts sheet`);
      console.log(`📊 [Excel Upload] Stored ${(result.textData || '').length} characters of Excel data for analysis`);
      
      // Use events from API response (with data quality analysis)
      const responseEvents = result.events || result.organizations; // Prefer events, fallback to organizations for backward compatibility
      if (responseEvents && Array.isArray(responseEvents)) {
        const events = responseEvents.map((eventData: any) => {
          // Build data string including event history if available
          const dataParts = Object.entries(eventData.rawData || {})
            .filter(([key]) => key !== '_sheet')
            .map(([key, value]) => `${key}: ${value || 'N/A'}`);
          
          // Add event history if available
          if (eventData.eventHistory && eventData.eventHistory.trim()) {
            dataParts.push(`Event History: ${eventData.eventHistory}`);
          }
          
          return {
            name: eventData.name,
            organizationName: eventData.organizationName || eventData.name, // Ensure organizationName exists
            data: dataParts.join(', '),
            rawData: eventData.rawData || {}, // Keep raw data object for better parsing in modal
            id: eventData.name.toLowerCase().replace(/\s+/g, '_'),
            dataQualityScore: eventData.dataQualityScore,
            issues: eventData.issues || [],
            eventHistory: eventData.eventHistory || '', // Store event history separately
            editions: eventData.editions || [], // Store editions array
          };
        });
        setEventsList(events);
        console.log(`✅ [Excel Upload] Loaded ${events.length} events with data quality analysis`);
        console.log(`📊 [Excel Upload] Events with history: ${events.filter(e => e.eventHistory).length}`);
        console.log(`📊 [Excel Upload] Events with editions:`, events.map(e => ({ name: e.name, editionsCount: e.editions?.length || 0, editions: e.editions })));
      } else {
        // Fallback: parse manually if API doesn't return organizations
        const events = parseEventsFromData(result.textData || '', result.summary);
        setEventsList(events);
      }
    } catch (error: any) {
      console.error('❌ [Excel Upload] Error:', error);
      setExcelFile(null);
    } finally {
      setUploadingExcel(false);
    }
  };

  // Score a single event/series from Excel/CSV data
  // Use backend scoring logic without AI
  // ============================================================================
  // BACKEND SCORING ENGINE - NO AI NEEDED
  // ============================================================================
  // Thuật toán tự động chấm điểm events dựa trên 4 tiêu chí:
  // 1. History Score (0-25): Ưu tiên events đã tổ chức tại VN/SEA
  // 2. Region Score (0-25): Ưu tiên events có tính chất khu vực châu Á
  // 3. Contact Score (0-25): Ưu tiên events có đầy đủ thông tin liên hệ
  // 4. Delegates Score (0-25): Ưu tiên events quy mô lớn (>500 người)
  // Total Score: 0-100 điểm
  //
  // Chi tiết xem file: SCORING_LOGIC.md
  // ============================================================================
  
  
  const scoreEventLocally = async (event: any, allExcelData: string): Promise<any> => {
    try {
      console.log(`📊 [Local Scoring] Scoring event: ${event.name}`);
      
      if (!event || !event.name) {
        throw new Error('Event is missing or has no name');
      }
      
      // Extract editions from event
      const editions = (event as any).editions || [];
      const rawData = (event as any).rawData || {};
      
      console.log(`  └─ Editions found: ${editions.length}`);
      console.log(`  └─ Excel contacts available: ${excelContacts?.length || 0}`);
    
    // Find related contacts from org_contacts sheet
    const relatedContacts: any[] = [];
    
    // Get organization name from event (could be organizationName or event name)
    const orgName = (event as any).organizationName || event.name;
    const orgNameLower = orgName?.toLowerCase().trim() || '';
    
    // Get Organization ID from rawData (for Orgs sheet, this is the ID field)
    // CRITICAL: Orgs sheet has column "ID", which links to "OrgID" column in Org_Contacts sheet
    // Match: Orgs.ID === Org_Contacts.OrgID
    const orgId = rawData.ID || rawData.id || rawData['ID'] ||
                  rawData.ORGID || rawData.OrgID || rawData.orgId || rawData.ORGANIZATION_ID ||
                  rawData.OrgId || rawData.Organization_ID || rawData['Organization ID'] || rawData['ORG ID'] || '';
    
    // Also try to get Series ID (for backward compatibility with Editions sheet)
    const seriesId = rawData.SERIESID || rawData.SeriesID || rawData.seriesId || rawData.SERIES_ID || 
                     rawData.SeriesId || rawData.Series_ID || rawData['Series ID'] || rawData['SERIES ID'] || '';
    
    // Find matching contacts from excelContacts
    if (excelContacts && excelContacts.length > 0) {
      console.log(`  └─ Searching ${excelContacts.length} contacts for: ${orgName}`);
      console.log(`  └─ Organization ID from Orgs sheet (ID): ${orgId || 'NOT FOUND'}`);
      console.log(`  └─ Event rawData keys:`, Object.keys(rawData).slice(0, 20).join(', '));
      
      excelContacts.forEach((contact: any, idx: number) => {
        // Get contact OrgID (from Org_Contacts sheet - this links to ID from Orgs sheet)
        // CRITICAL: Org_Contacts.OrgID === Orgs.ID
        const contactOrgId = contact.OrgID || contact.ORGID || contact.orgId || contact.OrgId || 
                            contact['OrgID'] || contact['ORGID'] || contact['Organization ID'] || '';
        
        // Also get contact organization name for fallback matching
        const contactOrgName = contact.OrgName || contact.ORGNAME || contact.orgName || 
                              contact.ORGANIZATION_NAME || contact.OrganizationName || contact.organization_name || 
                              contact.ORG_NAME || contact.org_name ||
                              contact.Organization_Name || contact['Organization Name'] || contact['ORGANIZATION NAME'] ||
                              contact.ORG || contact.Org || contact.org ||
                              contact.ORGANIZATION || contact.Organization || contact.organization ||
                              '';
        const contactOrgNameLower = contactOrgName.toLowerCase().trim();
        
        // PRIORITY 1: Match by OrgID (most reliable - Orgs.ID === Org_Contacts.OrgID)
        // This is the primary linking mechanism between Orgs and Org_Contacts sheets
        const matchesOrgId = orgId && contactOrgId && String(orgId).trim() === String(contactOrgId).trim();
        
        // PRIORITY 2: Match by organization name (fallback if OrgID not available)
        const matchesOrgName = contactOrgNameLower && orgNameLower && 
                              (contactOrgNameLower === orgNameLower || 
                               contactOrgNameLower.includes(orgNameLower) || 
                               orgNameLower.includes(contactOrgNameLower));
        
        // PRIORITY 3: Match by Series ID (for backward compatibility with Editions sheet)
        const contactSeriesId = contact.SERIESID || contact.SeriesID || contact.seriesId || contact.SERIES_ID ||
                                contact.SeriesId || contact.Series_ID || contact['Series ID'] || contact['SERIES ID'] || '';
        const matchesSeriesId = seriesId && contactSeriesId && String(seriesId).trim() === String(contactSeriesId).trim();
        
        if (matchesOrgId || matchesOrgName || matchesSeriesId) {
          const matchType = matchesOrgId ? 'OrgID (Orgs.ID === Org_Contacts.OrgID)' : 
                           matchesOrgName ? 'OrgName' : 'SeriesID';
          console.log(`  └─ ✅ MATCHED contact ${idx + 1}: Org_Contacts.OrgID="${contactOrgId}" matches Orgs.ID="${orgId}" (match type: ${matchType})`);
          console.log(`  └─ Contact: ${contact.FullName || 'N/A'}, Title: ${contact.Title || 'N/A'}, Email: ${contact.Email || 'N/A'}`);
          relatedContacts.push(contact);
        }
      });
    } else {
      console.log(`  └─ ⚠️ No contacts available (excelContacts: ${excelContacts?.length || 0})`);
    }
    
    console.log(`  └─ Found ${relatedContacts.length} related contacts for: ${orgName} (Orgs.ID: ${orgId})`);
    
    // Get vietnamEvents from rawData if available (for leads from database)
    const vietnamEvents = (event as any).vietnamEvents || rawData.vietnamEvents || rawData.VIETNAM_EVENTS;
    
    // Calculate scores using backend logic - only for enabled criteria
    const historyScore = scoringCriteria.history ? calculateHistoryScore(editions) : 0;
    const regionScore = scoringCriteria.region ? calculateRegionScore(event.name, editions) : 0;
    const contactScore = scoringCriteria.contact ? calculateContactScore(rawData, relatedContacts) : 0;
    const delegatesScore = scoringCriteria.delegates ? calculateDelegatesScore(editions) : 0;
    const totalScore = historyScore + regionScore + contactScore + delegatesScore;
    
    console.log(`  ├─ History Score: ${historyScore}/25 ${scoringCriteria.history ? '(Vietnam/SEA events)' : '(DISABLED)'}`);
    console.log(`  ├─ Region Score: ${regionScore}/25 ${scoringCriteria.region ? '(Asia/Pacific relevance)' : '(DISABLED)'}`);
    console.log(`  ├─ Contact Score: ${contactScore}/25 ${scoringCriteria.contact ? '(Email/Phone availability)' : '(DISABLED)'}`);
    console.log(`  ├─ Delegates Score: ${delegatesScore}/25 ${scoringCriteria.delegates ? '(Event size)' : '(DISABLED)'}`);
    console.log(`  └─ TOTAL SCORE: ${totalScore}/100 (Active criteria: ${[scoringCriteria.history && 'History', scoringCriteria.region && 'Region', scoringCriteria.contact && 'Contact', scoringCriteria.delegates && 'Delegates'].filter(Boolean).join(', ') || 'None'})`);
    console.log('');
    
    // Count Vietnam events from editions
    let finalVietnamEvents = 0;
    editions.forEach((edition: any) => {
      const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
      if (country === 'vietnam' || country === 'vn') {
        finalVietnamEvents++;
      }
    });
    
    // Use counted value if we have editions, otherwise use existing value
    const finalVietnamEventsValue = editions.length > 0 ? finalVietnamEvents : (vietnamEvents || 0);
    
    // Format event history
    const pastEventsHistory = formatEventHistory(editions);
    
    // Generate notes
    const notesParts: string[] = [];
    if (historyScore >= 25) notesParts.push('Has Vietnam events');
    else if (historyScore >= 15) notesParts.push('Has Southeast Asia events');
    
    if (regionScore >= 25) notesParts.push('Regional event (ASEAN/Asia/Pacific)');
    else if (regionScore >= 15) notesParts.push('Asian location');
    
    if (delegatesScore >= 25) notesParts.push('Large event (500+ delegates)');
    else if (delegatesScore >= 20) notesParts.push('Medium event (300+ delegates)');
    else if (delegatesScore >= 10) notesParts.push('Small event (100+ delegates)');
    
    // Generate problems
    const problems: string[] = [];
    if (contactScore === 0) problems.push('Missing contact information');
    else if (contactScore < 25) problems.push('Missing phone number');
    
    if (delegatesScore === 0) problems.push('No delegate count data');
    
    if (historyScore === 0 && regionScore === 0) problems.push('No Asia/Vietnam history');
    
    // Extract basic info from rawData
    const industry = rawData.INDUSTRY || rawData.Industry || rawData.industry || rawData.SERIES_SUBJECTS || '';
    const country = rawData.COUNTRY || rawData.Country || rawData.country || '';
    const city = rawData.CITY || rawData.City || rawData.city || '';
    const website = rawData.WEBSITE || rawData.Website || rawData.website || rawData.URL || '';
    
    // Extract contact info - PRIORITY: from org_contacts sheet, fallback to rawData
    let email = '';
    let phone = '';
    let keyPersonName = '';
    let keyPersonTitle = '';
    
    // First, try to get from relatedContacts (org_contacts sheet)
    if (relatedContacts.length > 0) {
      // Use first contact (or find the most relevant one - prefer contacts with email)
      // Sort contacts: prioritize those with email, then title, then name
      const sortedContacts = [...relatedContacts].sort((a, b) => {
        const aHasEmail = !!(a.Email || a.EMAIL || a.email);
        const bHasEmail = !!(b.Email || b.EMAIL || b.email);
        if (aHasEmail !== bHasEmail) return bHasEmail ? 1 : -1;
        
        const aHasTitle = !!(a.Title || a.TITLE || a.title);
        const bHasTitle = !!(b.Title || b.TITLE || b.title);
        if (aHasTitle !== bHasTitle) return bHasTitle ? 1 : -1;
        
        return 0;
      });
      
      const primaryContact = sortedContacts[0];
      
      console.log(`  └─ Extracting from contact, available keys:`, Object.keys(primaryContact).slice(0, 20).join(', '));
      
      // PRIORITY: Use normalized fields from excelImport.ts (FullName, Title, Email, Phone)
      // These are already combined from FirstName + MiddleName + LastName
      keyPersonName = primaryContact.FullName || primaryContact.FULLNAME || primaryContact.fullName || '';
      
      // If FullName not available, combine FirstName + MiddleName + LastName manually
      if (!keyPersonName) {
        const firstName = primaryContact.FirstName || primaryContact.FIRSTNAME || primaryContact.firstName || 
                         primaryContact['First Name'] || primaryContact['FIRST NAME'] || '';
        const middleName = primaryContact.MiddleName || primaryContact.MIDDLENAME || primaryContact.middleName || 
                          primaryContact['Middle Name'] || primaryContact['MIDDLE NAME'] || '';
        const lastName = primaryContact.LastName || primaryContact.LASTNAME || primaryContact.lastName || 
                        primaryContact['Last Name'] || primaryContact['LAST NAME'] || '';
        const nameParts = [firstName, middleName, lastName].filter(part => part && part.trim().length > 0);
        keyPersonName = nameParts.length > 0 ? nameParts.join(' ').trim() : '';
      }
      
      // Fallback to other name field variations if still empty
      if (!keyPersonName) {
        keyPersonName = primaryContact.NAME || primaryContact.Name || primaryContact.name || 
                       primaryContact.CONTACT_NAME || primaryContact.ContactName || primaryContact.contact_name ||
                       primaryContact.FULL_NAME || primaryContact.full_name ||
                       primaryContact['Name'] || primaryContact['NAME'] || primaryContact['Contact Name'] ||
                       primaryContact['Full Name'] || primaryContact['FULL NAME'] ||
                       primaryContact.keyPersonName || '';
      }
      
      // Extract title - PRIORITY: normalized Title field
      keyPersonTitle = primaryContact.Title || primaryContact.TITLE || primaryContact.title || 
                      primaryContact['Title'] || primaryContact['TITLE'] || '';
      
      // Fallback to other title field variations
      if (!keyPersonTitle) {
        keyPersonTitle = primaryContact.JOB_TITLE || primaryContact.JobTitle || primaryContact.job_title ||
                        primaryContact.POSITION || primaryContact.Position || primaryContact.position ||
                        primaryContact.ROLE || primaryContact.Role || primaryContact.role ||
                        primaryContact['Job Title'] || primaryContact['JOB TITLE'] ||
                        primaryContact['Position'] || primaryContact['POSITION'] ||
                        primaryContact.keyPersonTitle || '';
      }
      
      // Extract email - PRIORITY: normalized Email field
      email = primaryContact.Email || primaryContact.EMAIL || primaryContact.email || 
              primaryContact['Email'] || primaryContact['EMAIL'] || '';
      
      // Fallback to other email field variations
      if (!email) {
        email = primaryContact.CONTACT_EMAIL || primaryContact.ContactEmail || primaryContact.contact_email ||
                primaryContact.EMAIL_ADDRESS || primaryContact.EmailAddress || primaryContact.email_address ||
                primaryContact['Contact Email'] || primaryContact['CONTACT EMAIL'] ||
                primaryContact['E-mail'] || primaryContact['E-Mail'] || primaryContact['E-MAIL'] ||
                primaryContact.keyPersonEmail || '';
      }
      
      // Extract phone - PRIORITY: normalized Phone field
      phone = primaryContact.Phone || primaryContact.PHONE || primaryContact.phone || 
              primaryContact['Phone'] || primaryContact['PHONE'] || '';
      
      // Fallback to other phone field variations
      if (!phone) {
        phone = primaryContact.CONTACT_PHONE || primaryContact.ContactPhone || primaryContact.contact_phone ||
                primaryContact.TEL || primaryContact.Tel || primaryContact.tel ||
                primaryContact.TELEPHONE || primaryContact.Telephone || primaryContact.telephone ||
                primaryContact['Contact Phone'] || primaryContact['CONTACT PHONE'] ||
                primaryContact['Tel'] || primaryContact['TEL'] ||
                primaryContact.keyPersonPhone || '';
      }
      
      console.log(`  └─ Extracted from org_contacts: Name="${keyPersonName}", Email="${email}", Title="${keyPersonTitle}", Phone="${phone}"`);
      
      // If still empty, try to find any field that might contain email/name/title
      if (!email || !keyPersonName) {
        console.log(`  └─ ⚠️ Still missing data, checking all contact fields...`);
        Object.keys(primaryContact).forEach(key => {
          const value = String(primaryContact[key] || '').trim();
          if (!email && value.includes('@') && value.includes('.')) {
            email = value;
            console.log(`  └─ Found email in field "${key}": ${email}`);
          }
          if (!keyPersonName && value.length > 3 && /^[A-Z][a-z]+(\s+[A-Z][a-z]+)+$/.test(value)) {
            keyPersonName = value;
            console.log(`  └─ Found name in field "${key}": ${keyPersonName}`);
          }
        });
      }
    }
    
    // Fallback to rawData if not found in contacts
    if (!email) {
      email = rawData.EMAIL || rawData.Email || rawData.email || '';
    }
    if (!phone) {
      phone = rawData.PHONE || rawData.Phone || rawData.phone || '';
    }
    if (!keyPersonName) {
      keyPersonName = rawData.NAME || rawData.Name || rawData.name || 
                     rawData.CONTACT_NAME || rawData.ContactName || '';
    }
    if (!keyPersonTitle) {
      keyPersonTitle = rawData.TITLE || rawData.Title || rawData.title || 
                      rawData.JOB_TITLE || rawData.JobTitle || '';
    }
    
    // Get average delegates (more representative than max)
    const delegateValues: number[] = [];
    editions.forEach((edition: any) => {
      const delegates = Number(edition.TOTATTEND || edition.REGATTEND || edition.Delegates || 0);
      if (!isNaN(delegates) && delegates > 0) {
        delegateValues.push(delegates);
      }
    });
    const averageDelegates = delegateValues.length > 0 
      ? Math.round(delegateValues.reduce((acc, val) => acc + val, 0) / delegateValues.length)
      : 0;
    
    const notes = notesParts.length > 0 ? notesParts.join(', ') : 'Standard event';
    
    return {
      companyName: event.name,
      industry: industry || null,
      country: country || null,
      city: city || null,
      website: website || null,
      keyPersonName: keyPersonName || null,
      keyPersonTitle: keyPersonTitle || null,
      keyPersonEmail: email || null,
      keyPersonPhone: phone || null,
      vietnamEvents: finalVietnamEventsValue,
      totalEvents: editions.length || 1,
      numberOfDelegates: averageDelegates > 0 ? averageDelegates : null,
      totalScore: totalScore,
      historyScore: historyScore,
      regionScore: regionScore,
      contactScore: contactScore,
      delegatesScore: delegatesScore,
      problems: problems,
      notes: notes,
      pastEventsHistory: pastEventsHistory,
      nextStepStrategy: totalScore >= 50 ? 'High priority - Contact immediately' : totalScore >= 30 ? 'Medium priority - Follow up' : 'Low priority - Monitor',
      status: 'New'
    };
    } catch (error: any) {
      console.error(`❌ [Local Scoring] Error scoring event "${event?.name || 'unknown'}":`, error);
      console.error(`❌ [Local Scoring] Error message:`, error.message);
      console.error(`❌ [Local Scoring] Error stack:`, error.stack);
      throw error; // Re-throw to be caught by caller
    }
  };
  
  // Helper functions for scoring
  const calculateHistoryScore = (editions: any[]): number => {
    if (!editions || editions.length === 0) return 0;
    
    let vietnamCount = 0;
    let seaCount = 0;
    
    const seaCountries = ['vietnam', 'thailand', 'singapore', 'malaysia', 'indonesia', 'philippines', 'myanmar', 'cambodia', 'laos', 'brunei'];
    
    editions.forEach((edition: any) => {
      // ICCA format: COUNTRY, CITY are uppercase
      const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
      const city = String(edition.CITY || edition.City || edition.city || '').toLowerCase().trim();
      
      if (country === 'vietnam' || country === 'vn' || 
          city.includes('hanoi') || city.includes('ho chi minh') || city.includes('danang') || city.includes('saigon')) {
        vietnamCount++;
      } else if (seaCountries.includes(country)) {
        seaCount++;
      }
    });
    
    if (vietnamCount >= 1) return 25;
    if (seaCount >= 1) return 15;
    return 0;
  };
  
  const calculateRegionScore = (eventName: string, editions: any[]): number => {
    const nameLower = (eventName || '').toLowerCase();
    
    if (nameLower.includes('asean') || nameLower.includes('asia') || nameLower.includes('pacific') || nameLower.includes('apac') || nameLower.includes('eastern')) {
      return 25;
    }
    
    if (editions && editions.length > 0) {
      const asianCountries = ['china', 'japan', 'korea', 'india', 'thailand', 'singapore', 'malaysia', 'indonesia', 'philippines', 'vietnam', 'taiwan', 'hong kong', 'south korea', 'north korea', 'sri lanka', 'bangladesh', 'pakistan', 'myanmar', 'cambodia', 'laos', 'brunei'];
      
      for (const edition of editions) {
        const country = String(edition.COUNTRY || edition.Country || edition.country || '').toLowerCase().trim();
        // Use exact match or check if country string equals or starts with Asian country name
        // This avoids false positives like "united kingdom" matching "kingdom"
        if (asianCountries.some(ac => {
          // Exact match
          if (country === ac) return true;
          // Country name contains full Asian country name (e.g., "south korea" contains "korea")
          if (country.includes(ac) && ac.length >= 4) return true; // Only match if Asian country name is at least 4 chars to avoid short matches
          // Asian country name contains country (e.g., "hong kong" contains "hong")
          if (ac.includes(country) && country.length >= 4) return true;
          return false;
        })) {
          return 15;
        }
      }
    }
    
    return 0;
  };
  
  // Helper functions for validation
  const isValidEmail = (email: string): boolean => {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const isValidPhone = (phone: string): boolean => {
    if (!phone || typeof phone !== 'string') return false;
    const phoneStr = phone.trim();
    // Remove common phone formatting characters
    const cleaned = phoneStr.replace(/[\s\-\(\)\+]/g, '');
    // Check if it contains at least 7 digits (minimum for a valid phone number)
    return /^\d{7,}$/.test(cleaned);
  };

  const calculateContactScore = (eventData: any, relatedContacts: any[] = []): number => {
    let hasEmail = false;
    let hasPhone = false;
    let hasName = false;
    
    const emailFields = ['EMAIL', 'Email', 'email', 'keyPersonEmail', 'CONTACT_EMAIL'];
    const phoneFields = ['PHONE', 'Phone', 'phone', 'keyPersonPhone', 'CONTACT_PHONE', 'TEL'];
    const nameFields = ['keyPersonName', 'CONTACT_NAME', 'Name', 'Contact Name'];
    
    for (const field of emailFields) {
      const emailValue = eventData[field];
      if (emailValue && isValidEmail(String(emailValue))) {
        hasEmail = true;
        break;
      }
    }
    
    for (const field of phoneFields) {
      const phoneValue = eventData[field];
      if (phoneValue && isValidPhone(String(phoneValue))) {
        hasPhone = true;
        break;
      }
    }
    
    for (const field of nameFields) {
      const nameValue = eventData[field];
      if (nameValue && String(nameValue).trim().length > 0) {
        hasName = true;
        break;
      }
    }
    
    if (!hasEmail || !hasPhone || !hasName) {
      relatedContacts.forEach((contact: any) => {
        const contactEmail = contact.EMAIL || contact.Email || contact.email || contact.keyPersonEmail;
        const contactPhone = contact.PHONE || contact.Phone || contact.phone || contact.keyPersonPhone;
        const contactName = contact.NAME || contact.Name || contact.name || contact.keyPersonName;
        
        if (contactEmail && isValidEmail(String(contactEmail))) hasEmail = true;
        if (contactPhone && isValidPhone(String(contactPhone))) hasPhone = true;
        if (contactName && String(contactName).trim().length > 0) hasName = true;
      });
    }
    
    // Improved scoring: 25 = email+phone, 20 = email+name, 15 = email only, 10 = name only, 0 = nothing
    if (hasEmail && hasPhone) return 25;
    if (hasEmail && hasName) return 20;
    if (hasEmail) return 15;
    if (hasName) return 10;
    return 0;
  };
  
  const calculateDelegatesScore = (editions: any[]): number => {
    if (!editions || editions.length === 0) return 0;
    
    const delegateFields = ['TOTATTEND', 'REGATTEND', 'Delegates', 'Attendees', 'Attendance', 'DELEGATES', 'ATTENDEES'];
    
    const delegateValues: number[] = [];
    
    editions.forEach((edition: any) => {
      for (const field of delegateFields) {
        const value = edition[field];
        if (value !== null && value !== undefined) {
          const numValue = Number(value);
          if (!isNaN(numValue) && isFinite(numValue) && numValue > 0) {
            delegateValues.push(numValue);
            break; // Only count one value per edition
          }
        }
      }
    });
    
    if (delegateValues.length === 0) return 0;
    
    // Calculate average delegates (more representative than max)
    const sum = delegateValues.reduce((acc, val) => acc + val, 0);
    const averageDelegates = Math.round(sum / delegateValues.length);
    
    // Ariyana Convention Centre sweet spot: 200-800 delegates
    // Too small or too large events are penalized
    if (averageDelegates >= 200 && averageDelegates <= 800) {
      return 25; // Perfect fit for Ariyana capacity
    } else if ((averageDelegates >= 150 && averageDelegates < 200) || (averageDelegates > 800 && averageDelegates <= 1000)) {
      return 20; // Acceptable but not ideal
    } else if ((averageDelegates >= 100 && averageDelegates < 150) || (averageDelegates > 1000 && averageDelegates <= 1500)) {
      return 10; // Too small or too large
    } else {
      return 0; // Not suitable (<100 or >1500)
    }
  };
  
  const formatEventHistory = (editions: any[]): string => {
    if (!editions || editions.length === 0) {
      return '';
    }
    
    const historyItems: string[] = [];
    const countriesSet = new Set<string>();
    
    editions.forEach((edition: any) => {
      // Extract year - check multiple field names
      const year = extractFieldValue(edition, [
        'EDITYEARS', 'EditYears', 'edityears', 
        'STARTDATE', 'StartDate', 'startDate',
        'Year', 'YEAR', 'year',
        'Event Year', 'EVENT_YEAR',
        'Date', 'DATE', 'EVENT_DATE'
      ]);
      
      // Extract city
      const city = extractFieldValue(edition, [
        'CITY', 'City', 'city',
        'Location City', 'LOCATION_CITY',
        'Venue City', 'VENUE_CITY'
      ]);
      
      // Extract country - critical for rotation rule
      const country = extractFieldValue(edition, [
        'COUNTRY', 'Country', 'country',
        'Location Country', 'LOCATION_COUNTRY',
        'Venue Country', 'VENUE_COUNTRY'
      ]);
      
      // Extract delegates count - critical for size rule
      const delegates = extractFieldValue(edition, [
        'TOTATTEND', 'TotAttend', 'totattend',
        'REGATTEND', 'RegAttend', 'regattend',
        'Delegates', 'DELEGATES', 'delegates',
        'Attendees', 'ATTENDEES', 'attendees',
        'Attendance', 'ATTENDANCE'
      ]);
      
      // Track unique countries for rotation analysis
      if (country) {
        countriesSet.add(country.toLowerCase().trim());
      }
      
      // Format: "2023: City, Country (500 delegates)" or "2023: City, Country"
      let item = '';
      if (year) {
        item = year;
        if (city || country) {
          const location = [city, country].filter(Boolean).join(', ');
          item += `: ${location}`;
        }
        if (delegates) {
          item += ` (${delegates} onsite delegates)`;
        }
        historyItems.push(item);
      } else if (city || country) {
        const location = [city, country].filter(Boolean).join(', ');
        if (location) {
          historyItems.push(location);
        }
      }
    });
    
    // Add summary for AI: distinct countries count (critical for rotation rule)
    const historyString = historyItems.join('; ');
    const distinctCountries = Array.from(countriesSet);
    const countriesCount = distinctCountries.length;
    
    if (countriesCount > 0) {
      return `${historyString} | DISTINCT COUNTRIES: ${countriesCount} (${distinctCountries.join(', ')})`;
    }
    
    return historyString;
  };
  
  const extractFieldValue = (row: any, fieldNames: string[]): string | null => {
    for (const field of fieldNames) {
      if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 0) {
        return String(row[field]).trim();
      }
      
      const fieldKey = Object.keys(row).find(k =>
        k.toLowerCase() === field.toLowerCase() &&
        row[k] &&
        typeof row[k] === 'string' &&
        String(row[k]).trim().length > 0
      );
      
      if (fieldKey) {
        return String(row[fieldKey]).trim();
      }
      
      if (row[field] !== null && row[field] !== undefined) {
        const numValue = Number(row[field]);
        if (!isNaN(numValue) && isFinite(numValue)) {
          return String(numValue);
        }
      }
    }
    
    return null;
  };

  const analyzeSingleOrganization = async (orgData: string, orgName: string): Promise<any | null> => {
    console.log(`🔄 [Event Analysis] DISABLED - AI analysis disabled, using local scoring only`);
    
    // DISABLED: AI analysis temporarily disabled
    // Return null to indicate no AI analysis was performed
    // The scoring will be done by scoreEventLocally instead
    return null;
    
    /* DISABLED AI CODE - Keep for reference
    try {
      let result;
      let usedGPT = false;
      try {
        result = await GeminiService.generateStrategicAnalysis(orgData);
        console.log(`✅ [Organization Analysis] Gemini analysis successful for: ${orgName}`);
      } catch (geminiError: any) {
        console.warn(`⚠️  [Organization Analysis] Gemini failed for "${orgName}", falling back to GPT:`, geminiError.message);
        console.warn(`⚠️  [Organization Analysis] Gemini error details:`, JSON.stringify(geminiError, null, 2));
        
        try {
          console.log(`🟢 [Organization Analysis] Attempting GPT analysis for: ${orgName}`);
          result = await GPTService.generateStrategicAnalysis(orgData);
          usedGPT = true;
          console.log(`✅ [Organization Analysis] GPT analysis successful for: ${orgName}`);
        } catch (gptError: any) {
          console.error(`❌ [Organization Analysis] Both Gemini and GPT failed for "${orgName}":`, gptError.message);
          throw new Error(`Analysis failed: ${gptError.message || 'Unknown error'}`);
        }
      }
      const parsed = parseReport(result);
      
      if (parsed.partC && Array.isArray(parsed.partC) && parsed.partC.length > 0) {
        const leadResult = parsed.partC[0]; // Take first result
        
        // CRITICAL: Ensure AI returned the correct event name
        // If AI changed the event name, force it back to the original imported name
        const aiReturnedName = (leadResult.companyName || '').trim();
        const originalEventName = orgName.trim();
        
        // Check if AI returned a different event name
        const aiNameLower = aiReturnedName.toLowerCase();
        const originalNameLower = originalEventName.toLowerCase();
        
        // If names don't match (and it's not just a minor variation), use original name
        if (aiReturnedName && 
            aiNameLower !== originalNameLower && 
            !aiNameLower.includes(originalNameLower) && 
            !originalNameLower.includes(aiNameLower)) {
          console.warn(`⚠️  [Organization Analysis] AI returned different event name: "${aiReturnedName}" vs original "${originalEventName}". Using original name.`);
          leadResult.companyName = originalEventName; // Force correct name
          leadResult.notes = (leadResult.notes || '') + ` [Note: Event name corrected to match imported data]`;
        } else if (!aiReturnedName) {
          // If AI didn't return a name, use original
          leadResult.companyName = originalEventName;
        }
        
        const resultName = (leadResult.companyName || orgName).toLowerCase().trim();
        const normalizedName = orgName.toLowerCase().trim();
        
        // Update progress to completed - use case-insensitive matching
        setOrganizationProgress(prev => 
          prev.map(p => {
            const progressName = (p.companyName || '').toLowerCase().trim();
            if (progressName === normalizedName || 
                progressName === resultName ||
                progressName.includes(normalizedName) || 
                normalizedName.includes(progressName)) {
              return { ...p, status: 'completed' as const, result: leadResult, companyName: leadResult.companyName || orgName };
            }
            return p;
          })
        );
        
        return leadResult;
      }
      
      // If no JSON but we have result, mark as completed anyway
      const normalizedName = orgName.toLowerCase().trim();
      setOrganizationProgress(prev => 
        prev.map(p => {
          const progressName = (p.companyName || '').toLowerCase().trim();
          if (progressName === normalizedName || 
              progressName.includes(normalizedName) || 
              normalizedName.includes(progressName)) {
            return { ...p, status: 'completed' as const };
          }
          return p;
        })
      );
      
      return null;
    } catch (error: any) {
      console.error(`❌ [Organization Analysis] Error for ${orgName}:`, error);
      const normalizedName = orgName.toLowerCase().trim();
      
      // Extract error message
      let errorMessage = error.message || 'Unknown error occurred';
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
      
      // Check if it's a rate limit error
      if (isRateLimitError(error)) {
        const retryDelay = extractRetryDelay(error);
        if (retryDelay) {
          errorMessage = `Rate limit exceeded. Please wait ${retryDelay} seconds.`;
          // Set global rate limit countdown
          setRateLimitCountdown(retryDelay);
        } else {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        }
      }
      
      setOrganizationProgress(prev => 
        prev.map(p => {
          const progressName = (p.companyName || '').toLowerCase().trim();
          if (progressName === normalizedName || 
              progressName.includes(normalizedName) || 
              normalizedName.includes(progressName)) {
            return { ...p, status: 'error' as const, error: errorMessage };
          }
          return p;
        })
      );
      
      // Also set global error if this is a critical error
      if (isRateLimitError(error) || errorMessage.includes('quota') || errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        console.log('🔴 [Organization Analysis] Setting analysis error:', errorMessage);
        setAnalysisError(errorMessage);
      }
      
      // Re-throw error so it can be caught by handleAnalyze
      const errorToThrow: any = new Error(errorMessage);
      errorToThrow.isRateLimit = isRateLimitError(error);
      errorToThrow.retryDelay = extractRetryDelay(error);
      throw errorToThrow;
    }
  };

  // Parse organizations from Excel/CSV data
  // FIXME: This function has a paren/bracket mismatch causing JSX parse errors
  // Temporarily returning empty array until fixed
  const parseEventsFromData = (data: string, summary?: any): { name: string; data: string }[] => {
    return []; // TODO: Implement proper parsing
    /* COMMENTED OUT DUE TO SYNTAX ERROR
    const events: { name: string; data: string }[] = [];
    const seenNames = new Set<string>(); // Track seen event names to avoid duplicates
    
    // Try to extract from Excel preview if available (raw Excel rows)
    if (summary && summary.preview && Array.isArray(summary.preview)) {
      // Filter to only rows from "Editions" sheet (ICCA standard)
      const editionRows = summary.preview.filter((row: any) => {
        const sheetName = (row._sheet || '').toLowerCase();
        // Only include "Editions" sheet (ICCA standard) or sheets with "edition" or "event"
        return sheetName === 'editions' || 
               sheetName.includes('edition') ||
               (sheetName.includes('event') && !sheetName.includes('contact'));
      });
      
      console.log(`📊 [Parse Events] Filtered ${editionRows.length} rows from Editions sheet (out of ${summary.preview.length} total rows)`);
      
      editionRows.forEach((row: any, idx: number) => {
        // Try to find event name - ICCA uses "EVENT" or "SERIES" field in Editions sheet
        let eventName = null;
        
        // Check field names in priority order (ICCA uses "EVENT" or "SERIES" field)
        const nameFields = ['EVENT', 'Event Name', 'Event', 'Series', 'SERIES', 'Event Series', 'Name', 'Title', 'Conference Name'];
        
        for (const field of nameFields) {
          // Try exact match first
          if (row[field] && typeof row[field] === 'string' && row[field].trim().length > 2) {
            eventName = row[field].trim();
            break;
          }
          
          // Try case-insensitive match
          const fieldKey = Object.keys(row).find(k => 
            k.toLowerCase() === field.toLowerCase() && 
            row[k] && 
            typeof row[k] === 'string' && 
            row[k].trim().length > 2
          );
          if (fieldKey) {
            eventName = String(row[fieldKey]).trim();
            break;
          }
        }
        
        // If still not found, look for first meaningful string value
        if (!eventName) {
          for (const [key, value] of Object.entries(row)) {
            if (key !== '_sheet' && value && typeof value === 'string') {
              const strValue = String(value).trim();
              // Skip if it looks like metadata (ID, number, date, etc.)
              if (strValue.length > 3 && 
                  !strValue.match(/^\d+$/) && 
                  !strValue.match(/^\d{4}-\d{2}-\d{2}/) &&
                  !strValue.includes('Row') &&
                  !strValue.includes('Sheet')) {
                eventName = strValue;
                break;
              }
            }
          }
        }
        
        // If still not found, skip this row (don't use fallback)
        if (!eventName || eventName === 'N/A') {
          console.warn(`⚠️  [Parse Events] Row ${idx + 1}: No EVENT field found, skipping. Available fields:`, Object.keys(row));
          return;
        }
        
        // Check for duplicates (case-insensitive)
        const nameKey = eventName.toLowerCase().trim();
        if (seenNames.has(nameKey)) {
          console.warn(`⚠️  [Parse Events] Duplicate event skipped: "${eventName}"`);
          return;
        }
        seenNames.add(nameKey);
        
        // Build clean data string (without Row/Sheet prefix)
        const eventData = Object.entries(row)
          .filter(([key]) => key !== '_sheet')
          .map(([key, value]) => `${key}: ${value || 'N/A'}`)
          .join(', ');
        
        events.push({
          name: eventName,
          data: eventData
        });
      });
      
      console.log(`✅ [Parse Events] Found ${events.length} unique events:`, events.map(e => e.name).join(', '));
    }
    
    // If no preview or still empty, try to parse from text data format: "Row X (Sheet: Y): Field1: Value1, ..."
    if (events.length === 0 && data) {
      const lines = data.split('\n').filter(line => line.trim());
      
      lines.slice(0, 50).forEach((line, idx) => {
        // Parse format: "Row X (Sheet: Y): Field1: Value1, Field2: Value2, ..."
        const rowMatch = line.match(/Row \d+ \(Sheet: [^)]+\):\s*(.+)/);
        if (rowMatch) {
          const dataPart = rowMatch[1];
          const fields: { [key: string]: string } = {};
          
          // Parse "Field: Value" pairs
          dataPart.split(',').forEach(pair => {
            const match = pair.match(/([^:]+):\s*(.+)/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim();
              fields[key] = value;
            }
          });
          
          // Find event name from fields
          let eventName = null;
          const nameFields = ['EVENT', 'Event Name', 'Event', 'Series', 'SERIES', 'Event Series', 
                             'Name', 'Title', 'Conference Name', 'Congress Name'];
          
          for (const field of nameFields) {
            // Try exact match
            if (fields[field] && fields[field] !== 'N/A' && fields[field].length > 2) {
              eventName = fields[field];
              break;
            }
            
            // Try case-insensitive match
            const fieldKey = Object.keys(fields).find(k => 
              k.toLowerCase() === field.toLowerCase() && 
              fields[k] !== 'N/A' && 
              fields[k].length > 2
            );
            if (fieldKey) {
              eventName = fields[fieldKey];
              break;
            }
          }
          
          // If still not found, use first meaningful value
          if (!eventName) {
            for (const [key, value] of Object.entries(fields)) {
              if (value && value !== 'N/A' && 
                  !key.toLowerCase().includes('id') &&
                  !key.toLowerCase().includes('row') &&
                  !value.match(/^\d+$/) &&
                  value.length > 3) {
                eventName = value;
                break;
              }
            }
          }
          
          if (eventName && eventName.length > 2) {
            events.push({
              name: eventName,
              data: dataPart
            });
          }
        } else if (line.includes(',')) {
          // Try CSV format
          const values = line.split(',').map(v => v.trim());
          if (values.length > 0 && values[0] && values[0].length > 2 && !values[0].includes('Row')) {
            events.push({
              name: values[0],
              data: line
            });
          }
        }
      });
    }
    
    return events.slice(0, 50); // Limit to 50 events
    END OF COMMENTED CODE */
  };

  // Analyze a single batch of leads
  const analyzeBatch = async (leads: Lead[], batchIndex: number, totalBatches: number): Promise<any[]> => {
    const batchData = leads.map(l => {
      const parts = [
        l.companyName || 'Unknown',
        l.keyPersonName ? `Contact: ${l.keyPersonName}` : '',
        l.keyPersonEmail ? `Email: ${l.keyPersonEmail}` : '',
        l.keyPersonPhone ? `Phone: ${l.keyPersonPhone}` : '',
        `VN Events: ${l.vietnamEvents || 0}`,
        l.pastEventsHistory ? `History: ${l.pastEventsHistory}` : '',
        l.numberOfDelegates ? `Delegates: ${l.numberOfDelegates}` : '',
        l.industry ? `Industry: ${l.industry}` : '',
        l.country ? `Location: ${l.city || ''}, ${l.country}` : ''
      ].filter(p => p).join(' | ');
      return parts;
    }).join('\n');

    console.log(`🔄 [Batch ${batchIndex + 1}/${totalBatches}] Analyzing ${leads.length} leads...`);
    
    // Update progress for this batch
    leads.forEach(lead => {
      setOrganizationProgress(prev => {
        const leadNameLower = (lead.companyName || '').toLowerCase().trim();
        const existing = prev.find(p => {
          const pNameLower = (p.companyName || '').toLowerCase().trim();
          return pNameLower === leadNameLower;
        });
        if (!existing) {
          return [...prev, { companyName: lead.companyName, status: 'analyzing' }];
        }
        return prev.map(p => {
          const pNameLower = (p.companyName || '').toLowerCase().trim();
          return pNameLower === leadNameLower
            ? { ...p, status: 'analyzing' }
            : p;
        });
      });
    });

    // DISABLED: AI analysis temporarily disabled
    // Score each lead locally instead
    const results: any[] = [];
    
    try {
      for (const lead of leads) {
        // Parse pastEventsHistory to create editions array
        const editions: any[] = [];
        if (lead.pastEventsHistory) {
          // Parse format: "YEAR: City, Country; YEAR: City, Country"
          const historyParts = lead.pastEventsHistory.split(';').filter(p => p.trim());
          historyParts.forEach((part: string) => {
            const match = part.match(/(\d{4}):\s*(.+?),\s*(.+)/);
            if (match) {
              const [, year, city, country] = match;
              editions.push({
                YEAR: year.trim(),
                CITY: city.trim(),
                COUNTRY: country.trim(),
                TOTATTEND: lead.numberOfDelegates || null,
                REGATTEND: lead.numberOfDelegates || null,
              });
            }
          });
        }
        
        // If no editions but have numberOfDelegates, create a dummy edition for scoring
        if (editions.length === 0 && lead.numberOfDelegates) {
          editions.push({
            TOTATTEND: lead.numberOfDelegates,
            REGATTEND: lead.numberOfDelegates,
            COUNTRY: lead.country || '',
            CITY: lead.city || '',
          });
        }
        
        // Create a mock event object from lead data
        const mockEvent = {
          name: lead.companyName,
          data: [
            `Organization: ${lead.companyName}`,
            lead.industry ? `Industry: ${lead.industry}` : '',
            lead.country ? `Country: ${lead.country}` : '',
            lead.city ? `City: ${lead.city}` : '',
            lead.website ? `Website: ${lead.website}` : '',
            lead.keyPersonEmail ? `Email: ${lead.keyPersonEmail}` : '',
            lead.keyPersonPhone ? `Phone: ${lead.keyPersonPhone}` : '',
            lead.numberOfDelegates ? `Delegates: ${lead.numberOfDelegates}` : '',
          ].filter(Boolean).join(', '),
          editions: editions, // Use parsed editions from pastEventsHistory
          rawData: {
            INDUSTRY: lead.industry,
            COUNTRY: lead.country,
            CITY: lead.city,
            WEBSITE: lead.website,
            EMAIL: lead.keyPersonEmail,
            PHONE: lead.keyPersonPhone,
            TOTATTEND: lead.numberOfDelegates,
          },
          eventHistory: lead.pastEventsHistory || '',
          organizationName: lead.companyName,
          vietnamEvents: lead.vietnamEvents || 0,
        };
        
        // Score locally
        const scoredResult = await scoreEventLocally(mockEvent, '');
        
        // Update progress
        // Use case-insensitive matching to ensure we find the right progress entry
        setOrganizationProgress(prev => {
          const leadNameLower = (lead.companyName || '').toLowerCase().trim();
          return prev.map(p => {
            const pNameLower = (p.companyName || '').toLowerCase().trim();
            return pNameLower === leadNameLower
              ? { ...p, status: 'completed' as const, result: scoredResult }
              : p;
          });
        });
        
        results.push(scoredResult);
      }
      
      return results;
    } catch (error: any) {
      console.error(`❌ [Batch ${batchIndex + 1}] Error:`, error);
      leads.forEach(lead => {
        setOrganizationProgress(prev => {
          const leadNameLower = (lead.companyName || '').toLowerCase().trim();
          return prev.map(p => {
            const pNameLower = (p.companyName || '').toLowerCase().trim();
            return pNameLower === leadNameLower
              ? { ...p, status: 'error', error: error.message }
              : p;
          });
        });
      });
      return [];
    }
  };

  // Auto-fill missing data using AI research
  const handleAutoFillMissingData = async (lead: any, missingFields: string[], leadIndex: number) => {
    try {
      console.log(`🔍 [Auto-Fill] Starting research for: ${lead.companyName}`);
      console.log(`📝 [Auto-Fill] Missing fields:`, missingFields);
      
      // Mark as processing
      setCompletingDataMap(prev => {
        const newMap = new Map(prev);
        newMap.set(lead.companyName, true);
        return newMap;
      });
      
      // Call GPT API to enrich data (switched from Gemini due to quota limits)
      const result = await GPTService.enrichLeadData(
        lead.companyName || '',
        lead.keyPersonName || '',
        lead.city || ''
      );
      
      console.log(`✅ [Auto-Fill] Research completed for: ${lead.companyName}`);
      console.log(`📊 [Auto-Fill] Enrichment result:`, result);
      
      // Parse the enrichment result and update lead
      // The result.text contains structured information about the organization
      const enrichedText = result.text || '';
      
      // Update the lead with enriched data (update in extractedLeads state)
      setExtractedLeads(prev => {
        const newLeads = [...prev];
        if (newLeads[leadIndex]) {
          // Add enrichment note
          const enrichmentNote = `\n\n[AI Research Completed - ${new Date().toLocaleString()}]\n${enrichedText}`;
          newLeads[leadIndex] = {
            ...newLeads[leadIndex],
            notes: (newLeads[leadIndex].notes || '') + enrichmentNote,
            enrichedData: enrichedText,
            lastEnriched: new Date().toISOString(),
          };
        }
        return newLeads;
      });
      
      // Also update parsedReport.partC if available
      setParsedReport(prev => {
        if (!prev || !prev.partC) return prev;
        const newPartC = [...prev.partC];
        if (newPartC[leadIndex]) {
          const enrichmentNote = `\n\n[AI Research Completed - ${new Date().toLocaleString()}]\n${enrichedText}`;
          newPartC[leadIndex] = {
            ...newPartC[leadIndex],
            notes: (newPartC[leadIndex].notes || '') + enrichmentNote,
            enrichedData: enrichedText,
            lastEnriched: new Date().toISOString(),
          };
        }
        return { ...prev, partC: newPartC };
      });
      
      console.log(`✅ Research completed for ${lead.companyName}! Enriched data has been added to the event's notes section.`);
      
    } catch (error: any) {
      console.error(`❌ [Auto-Fill] Error for ${lead.companyName}:`, error);
    } finally {
      // Remove from processing
      setCompletingDataMap(prev => {
        const newMap = new Map(prev);
        newMap.delete(lead.companyName);
        return newMap;
      });
    }
  };

  const handleAnalyze = async () => {
    console.log('🔵 [Strategic Analysis] Starting analysis...');
    console.log('📊 [Strategic Analysis] Input mode:', inputMode);
    console.log('📊 [Strategic Analysis] Events list:', eventsList.length);
    console.log('🤖 [Scoring Method] Using BACKEND LOGIC (No AI)');
    console.log('📝 [Scoring Criteria] History(25) + Region(25) + Contact(25) + Delegates(25) = Total(100)');
    console.log('🎯 [Delegates Sweet Spot] Ariyana optimal capacity: 200-800 delegates');
    console.log('');

    setLoading(true);
    setAnalysisError(null); // Clear previous errors
    setReport('');
    setParsedReport(null);
    setExtractedLeads([]);
    setRateLimitCountdown(null);
    // DON'T reset organizationProgress - preserve existing scores
    // setOrganizationProgress([]);
    setIsBatchMode(false);
    
    const startTime = Date.now();
    
    try {
      // PRIORITY: If we have events from import (eventsList), analyze those first
      // This ensures imported Excel/CSV files are analyzed, not leads from database
      if (eventsList.length > 0) {
         console.log(`📥 [Strategic Analysis] Processing ${eventsList.length} events from imported file...`);
         
         // Save all events to database before analysis
         console.log('💾 [Event Save] Saving all events from import to database...');
         try {
           const eventsToSave: Lead[] = [];
           
           for (let i = 0; i < eventsList.length; i++) {
             const event = eventsList[i];
             try {
               // Extract basic data from event rawData
               const editions = (event as any).editions || [];
               const rawData = event.rawData || {};
               
               // Try to extract contact info from excelContacts if available
               const eventNameLower = event.name.toLowerCase().trim();
               let keyPersonName = '';
               let keyPersonTitle = '';
               let keyPersonEmail = '';
               let keyPersonPhone = '';
               
               // Find matching contact from excelContacts
               if (excelContacts && excelContacts.length > 0) {
                 const matchingContact = excelContacts.find((contact: any) => {
                   const contactOrgName = (contact.OrgName || contact.orgName || '').toLowerCase().trim();
                   return contactOrgName === eventNameLower;
                 });
                 
                 if (matchingContact) {
                   keyPersonName = matchingContact.FullName || matchingContact.fullName || 
                                   `${matchingContact.FirstName || ''} ${matchingContact.MiddleName || ''} ${matchingContact.LastName || ''}`.trim() || '';
                   keyPersonTitle = matchingContact.Title || matchingContact.title || '';
                   keyPersonEmail = matchingContact.Email || matchingContact.email || '';
                   keyPersonPhone = matchingContact.Phone || matchingContact.phone || '';
                 }
               }
               
               // Create lead from event data
               const newLead: Lead = {
                 id: 'imported_event_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 5),
                 companyName: event.name.trim(),
                 industry: rawData.Industry || rawData.industry || rawData.INDUSTRY || '',
                 country: rawData.Country || rawData.country || rawData.COUNTRY || '',
                 city: rawData.City || rawData.city || rawData.CITY || '',
                 website: rawData.Website || rawData.website || rawData.WEBSITE || '',
                 keyPersonName: keyPersonName || rawData['Key Person Name'] || rawData.keyPersonName || '',
                 keyPersonTitle: keyPersonTitle || rawData['Key Person Title'] || rawData.keyPersonTitle || '',
                 keyPersonEmail: keyPersonEmail || rawData['Key Person Email'] || rawData.keyPersonEmail || '',
                 keyPersonPhone: keyPersonPhone || rawData['Key Person Phone'] || rawData.keyPersonPhone || '',
                 keyPersonLinkedIn: rawData['Key Person LinkedIn'] || rawData.keyPersonLinkedIn || '',
                 totalEvents: editions.length || 1,
                 vietnamEvents: 0,
                 notes: '',
                 status: 'New',
                 pastEventsHistory: (event as any).eventHistory || '',
               };
               
               eventsToSave.push(newLead);
             } catch (error: any) {
               console.error(`❌ [Event Save] Error processing event "${event.name}":`, error);
               // Create a minimal lead even if extraction fails
               const minimalLead: Lead = {
                 id: 'imported_event_' + Date.now() + '_' + i + '_' + Math.random().toString(36).substr(2, 5),
                 companyName: event.name.trim(),
                 industry: '',
                 country: '',
                 city: '',
                 website: '',
                 keyPersonName: '',
                 keyPersonTitle: '',
                 keyPersonEmail: '',
                 keyPersonPhone: '',
                 keyPersonLinkedIn: '',
                 totalEvents: 1,
                 vietnamEvents: 0,
                 notes: '',
                 status: 'New',
               };
               eventsToSave.push(minimalLead);
             }
           }
           
           // Save all events to database
           if (eventsToSave.length > 0) {
             console.log(`💾 [Event Save] Saving ${eventsToSave.length} events to database...`);
             await onSaveToLeads(eventsToSave);
             console.log(`✅ [Event Save] Successfully saved ${eventsToSave.length} events to database`);
           }
         } catch (error: any) {
           console.error('❌ [Event Save] Error saving events to database:', error);
           // Continue with analysis even if save fails
         }
           
           // Initialize progress tracking - preserve existing completed results
           setOrganizationProgress(prev => {
             // Create a map of existing completed results
             const existingResults = new Map<string, OrganizationProgress>();
             prev.forEach(p => {
               if (p.status === 'completed' && p.result) {
                 const key = (p.companyName || '').toLowerCase().trim();
                 existingResults.set(key, p);
               }
             });
             
             // Initialize progress for all events, preserving existing completed results
             const initialProgress: OrganizationProgress[] = eventsList.map(event => {
               const eventKey = (event.name || '').toLowerCase().trim();
               const existing = existingResults.get(eventKey);
               
               // If we have an existing completed result, keep it
               if (existing && existing.status === 'completed' && existing.result) {
                 return existing; // Preserve existing score and result
               }
               
               // Otherwise, create new analyzing entry
               return {
                 companyName: event.name,
                 status: 'analyzing'
               };
             });
             
             return initialProgress;
           });
           setIsBatchMode(true);
           
          // Process events one by one and display results immediately
          const allResults: any[] = [];
          let skippedCount = 0; // Track events skipped due to not being ICCA qualified
          
          // Initialize skeleton loading for all events
          setAnalyzingEvents(new Set(eventsList.map(e => e.name)));
          setCompletedLeadsMap(new Map());
           
          // Multi-Agent System: Each event gets assigned to a dedicated agent worker
          const MAX_AGENTS = 10; // Number of concurrent agent workers
          const MAX_EVENTS = 200; // Limit total events to analyze (increased from 50 to handle more events)
          const eventsToProcess = eventsList.slice(0, MAX_EVENTS);
          
          console.log(`🤖 [Multi-Agent System] Deploying ${Math.min(MAX_AGENTS, eventsToProcess.length)} agents to process ${eventsToProcess.length} events`);
          
          // Agent Worker Function: Each agent processes one event independently
          const createAgentWorker = async (event: any, agentId: number, globalIndex: number): Promise<any> => {
            console.log(`🤖 [Agent ${agentId}] Processing event: ${event.name} (${globalIndex + 1}/${eventsToProcess.length})`);
            
            // Ensure status is set to 'analyzing' when agent starts processing
            // Use case-insensitive matching to ensure we find the right progress entry
            setOrganizationProgress(prev => prev.map(p => {
              const pNameLower = (p.companyName || '').toLowerCase().trim();
              const eventNameLower = (event.name || '').toLowerCase().trim();
              if (pNameLower === eventNameLower && p.status !== 'analyzing') {
                return { ...p, status: 'analyzing' };
              }
              return p;
            }));
            
            const editions = (event as any).editions || [];
            console.log(`📊 [Agent ${agentId}] Event has ${editions.length} editions`);
            
            try {
              // STEP 1: Score event using backend logic (NO AI)
              console.log(`📊 [Agent ${agentId}] Scoring event using backend logic: ${event.name}`);
              console.log(`📊 [Agent ${agentId}] Excel data available: ${allExcelData ? `${allExcelData.length} chars` : 'NO'}`);
              console.log(`📊 [Agent ${agentId}] Contacts available: ${excelContacts?.length || 0}`);
              
              // Validate required data
              if (!event || !event.name) {
                throw new Error('Event is missing or has no name');
              }
              
              const result = await scoreEventLocally(event, allExcelData);
              
              if (!result) {
                throw new Error('scoreEventLocally returned null/undefined');
              }
              
              if (result) {
                const originalEventName = event.name.trim();
                
                // Create eventBrief with default values (NO AI research)
                const eventBrief = {
                  breakoutRooms: result.numberOfDelegates ? 
                    (result.numberOfDelegates >= 1000 ? "15+ rooms" : 
                     result.numberOfDelegates >= 500 ? "8-12 rooms" : 
                     result.numberOfDelegates >= 300 ? "5-7 rooms" : "3-5 rooms") : "",
                  roomSizes: result.numberOfDelegates ? 
                    (result.numberOfDelegates >= 1000 ? "500-800 sqm main hall, 100-150 sqm breakout rooms" : 
                     result.numberOfDelegates >= 500 ? "300-500 sqm main hall, 80-120 sqm breakout rooms" : 
                     "200-300 sqm main hall, 50-80 sqm breakout rooms") : "",
                  openYear: null,
                  localHostName: "",
                  localHostTitle: "",
                  localHostEmail: "",
                  localHostPhone: "",
                  localHostOrganization: "",
                  localHostWebsite: "",
                  localStrengths: "",
                  layout: "",
                  conferenceRegistration: "",
                  infoOnLastUpcomingEvents: "",
                  competitors: "",
                  sponsors: "",
                  iccaQualified: "no"
                };
                
                const newLead = {
                  ...result,
                  id: 'imported_' + Date.now() + Math.random().toString(36).substr(2, 5) + '_' + globalIndex,
                  totalEvents: result.totalEvents || editions.length || 1,
                  vietnamEvents: result.vietnamEvents || 0,
                  status: result.status || 'New',
                  companyName: originalEventName, // Always use original event name
                  pastEventsHistory: result.pastEventsHistory || (event as any).eventHistory || '',
                  editions: editions, // Include editions for history display
                  agentId: agentId, // Track which agent processed this
                  eventBrief: eventBrief, // Include default eventBrief data
                  // Also add top-level fields from eventBrief for backward compatibility
                  openYear: eventBrief.openYear,
                  breakoutRooms: eventBrief.breakoutRooms,
                  roomSizes: eventBrief.roomSizes,
                  localStrengths: eventBrief.localStrengths,
                  competitors: eventBrief.competitors,
                  sponsors: eventBrief.sponsors,
                  layout: eventBrief.layout,
                  iccaQualified: eventBrief.iccaQualified
                };
                
                // VALIDATION: Check for email and key person name
                // NOTE: We allow events even if missing these fields - they can be enriched later
                // Only log warning, don't reject
                console.log(`🔍 [Agent ${agentId}] Validating fields for: ${event.name}`);
                const hasEmail = newLead.keyPersonEmail && newLead.keyPersonEmail.trim() !== '';
                const hasKeyPersonName = newLead.keyPersonName && newLead.keyPersonName.trim() !== '';
                
                if (!hasEmail || !hasKeyPersonName) {
                  console.log(`⚠️  [Agent ${agentId}] Event "${event.name}" missing some fields (will still be included)`);
                  console.log(`   Email: ${hasEmail ? '✅' : '❌'}, KeyPersonName: ${hasKeyPersonName ? '✅' : '❌'}`);
                  console.log(`   Note: Event will be included but may need data enrichment`);
                  
                  // Add to problems array if missing
                  if (!hasEmail) {
                    if (!newLead.problems) newLead.problems = [];
                    if (!newLead.problems.includes('Missing email')) {
                      newLead.problems.push('Missing email');
                    }
                  }
                  if (!hasKeyPersonName) {
                    if (!newLead.problems) newLead.problems = [];
                    if (!newLead.problems.includes('Missing key person name')) {
                      newLead.problems.push('Missing key person name');
                    }
                  }
                }
                
                // Log event history
                console.log(`📊 [Agent ${agentId}] Event history for "${event.name}":`, newLead.pastEventsHistory);
                console.log(`📊 [Agent ${agentId}] Total editions: ${editions.length}`);
                console.log(`✅ [Agent ${agentId}] Completed scoring for: ${event.name} (Score: ${result.totalScore})`);
                console.log(`✅ [Agent ${agentId}] Validation passed - Email: ${newLead.keyPersonEmail}, KeyPerson: ${newLead.keyPersonName}`);
                
                // CRITICAL: Update organizationProgress to 'completed' status
                // Use case-insensitive matching to ensure we find the right progress entry
                // Preserve existing score if new score is 0 or invalid
                setOrganizationProgress(prev => prev.map(p => {
                  const pNameLower = (p.companyName || '').toLowerCase().trim();
                  const eventNameLower = (event.name || '').toLowerCase().trim();
                  if (pNameLower === eventNameLower) {
                    const newScore = newLead.totalScore || 0;
                    const existingScore = p.result?.totalScore || 0;
                    
                    // If new score is 0 but we have an existing valid score, preserve the existing result
                    if (newScore === 0 && existingScore > 0) {
                      console.log(`⚠️  [Agent ${agentId}] New score is 0, preserving existing score ${existingScore} for: ${event.name}`);
                      return { ...p, status: 'completed' }; // Keep existing result
                    }
                    
                    console.log(`✅ [Agent ${agentId}] Updating progress to 'completed' for: ${event.name} (Score: ${newScore})`);
                    return { ...p, status: 'completed', result: newLead };
                  }
                  return p;
                }));
                
                // Update completed leads map - this will replace skeleton with actual result
                setCompletedLeadsMap(prev => {
                  const newMap = new Map(prev);
                  newMap.set(event.name, newLead);
                  return newMap;
                });
                
                // Remove from analyzing set
                setAnalyzingEvents(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(event.name);
                  return newSet;
                });
                
                return { success: true, lead: newLead, agentId, eventName: event.name };
              }
              
              // If no result returned, mark as error
              // Use case-insensitive matching to ensure we find the right progress entry
              setOrganizationProgress(prev => prev.map(p => {
                const pNameLower = (p.companyName || '').toLowerCase().trim();
                const eventNameLower = (event.name || '').toLowerCase().trim();
                if (pNameLower === eventNameLower) {
                  return { ...p, status: 'error', error: 'No result returned from scoring' };
                }
                return p;
              }));
              
              setAnalyzingEvents(prev => {
                const newSet = new Set(prev);
                newSet.delete(event.name);
                return newSet;
              });
              
              return { success: false, agentId, eventName: event.name, error: 'No result returned' };
            } catch (eventError: any) {
              console.error(`❌ [Agent ${agentId}] Failed to score event ${event.name}:`, eventError);
              
              // Extract error message
              let errorMsg = eventError.message || 'Unknown error occurred';
              if (eventError.error?.message) {
                errorMsg = eventError.error.message;
              }
              
              // CRITICAL: Update organizationProgress to clear 'analyzing' status
              // Use case-insensitive matching to ensure we find the right progress entry
              setOrganizationProgress(prev => prev.map(p => {
                const pNameLower = (p.companyName || '').toLowerCase().trim();
                const eventNameLower = (event.name || '').toLowerCase().trim();
                if (pNameLower === eventNameLower) {
                  return { ...p, status: 'error', error: errorMsg };
                }
                return p;
              }));
              
              // Remove from analyzing set
              setAnalyzingEvents(prev => {
                const newSet = new Set(prev);
                newSet.delete(event.name);
                return newSet;
              });
              
              // Check if it's a rate limit error
              if (isRateLimitError(eventError) || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
                const retryDelay = extractRetryDelay(eventError) || eventError.retryDelay;
                if (retryDelay) {
                  setRateLimitCountdown(retryDelay);
                  const rateLimitMsg = `Rate limit exceeded while analyzing "${event.name}". Please wait ${retryDelay} seconds before trying again.`;
                  console.log(`🔴 [Agent ${agentId}] Rate limit error:`, rateLimitMsg);
                  setAnalysisError(rateLimitMsg);
                } else {
                  const rateLimitMsg = `Rate limit exceeded while analyzing "${event.name}". Please try again later.`;
                  console.log(`🔴 [Agent ${agentId}] Rate limit error:`, rateLimitMsg);
                  setAnalysisError(rateLimitMsg);
                }
                return { success: false, agentId, eventName: event.name, error: errorMsg, isRateLimit: true };
              } else {
                // For other errors, log but continue
                const genericErrorMsg = `Error analyzing "${event.name}": ${errorMsg}`;
                console.log(`🔴 [Agent ${agentId}] Error:`, genericErrorMsg);
                setAnalysisError(genericErrorMsg);
                return { success: false, agentId, eventName: event.name, error: errorMsg };
              }
            } finally {
              // CRITICAL: Ensure status is cleared even if there's an unexpected error
              // This is a safety net to prevent stuck "Analyzing" status
              // Use case-insensitive matching to ensure we find the right progress entry
              setOrganizationProgress(prev => prev.map(p => {
                const pNameLower = (p.companyName || '').toLowerCase().trim();
                const eventNameLower = (event.name || '').toLowerCase().trim();
                if (pNameLower === eventNameLower && p.status === 'analyzing') {
                  // Only update if still in analyzing state (not already completed/error)
                  // This prevents overwriting completed/error status
                  if (!p.result && !p.error) {
                    return { ...p, status: 'error', error: 'Analysis was interrupted' };
                  }
                }
                return p;
              }));
            }
          };
          
          // Agent Pool Manager: Process events in batches, each event assigned to one agent
          // Each agent works independently on its assigned event
          const processWithAgentPool = async () => {
            // Split events into batches for agent pool
            for (let batchStart = 0; batchStart < eventsToProcess.length; batchStart += MAX_AGENTS) {
              const batchEnd = Math.min(batchStart + MAX_AGENTS, eventsToProcess.length);
              const batch = eventsToProcess.slice(batchStart, batchEnd);
              
              console.log(`🤖 [Agent Pool Batch ${Math.floor(batchStart / MAX_AGENTS) + 1}] Deploying ${batch.length} agents...`);
              
              // Each event in batch gets its own agent
              const agentPromises = batch.map((event, batchIndex) => {
                const globalIndex = batchStart + batchIndex;
                const agentId = (globalIndex % MAX_AGENTS) + 1;
                return createAgentWorker(event, agentId, globalIndex);
              });
              
              // Wait for all agents in this batch to complete
              const batchResults = await Promise.allSettled(agentPromises);
              
              // Process results as they come in
              batchResults.forEach((settled, index) => {
                if (settled.status === 'fulfilled') {
                  const result = settled.value;
                  if (result.skipped) {
                    skippedCount++;
                    console.log(`⏭️  [Agent Pool] Event "${result.eventName}" skipped: ${result.reason || 'Not ICCA qualified'}`);
                    // Update progress for skipped events
                    // Use case-insensitive matching to ensure we find the right progress entry
                    setOrganizationProgress(prev => {
                      const batchNameLower = (batch[index].name || '').toLowerCase().trim();
                      return prev.map(p => {
                        const pNameLower = (p.companyName || '').toLowerCase().trim();
                        return pNameLower === batchNameLower
                          ? { ...p, status: 'error', error: result.reason || 'Skipped' }
                          : p;
                      });
                    });
                    setAnalyzingEvents(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(batch[index].name);
                      return newSet;
                    });
                  } else if (result.success && result.lead) {
                    // NOTE: ICCA qualification is NOT mandatory - add all events to results
                    // ICCA status will be displayed for reference but won't filter events
                    // Events are selected based on score, not ICCA qualification
                    
                    console.log(`✅ [Agent Pool] Event "${result.eventName}" ADDED - Score: ${result.lead.totalScore || 0}`);
                    
                    allResults.push(result.lead);
                    
                    // Update extracted leads immediately
                    setExtractedLeads(prev => [...prev, result.lead]);
                    
                    // Update completed leads map
                    setCompletedLeadsMap(prev => {
                      const newMap = new Map(prev);
                      newMap.set(batch[index].name, result.lead);
                      return newMap;
                    });
                    
                    // CRITICAL: Update organizationProgress to 'completed' status
                    // Use case-insensitive matching to ensure we find the right progress entry
                    // Preserve existing score if new score is 0 or invalid
                    setOrganizationProgress(prev => prev.map(p => {
                      const pNameLower = (p.companyName || '').toLowerCase().trim();
                      const batchNameLower = (batch[index].name || '').toLowerCase().trim();
                      if (pNameLower === batchNameLower) {
                        const newScore = result.lead.totalScore || 0;
                        const existingScore = p.result?.totalScore || 0;
                        
                        // If new score is 0 but we have an existing valid score, preserve the existing result
                        if (newScore === 0 && existingScore > 0) {
                          console.log(`⚠️  [Agent Pool] New score is 0, preserving existing score ${existingScore} for: ${batch[index].name}`);
                          return { ...p, status: 'completed' }; // Keep existing result
                        }
                        
                        console.log(`✅ [Agent Pool] Updating progress to 'completed' for: ${batch[index].name} (Score: ${newScore})`);
                        return { ...p, status: 'completed', result: result.lead };
                      }
                      return p;
                    }));
                    
                    // Remove from analyzing set
                    setAnalyzingEvents(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(batch[index].name);
                      return newSet;
                    });
                    
                    // DISABLED: Auto-fill missing data with AI research
                    // Research is now manual - user must click Research button
                    // (async () => {
                    //   ... auto-research code removed ...
                    // })();
                  } else if (result.isRateLimit) {
                    console.error(`❌ [Agent Pool] Rate limit hit by Agent ${result.agentId}`);
                    setAnalysisError(`Rate limit exceeded. Please wait before retrying.`);
                    // Update progress for rate limit error
                    setOrganizationProgress(prev => prev.map(p => 
                      p.companyName === batch[index].name 
                        ? { ...p, status: 'error', error: 'Rate limit exceeded' }
                        : p
                    ));
                  } else if (!result.success) {
                    // Handle other failures
                    setOrganizationProgress(prev => prev.map(p => 
                      p.companyName === batch[index].name 
                        ? { ...p, status: 'error', error: result.error || 'Analysis failed' }
                        : p
                    ));
                  }
                } else {
                  console.error(`❌ [Agent Pool] Agent failed:`, settled.reason);
                  // Update progress for rejected promises
                  const eventName = batch[index]?.name;
                  if (eventName) {
                    setOrganizationProgress(prev => prev.map(p => 
                      p.companyName === eventName 
                        ? { ...p, status: 'error', error: settled.reason?.message || 'Agent promise rejected' }
                        : p
                    ));
                    setAnalyzingEvents(prev => {
                      const newSet = new Set(prev);
                      newSet.delete(eventName);
                      return newSet;
                    });
                  }
                }
              });
              
              // Generate and display report after each batch
              if (allResults.length > 0 || skippedCount > 0) {
                const currentReport = generateFinalReport(allResults, eventsToProcess.length, skippedCount);
                const currentParsed = parseReport(currentReport);
                
                setParsedReport(currentParsed);
                setReport(currentReport);
              }
              
              console.log(`✅ [Agent Pool Batch ${Math.floor(batchStart / MAX_AGENTS) + 1}] Completed: ${batchResults.filter(r => r.status === 'fulfilled' && r.value.success).length}/${batch.length} successful`);
              
              // Small delay between batches to avoid overwhelming the API
              if (batchEnd < eventsToProcess.length) {
                await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
          };
          
          await processWithAgentPool();
          
          console.log(`🎉 [Agent Pool] Completed: ${allResults.length}/${eventsToProcess.length} events processed successfully`);
          
          if (eventsList.length > MAX_EVENTS) {
            console.log(`⚠️  [Agent Pool] Limited analysis to first ${MAX_EVENTS} events (out of ${eventsList.length} total)`);
          }
           
           // Final report is already generated and displayed incrementally above
           // Just log final summary
           if (allResults.length > 0) {
             console.log('📊 [Strategic Analysis] Final summary:', {
               totalEvents: eventsList.length,
               analyzedEvents: allResults.length,
               parsedReport: parsedReport ? {
                 hasPartA: !!parsedReport.partA,
                 hasPartB: !!parsedReport.partB,
                 hasPartC: !!parsedReport.partC,
                 partCLength: Array.isArray(parsedReport.partC) ? parsedReport.partC.length : 0,
               } : null
             });
           } else if (allResults.length === 0 && eventsList.length > 0) {
             // Check if events were processed but no results
             const totalProcessed = allResults.length + skippedCount;
             if (totalProcessed < eventsList.length) {
               // Some events were not processed - potential error
               const errorMsg = `Analysis completed but only ${totalProcessed}/${eventsList.length} events were processed. Please check the console for details.`;
               console.error('❌ [Strategic Analysis]', errorMsg);
               if (!analysisError) {
                 setAnalysisError(errorMsg);
               }
             } else {
               // All events processed but no results - this shouldn't happen
               const errorMsg = 'Analysis completed but no results were generated. Please check the console for details.';
               console.error('❌ [Strategic Analysis]', errorMsg);
               if (!analysisError) {
                 setAnalysisError(errorMsg);
               }
             }
           }
           
           const totalTime = Date.now() - startTime;
           console.log(`🎉 [Strategic Analysis] Analysis completed: ${allResults.length}/${eventsList.length} events analyzed in ${(totalTime / 1000).toFixed(2)}s`);
           
           // Auto-save to database after analysis completes
           if (allResults.length > 0) {
             console.log('💾 [Auto-Save] Auto-saving analyzed leads to database...');
             try {
               await onSaveToLeads(allResults);
               console.log('✅ [Auto-Save] Successfully auto-saved', allResults.length, 'leads to database');
               
               // Mark all saved events
               const savedNames = new Set(allResults.map(r => r.companyName?.toLowerCase().trim()).filter(Boolean));
               setSavedToDatabase(prev => {
                 const newSet = new Set(prev);
                 savedNames.forEach(name => newSet.add(name));
                 return newSet;
               });
             } catch (error: any) {
               console.error('❌ [Auto-Save] Error auto-saving leads:', error);
               // Don't show alert for auto-save errors, just log
             }
           }
           
           setLoading(false);
           return;
      } else {
        // No events found - request user to upload file
        console.log('⚠️  [Strategic Analysis] No events to analyze. Please upload an Excel/CSV file.');
        setAnalysisError('Please upload an Excel/CSV file to analyze events.');
        setLoading(false);
        return;
      }
    } catch (e: any) {
      const totalTime = Date.now() - startTime;
      console.error('❌ [Strategic Analysis] Analysis failed after', (totalTime / 1000).toFixed(2), 's');
      console.error('❌ [Strategic Analysis] Error details:', e);
      console.error('❌ [Strategic Analysis] Error message:', e.message);
      console.error('❌ [Strategic Analysis] Error stack:', e.stack);
      
      // Extract error message
      let errorMsg = e.message || 'Unknown error occurred';
      if (e.error?.message) {
        errorMsg = e.error.message;
      }
      
      if (isRateLimitError(e) || errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        console.warn('⚠️  [Strategic Analysis] Rate limit error detected');
        const retryDelay = extractRetryDelay(e) || e.retryDelay;
        if (retryDelay) {
          console.log(`⏳ [Strategic Analysis] Rate limit retry delay: ${retryDelay}s`);
          setRateLimitCountdown(retryDelay);
          const rateLimitMsg = `Rate limit exceeded. Please wait ${retryDelay} seconds before trying again.`;
          console.log('🔴 [Strategic Analysis] Setting rate limit error:', rateLimitMsg);
          setAnalysisError(rateLimitMsg);
        } else {
          console.error('❌ [Strategic Analysis] Rate limit exceeded, no retry delay provided');
          const rateLimitMsg = 'Rate limit exceeded. Please try again later.';
          console.log('🔴 [Strategic Analysis] Setting rate limit error:', rateLimitMsg);
          setAnalysisError(rateLimitMsg);
        }
      } else {
        // For other errors, also show them
        const genericErrorMsg = `Analysis failed: ${errorMsg}`;
        console.log('🔴 [Strategic Analysis] Setting generic error:', genericErrorMsg);
        setAnalysisError(genericErrorMsg);
      }
    } finally {
      setLoading(false);
      console.log('🏁 [Strategic Analysis] Analysis process finished');
    }
  };

  const handleSaveLeads = async () => {
    if (extractedLeads.length === 0) return;
    
    try {
      setSaving(true);
      console.log('💾 Saving', extractedLeads.length, 'leads to database...');
      await onSaveToLeads(extractedLeads);
      console.log('✅ Successfully saved', extractedLeads.length, 'leads to database');
      
      // Refresh existing leads if in 'existing' mode
      if (inputMode === 'existing') {
        const fetchedLeads = await leadsApi.getAll();
        const mappedLeads = fetchedLeads.map(mapLeadFromDB);
        setExistingLeads(mappedLeads);
      }
      
      setExtractedLeads([]);
      setReport(''); // Clear report after saving
      setParsedReport(null); // Clear parsed report
    } catch (error: any) {
      console.error('❌ Error saving leads:', error);
    } finally {
      setSaving(false);
    }
  };

  // Research edition leadership with batching
  const researchEditionsLeadership = async (eventName: string, editions: any[]) => {
    if (!editions || editions.length === 0) return;

    console.log(`🔍 [Edition Research] Starting research for ${editions.length} editions of ${eventName}`);

    const BATCH_SIZE = 3; // Research 3 editions at a time
    const BATCH_DELAY = 2000; // 2 second delay between batches

    for (let i = 0; i < editions.length; i += BATCH_SIZE) {
      const batch = editions.slice(i, i + BATCH_SIZE);
      console.log(`🔄 [Edition Research] Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(editions.length / BATCH_SIZE)}`);

      // Research batch in parallel
      const researchPromises = batch.map(async (edition: any, batchIdx: number) => {
        const globalIdx = i + batchIdx;
        
        // Extract edition info
        const startDate = edition.STARTDATE || edition.StartDate || edition.startDate || '';
        const editionYear = edition.EDITYEARS || edition.EditYears || edition.edityears || '';
        const year = editionYear || startDate || '';
        
        const seriesName = edition.SeriesName || edition.SERIESNAME || edition.seriesName || '';
        const seriesEdition = edition.SeriesEditions || edition.SERIESEDITIONS || edition.seriesEditions || edition.Sequence || edition.SEQUENCE || '';
        const editionName = seriesEdition ? `${seriesEdition} ${seriesName}` : seriesName;
        
        const city = edition.CITY || edition.City || edition.city || '';
        const country = edition.COUNTRY || edition.Country || edition.country || '';

        // Create cache key
        const cacheKey = `${eventName}_${year}_${city}_${country}`;

        // Check cache first
        if (editionResearchCache.has(cacheKey)) {
          console.log(`✅ [Edition Research] Cache hit for edition ${globalIdx + 1}`);
          return { idx: globalIdx, cached: true, ...editionResearchCache.get(cacheKey)! };
        }

        // Mark as researching
        setResearchingEditions(prev => new Set(prev).add(cacheKey));

        try {
          console.log(`🔍 [Edition Research] Researching edition ${globalIdx + 1}: ${year} ${city}`);
          
          const result = await GPTService.researchEditionLeadership(
            eventName,
            editionName,
            year,
            city,
            country
          );

          // Update cache
          setEditionResearchCache(prev => {
            const newCache = new Map(prev);
            newCache.set(cacheKey, {
              chairman: result.organizingChairman || '',
              secretary: result.secretaryGeneral || ''
            });
            return newCache;
          });

          // Update parsedReport to trigger UI re-render
          setParsedReport(prev => {
            if (!prev || !prev.partC) return prev;
            
            const newPartC = prev.partC.map((l: any) => {
              if (l.companyName === eventName && l.editions) {
                const newEditions = [...l.editions];
                if (newEditions[globalIdx]) {
                  newEditions[globalIdx] = {
                    ...newEditions[globalIdx],
                    aiChairman: result.organizingChairman || '',
                    aiSecretary: result.secretaryGeneral || '',
                    aiResearched: true
                  };
                }
                return { ...l, editions: newEditions };
              }
              return l;
            });
            
            return { ...prev, partC: newPartC };
          });

          // Remove from researching
          setResearchingEditions(prev => {
            const newSet = new Set(prev);
            newSet.delete(cacheKey);
            return newSet;
          });

          console.log(`✅ [Edition Research] Edition ${globalIdx + 1} complete - Chairman: ${result.organizingChairman || 'N/A'}, Secretary: ${result.secretaryGeneral || 'N/A'}`);
          return { idx: globalIdx, ...result };
        } catch (error: any) {
          console.error(`❌ [Edition Research] Edition ${globalIdx + 1} failed:`, error);
          
          // Remove from researching
          setResearchingEditions(prev => {
            const newSet = new Set(prev);
            newSet.delete(cacheKey);
            return newSet;
          });

          return { idx: globalIdx, organizingChairman: '', secretaryGeneral: '', confidence: 'low' };
        }
      });

      // Wait for batch to complete
      await Promise.allSettled(researchPromises);

      // Delay before next batch (except for last batch)
      if (i + BATCH_SIZE < editions.length) {
        console.log(`⏳ [Edition Research] Waiting ${BATCH_DELAY}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
      }
    }

    console.log(`✅ [Edition Research] Completed research for all ${editions.length} editions`);
  };

  const handleExportEventBrief = async (lead: any) => {
    try {
      console.log('📄 Exporting Event Brief for:', lead.companyName);
      
      const response = await fetch('/api/v1/event-brief/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lead }),
      });

      if (!response.ok) {
        throw new Error(`Failed to export: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Event-Brief-${(lead.companyName || 'Event').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().getFullYear()}.docx`;
      if (contentDisposition) {
        // Try to extract filename from Content-Disposition header
        // Support both formats: filename="..." and filename*=UTF-8''...
        const filenameMatch = contentDisposition.match(/filename\*?=['"]?([^'";]+)['"]?/i);
        if (filenameMatch && filenameMatch[1]) {
          const extractedFilename = filenameMatch[1];
          // Decode if it's URL encoded
          try {
            filename = decodeURIComponent(extractedFilename);
          } catch (e) {
            filename = extractedFilename;
          }
          // Ensure .docx extension (remove any trailing underscore or incorrect extension)
          if (!filename.endsWith('.docx')) {
            filename = filename.replace(/\.docx_?$/i, '') + '.docx';
          }
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      console.log('✅ Event Brief exported successfully');
    } catch (error: any) {
      console.error('❌ Error exporting Event Brief:', error);
      alert(`❌ Failed to export Event Brief: ${error.message || 'Please check console for details'}`);
    }
  };


  // Filter and sort events
  // Calculate how many events were analyzed vs total
  const MAX_EVENTS_ANALYZED = 200; // Should match MAX_EVENTS in handleAnalyze
  const analyzedCount = organizationProgress.filter(p => p.status === 'completed' || p.status === 'analyzing' || p.status === 'error').length;
  const notAnalyzedCount = Math.max(0, eventsList.length - Math.min(eventsList.length, MAX_EVENTS_ANALYZED));
  
  const filteredAndSortedEvents = eventsList
    .map((event, idx) => {
      const eventNameLower = event.name.toLowerCase().trim();
      const progress = organizationProgress.find(p => {
        const progressName = (p.companyName || '').toLowerCase().trim();
        const resultName = (p.result?.companyName || '').toLowerCase().trim();
        return progressName === eventNameLower || 
               resultName === eventNameLower ||
               progressName.includes(eventNameLower) ||
               eventNameLower.includes(progressName);
      });
      
      // Determine if event was analyzed or skipped
      // Event is skipped if:
      // 1. It's beyond the MAX_EVENTS_ANALYZED limit AND
      // 2. It doesn't have any progress (wasn't analyzed)
      const wasAnalyzed = !!progress;
      const wasSkipped = !wasAnalyzed && idx >= MAX_EVENTS_ANALYZED;
      const skipReason = wasSkipped ? `Not analyzed - only first ${MAX_EVENTS_ANALYZED} events are analyzed` : null;
      
      return { event, idx, progress, wasAnalyzed, wasSkipped, skipReason };
    })
    .filter(({ event, progress, wasSkipped }) => {
      // Search filter
      if (searchTerm && !event.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        return false;
      }
      
      // Priority filter - only filter completed events, show all pending/not analyzed events
      if (priorityFilter !== 'all' && progress?.status === 'completed' && progress.result) {
        const score = progress.result.totalScore || 0;
        if (priorityFilter === 'high' && score < 50) return false;
        if (priorityFilter === 'medium' && (score < 30 || score >= 50)) return false;
        if (priorityFilter === 'low' && score >= 30) return false;
      }
      
      // Always show events that haven't been analyzed yet (so user knows they exist)
      // unless priority filter is set and they don't have a score
      if (!progress || progress.status === 'pending') {
        return true; // Show all pending/not analyzed events
      }
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = a.progress?.result?.totalScore || 0;
        const scoreB = b.progress?.result?.totalScore || 0;
        return sortOrder === 'desc' ? scoreB - scoreA : scoreA - scoreB;
      } else if (sortBy === 'name') {
        const nameA = a.progress?.result?.companyName || a.event.name;
        const nameB = b.progress?.result?.companyName || b.event.name;
        return sortOrder === 'desc' 
          ? nameB.localeCompare(nameA)
          : nameA.localeCompare(nameB);
      } else { // status
        const statusOrder = { 'completed': 0, 'analyzing': 1, 'pending': 2, 'error': 3 };
        const statusA = statusOrder[a.progress?.status || 'pending'] ?? 3;
        const statusB = statusOrder[b.progress?.status || 'pending'] ?? 3;
        return sortOrder === 'desc' ? statusB - statusA : statusA - statusB;
      }
    });

  return (
    <div className="p-6 min-h-screen overflow-y-auto space-y-6">
      {/* Header Section */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Event Intelligence Dashboard</h2>
          <p className="text-sm text-slate-600 mt-1">Phân tích và ưu tiên hóa events tự động với Backend Scoring Engine</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg inline-flex items-center text-sm font-semibold cursor-pointer transition-colors shadow-sm">
            <FileSpreadsheet size={16} className="mr-2" /> Upload Excel/CSV
            <input
              type="file"
              onChange={handleFileImport}
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Scoring Engine Info - Collapsible */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-sm">
        <details className="group">
          <summary className="text-sm font-semibold text-slate-900 cursor-pointer hover:text-slate-700 flex items-center justify-between">
            <span className="flex items-center">
              <Sparkles size={16} className="mr-2 text-indigo-500" />
              Backend Scoring Engine - 5 Tiêu chí đánh giá
            </span>
            <ChevronDown size={16} className="text-slate-400 group-open:rotate-180 transition-transform" />
          </summary>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-700 leading-relaxed mb-4">
              Hệ thống tự động phân tích và xếp hạng events dựa trên <strong className="text-slate-900">4 tiêu chí scoring</strong>:
              <strong className="text-blue-600"> History (25đ)</strong>, <strong className="text-green-600">Region (25đ)</strong>, 
              <strong className="text-purple-600"> Contact (25đ)</strong>, <strong className="text-orange-600">Delegates (25đ)</strong>,
              và <strong className="text-slate-900">1 tiêu chí qualification</strong>: <strong className="text-teal-600">ICCA Qualification</strong>.
            </p>
            
            {/* Scoring Criteria Toggles */}
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-700">Bật/Tắt Tiêu Chí Scoring:</p>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setScoringCriteria({
                      history: true,
                      region: true,
                      contact: true,
                      delegates: true,
                      iccaQualification: true
                    })}
                    className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                  >
                    Bật tất cả
                  </button>
                  <button
                    onClick={() => setScoringCriteria({
                      history: false,
                      region: false,
                      contact: false,
                      delegates: false,
                      iccaQualification: false
                    })}
                    className="px-2 py-1 text-xs font-medium text-white bg-slate-500 hover:bg-slate-600 rounded transition-colors"
                  >
                    Tắt tất cả
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scoringCriteria.history}
                    onChange={(e) => setScoringCriteria(prev => ({ ...prev, history: e.target.checked }))}
                    className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-xs text-slate-700">History</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scoringCriteria.region}
                    onChange={(e) => setScoringCriteria(prev => ({ ...prev, region: e.target.checked }))}
                    className="w-4 h-4 text-green-600 border-slate-300 rounded focus:ring-green-500"
                  />
                  <span className="text-xs text-slate-700">Region</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scoringCriteria.contact}
                    onChange={(e) => setScoringCriteria(prev => ({ ...prev, contact: e.target.checked }))}
                    className="w-4 h-4 text-purple-600 border-slate-300 rounded focus:ring-purple-500"
                  />
                  <span className="text-xs text-slate-700">Contact</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scoringCriteria.delegates}
                    onChange={(e) => setScoringCriteria(prev => ({ ...prev, delegates: e.target.checked }))}
                    className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500"
                  />
                  <span className="text-xs text-slate-700">Delegates</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={scoringCriteria.iccaQualification}
                    onChange={(e) => setScoringCriteria(prev => ({ ...prev, iccaQualification: e.target.checked }))}
                    className="w-4 h-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500"
                  />
                  <span className="text-xs text-slate-700">ICCA Qual</span>
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className={`bg-blue-50 border border-blue-200 rounded-lg p-3 ${!scoringCriteria.history ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-blue-900">1. History Score (0-25)</strong>
                  {!scoringCriteria.history && <span className="text-xs text-slate-500 italic">(Tắt)</span>}
                </div>
                <p className="text-blue-700 text-xs">25đ: Vietnam | 15đ: Đông Nam Á</p>
              </div>
              <div className={`bg-green-50 border border-green-200 rounded-lg p-3 ${!scoringCriteria.region ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-green-900">2. Region Score (0-25)</strong>
                  {!scoringCriteria.region && <span className="text-xs text-slate-500 italic">(Tắt)</span>}
                </div>
                <p className="text-green-700 text-xs">25đ: Tên có "ASEAN/Asia/Pacific" | 15đ: Địa điểm châu Á</p>
              </div>
              <div className={`bg-purple-50 border border-purple-200 rounded-lg p-3 ${!scoringCriteria.contact ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-purple-900">3. Contact Score (0-25)</strong>
                  {!scoringCriteria.contact && <span className="text-xs text-slate-500 italic">(Tắt)</span>}
                </div>
                <p className="text-purple-700 text-xs">25đ: Email + Phone | 20đ: Email + Tên | 15đ: Email | 10đ: Tên</p>
              </div>
              <div className={`bg-orange-50 border border-orange-200 rounded-lg p-3 ${!scoringCriteria.delegates ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-orange-900">4. Delegates Score (0-25)</strong>
                  {!scoringCriteria.delegates && <span className="text-xs text-slate-500 italic">(Tắt)</span>}
                </div>
                <p className="text-orange-700 text-xs">25đ: ≥500 | 20đ: ≥300 | 10đ: ≥100</p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-slate-200">
              <div className={`bg-teal-50 border border-teal-200 rounded-lg p-3 ${!scoringCriteria.iccaQualification ? 'opacity-50' : ''}`}>
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-teal-900">5. ICCA Qualification</strong>
                  {!scoringCriteria.iccaQualification && <span className="text-xs text-slate-500 italic">(Tắt)</span>}
                </div>
                <p className="text-teal-700 text-xs">3 quy tắc: Rotation (≥3 nước) | Size (≥50 onsite) | Regularity (annual/biennial/triennial)</p>
                <p className="text-teal-600 text-xs mt-1 italic">Organizer: International Association | Loại trừ: Trade shows, corporate, sporting, religious/political</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* File Upload Status */}
      {uploadingExcel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <Loader2 className="animate-spin text-blue-600" size={20} />
            <div>
              <p className="text-sm font-semibold text-blue-800">Processing file...</p>
              <p className="text-xs text-blue-700 mt-0.5">Please wait while we analyze your data</p>
            </div>
          </div>
        </div>
      )}

      {excelFile && excelSummary && !uploadingExcel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <FileSpreadsheet size={20} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">{excelFile.name}</p>
                <p className="text-xs text-green-700 mt-0.5">
                  {excelSummary.totalRows} rows • {excelSummary.totalSheets} sheets • {eventsList.length} events detected
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setExcelFile(null);
                setExcelSummary(null);
                setEventsList([]);
                setImportData('');
                setEmailSendSummary(null);
              }}
              className="text-green-600 hover:text-green-800 p-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}


      {emailSendSummary && !uploadingExcel && (
        <div
          className={`rounded-lg p-4 border ${emailSendSummary.skipped ? 'bg-yellow-50 border-yellow-200' : emailSendSummary.failures.length > 0 ? 'bg-orange-50 border-orange-200' : 'bg-indigo-50 border-indigo-200'}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Auto email campaign</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {emailSendSummary.skipped
                  ? (emailSendSummary.message || 'Email automation skipped because credentials are missing.')
                  : `Sent ${emailSendSummary.sent} of ${emailSendSummary.attempted} emails automatically.`}
              </p>
              {!emailSendSummary.skipped && emailSendSummary.message && (
                <p className="text-[11px] text-slate-500 mt-1">{emailSendSummary.message}</p>
              )}
            </div>
          </div>
          {emailSendSummary.failures.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">Failed recipients</p>
              <ul className="text-xs text-slate-600 space-y-1">
                {emailSendSummary.failures.slice(0, 3).map((fail, idx) => (
                  <li key={idx}>
                    {fail.eventName}
                    {fail.email ? ` (${fail.email})` : ''}: {fail.error}
                  </li>
                ))}
              </ul>
              {emailSendSummary.failures.length > 3 && (
                <p className="text-[11px] text-slate-500 mt-1">+{emailSendSummary.failures.length - 3} more failures logged in console.</p>
              )}
            </div>
          )}
        </div>
      )}

      {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
              <p className="text-xs text-yellow-700 mt-1">Please wait before trying again</p>
            </div>
            <div className="text-2xl font-bold text-yellow-600">
              {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
            </div>
          </div>
           </div>
        )}

      {analysisError && (
        <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4 animate-fade-in shadow-md" style={{ zIndex: 1000 }}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <X className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-sm font-bold text-red-800">⚠️ Analysis Error</p>
              </div>
              <p className="text-sm text-red-700 mt-1 font-medium">{analysisError}</p>
              <p className="text-xs text-red-600 mt-2">Please check the console for more details.</p>
            </div>
            <button
              onClick={() => {
                console.log('🔴 [UI] Closing error message');
                setAnalysisError(null);
              }}
              className="text-red-600 hover:text-red-800 flex-shrink-0 ml-2 p-1 hover:bg-red-100 rounded"
              aria-label="Close error"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      {loading && eventsList.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <div className="flex items-center space-x-3">
              <Loader2 className="animate-spin text-blue-600" size={20} />
              <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">Analyzing Events...</p>
              <p className="text-xs text-blue-700 mt-1">
                Processing {Math.min(organizationProgress.filter(p => p.status === 'analyzing').length, eventsList.length)} of {eventsList.length} events. 
                Completed: {Math.min(organizationProgress.filter(p => p.status === 'completed').length, eventsList.length)}
              </p>
              </div>
            </div>
          </div>
        )}


      {/* Filters and Search Bar */}
      {eventsList.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search events by name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
                />
              </div>
            </div>
            
            {/* Priority Filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Priority:</label>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value as any)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              >
                <option value="all">All Priorities</option>
                <option value="high">High (≥50)</option>
                <option value="medium">Medium (30-49)</option>
                <option value="low">Low (&lt;30)</option>
              </select>
            </div>

            {/* Sort By */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-700 whitespace-nowrap">Sort by:</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-300"
              >
                <option value="score">Score</option>
                <option value="name">Name</option>
                <option value="status">Status</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
              >
                {sortOrder === 'asc' ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="text-xs text-slate-600">
                  Showing <strong className="text-slate-900">{filteredAndSortedEvents.length}</strong> of <strong className="text-slate-900">{eventsList.length}</strong> events
                </p>
                {priorityFilter !== 'all' && (
                  <p className="text-xs text-blue-600 mt-1">
                    ℹ️ Filtered by priority: <strong>{priorityFilter}</strong> (score {priorityFilter === 'high' ? '≥50' : priorityFilter === 'medium' ? '30-49' : '<30'})
                  </p>
                )}
              </div>
              {notAnalyzedCount > 0 && (
                <p className="text-xs text-amber-600 font-medium">
                  ⚠️ {notAnalyzedCount} events not analyzed (only first {MAX_EVENTS_ANALYZED} are analyzed)
                </p>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {analyzedCount > 0 && (
                <p className="text-xs text-slate-500">
                  Analyzed: <strong className="text-slate-700">{analyzedCount}</strong> events
                </p>
              )}
              {filteredAndSortedEvents.length < eventsList.length && priorityFilter === 'all' && (
                <p className="text-xs text-slate-500">
                  {eventsList.length - filteredAndSortedEvents.length} events hidden by search filter
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Events Table */}
      {eventsList.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-12">#</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider min-w-[300px]">Event Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-28">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider w-24">Score</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-700 uppercase tracking-wider w-32">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {filteredAndSortedEvents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-500">
                      <Search size={48} className="mx-auto mb-3 text-slate-300" />
                      <p className="text-sm font-medium">No events match your filters</p>
                      <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedEvents.map(({ event, idx, progress, wasSkipped, skipReason }) => (
                    <tr 
                      key={event.id || idx} 
                      className={`hover:bg-slate-50 transition-colors ${
                        progress?.status === 'completed' ? 'bg-green-50/30' :
                        progress?.status === 'analyzing' ? 'bg-blue-50/30' :
                        progress?.status === 'error' ? 'bg-red-50/30' :
                        wasSkipped ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-sm font-medium text-slate-600">{idx + 1}</td>
                      
                      {/* Event Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center space-x-2">
                          {progress?.status === 'completed' && (
                            <Check className="text-green-600 flex-shrink-0" size={16} />
                          )}
                          {progress?.status === 'analyzing' && (
                            <Loader2 className="animate-spin text-blue-600 flex-shrink-0" size={16} />
                          )}
                          {progress?.status === 'error' && (
                            <X className="text-red-600 flex-shrink-0" size={16} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-900 truncate">
                              {progress?.result?.companyName || event.name}
                            </div>
                            {progress?.result?.industry && (
                              <div className="text-xs text-slate-500 mt-0.5 truncate">
                                {progress.result.industry}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      
                      {/* Status */}
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                            progress?.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : progress?.status === 'analyzing'
                              ? 'bg-blue-100 text-blue-800'
                              : progress?.status === 'error'
                              ? 'bg-red-100 text-red-800'
                              : wasSkipped
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}>
                            {progress?.status === 'completed' ? 'Completed' :
                             progress?.status === 'analyzing' ? 'Analyzing' :
                             progress?.status === 'error' ? 'Error' :
                             wasSkipped ? 'Not Analyzed' : 'Pending'}
                          </span>
                          {wasSkipped && skipReason && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200" title={skipReason}>
                              ⚠️ {skipReason}
                            </span>
                          )}
                          {progress?.status === 'completed' && progress.result && (() => {
                            const eventName = (progress.result.companyName || event.name || '').toLowerCase().trim();
                            return savedToDatabase.has(eventName) ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-700">
                                ✓ Đã lưu vào database
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </td>
                      
                      {/* Score */}
                      <td className="px-4 py-3">
                        {progress?.status === 'completed' && progress.result ? (
                          <div className="flex items-center space-x-1">
                            <span className="text-base font-bold text-indigo-600">
                              {progress.result.totalScore || 0}
                            </span>
                            <span className="text-xs text-slate-500">/100</span>
                          </div>
                        ) : (event as any).dataQualityScore !== undefined ? (
                          <span className={`text-sm font-semibold ${
                            (event as any).dataQualityScore >= 80 ? 'text-green-600' :
                            (event as any).dataQualityScore >= 60 ? 'text-yellow-600' :
                            'text-red-600'
                          }`}>
                            {(event as any).dataQualityScore}%
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">-</span>
                        )}
                      </td>
                      
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {progress?.status === 'completed' && progress.result && (
                            <>
                              <button
                                onClick={() => setSelectedEventForModal({
                                  name: progress.result.companyName || event.name,
                                  data: event.data,
                                  id: event.id,
                                  dataQualityScore: (event as any).dataQualityScore,
                                  issues: (event as any).issues,
                                  rawData: (event as any).rawData
                                })}
                                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                                title="View Details"
                              >
                                <FileText size={16} />
                              </button>
                              {(() => {
                                // Check for editions in result or event
                                const editions = progress.result.editions || (event as any).editions || [];
                                const hasEditions = Array.isArray(editions) && editions.length > 0;
                                
                                if (hasEditions) {
                                  const eventName = progress.result.companyName || event.name;
                                  const isResearching = Array.from(researchingEditions).some(key => key.includes(eventName));
                                  
                                  return (
                                    <button
                                      onClick={() => {
                                        if (!isResearching) {
                                          researchEditionsLeadership(eventName, editions);
                                        }
                                      }}
                                      disabled={isResearching}
                                      className="p-1.5 text-purple-600 hover:text-purple-900 hover:bg-purple-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      title="Research Edition Leadership"
                                    >
                                      {isResearching ? (
                                        <Loader2 className="animate-spin" size={16} />
                                      ) : (
                                        <Sparkles size={16} />
                                      )}
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          )}
                          {(event as any).rawData && !progress?.result && (
                            <button
                              onClick={() => setSelectedEventForModal({
                                name: event.name,
                                data: event.data,
                                id: event.id,
                                dataQualityScore: (event as any).dataQualityScore,
                                issues: (event as any).issues,
                                rawData: (event as any).rawData
                              })}
                              className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors"
                              title="View Raw Data"
                            >
                              <Search size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {eventsList.length === 0 && !uploadingExcel && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-slate-300 p-12 text-center">
          <FileSpreadsheet size={64} className="mx-auto mb-4 text-slate-300" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Events Yet</h3>
          <p className="text-sm text-slate-600 mb-6 max-w-md mx-auto">
            Upload an Excel or CSV file to start analyzing events. The system will automatically score and prioritize them based on 4 criteria.
          </p>
          <label className="inline-flex items-center px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer transition-colors shadow-md">
            <FileSpreadsheet size={18} className="mr-2" /> Upload Excel/CSV File
            <input
              type="file"
              onChange={handleFileImport}
              accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="hidden"
            />
          </label>
        </div>
      )}

      {/* Run Strategy Analysis Button */}
      {eventsList.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 flex justify-between items-center">
          <div>
            <p className="text-sm text-slate-600">
              Ready to analyze <span className="font-semibold text-slate-800">{eventsList.length}</span> event{eventsList.length > 1 ? 's' : ''}
            </p>
            {loading && (
              <p className="text-xs text-blue-600 mt-1">
                Analyzing events one by one... This may take a few minutes.
              </p>
            )}
            {researchingEditions.size > 0 && !loading && (
              <p className="text-xs text-purple-600 mt-1">
                Researching edition leadership information... Please wait.
              </p>
            )}
          </div>
           <button 
             onClick={handleAnalyze} 
            disabled={loading || researchingEditions.size > 0 || eventsList.length === 0 || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center shadow-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
           >
             {loading ? (
               <>
                 <Loader2 className="animate-spin mr-2" size={18} />
                 <span>Analyzing...</span>
               </>
             ) : researchingEditions.size > 0 ? (
               <>
                 <Loader2 className="animate-spin mr-2" size={18} />
                 <span>Researching...</span>
               </>
             ) : (
               <>
                 <BrainCircuit className="mr-2" size={18} />
                 {rateLimitCountdown !== null && rateLimitCountdown > 0 
                   ? `Retry in ${rateLimitCountdown}s` 
                   : 'Run Strategy Analysis'}
               </>
             )}
           </button>
        </div>
      )}

      {/* Expanded Details */}
      {eventsList.map((event, idx) => {
        const eventNameLower = (event.name || '').toLowerCase().trim();
        const progress = organizationProgress.find(p => {
          const pNameLower = (p.companyName || '').toLowerCase().trim();
          const resultNameLower = (p.result?.companyName || '').toLowerCase().trim();
          return pNameLower === eventNameLower || resultNameLower === eventNameLower;
        });
        if (!expandedOrgs.has(event.name)) return null;
        
        // Show details even if no progress result - display event data
        if (!progress?.result) {
          // Parse event data to show basic info
          const eventDataParts = event.data.split(', ').map((part: string) => {
            const [key, ...valueParts] = part.split(': ');
            return { key: key.trim(), value: valueParts.join(': ').trim() };
          });
          
          return (
            <div key={`details-${idx}`} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 mt-2">
              <h4 className="font-bold text-slate-800 mb-3 text-lg">{event.name}</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {eventDataParts.slice(0, 10).map((part: any, partIdx: number) => (
                  part.value && part.value !== 'N/A' && (
                    <div key={partIdx}>
                      <span className="font-semibold text-slate-700">{part.key}:</span>
                      <span className="ml-2 text-slate-600">{part.value}</span>
                    </div>
                  )
                ))}
                {(event as any).dataQualityScore !== undefined && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <span className="font-semibold text-slate-700">Data Quality Score:</span>
                    <span className={`ml-2 font-bold ${
                      (event as any).dataQualityScore >= 80 ? 'text-green-600' :
                      (event as any).dataQualityScore >= 60 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {(event as any).dataQualityScore}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        }
        
        return (
          <div key={`details-${idx}`} className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 mb-4 mt-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-semibold text-slate-700">Industry:</span>
                <span className="ml-2 text-slate-600">{progress.result.industry || 'N/A'}</span>
      </div>
              <div>
                <span className="font-semibold text-slate-700">Location:</span>
                <span className="ml-2 text-slate-600">
                  {progress.result.city || ''}{progress.result.city && progress.result.country ? ', ' : ''}{progress.result.country || 'N/A'}
                </span>
              </div>
              {progress.result.keyPersonName && (
                <div>
                  <span className="font-semibold text-slate-700">Contact:</span>
                  <span className="ml-2 text-slate-600">
                    {progress.result.keyPersonName}
                    {progress.result.keyPersonTitle && ` - ${progress.result.keyPersonTitle}`}
                  </span>
                </div>
              )}
              {progress.result.keyPersonEmail && (
                <div>
                  <span className="font-semibold text-slate-700">Email:</span>
                  <a href={`mailto:${progress.result.keyPersonEmail}`} className="ml-2 text-indigo-600 hover:underline">
                    {progress.result.keyPersonEmail}
                  </a>
                </div>
              )}
              {progress.result.numberOfDelegates && (
                <div>
                  <span className="font-semibold text-slate-700">Delegates:</span>
                  <span className="ml-2 text-slate-600">{progress.result.numberOfDelegates}</span>
                </div>
              )}
              {progress.result.eligibilityCheck && (
                <div className="col-span-2 pt-3 border-t border-slate-200">
                  <div className="font-semibold text-slate-700 mb-2">Eligibility Check:</div>
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className={`p-2 rounded ${progress.result.eligibilityCheck.hasVietnamHistory ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="font-medium text-slate-700 mb-1">Vietnam History</div>
                      <div className={progress.result.eligibilityCheck.hasVietnamHistory ? 'text-green-700 font-semibold' : 'text-slate-500'}>
                        {progress.result.eligibilityCheck.hasVietnamHistory ? '✓ Yes' : '✗ No'}
                      </div>
                      {progress.result.eligibilityCheck.vietnamHistoryDetails && (
                        <div className="text-xs text-slate-600 mt-1">{progress.result.eligibilityCheck.vietnamHistoryDetails}</div>
                      )}
                    </div>
                    <div className={`p-2 rounded ${progress.result.eligibilityCheck.isICCAQualified ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="font-medium text-slate-700 mb-1">ICCA Qualified</div>
                      <div className={progress.result.eligibilityCheck.isICCAQualified ? 'text-green-700 font-semibold' : 'text-slate-500'}>
                        {progress.result.eligibilityCheck.isICCAQualified ? '✓ Yes' : '✗ No'}
                      </div>
                      {progress.result.eligibilityCheck.iccaQualifiedReason && (
                        <div className="text-xs text-slate-600 mt-1">{progress.result.eligibilityCheck.iccaQualifiedReason}</div>
                      )}
                    </div>
                    <div className={`p-2 rounded ${progress.result.eligibilityCheck.hasRecentActivity ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
                      <div className="font-medium text-slate-700 mb-1">Recent Activity</div>
                      <div className={progress.result.eligibilityCheck.hasRecentActivity ? 'text-green-700 font-semibold' : 'text-slate-500'}>
                        {progress.result.eligibilityCheck.hasRecentActivity ? '✓ Yes' : '✗ No'}
                      </div>
                      {progress.result.eligibilityCheck.mostRecentYear && (
                        <div className="text-xs text-slate-600 mt-1">Last: {progress.result.eligibilityCheck.mostRecentYear}</div>
                      )}
                      {progress.result.eligibilityCheck.yearsSinceLastEvent !== null && (
                        <div className="text-xs text-slate-600">{progress.result.eligibilityCheck.yearsSinceLastEvent} years ago</div>
                      )}
                    </div>
                  </div>
                  <div className={`mt-3 p-2 rounded ${progress.result.eligibilityCheck.isEligible ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-slate-700">Overall Eligibility:</div>
                        <div className={`text-sm mt-1 ${progress.result.eligibilityCheck.isEligible ? 'text-green-700' : 'text-orange-700'}`}>
                          {progress.result.eligibilityCheck.isEligible ? '✓ Eligible for Analysis' : '⚠ Review Required'}
                        </div>
                        {progress.result.eligibilityCheck.eligibilityReason && (
                          <div className="text-xs text-slate-600 mt-1">{progress.result.eligibilityCheck.eligibilityReason}</div>
                        )}
                      </div>
                      <div className={`px-3 py-1 rounded text-xs font-medium ${
                        progress.result.eligibilityCheck.recommendation === 'proceed' ? 'bg-green-200 text-green-800' :
                        progress.result.eligibilityCheck.recommendation === 'skip' ? 'bg-red-200 text-red-800' :
                        'bg-orange-200 text-orange-800'
                      }`}>
                        {progress.result.eligibilityCheck.recommendation === 'proceed' ? 'Proceed' :
                         progress.result.eligibilityCheck.recommendation === 'skip' ? 'Skip' :
                         'Review'}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {progress.result.vietnamEvents > 0 && (
                <div>
                  <span className="font-semibold text-slate-700">VN Events:</span>
                  <span className="ml-2 text-green-600 font-medium">{progress.result.vietnamEvents}</span>
                </div>
              )}
              {(progress.result.eventBrief?.openYear || progress.result.openYear) && (
                <div>
                  <span className="font-semibold text-slate-700">Open Year:</span>
                  <span className="ml-2 text-slate-600">{progress.result.eventBrief?.openYear || progress.result.openYear}</span>
                </div>
              )}
              {(progress.result.eventBrief?.breakoutRooms || progress.result.breakoutRooms) && (
                <div>
                  <span className="font-semibold text-slate-700">Break-Out Rooms:</span>
                  <span className="ml-2 text-slate-600">{progress.result.eventBrief?.breakoutRooms || progress.result.breakoutRooms}</span>
                </div>
              )}
              {(progress.result.eventBrief?.roomSizes || progress.result.roomSizes) && (
                <div>
                  <span className="font-semibold text-slate-700">Size of Rooms:</span>
                  <span className="ml-2 text-slate-600">{progress.result.eventBrief?.roomSizes || progress.result.roomSizes}</span>
                </div>
              )}
              {progress.result.keyPersonPhone && (
                <div>
                  <span className="font-semibold text-slate-700">Phone:</span>
                  <a href={`tel:${progress.result.keyPersonPhone}`} className="ml-2 text-indigo-600 hover:underline">
                    {progress.result.keyPersonPhone}
                  </a>
                </div>
              )}
            </div>
            {(progress.result.eventBrief?.localStrengths || progress.result.localStrengths) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Local Strengths & Weaknesses:</span>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{progress.result.eventBrief?.localStrengths || progress.result.localStrengths}</p>
              </div>
            )}
            {(progress.result.eventBrief?.competitors || progress.result.competitors) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Competitors:</span>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{progress.result.eventBrief?.competitors || progress.result.competitors}</p>
              </div>
            )}
            {(progress.result.eventBrief?.sponsors || progress.result.sponsors) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Sponsors:</span>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{progress.result.eventBrief?.sponsors || progress.result.sponsors}</p>
              </div>
            )}
            {(progress.result.eventBrief?.layout || progress.result.layout) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Layout Event:</span>
                <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{progress.result.eventBrief?.layout || progress.result.layout}</p>
              </div>
            )}
            {(progress.result.eventBrief?.iccaQualified || progress.result.iccaQualified) && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">ICCA Qualified:</span>
                <p className="mt-1 text-sm text-slate-600">{progress.result.eventBrief?.iccaQualified || progress.result.iccaQualified}</p>
              </div>
            )}
            {progress.result.notes && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-slate-700">Notes:</span>
                <p className="mt-1 text-sm text-slate-600">{progress.result.notes}</p>
              </div>
            )}
            {progress.result.problems && Array.isArray(progress.result.problems) && progress.result.problems.length > 0 && (
              <div className="mt-3 pt-3 border-t border-slate-200">
                <span className="font-semibold text-amber-700">Data Issues:</span>
                <div className="mt-1 flex flex-wrap gap-1">
                  {progress.result.problems.map((problem: string, pIdx: number) => (
                    <span key={pIdx} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs">
                      {problem}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Old Organization Progress - Removed, now using table above */}
      {false && isBatchMode && organizationProgress.length > 0 && (
        <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200 mb-4 animate-fade-in">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <Loader2 className={`mr-2 ${loading ? 'animate-spin' : ''}`} size={20} />
              Analysis Progress
            </h3>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
              {organizationProgress.filter(p => p.status === 'completed').length} / {organizationProgress.length} completed
            </span>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {organizationProgress.map((progress, idx) => (
              <div 
                key={idx} 
                className={`p-3 rounded-lg border transition-all ${
                  progress.status === 'completed' 
                    ? 'bg-green-50 border-green-200' 
                    : progress.status === 'analyzing'
                    ? 'bg-blue-50 border-blue-200'
                    : progress.status === 'error'
                    ? 'bg-red-50 border-red-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 flex-1">
                    {progress.status === 'completed' && (
                      <Check className="text-green-600" size={18} />
                    )}
                    {progress.status === 'analyzing' && (
                      <Loader2 className="animate-spin text-blue-600" size={18} />
                    )}
                    {progress.status === 'error' && (
                      <X className="text-red-600" size={18} />
                    )}
                    {progress.status === 'pending' && (
                      <div className="w-4 h-4 rounded-full border-2 border-slate-300" />
                    )}
                    <span className={`font-medium ${
                      progress.status === 'completed' ? 'text-green-800' :
                      progress.status === 'analyzing' ? 'text-blue-800' :
                      progress.status === 'error' ? 'text-red-800' :
                      'text-slate-600'
                    }`}>
                      {progress.result?.companyName || progress.companyName}
                    </span>
                    {/* Priority Badge */}
                    {progress.status === 'completed' && progress.result && progress.result.totalScore >= 80 && (
                      <span className="px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 text-xs font-bold flex items-center">
                        <Star size={12} className="mr-1" /> High Priority
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    {progress.status === 'completed' && progress.result && (
                      <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700">
                        Score: {progress.result.totalScore || 0}
                      </span>
                    )}
                    {progress.status === 'analyzing' && (
                      <span className="text-xs text-blue-600">Analyzing...</span>
                    )}
                    {progress.status === 'pending' && (
                      <span className="text-xs text-slate-500">Waiting...</span>
                    )}
                    {progress.status === 'error' && (
                      <span className="text-xs text-red-600">Error</span>
                    )}
                  </div>
                </div>
                {progress.status === 'completed' && progress.result && (
                  <div className="mt-2">
                    {/* Expand/Collapse Button */}
                    <button
                      onClick={() => toggleExpand(progress.result?.companyName || progress.companyName)}
                      className="w-full flex items-center justify-between text-xs text-slate-600 hover:text-slate-800 mb-2 font-medium"
                    >
                      <span>View Details</span>
                      {expandedOrgs.has(progress.result?.companyName || progress.companyName) ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                    
                    {/* Expandable Content */}
                    {expandedOrgs.has(progress.result?.companyName || progress.companyName) && (
                      <div className="text-xs space-y-2 pt-2 border-t border-slate-200">
                        {/* Data Quality & Enrichment Status */}
                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                            <div className="font-semibold text-blue-800 mb-1 flex items-center">
                              <Sparkles size={14} className="mr-1" /> Data Quality
                            </div>
                            <div className="text-2xl font-bold text-blue-700">{calculateDataQuality(progress.result)}%</div>
                            <div className="text-xs text-blue-600 mt-1">
                              {calculateDataQuality(progress.result) >= 80 ? 'Excellent' :
                               calculateDataQuality(progress.result) >= 60 ? 'Good' :
                               calculateDataQuality(progress.result) >= 40 ? 'Fair' : 'Poor'}
                            </div>
                          </div>
                          {getEnrichedFields(progress.result).length > 0 && (
                            <div className="p-2 bg-purple-50 border border-purple-200 rounded">
                              <div className="font-semibold text-purple-800 mb-1 flex items-center">
                                <Sparkles size={14} className="mr-1" /> AI Enriched
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {getEnrichedFields(progress.result).map((field, idx) => (
                                  <span key={idx} className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-xs">
                                    {field}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                    
                        {/* Data Issues/Problems */}
                        {progress.result.problems && Array.isArray(progress.result.problems) && progress.result.problems.length > 0 && (
                          <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded">
                            <div className="font-semibold text-amber-800 mb-1.5 flex items-center">
                              <span className="mr-1">⚠️</span> Data Issues ({progress.result.problems.length})
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {progress.result.problems.map((problem: string, pIdx: number) => (
                                <span key={pIdx} className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-xs border border-amber-300">
                                  {problem}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                    
                    {/* Key Information Grid */}
                    <div className="grid grid-cols-2 gap-2 text-slate-700">
                      {/* Industry & Location */}
                      {progress.result.industry && (
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">🏢</span>
                          <span className="font-medium">{progress.result.industry}</span>
                        </div>
                      )}
                      {(progress.result.country || progress.result.city) && (
                        <div className="flex items-center space-x-1">
                          <span className="text-slate-500">📍</span>
                          <span>{progress.result.city || ''}{progress.result.city && progress.result.country ? ', ' : ''}{progress.result.country || ''}</span>
                        </div>
                      )}
                      
                      {/* Contact Person Info */}
                      {progress.result.keyPersonName && (
                        <div className="flex items-center space-x-1 col-span-2">
                          <UserIcon size={14} className="text-slate-500" />
                          <span className="font-medium">{progress.result.keyPersonName}</span>
                          {progress.result.keyPersonTitle && (
                            <span className="text-slate-500">- {progress.result.keyPersonTitle}</span>
                          )}
                        </div>
                      )}
                      
                      {/* Contact Information Status */}
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-500">📧</span>
                        <span className={progress.result.keyPersonEmail ? 'text-green-700 font-medium' : 'text-amber-700'}>
                          {progress.result.keyPersonEmail ? (
                            <a href={`mailto:${progress.result.keyPersonEmail}`} className="hover:underline">
                              {progress.result.keyPersonEmail}
                            </a>
                          ) : '✗ No Email'}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-slate-500">📞</span>
                        <span className={progress.result.keyPersonPhone ? 'text-green-700 font-medium' : 'text-amber-700'}>
                          {progress.result.keyPersonPhone ? progress.result.keyPersonPhone : '✗ No Phone'}
                        </span>
                      </div>
                      
                      {/* Website Status */}
                      {progress.result.website && (
                        <div className="flex items-center space-x-1 col-span-2">
                          <span className="text-slate-500">🌐</span>
                          <a href={progress.result.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
                            {progress.result.website}
                          </a>
                        </div>
                      )}
                    </div>
                    
                    {/* Scoring Breakdown */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="font-semibold text-slate-700 mb-1">Scoring Breakdown:</div>
                      <div className="grid grid-cols-2 gap-1 text-slate-600">
                        <div>History: <span className="font-bold text-indigo-600">{progress.result.historyScore || 0}/25</span></div>
                        <div>Region: <span className="font-bold text-indigo-600">{progress.result.regionScore || 0}/25</span></div>
                        <div>Contact: <span className="font-bold text-indigo-600">{progress.result.contactScore || 0}/25</span></div>
                        <div>Delegates: <span className="font-bold text-indigo-600">{progress.result.delegatesScore || 0}/25</span></div>
                      </div>
                    </div>
                    
                    {/* Key Metrics */}
                    <div className="flex flex-wrap gap-2 text-slate-600">
                      {progress.result.vietnamEvents > 0 && (
                        <span className="px-2 py-1 rounded bg-green-100 text-green-700 font-medium">
                          ✓ {progress.result.vietnamEvents} VN event{progress.result.vietnamEvents > 1 ? 's' : ''}
                        </span>
                      )}
                      {progress.result.numberOfDelegates && (
                        <span className="px-2 py-1 rounded bg-blue-100 text-blue-700 font-medium">
                          👥 {progress.result.numberOfDelegates} delegates
                        </span>
                      )}
                      {progress.result.totalEvents > 1 && (
                        <span className="px-2 py-1 rounded bg-purple-100 text-purple-700 font-medium">
                          📅 {progress.result.totalEvents} total events
                        </span>
                      )}
                    </div>
                    
                    
                        {/* Event History */}
                        {progress.result.pastEventsHistory && (
                          <div className="pt-2 border-t border-slate-200">
                            <div className="font-semibold text-slate-700 mb-2 flex items-center">
                              <Calendar size={16} className="mr-2 text-blue-600" /> 
                              <span>📅 Lịch sử diễn ra của event (từ sheet Editions)</span>
                            </div>
                            <div className="text-slate-700 text-sm bg-blue-50 border border-blue-200 rounded-lg p-3 whitespace-pre-wrap">
                              {progress.result.pastEventsHistory}
                            </div>
                          </div>
                        )}
                    
                        {/* Event History */}
                        {progress.result.pastEventsHistory && (
                          <div className="pt-2 border-t border-slate-200">
                            <div className="font-semibold text-slate-700 mb-2">📅 Lịch sử Event:</div>
                            <div className="text-slate-600 text-xs bg-slate-50 p-2 rounded border border-slate-200">
                              {progress.result.pastEventsHistory}
                            </div>
                          </div>
                        )}
                        
                        {/* Editions List */}
                        {progress.result.editions && Array.isArray(progress.result.editions) && progress.result.editions.length > 0 && (
                          <div className="pt-2 border-t border-slate-200">
                            <div className="font-semibold text-slate-700 mb-2">📋 Chi tiết các editions ({progress.result.editions.length}):</div>
                            <div className="space-y-1 max-h-48 overflow-y-auto">
                              {progress.result.editions.map((edition: any, idx: number) => {
                                const year = edition.YEAR || edition.Year || edition.year || '';
                                const city = edition.CITY || edition.City || edition.city || '';
                                const country = edition.COUNTRY || edition.Country || edition.country || '';
                                const delegates = edition.TOTATTEND || edition.REGATTEND || edition.Delegates || '';
                                
                                return (
                                  <div key={idx} className="text-xs bg-slate-50 p-2 rounded border border-slate-200">
                                    <div className="font-medium text-slate-800">
                                      Edition {idx + 1}
                                      {year && ` - ${year}`}
                                    </div>
                                    {(city || country) && (
                                      <div className="text-slate-600 mt-0.5">
                                        📍 {[city, country].filter(Boolean).join(', ') || 'N/A'}
                                      </div>
                                    )}
                                    {delegates && (
                                      <div className="text-slate-600 mt-0.5">
                                        👥 {delegates} delegates
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Next Step Strategy */}
                        {progress.result.nextStepStrategy && (
                          <div className="pt-2 border-t border-slate-200">
                            <div className="font-semibold text-slate-700 mb-1">🎯 Next Step:</div>
                            <div className="text-slate-600">{progress.result.nextStepStrategy}</div>
                          </div>
                        )}
                        
                        {/* Quick Actions */}
                        <div className="pt-2 border-t border-slate-200">
                          <div className="font-semibold text-slate-700 mb-2">Quick Actions:</div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => {
                                const lead = extractedLeads.find(l => l.companyName === progress.result.companyName);
                                if (lead) {
                                  // Scroll to lead details or open in new view
                                  console.log('View details for:', lead);
                                }
                              }}
                              className="px-3 py-1.5 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 flex items-center"
                            >
                              <FileText size={12} className="mr-1" /> View Details
                            </button>
                            <button
                              onClick={() => {
                                // Trigger data enrichment for this organization
                                console.log('Enrich data for:', progress.result.companyName);
                              }}
                              className="px-3 py-1.5 bg-purple-600 text-white rounded text-xs font-medium hover:bg-purple-700 flex items-center"
                            >
                              <Sparkles size={12} className="mr-1" /> Enrich Data
                            </button>
                            {progress.result.website && (
                              <a
                                href={progress.result.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs font-medium hover:bg-indigo-700 flex items-center"
                              >
                                <ExternalLink size={12} className="mr-1" /> Visit Website
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {progress.status === 'error' && progress.error && (
                  <div className="mt-2 text-xs text-red-600">
                    {progress.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}


      {report && parsedReport && (
        <div className="space-y-4 animate-fade-in">
          {/* PART A: Strategic Analysis Table - Enhanced Design */}
          {parsedReport.partC && Array.isArray(parsedReport.partC) && parsedReport.partC.length > 0 ? (
            <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-xl shadow-lg border border-slate-200">
              <div className="flex justify-between items-center mb-6 pb-4 border-b-2 border-slate-300">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <BrainCircuit className="text-indigo-600" size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">Phân tích và chọn lọc Events</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Kết quả phân tích AI - Chọn lọc events phù hợp nhất từ danh sách đã import</p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-bold">
                    {parsedReport.partC.length} events
                  </span>
                </div>
              </div>
              <div className="space-y-8">
                {parsedReport.partC.map((lead: any, idx: number) => {
                  const score = lead.totalScore || 0;
                  const isResearching = !lead.lastEnriched;
                  const isExpanded = expandedEvents.has(idx);
                  
                  // Helper to render field value with AI badge or loading
                  const renderField = (value: any, fieldName: string, isLink: boolean = false) => {
                    const isAIFilled = lead.aiFilledFields?.includes(fieldName);
                    const showLoading = isResearching && (!value || value === 'N/A');
                    
                    if (showLoading) {
                      return (
                        <span className="inline-flex items-center text-slate-400">
                          <Loader2 className="animate-spin mr-1" size={12} />
                          Researching...
                        </span>
                      );
                    }
                    
                    const displayValue = value || 'N/A';
                    
                    return (
                      <>
                        {isLink && value ? (
                          <a href={value} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                            {displayValue}
                          </a>
                        ) : displayValue}
                        {isAIFilled && (
                          <sup className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                            AI
                          </sup>
                        )}
                      </>
                    );
                  };
                  
                  const toggleExpand = () => {
                    setExpandedEvents(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has(idx)) {
                        newSet.delete(idx);
                      } else {
                        newSet.add(idx);
                      }
                      return newSet;
                    });
                  };
                  
                  return (
                    <div 
                      key={idx} 
                      className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden"
                    >
                      {/* Header */}
                      <div className="bg-slate-800 text-white px-4 py-3 flex items-center justify-between">
                        <h3 className="text-lg font-bold">Event Brief #{idx + 1}</h3>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm">Score: <span className="font-bold text-yellow-400">{lead.totalScore}/100</span></span>
                          {lead.totalScore && (
                            <button
                              onClick={() => handleExportEventBrief(lead)}
                              className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded transition-colors"
                            >
                              <Download size={12} className="mr-1" />
                              Export
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Collapsed Summary View */}
                      {!isExpanded && (
                        <div className="p-6">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Event Name</span>
                              <p className="text-base font-bold text-slate-900 mt-1">{lead.companyName || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Industry</span>
                              <p className="text-sm text-slate-800 mt-1">{lead.industry || 'N/A'}</p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Average Attendance</span>
                              <p className="text-sm text-slate-800 mt-1">
                                {lead.numberOfDelegates ? `${lead.numberOfDelegates.toLocaleString()} pax` : 'N/A'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Contact Person</span>
                              <p className="text-sm text-slate-800 mt-1">
                                {lead.keyPersonName || 'N/A'}
                                {lead.keyPersonTitle && <span className="text-slate-500"> ({lead.keyPersonTitle})</span>}
                              </p>
                            </div>
                            <div>
                              <span className="text-xs font-semibold text-slate-500 uppercase">Website</span>
                              <p className="text-sm mt-1">
                                {lead.website ? (
                                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {lead.website}
                                  </a>
                                ) : 'N/A'}
                              </p>
                            </div>
                          </div>
                          
                          <button
                            onClick={toggleExpand}
                            className="w-full mt-2 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition-colors flex items-center justify-center"
                          >
                            <ChevronDown size={18} className="mr-2" />
                            Xem thêm chi tiết
                          </button>
                        </div>
                      )}
                      
                      {/* Expanded Full Details */}
                      {isExpanded && (
                        <>
                          <div className="p-4">
                            <button
                              onClick={toggleExpand}
                              className="w-full mb-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition-colors flex items-center justify-center"
                            >
                              <ChevronUp size={18} className="mr-2" />
                              Thu gọn
                            </button>
                          </div>
                      
                      {/* AI Research Status Banner */}
                      {!lead.lastEnriched && (
                        <div className="bg-blue-50 border-l-4 border-blue-500 px-4 py-3 flex items-center">
                          <Loader2 className="animate-spin text-blue-600 mr-2" size={16} />
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-blue-900">AI Research in Progress</p>
                            <p className="text-xs text-blue-700">Finding missing information: website, contacts, sponsors, ICCA status...</p>
                          </div>
                        </div>
                      )}
                      {lead.lastEnriched && lead.aiFilledFields && lead.aiFilledFields.length > 0 && (
                        <div className="bg-green-50 border-l-4 border-green-500 px-4 py-3 flex items-center">
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-green-900">
                              ✅ AI Research Completed
                            </p>
                            <p className="text-xs text-green-700">
                              Auto-filled {lead.aiFilledFields.length} field{lead.aiFilledFields.length > 1 ? 's' : ''}: {lead.aiFilledFields.slice(0, 5).join(', ')}
                              {lead.aiFilledFields.length > 5 && ` +${lead.aiFilledFields.length - 5} more`}
                            </p>
                          </div>
                          <span className="text-xs text-green-600">
                            {new Date(lead.lastEnriched).toLocaleTimeString()}
                          </span>
                        </div>
                      )}
                      
                      
                      {/* Basic Event Information Table */}
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4">Event Name</td>
                            <td className="px-4 py-3 text-slate-900">{lead.companyName || 'N/A'}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Industry</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.industry, 'industry')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Average Attendance</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.numberOfDelegates ? `${lead.numberOfDelegates.toLocaleString()} pax` : null, 'numberOfDelegates')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Open Year</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.openYear || lead.foundedYear, 'openYear')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Frequency</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.frequency || 'annually', 'frequency')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Rotation Area & Pattern</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.rotationPattern || [lead.city, lead.country].filter(Boolean).join(', '), 'rotationPattern')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Duration of Event</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.duration || lead.eventDuration || '3 days', 'duration')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Preferred Month</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.preferredMonth || lead.preferredMonths, 'preferredMonth')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Preferred Venue</td>
                            <td className="px-4 py-3 text-slate-900">{lead.preferredVenue || 'Hotel with convention facilities or Convention Centre'}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Break-Out Rooms</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.breakoutRooms || lead.breakOutRooms, 'breakoutRooms')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Size of Rooms</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.roomSizes || lead.sizeOfRooms, 'roomSizes')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Info on Last / Upcoming Events</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.upcomingEvents || lead.lastEventInfo, 'upcomingEvents')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Delegates Profile</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.delegatesProfile, 'delegatesProfile')}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Event History Section */}
                      <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold mt-4">
                        Event History
                      </div>
                      {(() => {
                        // Debug log
                        console.log('🔍 Event History Debug:', {
                          eventName: lead.companyName,
                          hasEditions: !!lead.editions,
                          editionsLength: lead.editions?.length,
                          editions: lead.editions,
                          hasPastHistory: !!lead.pastEventsHistory,
                          pastHistory: lead.pastEventsHistory
                        });
                        
                        // Check if we have editions with data
                        if (lead.editions && lead.editions.length > 0) {
                          return (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-blue-900 text-white">
                                    <th className="px-4 py-2 text-left font-semibold border-r border-blue-800">Date</th>
                                    <th className="px-4 py-2 text-left font-semibold border-r border-blue-800">Congress</th>
                                    <th className="px-4 py-2 text-left font-semibold border-r border-blue-800">Venue</th>
                                    <th className="px-4 py-2 text-left font-semibold border-r border-blue-800">Organizing Chairman</th>
                                    <th className="px-4 py-2 text-left font-semibold">Secretary General</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lead.editions.map((edition: any, idx: number) => {
                                    // Map to actual Excel column names from ICCA data
                                    const startDate = edition.STARTDATE || edition.StartDate || edition.startDate || '';
                                    const endDate = edition.ENDDATE || edition.EndDate || edition.endDate || '';
                                    const editionYear = edition.EDITYEARS || edition.EditYears || edition.edityears || '';
                                    
                                    // Format date: prefer EDITYEARS, then STARTDATE, then ENDDATE
                                    const date = editionYear || startDate || endDate || 'N/A';
                                    
                                    // Congress: SeriesName + SeriesEditions (e.g., "1st APCCVIR" or just series name)
                                    const seriesName = edition.SeriesName || edition.SERIESNAME || edition.seriesName || '';
                                    const seriesEdition = edition.SeriesEditions || edition.SERIESEDITIONS || edition.seriesEditions || edition.Sequence || edition.SEQUENCE || '';
                                    const congress = seriesEdition ? `${seriesEdition} ${seriesName}` : seriesName || 'N/A';
                                    
                                    // Venue: City, Country
                                    const city = edition.CITY || edition.City || edition.city || '';
                                    const country = edition.COUNTRY || edition.Country || edition.country || '';
                                    const venue = [city, country].filter(Boolean).join(', ') || 'N/A';
                                    
                                    // Chairman and Secretary: Try edition data first, then check AI research cache
                                    const editionChairman = edition.Chairman || edition.CHAIRMAN || edition.chairman || 
                                                           edition.organizingChairman || edition.ORGANIZING_CHAIRMAN || '';
                                    const editionSecretary = edition.Secretary || edition.SECRETARY || edition.secretary || 
                                                            edition.SecretaryGeneral || edition.SECRETARY_GENERAL || edition.secretaryGeneral || '';
                                    
                                    // AI researched data (stored directly in edition object)
                                    const aiChairman = edition.aiChairman || '';
                                    const aiSecretary = edition.aiSecretary || '';
                                    const isAIResearched = edition.aiResearched === true;
                                    
                                    // Check if currently researching
                                    const cacheKey = `${lead.companyName}_${date}_${city}_${country}`;
                                    const isResearching = researchingEditions.has(cacheKey);
                                    
                                    // Final values: Excel data > AI data > empty
                                    const chairman = editionChairman || aiChairman;
                                    const secretary = editionSecretary || aiSecretary;
                                    
                                    // Track if value came from AI
                                    const chairmanFromAI = !editionChairman && aiChairman && isAIResearched;
                                    const secretaryFromAI = !editionSecretary && aiSecretary && isAIResearched;
                                    
                                    // Delegates info
                                    const delegates = edition.TOTATTEND || edition.TotAttend || edition.totattend || 
                                                     edition.REGATTEND || edition.RegAttend || edition.regattend || 
                                                     edition.registeredDelegate || edition.PEARNUMBERS || '';
                                    
                                    return (
                                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                                        <td className="px-4 py-2 border-b border-slate-200 text-slate-900 whitespace-nowrap">{date}</td>
                                        <td className="px-4 py-2 border-b border-slate-200 text-slate-900">{congress}</td>
                                        <td className="px-4 py-2 border-b border-slate-200 text-blue-600">{venue}</td>
                                        <td className="px-4 py-2 border-b border-slate-200 text-slate-900">
                                          {isResearching ? (
                                            <span className="inline-flex items-center text-slate-400 text-xs">
                                              <Loader2 className="animate-spin mr-1" size={12} />
                                              Researching...
                                            </span>
                                          ) : (
                                            <>
                                              {chairman || 'N/A'}
                                              {chairmanFromAI && chairman && (
                                                <sup className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                                                  AI
                                                </sup>
                                              )}
                                            </>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 border-b border-slate-200 text-slate-900">
                                          {isResearching ? (
                                            <span className="inline-flex items-center text-slate-400 text-xs">
                                              <Loader2 className="animate-spin mr-1" size={12} />
                                              Researching...
                                            </span>
                                          ) : (
                                            <>
                                              {secretary || 'N/A'}
                                              {secretaryFromAI && secretary && (
                                                <sup className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                                                  AI
                                                </sup>
                                              )}
                                            </>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        } else if (lead.pastEventsHistory) {
                          return (
                            <div className="px-4 py-3 text-slate-900 bg-slate-50 whitespace-pre-wrap">
                              {lead.pastEventsHistory}
                            </div>
                          );
                        } else {
                          return (
                            <div className="px-4 py-3 text-slate-500 bg-slate-50 italic">
                              No event history available
                            </div>
                          );
                        }
                      })()}
                      
                      {/* International Organisation & Local Host Information */}
                      <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold mt-4">
                        International Organisation & Local Host Information
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4">Name of International Organisation</td>
                            <td className="px-4 py-3 text-slate-900">
                              {(() => {
                                console.log('🔍 [Org Name Debug] organizationName:', lead.organizationName, '| companyName:', lead.companyName);
                                console.log('🔍 [Org Name Debug] Available fields:', Object.keys(lead).filter(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('org')));
                                return lead.organizationName || lead.companyName || 'N/A';
                              })()}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Website</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.website, 'website', true)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Organisation Profile</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.organizationProfile || lead.notes, 'organizationProfile')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Name of Local Host / Member</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.keyPersonName || lead.localHostName, 'keyPersonName')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Title</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.keyPersonTitle, 'keyPersonTitle')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Email</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.keyPersonEmail, 'keyPersonEmail', true)}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Phone</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.keyPersonPhone, 'keyPersonPhone')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 align-top">Local Strengths & Weaknesses</td>
                            <td className="px-4 py-3 text-slate-900">
                              {(() => {
                                const value = lead.localStrengthsWeaknesses;
                                const isAIFilled = lead.aiFilledFields?.includes('localStrengthsWeaknesses');
                                const isResearching = !lead.lastEnriched && (!value || value === 'N/A');
                                
                                if (isResearching) {
                                  return (
                                    <span className="inline-flex items-center text-slate-400">
                                      <Loader2 className="animate-spin mr-1" size={12} />
                                      Researching...
                                    </span>
                                  );
                                }
                                
                                if (!value || value === 'N/A') {
                                  return <span className="text-slate-500">N/A</span>;
                                }
                                
                                // Parse strengths and weaknesses
                                const parseStrengthsWeaknesses = (text: string) => {
                                  const strengthsMatch = text.match(/Strengths?:?\s*([^W]*?)(?:Weaknesses?:|$)/is);
                                  const weaknessesMatch = text.match(/Weaknesses?:?\s*(.+)$/is);
                                  
                                  return {
                                    strengths: strengthsMatch ? strengthsMatch[1].trim() : '',
                                    weaknesses: weaknessesMatch ? weaknessesMatch[1].trim() : text
                                  };
                                };
                                
                                const { strengths, weaknesses } = parseStrengthsWeaknesses(value);
                                
                                return (
                                  <div className="space-y-2">
                                    {strengths && (
                                      <div className="bg-green-50 border-l-4 border-green-500 p-2 rounded">
                                        <div className="text-xs font-semibold text-green-800 mb-1">💪 Strengths:</div>
                                        <div className="text-sm text-green-900 whitespace-pre-wrap">{strengths}</div>
                                      </div>
                                    )}
                                    {weaknesses && (
                                      <div className="bg-amber-50 border-l-4 border-amber-500 p-2 rounded">
                                        <div className="text-xs font-semibold text-amber-800 mb-1">⚠️ Weaknesses:</div>
                                        <div className="text-sm text-amber-900 whitespace-pre-wrap">{weaknesses}</div>
                                      </div>
                                    )}
                                    {isAIFilled && (
                                      <div className="text-right">
                                        <sup className="px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                                          AI Researched
                                        </sup>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Bidding Information */}
                      <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold mt-4">
                        Bidding Information
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4">Decision Maker</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.decisionMaker || 'Local host', 'decisionMaker')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Decision Making Process</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.decisionMakingProcess || 'Local host work with DMC\nDMC sorting venues & have site inspection\nClose destination & venues', 'decisionMakingProcess')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Key Bid Criteria</td>
                            <td className="px-4 py-3 text-slate-900">
                              {lead.keyBidCriteria || 'Venue capacity & breakout rooms\nConnectivity'}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Competitors</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.competitors, 'competitors')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Competitive Analysis</td>
                            <td className="px-4 py-3 text-slate-900">{lead.competitiveAnalysis || 'Previous & current bid'}</td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Host Responsibility</td>
                            <td className="px-4 py-3 text-slate-900">{lead.hostResponsibility || 'Organising Committee, responsible for selection of destination, venue and event plan'}</td>
                          </tr>
                        </tbody>
                      </table>
                      
                      {/* Other Information */}
                      <div className="bg-slate-700 text-white px-4 py-2 text-sm font-semibold mt-4">
                        Other Information
                      </div>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700 w-1/4 align-top">Sponsors</td>
                            <td className="px-4 py-3">
                              {(() => {
                                const sponsorsText = lead.sponsors || lead.sponsorInfo || '';
                                const isAIFilled = lead.aiFilledFields?.includes('sponsors');
                                
                                if (!sponsorsText || sponsorsText === 'N/A') {
                                  return <span className="text-slate-500">N/A</span>;
                                }
                                
                                // Parse sponsors by tier (format: "Diamond: Company1, Company2; Gold: Company3")
                                const parseSponsorsByTier = (text: string) => {
                                  const tiers: { [key: string]: string[] } = {};
                                  
                                  console.log('🔍 [Sponsors Parse] Raw text:', text);
                                  
                                  // Split by semicolon or newline
                                  const sections = text.split(/[;\n]/).filter(s => s.trim());
                                  
                                  console.log('🔍 [Sponsors Parse] Sections:', sections);
                                  
                                  sections.forEach(section => {
                                    // Match pattern: "TierName: Company1, Company2"
                                    const match = section.match(/^([^:]+):\s*(.+)$/);
                                    if (match) {
                                      const tierName = match[1].trim();
                                      const companiesText = match[2].trim();
                                      // Split by comma, handle "and", remove extra spaces
                                      const companies = companiesText
                                        .split(/,|\band\b/)
                                        .map(c => c.trim())
                                        .filter(c => c.length > 0);
                                      
                                      console.log(`🔍 [Sponsors Parse] ${tierName}:`, companies, `(${companies.length} companies)`);
                                      
                                      tiers[tierName] = companies;
                                    } else {
                                      console.warn('⚠️ [Sponsors Parse] Could not parse section:', section);
                                    }
                                  });
                                  
                                  console.log('✅ [Sponsors Parse] Final tiers:', tiers);
                                  
                                  return tiers;
                                };
                                
                                const tierColors: { [key: string]: { bg: string; border: string; text: string; badge: string } } = {
                                  'Diamond': { bg: 'bg-gradient-to-br from-cyan-50 to-blue-50', border: 'border-cyan-300', text: 'text-cyan-900', badge: 'bg-cyan-500 text-white' },
                                  'Platinum': { bg: 'bg-gradient-to-br from-gray-50 to-slate-100', border: 'border-gray-400', text: 'text-gray-900', badge: 'bg-gray-500 text-white' },
                                  'Gold': { bg: 'bg-gradient-to-br from-yellow-50 to-amber-50', border: 'border-yellow-400', text: 'text-yellow-900', badge: 'bg-yellow-500 text-white' },
                                  'Silver': { bg: 'bg-gradient-to-br from-slate-50 to-gray-50', border: 'border-slate-300', text: 'text-slate-900', badge: 'bg-slate-400 text-white' },
                                  'Bronze': { bg: 'bg-gradient-to-br from-orange-50 to-amber-50', border: 'border-orange-300', text: 'text-orange-900', badge: 'bg-orange-600 text-white' },
                                  'Institutional': { bg: 'bg-gradient-to-br from-blue-50 to-indigo-50', border: 'border-blue-300', text: 'text-blue-900', badge: 'bg-blue-600 text-white' },
                                  'Media': { bg: 'bg-gradient-to-br from-purple-50 to-pink-50', border: 'border-purple-300', text: 'text-purple-900', badge: 'bg-purple-600 text-white' },
                                  'Exhibition': { bg: 'bg-gradient-to-br from-green-50 to-emerald-50', border: 'border-green-300', text: 'text-green-900', badge: 'bg-green-600 text-white' },
                                };
                                
                                const tiers = parseSponsorsByTier(sponsorsText);
                                
                                // If no tiers found, display as simple text with AI badge
                                if (Object.keys(tiers).length === 0) {
                                  return (
                                    <div className="text-slate-900">
                                      {sponsorsText}
                                      {isAIFilled && (
                                        <sup className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                                          AI
                                        </sup>
                                      )}
                                    </div>
                                  );
                                }
                                
                                // Display as cards
                                return (
                                  <div className="space-y-3">
                                    {Object.entries(tiers).map(([tierName, companies]) => {
                                      const colors = tierColors[tierName] || { 
                                        bg: 'bg-gradient-to-br from-slate-50 to-gray-50', 
                                        border: 'border-slate-300', 
                                        text: 'text-slate-900',
                                        badge: 'bg-slate-500 text-white'
                                      };
                                      
                                      return (
                                        <div key={tierName} className={`${colors.bg} border-2 ${colors.border} rounded-lg p-3`}>
                                          <div className="flex items-center justify-between mb-2">
                                            <span className={`text-xs font-bold ${colors.text} uppercase tracking-wider`}>
                                              {tierName} Sponsors
                                            </span>
                                            <span className={`text-[10px] px-2 py-0.5 ${colors.badge} rounded font-semibold`}>
                                              {companies.length}
                                            </span>
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {companies.map((company, idx) => (
                                              <span key={idx} className={`text-xs ${colors.text} px-2.5 py-1 bg-white/70 rounded border ${colors.border} font-medium`}>
                                                {company}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })}
                                    {isAIFilled && (
                                      <div className="text-right">
                                        <sup className="px-1.5 py-0.5 bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-600 text-[10px] font-semibold rounded border border-blue-200/50">
                                          AI Researched
                                        </sup>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Layout Event</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.layoutEvent || lead.eventLayout, 'layoutEvent')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Conference Registration</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.conferenceRegistration, 'conferenceRegistration')}
                            </td>
                          </tr>
                          <tr className="border-b border-slate-200">
                            <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">ICCA Qualified</td>
                            <td className="px-4 py-3 text-slate-900">
                              {renderField(lead.iccaQualified, 'iccaQualified')}
                            </td>
                          </tr>
                          {lead.otherInformation && (
                            <tr className="border-b border-slate-200">
                              <td className="px-4 py-3 bg-slate-50 font-semibold text-slate-700">Additional Notes</td>
                              <td className="px-4 py-3 text-slate-900 whitespace-pre-wrap">{lead.otherInformation}</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                      
                      
                      {/* Old Organization Details - Hidden */}
                      <div className="hidden">
                        <div className="space-y-3">
                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/50">
                            <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center">
                              <Users size={14} className="mr-1.5" />
                              Organization Details
                            </h5>
                            <div className="space-y-2">
                              {lead.website && (
                                <div className="flex items-start">
                                  <span className="text-xs font-semibold text-slate-500 w-20 flex-shrink-0">Website:</span>
                                  <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all font-medium">
                                    {lead.website}
                                  </a>
                                </div>
                              )}
                              {lead.pastEventsHistory && (
                                <div className="flex items-start mt-2">
                                  <span className="text-xs font-semibold text-slate-500 w-24 flex-shrink-0 flex items-center">
                                    <Calendar size={12} className="mr-1" /> History:
                                  </span>
                                  <span className="text-xs text-slate-700 leading-relaxed bg-blue-50 border border-blue-200 rounded px-2 py-1 whitespace-pre-wrap">
                                    {lead.pastEventsHistory}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Right Column: Contact Information */}
                        <div className="space-y-3">
                          <div className="bg-white/60 backdrop-blur-sm rounded-lg p-3 border border-white/50">
                            <h5 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 flex items-center">
                              <Mail size={14} className="mr-1.5" />
                              Contact Information
                            </h5>
                            <div className="space-y-2">
                              {lead.keyPersonName && (
                                <div className="flex items-start">
                                  <span className="text-xs font-semibold text-slate-500 w-20 flex-shrink-0">Contact:</span>
                                  <div className="flex-1">
                                    <span className="text-sm text-slate-800 font-semibold">{lead.keyPersonName}</span>
                                    {lead.keyPersonTitle && (
                                      <span className="text-xs text-slate-500 ml-2">({lead.keyPersonTitle})</span>
                                    )}
                                  </div>
                                </div>
                              )}
                              {lead.keyPersonEmail && (
                                <div className="flex items-start">
                                  <span className="text-xs font-semibold text-slate-500 w-20 flex-shrink-0">Email:</span>
                                  <a href={`mailto:${lead.keyPersonEmail}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline break-all font-medium">
                                    {lead.keyPersonEmail}
                                  </a>
                                </div>
                              )}
                              {lead.keyPersonPhone && (
                                <div className="flex items-start">
                                  <span className="text-xs font-semibold text-slate-500 w-20 flex-shrink-0">Phone:</span>
                                  <a href={`tel:${lead.keyPersonPhone}`} className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium">
                                    {lead.keyPersonPhone}
                                  </a>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    
                          {/* Event Brief Section - Hidden */}
                          {false && lead.eventBrief && (
                            <div className="mt-4 pt-4 border-t-2 border-white/50">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-2">
                                  <div className="p-1.5 bg-blue-100 rounded-lg">
                                    <FileText size={16} className="text-blue-600" />
                                  </div>
                                  <span className="text-sm font-bold text-slate-800">Event Brief</span>
                                  {lead.eventBrief.opportunityScore !== undefined && (
                                    <span className="ml-2 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-500 text-white shadow-sm">
                                      Opportunity: {lead.eventBrief.opportunityScore}/100
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={() => handleExportEventBrief(lead)}
                                  className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
                                >
                                  <Download size={14} className="mr-1.5" />
                                  Export Event Brief
                                </button>
                              </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                              {lead.eventBrief.eventName && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-600">Event Name:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.eventName}</p>
                                </div>
                              )}
                              {lead.eventBrief.eventSeries && (
                                <div>
                                  <span className="font-semibold text-slate-600">Event Series:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.eventSeries}</p>
                                </div>
                              )}
                              {lead.eventBrief.industry && (
                                <div>
                                  <span className="font-semibold text-slate-600">Industry:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.industry}</p>
                                </div>
                              )}
                              {lead.eventBrief.averageAttendance !== undefined && lead.eventBrief.averageAttendance !== null && typeof lead.eventBrief.averageAttendance === 'number' && (
                                <div>
                                  <span className="font-semibold text-slate-600">Average Attendance:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.averageAttendance.toLocaleString()} delegates</p>
                                </div>
                              )}
                              {lead.eventBrief.openYear && (
                                <div>
                                  <span className="font-semibold text-slate-600">Open Year:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.openYear}</p>
                                </div>
                              )}
                              {lead.eventBrief.frequency && (
                                <div>
                                  <span className="font-semibold text-slate-600">Frequency:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.frequency}</p>
                                </div>
                              )}
                              {lead.eventBrief.rotationArea && (
                                <div>
                                  <span className="font-semibold text-slate-600">Rotation Area:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.rotationArea}</p>
                                </div>
                              )}
                              {lead.eventBrief.rotationPattern && (
                                <div>
                                  <span className="font-semibold text-slate-600">Rotation Pattern:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.rotationPattern}</p>
                                </div>
                              )}
                              {lead.eventBrief.duration && (
                                <div>
                                  <span className="font-semibold text-slate-600">Duration:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.duration}</p>
                                </div>
                              )}
                              {lead.eventBrief.preferredMonths && (
                                <div>
                                  <span className="font-semibold text-slate-600">Preferred Months:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.preferredMonths}</p>
                                </div>
                              )}
                              {lead.eventBrief.preferredVenue && (
                                <div>
                                  <span className="font-semibold text-slate-600">Preferred Venue:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.preferredVenue}</p>
                                </div>
                              )}
                              {lead.eventBrief.breakoutRooms && (
                                <div>
                                  <span className="font-semibold text-slate-600">Breakout Rooms:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.breakoutRooms}</p>
                                </div>
                              )}
                              {lead.eventBrief.roomSizes && (
                                <div>
                                  <span className="font-semibold text-slate-600">Room Sizes:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.roomSizes}</p>
                                </div>
                              )}
                              {lead.eventBrief.infoOnLastUpcomingEvents && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-600">Last / Upcoming Events:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.infoOnLastUpcomingEvents}</p>
                                </div>
                              )}
                              {lead.eventBrief.eventHistory && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-600">Event History:</span>
                                  <p className="text-slate-800 mt-0.5 whitespace-pre-line">{lead.eventBrief.eventHistory}</p>
                                </div>
                              )}
                              {lead.eventBrief.delegatesProfile && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-600">Delegates Profile:</span>
                                  <p className="text-slate-800 mt-0.5">{lead.eventBrief.delegatesProfile}</p>
                                </div>
                              )}
                              {lead.eventBrief.internationalOrganisationName && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  <span className="font-semibold text-slate-600 block mb-1">International Organisation:</span>
                                  <p className="text-slate-800 font-medium">{lead.eventBrief.internationalOrganisationName}</p>
                                  {lead.eventBrief.internationalOrganisationWebsite && (
                                    <a href={lead.eventBrief.internationalOrganisationWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm mt-0.5 block">
                                      {lead.eventBrief.internationalOrganisationWebsite}
                                    </a>
                                  )}
                                </div>
                              )}
                              {lead.eventBrief.organizationProfile && (
                                <div className="md:col-span-2">
                                  <span className="font-semibold text-slate-600">Organization Profile:</span>
                                  <p className="text-slate-800 mt-0.5 whitespace-pre-line">{lead.eventBrief.organizationProfile}</p>
                                </div>
                              )}
                              {lead.eventBrief.localHostName && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  <span className="font-semibold text-slate-600 block mb-1">Local Host Information:</span>
                                  <p className="text-slate-800">{lead.eventBrief.localHostName}</p>
                                  {lead.eventBrief.localHostTitle && <p className="text-slate-600 text-xs mt-0.5">{lead.eventBrief.localHostTitle}</p>}
                                  {lead.eventBrief.localHostOrganization && <p className="text-slate-600 text-xs mt-0.5">{lead.eventBrief.localHostOrganization}</p>}
                                  {lead.eventBrief.localHostEmail && (
                                    <p className="text-slate-600 text-xs mt-0.5">
                                      Email: <a href={`mailto:${lead.eventBrief.localHostEmail}`} className="text-blue-600 hover:underline">{lead.eventBrief.localHostEmail}</a>
                                    </p>
                                  )}
                                  {lead.eventBrief.localHostPhone && (
                                    <p className="text-slate-600 text-xs mt-0.5">
                                      Phone: <a href={`tel:${lead.eventBrief.localHostPhone}`} className="text-blue-600 hover:underline">{lead.eventBrief.localHostPhone}</a>
                                    </p>
                                  )}
                                  {lead.eventBrief.localHostWebsite && (
                                    <a href={lead.eventBrief.localHostWebsite} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs mt-0.5 block">
                                      {lead.eventBrief.localHostWebsite}
                                    </a>
                                  )}
                                </div>
                              )}
                              {lead.eventBrief.decisionMaker && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  <span className="font-semibold text-slate-600 block mb-1">Bidding Information:</span>
                                  <p className="text-slate-800"><span className="font-semibold">Decision Maker:</span> {lead.eventBrief.decisionMaker}</p>
                                  {lead.eventBrief.decisionMakingProcess && (
                                    <p className="text-slate-800 mt-1"><span className="font-semibold">Process:</span> {lead.eventBrief.decisionMakingProcess}</p>
                                  )}
                                  {lead.eventBrief.keyBidCriteria && (
                                    <p className="text-slate-800 mt-1"><span className="font-semibold">Key Criteria:</span> {lead.eventBrief.keyBidCriteria}</p>
                                  )}
                                </div>
                              )}
                              {lead.eventBrief.layout && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  <span className="font-semibold text-slate-600 block mb-1">Layout Event:</span>
                                  <p className="text-slate-800 text-xs whitespace-pre-line">{lead.eventBrief.layout}</p>
                                </div>
                              )}
                              {lead.eventBrief.conferenceRegistration && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100">
                                  <span className="font-semibold text-slate-600 block mb-1">Conference Registration:</span>
                                  <p className="text-slate-800 text-xs whitespace-pre-line">{lead.eventBrief.conferenceRegistration}</p>
                                </div>
                              )}
                              {lead.eventBrief.fitForAriyana && (
                                <div className="md:col-span-2 pt-2 border-t border-slate-100 bg-green-50 p-2 rounded">
                                  <span className="font-semibold text-green-800 block mb-1">✓ Fit for Ariyana:</span>
                                  <p className="text-green-900 text-xs">{lead.eventBrief.fitForAriyana}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-4 text-center">
              <p className="text-base text-blue-800 font-medium">
                Không tìm thấy event phù hợp
              </p>
              <p className="text-sm text-blue-600 mt-2">
                Không có event nào đáp ứng tiêu chí ICCA qualified và điểm số yêu cầu.
              </p>
            </div>
          )}

          {/* PART B: Actionable Emails */}
          {parsedReport.partB && (
            <div className="bg-white p-5 rounded-lg shadow-sm border border-slate-200">
              <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <Mail className="mr-2 text-indigo-500" size={20} />
                  PART B: Actionable Emails
                </h3>
              </div>
              <div className="space-y-4">
                {parsedReport.partB.split(/\*\*Email \d+:/).filter(s => s.trim()).map((emailBlock, idx) => {
                  const lines = emailBlock.trim().split('\n');
                  const subjectMatch = emailBlock.match(/Subject:\s*(.+)/i);
                  const subject = subjectMatch ? subjectMatch[1] : '';
                  const bodyStart = subjectMatch ? emailBlock.indexOf(subject) + subject.length : 0;
                  const body = emailBlock.substring(bodyStart).replace(/Subject:.*/i, '').trim();
                  
                  return (
                    <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                      <div className="flex items-center mb-2">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs mr-2">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-slate-800">Email {idx + 1}</h4>
                      </div>
                      {subject && (
                        <div className="mb-2">
                          <span className="text-xs font-semibold text-slate-600">Subject: </span>
                          <span className="text-sm text-slate-800 font-medium">{subject}</span>
                        </div>
                      )}
                      <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-white p-3 rounded border border-slate-200">
                        {body || emailBlock}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}


          {/* Download Button */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200 flex justify-end">
            <button
              onClick={() => {
                const blob = new Blob([report], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `analysis-report-${new Date().toISOString().split('T')[0]}.txt`;
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="text-sm px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center"
            >
              <Download size={16} className="mr-2" /> Download Full Report
            </button>
          </div>
        </div>
      )}


      {/* Event Data Modal */}
      {selectedEventForModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-fade-in">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-slate-900 mb-1">{selectedEventForModal.name}</h2>
                {(selectedEventForModal as any).dataQualityScore !== undefined && (
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-xs text-slate-500">Data Quality:</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      (selectedEventForModal as any).dataQualityScore >= 80 ? 'bg-green-50 text-green-700 border border-green-200' :
                      (selectedEventForModal as any).dataQualityScore >= 60 ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' :
                      'bg-red-50 text-red-700 border border-red-200'
                    }`}>
                      {(selectedEventForModal as any).dataQualityScore}%
                    </span>
                  </div>
                )}
              </div>
              <button 
                onClick={() => setSelectedEventForModal(null)} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {/* Parse and display event data */}
              {(() => {
                // Get rawData object if available, otherwise parse from data string
                const rawData = (selectedEventForModal as any).rawData || {};
                const dataObj: { [key: string]: any } = {};
                
                // If we have rawData object, use it directly
                if (Object.keys(rawData).length > 0) {
                  Object.entries(rawData).forEach(([key, value]) => {
                    // Include all values except _sheet, but show null/undefined as empty string
                    if (key !== '_sheet') {
                      dataObj[key] = value !== null && value !== undefined ? value : '';
                    }
                  });
                } else {
                  // Otherwise parse from data string
                  selectedEventForModal.data.split(', ').forEach((part: string) => {
                    const [key, ...valueParts] = part.split(': ');
                    const value = valueParts.join(': ').trim();
                    if (key.trim()) {
                      dataObj[key.trim()] = value || '';
                    }
                  });
                }

                // Find related data from other sheets using allExcelData
                const relatedData: { [key: string]: any[] } = {
                  organizations: [],
                  contacts: [],
                  otherEditions: [],
                  suppliers: []
                };

                if (allExcelData) {
                  const lines = allExcelData.split('\n');
                  const seriesId = dataObj.SERIESID || dataObj.SeriesID || dataObj.seriesId;
                  const ecode = dataObj.ECODE || dataObj.Ecode || dataObj.ecode;
                  
                  lines.forEach((line: string) => {
                    if (!line.trim()) return;
                    
                    // Parse line format: "Row X (Sheet: Y): Field1: Value1, Field2: Value2, ..."
                    const rowMatch = line.match(/Row \d+ \(Sheet: ([^)]+)\):\s*(.+)/);
                    if (rowMatch) {
                      const sheetName = rowMatch[1].toLowerCase();
                      const dataPart = rowMatch[2];
                      const fields: { [key: string]: string } = {};
                      
                      // Parse fields
                      dataPart.split(', ').forEach((pair: string) => {
                        const match = pair.match(/([^:]+):\s*(.+)/);
                        if (match) {
                          const key = match[1].trim();
                          const value = match[2].trim();
                          fields[key] = value;
                        }
                      });

                      // Check if this row is related to current event
                      const isRelated = 
                        (seriesId && (fields.SERIESID === seriesId || fields.SeriesID === seriesId || fields.seriesId === seriesId)) ||
                        (ecode && (fields.ECODE === ecode || fields.Ecode === ecode || fields.ecode === ecode)) ||
                        (dataObj.SERIESNAME && fields.SERIESNAME && fields.SERIESNAME.toLowerCase().includes(dataObj.SERIESNAME.toLowerCase().substring(0, 20)));

                      if (isRelated) {
                        if (sheetName.includes('org')) {
                          relatedData.organizations.push(fields);
                        } else if (sheetName.includes('contact')) {
                          relatedData.contacts.push(fields);
                        } else if (sheetName.includes('edition') && fields.ECODE !== ecode) {
                          relatedData.otherEditions.push(fields);
                        } else if (sheetName.includes('supplier')) {
                          relatedData.suppliers.push(fields);
                        }
                      }
                    }
                  });
                }

                // Categorize fields
                const categories: { [key: string]: { [key: string]: any } } = {
                  'Event Information': {},
                  'Organization': {},
                  'Location': {},
                  'Dates & Timing': {},
                  'Event Details': {},
                  'Contact & Website': {},
                  'Statistics': {},
                  'Other': {}
                };

                // Field mapping to categories
                Object.entries(dataObj).forEach(([key, value]) => {
                  const keyUpper = key.toUpperCase();
                  if (keyUpper.includes('SERIES') || keyUpper.includes('ORGANIZATION') || keyUpper.includes('ORG')) {
                    categories['Organization'][key] = value;
                  } else if (keyUpper.includes('CITY') || keyUpper.includes('COUNTRY') || keyUpper.includes('LOCATION') || keyUpper.includes('VENUE')) {
                    categories['Location'][key] = value;
                  } else if (keyUpper.includes('DATE') || keyUpper.includes('YEAR') || keyUpper.includes('TIME') || keyUpper.includes('START') || keyUpper.includes('END')) {
                    categories['Dates & Timing'][key] = value;
                  } else if (keyUpper.includes('EMAIL') || keyUpper.includes('PHONE') || keyUpper.includes('CONTACT') || keyUpper.includes('URL') || keyUpper.includes('WEBSITE') || keyUpper.includes('WEB')) {
                    categories['Contact & Website'][key] = value;
                  } else if (keyUpper.includes('ATTEND') || keyUpper.includes('DELEGATE') || keyUpper.includes('PARTICIPANT') || keyUpper.includes('SEQUENCE') || keyUpper.includes('COUNT')) {
                    categories['Statistics'][key] = value;
                  } else if (keyUpper.includes('EVENT') || keyUpper.includes('NAME') || keyUpper.includes('TITLE') || keyUpper.includes('CODE') || keyUpper.includes('ID')) {
                    categories['Event Information'][key] = value;
                  } else if (keyUpper.includes('EXHIBITION') || keyUpper.includes('COMMERCIAL') || keyUpper.includes('POSTER') || keyUpper.includes('TYPE') || keyUpper.includes('CATEGORY')) {
                    categories['Event Details'][key] = value;
                  } else {
                    categories['Other'][key] = value;
                  }
                });

                // Calculate statistics
                const totalEditions = relatedData.otherEditions.length + 1; // +1 for current event
                const locations = new Set<string>();
                const countries = new Set<string>();
                const cities = new Set<string>();
                
                // Extract location info from current event and related editions
                [dataObj, ...relatedData.otherEditions].forEach((event: any) => {
                  if (event.CITY || event.City || event.city) {
                    cities.add(event.CITY || event.City || event.city);
                  }
                  if (event.COUNTRY || event.Country || event.country) {
                    countries.add(event.COUNTRY || event.Country || event.country);
                  }
                  if (event.LOCATION || event.Location || event.location) {
                    locations.add(event.LOCATION || event.Location || event.location);
                  }
                });

                return (
                  <div className="space-y-3">
                    {/* Summary Statistics */}
                    {(totalEditions > 1 || locations.size > 0 || countries.size > 0 || cities.size > 0) && (
                      <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Tóm tắt</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {totalEditions > 1 && (
                            <div>
                              <div className="text-xs text-slate-500 mb-0.5">Tổng số editions</div>
                              <div className="text-lg font-semibold text-slate-900">{totalEditions}</div>
                            </div>
                          )}
                          {cities.size > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 mb-0.5">Thành phố</div>
                              <div className="text-lg font-semibold text-slate-900">{cities.size}</div>
                              <div className="text-xs text-slate-600 mt-0.5">{Array.from(cities).slice(0, 2).join(', ')}{cities.size > 2 ? '...' : ''}</div>
                            </div>
                          )}
                          {countries.size > 0 && (
                            <div>
                              <div className="text-xs text-slate-500 mb-0.5">Quốc gia</div>
                              <div className="text-lg font-semibold text-slate-900">{countries.size}</div>
                              <div className="text-xs text-slate-600 mt-0.5">{Array.from(countries).slice(0, 2).join(', ')}{countries.size > 2 ? '...' : ''}</div>
                            </div>
                          )}
                          {dataObj.SEQUENCE && (
                            <div>
                              <div className="text-xs text-slate-500 mb-0.5">Sequence</div>
                              <div className="text-lg font-semibold text-slate-900">{dataObj.SEQUENCE}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Related Organizations */}
                    {relatedData.organizations.length > 0 && (
                      <div className="bg-white rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Thông tin tổ chức</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {relatedData.organizations[0] && Object.entries(relatedData.organizations[0]).map(([key, value]) => (
                            value && value !== 'N/A' && (
                              <div key={key} className="pb-2 border-b border-slate-100 last:border-0">
                                <div className="text-xs text-slate-500 mb-0.5">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </div>
                                <div className="text-sm text-slate-800 break-words">
                                  {typeof value === 'string' && (value.toLowerCase().includes('http') || value.toLowerCase().startsWith('www')) ? (
                                    <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline break-all">
                                      {value}
                                    </a>
                                  ) : String(value)}
                                </div>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Related Contacts */}
                    {relatedData.contacts.length > 0 && (
                      <div className="bg-white rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Thông tin liên hệ (từ sheet Contacts)</h3>
                        <div className="space-y-3">
                          {relatedData.contacts.map((contact: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
                              <div className="text-xs font-medium text-slate-600 mb-2">Contact #{idx + 1}</div>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <tbody className="divide-y divide-slate-200">
                                    {Object.entries(contact)
                                      .filter(([_, value]) => value && String(value).trim() && String(value).trim() !== 'N/A')
                                      .map(([key, value]) => {
                                        const formattedKey = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()).trim();
                                        const valueStr = String(value).trim();
                                        let displayValue: any = valueStr;
                                        
                                        if (valueStr.includes('@')) {
                                          displayValue = (
                                            <a href={`mailto:${valueStr}`} className="text-blue-600 hover:underline">
                                              {valueStr}
                                            </a>
                                          );
                                        } else if (valueStr.toLowerCase().includes('http') || valueStr.toLowerCase().startsWith('www')) {
                                          displayValue = (
                                            <a href={valueStr.startsWith('http') ? valueStr : `https://${valueStr}`} 
                                               target="_blank" rel="noopener noreferrer" 
                                               className="text-blue-600 hover:underline break-all">
                                              {valueStr}
                                            </a>
                                          );
                                        }
                                        
                                        return (
                                          <tr key={key} className="hover:bg-white">
                                            <td className="py-1 pr-4 align-top w-1/3">
                                              <span className="font-medium text-slate-700 text-xs">{formattedKey}</span>
                                            </td>
                                            <td className="py-1 align-top">
                                              <span className="text-slate-800 break-words">
                                                {typeof displayValue === 'string' ? displayValue : displayValue}
                                              </span>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Other Editions (Event History) */}
                    {relatedData.otherEditions.length > 0 && (
                      <div className="bg-white rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Lịch sử event ({relatedData.otherEditions.length} editions khác)</h3>
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                          {relatedData.otherEditions.map((edition: any, idx: number) => (
                            <div key={idx} className="bg-slate-50 rounded border border-slate-200 px-3 py-2">
                              <div className="font-medium text-sm text-slate-800 mb-1">
                                {edition.EVENT || edition.Event || edition.eventName || `Edition ${edition.SEQUENCE || idx + 1}`}
                              </div>
                              <div className="text-xs text-slate-600 space-y-0.5">
                                {edition.YEAR && <div>Năm: {edition.YEAR}</div>}
                                {edition.CITY && edition.COUNTRY && (
                                  <div>Địa điểm: {edition.CITY}, {edition.COUNTRY}</div>
                                )}
                                {edition.SEQUENCE && <div>Sequence: {edition.SEQUENCE}</div>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Data Quality Issues */}
                    {(selectedEventForModal as any).issues && Array.isArray((selectedEventForModal as any).issues) && (selectedEventForModal as any).issues.length > 0 && (
                      <div className="bg-slate-50 rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-2">Vấn đề về chất lượng dữ liệu</h3>
                        <div className="space-y-2">
                          {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'critical').length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-red-700 mb-1">Quan trọng:</div>
                              {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'critical').map((issue: any, idx: number) => (
                                <div key={idx} className="text-sm text-red-700 mb-1 pl-3">
                                  • {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                          {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'warning').length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-amber-700 mb-1">Cảnh báo:</div>
                              {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'warning').map((issue: any, idx: number) => (
                                <div key={idx} className="text-sm text-amber-700 mb-1 pl-3">
                                  • {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                          {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'info').length > 0 && (
                            <div>
                              <div className="text-xs font-medium text-slate-600 mb-1">Thông tin:</div>
                              {(selectedEventForModal as any).issues.filter((i: any) => i.severity === 'info').map((issue: any, idx: number) => (
                                <div key={idx} className="text-sm text-slate-600 mb-1 pl-3">
                                  • {issue.message}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* All Event Data in Table Format */}
                    {Object.keys(dataObj).length > 0 && (
                      <div className="bg-white rounded border border-slate-200 px-4 py-3">
                        <h3 className="text-sm font-semibold text-slate-700 mb-3">Tất cả thông tin</h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <tbody className="divide-y divide-slate-200">
                              {Object.entries(dataObj)
                                .sort(([keyA], [keyB]) => {
                                  // Sort by category priority
                                  const priority: { [key: string]: number } = {
                                    'EVENT': 1, 'SERIES': 2, 'NAME': 3, 'TITLE': 4,
                                    'CITY': 5, 'COUNTRY': 6, 'LOCATION': 7,
                                    'YEAR': 8, 'DATE': 9, 'START': 10, 'END': 11,
                                    'EMAIL': 12, 'PHONE': 13, 'CONTACT': 14, 'WEBSITE': 15, 'URL': 16,
                                    'ATTEND': 17, 'DELEGATE': 18, 'TOTATTEND': 19, 'REGATTEND': 20,
                                    'SEQUENCE': 21, 'CODE': 22, 'ID': 23
                                  };
                                  const getPriority = (key: string) => {
                                    const keyUpper = key.toUpperCase();
                                    for (const [prefix, prio] of Object.entries(priority)) {
                                      if (keyUpper.includes(prefix)) return prio;
                                    }
                                    return 999;
                                  };
                                  return getPriority(keyA) - getPriority(keyB);
                                })
                                .map(([key, value]) => {
                                  // Format value
                                  let displayValue: any = value;
                                  const valueStr = String(value || '').trim();
                                  
                                  if (!valueStr || valueStr === 'N/A' || valueStr === 'null' || valueStr === 'undefined') {
                                    displayValue = <span className="text-slate-400 italic">Không có</span>;
                                  } else if (typeof value === 'boolean') {
                                    displayValue = value ? 'Có' : 'Không';
                                  } else if (valueStr.toLowerCase().includes('http') || valueStr.toLowerCase().startsWith('www')) {
                                    displayValue = (
                                      <a href={valueStr.startsWith('http') ? valueStr : `https://${valueStr}`} 
                                         target="_blank" rel="noopener noreferrer" 
                                         className="text-blue-600 hover:underline break-all">
                                        {valueStr}
                                      </a>
                                    );
                                  } else if (valueStr.includes('@')) {
                                    displayValue = (
                                      <a href={`mailto:${valueStr}`} className="text-blue-600 hover:underline">
                                        {valueStr}
                                      </a>
                                    );
                                  } else {
                                    displayValue = valueStr;
                                  }
                                  
                                  // Format key name
                                  const formattedKey = key
                                    .replace(/([A-Z])/g, ' $1')
                                    .replace(/^./, str => str.toUpperCase())
                                    .trim();
                                  
                                  return (
                                    <tr key={key} className="hover:bg-slate-50">
                                      <td className="py-2 pr-4 align-top w-1/3">
                                        <span className="font-medium text-slate-700 text-xs">{formattedKey}</span>
                                      </td>
                                      <td className="py-2 align-top">
                                        <span className="text-slate-800 break-words">
                                          {typeof displayValue === 'string' ? displayValue : displayValue}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Raw Data (for debugging) */}
                    <details className="bg-slate-50 rounded border border-slate-200 px-4 py-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-600 hover:text-slate-800">
                        Raw Data (Click to expand)
                      </summary>
                      <pre className="mt-2 text-xs text-slate-600 bg-white p-2 rounded border border-slate-200 overflow-x-auto">
                        {JSON.stringify(dataObj, null, 2)}
                      </pre>
                    </details>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-slate-200 bg-white flex justify-end">
              <button
                onClick={() => setSelectedEventForModal(null)}
                className="px-4 py-1.5 bg-slate-600 hover:bg-slate-700 text-white text-sm rounded transition-colors"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper function to format markdown text into React elements
// formatMarkdown and formatInlineMarkdown are now imported from utils/markdownUtils

// 6. Chat Assistant
const ChatAssistant = ({ user }: { user: User }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  // Load messages from database when component mounts
  useEffect(() => {
    const loadMessages = async () => {
      if (!user) return;
      
      try {
        setMessagesLoading(true);
        console.log('📥 Loading chat messages for user:', user.username);
        const dbMessages = await chatMessagesApi.getByUsername(user.username);
        console.log('📥 Loaded', dbMessages.length, 'messages from database');
        
        // Map database format to frontend format
        const mappedMessages: ChatMessage[] = dbMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          text: msg.text,
          timestamp: typeof msg.timestamp === 'string' ? new Date(msg.timestamp) : msg.timestamp,
        }));
        
        // If no messages exist, add the welcome message
        if (mappedMessages.length === 0) {
          const welcomeMsg: ChatMessage = {
            id: '1',
            role: 'assistant',
            text: 'Hello! I am your Ariyana Sales Assistant. How can I help you analyze the market today?',
            timestamp: new Date()
          };
          setMessages([welcomeMsg]);
          // Save welcome message to database
          try {
            console.log('💾 Saving welcome message to database:', { 
              id: welcomeMsg.id, 
              username: user.username,
              timestamp: welcomeMsg.timestamp 
            });
            const saved = await chatMessagesApi.create({
              id: welcomeMsg.id,
              username: user.username,
              role: welcomeMsg.role,
              text: welcomeMsg.text,
              timestamp: welcomeMsg.timestamp instanceof Date ? welcomeMsg.timestamp.toISOString() : welcomeMsg.timestamp,
            });
            console.log('✅ Welcome message saved successfully:', saved.id);
          } catch (error: any) {
            console.error('❌ Error saving welcome message:', error);
            console.error('Error details:', error.message, error.stack);
            // Don't show alert for welcome message
          }
        } else {
          setMessages(mappedMessages);
        }
      } catch (error: any) {
        console.error('❌ Error loading chat messages:', error);
        console.error('Error details:', error.message, error.stack);
        // Fallback to welcome message if API fails
        console.log('⚠️ Falling back to local welcome message');
        const welcomeMsg: ChatMessage = {
          id: '1',
          role: 'assistant',
          text: 'Hello! I am your Ariyana Sales Assistant. How can I help you analyze the market today?',
          timestamp: new Date()
        };
        setMessages([welcomeMsg]);
      } finally {
        setMessagesLoading(false);
      }
    };
    
    loadMessages();
  }, [user]);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  const handleSend = async () => {
    if (!input.trim() || (rateLimitCountdown !== null && rateLimitCountdown > 0) || !user) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = input;
    setInput('');
    setLoading(true);
    setRateLimitCountdown(null);

    // Save user message to database
    try {
      console.log('💾 Saving user message to database:', { 
        id: userMsg.id, 
        username: user.username, 
        role: userMsg.role,
        text: userMsg.text.substring(0, 50),
        timestamp: userMsg.timestamp 
      });
      const saved = await chatMessagesApi.create({
        id: userMsg.id,
        username: user.username,
        role: userMsg.role,
        text: userMsg.text,
        timestamp: userMsg.timestamp instanceof Date ? userMsg.timestamp.toISOString() : userMsg.timestamp,
      });
      console.log('✅ User message saved successfully:', saved.id);
    } catch (error: any) {
      console.error('❌ Error saving user message:', error);
      console.error('Error details:', error.message, error.stack);
      // Show error to user but don't block the chat
      alert(`Warning: Could not save message to database. ${error.message || 'Please check console for details.'}`);
    }

    try {
      // Prepare history for API (GPT format)
      const history = messages.map(m => ({
        role: m.role === 'model' ? 'assistant' : m.role, // Convert 'model' to 'assistant' for GPT
        content: m.text
      }));

      const responseText = await GPTService.sendChatMessage(history, currentInput);
      
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'assistant', text: responseText, timestamp: new Date() };
      setMessages(prev => [...prev, botMsg]);
      
      // Save bot message to database
      try {
        console.log('💾 Saving bot message to database:', { 
          id: botMsg.id, 
          username: user.username, 
          role: botMsg.role,
          text: botMsg.text.substring(0, 50),
          timestamp: botMsg.timestamp 
        });
        const saved = await chatMessagesApi.create({
          id: botMsg.id,
          username: user.username,
          role: botMsg.role,
          text: botMsg.text,
          timestamp: botMsg.timestamp instanceof Date ? botMsg.timestamp.toISOString() : botMsg.timestamp,
        });
        console.log('✅ Bot message saved successfully:', saved.id);
      } catch (error: any) {
        console.error('❌ Error saving bot message:', error);
        console.error('Error details:', error.message, error.stack);
        // Don't show alert for bot messages to avoid spam
      }
    } catch (e: any) {
      console.error('❌ Error in handleSend:', e);
      console.error('Error details:', {
        message: e.message,
        name: e.name,
        stack: e.stack,
        code: e.code,
      });
      
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        }
        const errorMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          text: `Rate limit exceeded. Please wait ${retryDelay || 'a moment'} seconds before trying again.`, 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, errorMsg]);
        
        // Save error message to database
        try {
          await chatMessagesApi.create({
            id: errorMsg.id,
            username: user.username,
            role: errorMsg.role,
            text: errorMsg.text,
            timestamp: errorMsg.timestamp,
          });
        } catch (error) {
          console.error('Error saving error message:', error);
        }
      } else {
        // Check for specific error types
        let errorText = "I'm having trouble connecting right now. Please try again.";
        
        // Check if API key is missing
        if (e.message && (e.message.includes('API Key not found') || e.message.includes('OPENAI_API_KEY'))) {
          errorText = "⚠️ OpenAI API Key is not configured. Please set OPENAI_API_KEY in your .env file.";
        } 
        // Check for network errors
        else if (e.message && (e.message.includes('fetch failed') || e.message.includes('network') || e.message.includes('Failed to fetch'))) {
          errorText = "🌐 Network error. Please check your internet connection and try again.";
        }
        // Check for API errors
        else if (e.message && (e.message.includes('401') || e.message.includes('Unauthorized'))) {
          errorText = "🔑 Invalid API Key. Please check your OPENAI_API_KEY in .env file.";
        }
        // Check for API quota errors
        else if (e.message && (e.message.includes('quota') || e.message.includes('429'))) {
          errorText = "⏱️ API quota exceeded. Please try again later.";
        }
        // Show detailed error in development
        else if (import.meta.env.DEV && e.message) {
          errorText = `❌ Error: ${e.message.substring(0, 200)}`;
        }
        
        const errorMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'assistant', 
          text: errorText, 
          timestamp: new Date() 
        };
        setMessages(prev => [...prev, errorMsg]);
        
        // Save error message to database
        try {
          await chatMessagesApi.create({
            id: errorMsg.id,
            username: user.username,
            role: errorMsg.role,
            text: errorMsg.text,
            timestamp: errorMsg.timestamp,
          });
        } catch (error) {
          console.error('Error saving error message:', error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50">
      <div className="p-4 bg-white border-b border-slate-200 shadow-sm flex items-center justify-between">
         <h2 className="text-lg font-bold text-slate-800 flex items-center">
           <Bot className="mr-2 text-blue-600" /> AI Sales Assistant
         </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messagesLoading ? (
          <div className="flex justify-center items-center h-full">
            <div className="flex items-center space-x-2 text-slate-500">
              <Loader2 size={20} className="animate-spin" />
              <span>Loading chat history...</span>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] p-4 rounded-lg shadow-sm text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
            }`}>
              {msg.role === 'assistant' ? (
                <div className="prose prose-sm max-w-none">
                  {formatMarkdown(msg.text)}
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.text}</div>
              )}
            </div>
          </div>
        ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-lg border border-slate-200 rounded-bl-none flex items-center space-x-2">
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-75"></div>
              <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce delay-150"></div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
        <div className="p-4 bg-yellow-50 border-t border-yellow-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
              <p className="text-xs text-yellow-700 mt-1">Please wait before sending another message</p>
            </div>
            <div className="text-xl font-bold text-yellow-600">
              {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
            </div>
          </div>
        </div>
      )}

      <div className="p-4 bg-white border-t border-slate-200">
        <div className="flex items-center space-x-2">
          <input 
            className="flex-1 p-3 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed transition-colors"
            placeholder={rateLimitCountdown !== null && rateLimitCountdown > 0 ? `Wait ${rateLimitCountdown}s...` : "Ask about leads, email templates, or market trends..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={rateLimitCountdown !== null && rateLimitCountdown > 0}
          />
          <button 
            onClick={handleSend}
            disabled={loading || !input.trim() || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

// 6. Email Templates Management View
const EmailTemplatesView = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState({ name: '', subject: '', body: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; subject?: string; body?: string }>({});
  const [bodyViewMode, setBodyViewMode] = useState<'code' | 'preview'>('preview');

  useEffect(() => {
    loadTemplates();
  }, []);

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
          className="bg-slate-900 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-colors shrink-0 inline-flex items-center"
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
              className="mt-4 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center"
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
                  <tr key={template.id} className="hover:bg-slate-50 transition-colors">
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
                          className="text-indigo-600 hover:text-indigo-800 font-medium text-sm inline-flex items-center"
                        >
                          <Edit2 size={16} className="mr-1" /> Edit
                        </button>
                        <button
                          onClick={() => handleDelete(template.id)}
                          className="text-red-600 hover:text-red-800 font-medium text-sm inline-flex items-center"
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
                className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
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
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    formErrors.name ? 'border-red-300' : 'border-slate-300'
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
                  className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                    formErrors.subject ? 'border-red-300' : 'border-slate-300'
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
                      onClick={() => setBodyViewMode('code')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        bodyViewMode === 'code'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      HTML Code
                    </button>
                    <button
                      type="button"
                      onClick={() => setBodyViewMode('preview')}
                      className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
                        bodyViewMode === 'preview'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                    className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none font-mono ${
                      formErrors.body ? 'border-red-300' : 'border-slate-300'
                    }`}
                  />
                ) : (
                  <div 
                    className="w-full border rounded-lg border-slate-300 bg-white overflow-auto"
                    style={{ minHeight: '500px', maxHeight: '600px' }}
                  >
                    <div
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(e) => {
                        const html = e.currentTarget.innerHTML;
                        setFormData({ ...formData, body: html });
                      }}
                      onBlur={(e) => {
                        const html = e.currentTarget.innerHTML;
                        setFormData({ ...formData, body: html });
                      }}
                      dangerouslySetInnerHTML={{ __html: formData.body || '<div style="padding: 20px; color: #666; text-align: center;">Click here to start editing your email template. Use variables like {{keyPersonName}}, {{companyName}}, etc.</div>' }}
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
                className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center"
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

// 7. User Profile View
const UserProfileView = ({ user, onUpdateUser }: { user: User, onUpdateUser: (user: User) => void }) => {
  const [formData, setFormData] = useState({
    name: user.name,
    avatar: user.avatar || '',
  });
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [successMessage, setSuccessMessage] = useState<string>('');

  const validateForm = (): boolean => {
    const errors: { name?: string } = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setLoading(true);
    setSuccessMessage('');
    try {
      const updatedUser = await usersApi.update(user.username, {
        name: formData.name.trim(),
        avatar: formData.avatar.trim() || undefined,
      });
      
      if (updatedUser) {
        onUpdateUser(updatedUser);
        setSuccessMessage('Profile updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user.name,
      avatar: user.avatar || '',
    });
    setFormErrors({});
    setSuccessMessage('');
  };

  return (
    <div className="p-6 min-h-screen flex flex-col space-y-5">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">My Profile</h2>
          <p className="text-sm text-slate-600 mt-1">Manage your account information</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">{successMessage}</p>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="space-y-6">
          {/* Avatar Section */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Avatar URL
            </label>
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 overflow-hidden border-2 border-blue-400/50 shadow-lg flex-shrink-0">
                {formData.avatar ? (
                  <img src={formData.avatar} alt="avatar" className="w-full h-full object-cover" onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-white text-2xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <input
                  type="text"
                  value={formData.avatar}
                  onChange={(e) => setFormData({ ...formData, avatar: e.target.value })}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                />
                <p className="text-xs text-slate-500 mt-1">Enter a URL for your profile picture</p>
              </div>
            </div>
          </div>

          {/* Username (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Username
            </label>
            <input
              type="text"
              value={user.username}
              disabled
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Username cannot be changed</p>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter your full name"
              className={`w-full px-4 py-2.5 bg-white border rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none ${
                formErrors.name ? 'border-red-300' : 'border-slate-300'
              }`}
            />
            {formErrors.name && (
              <p className="text-xs text-red-600 mt-1">{formErrors.name}</p>
            )}
          </div>

          {/* Role (Read-only) */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Role
            </label>
            <input
              type="text"
              value={user.role}
              disabled
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="text-xs text-slate-500 mt-1">Role cannot be changed</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end gap-3">
          <button
            onClick={handleCancel}
            disabled={loading}
            className="px-4 py-2 text-slate-700 bg-white border border-slate-300 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors inline-flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// 8. Video Analysis View
const VideoAnalysisView = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [videoAnalysisError, setVideoAnalysisError] = useState<string | null>(null);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 9MB Safety Limit for XHR
      if (file.size > 9 * 1024 * 1024) {
        setVideoAnalysisError("File too large. Please upload an image or video under 9MB for this demo.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysis('');
      setVideoAnalysisError(null); // Clear previous errors when new file is selected
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setRateLimitCountdown(null);
    setVideoAnalysisError(null); // Clear previous errors
    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(',')[1];
          const result = await GeminiService.analyzeVideoContent(base64Str, selectedFile.type);
          setAnalysis(result);
          setVideoAnalysisError(null); // Clear error on success
        } catch (e: any) {
          console.error(e);
          if (isGeminiRateLimitError(e)) {
            const retryDelay = extractGeminiRetryDelay(e);
            if (retryDelay) {
              setRateLimitCountdown(retryDelay);
              setVideoAnalysisError(null); // Rate limit countdown will be shown separately
            } else {
              setVideoAnalysisError("Rate limit exceeded. Please try again later.");
            }
          } else {
            setVideoAnalysisError(`Analysis failed: ${e.message || 'Unknown error occurred'}`);
          }
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setLoading(false);
        setVideoAnalysisError("Error reading file. Please try uploading again.");
      };
    } catch (e: any) {
      console.error(e);
      if (isGeminiRateLimitError(e)) {
        const retryDelay = extractGeminiRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
          setVideoAnalysisError(null); // Rate limit countdown will be shown separately
        } else {
          setVideoAnalysisError("Rate limit exceeded. Please try again later.");
        }
      } else {
        setVideoAnalysisError(`Analysis failed: ${e.message || 'Unknown error occurred'}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Competitor Video Intelligence</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors bg-white">
            <input 
              type="file" 
              accept="image/*,video/*" 
              onChange={handleFileChange} 
              className="hidden" 
              id="video-upload"
            />
            {previewUrl ? (
              <div className="w-full relative">
                 {selectedFile?.type.startsWith('video') ? (
                   <video src={previewUrl} controls className="w-full rounded-lg max-h-64 object-cover" />
                 ) : (
                   <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
                 )}
                 <button 
                   onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                   className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow hover:bg-red-600"
                 >
                   <X size={14} />
                 </button>
              </div>
            ) : (
              <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                  <Upload size={32} />
                </div>
                <h3 className="font-semibold text-slate-700">Upload Competitor Material</h3>
                <p className="text-sm text-slate-400 mt-2">Supports Images & Short Videos (Max 9MB)</p>
              </label>
            )}
          </div>

          {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
                  <p className="text-xs text-yellow-700 mt-1">Please wait before trying again</p>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {videoAnalysisError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error</p>
                  <p className="text-xs text-red-700 mt-1">{videoAnalysisError}</p>
                </div>
                <button
                  onClick={() => setVideoAnalysisError(null)}
                  className="text-red-600 hover:text-red-800 flex-shrink-0 ml-2 p-1 hover:bg-red-100 rounded"
                  aria-label="Close error message"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <button 
            onClick={handleAnalyze}
            disabled={!selectedFile || loading || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-lg hover:bg-indigo-700 disabled:opacity-50 flex justify-center items-center shadow-lg shadow-indigo-200"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <BrainCircuit className="mr-2" />}
            {rateLimitCountdown !== null && rateLimitCountdown > 0 
              ? `Retry in ${rateLimitCountdown}s` 
              : 'Analyze with Gemini AI'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-full min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <FileText className="mr-2 text-indigo-500" /> Analysis Report
          </h3>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 size={40} className="animate-spin mb-4 text-indigo-500" />
              <p>Extracting insights...</p>
            </div>
          ) : analysis ? (
            <div className="prose prose-sm prose-indigo max-w-none text-slate-700 whitespace-pre-wrap">
              {analysis}
            </div>
          ) : videoAnalysisError ? (
            <div className="flex items-center justify-center h-64 text-red-400 italic">
              <div className="text-center">
                <p className="mb-2">⚠️ Analysis could not be completed</p>
                <p className="text-sm">Please check the error message above</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 italic">
              Upload content to see AI insights here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


// 8. Main App Layout
const App = () => {
  // Sidebar toggle state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  
  // Load user from localStorage on mount
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('ariyana_user');
      if (savedUser) {
        return JSON.parse(savedUser);
      }
    } catch (error) {
      console.error('Error loading user from localStorage:', error);
    }
    return null;
  });

  // Load activeTab from localStorage
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('ariyana_activeTab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(false);

  // Save activeTab to localStorage when it changes
  useEffect(() => {
    if (user) {
      localStorage.setItem('ariyana_activeTab', activeTab);
    }
  }, [activeTab, user]);

  // Fetch leads from API when user logs in
  useEffect(() => {
    if (user) {
      const fetchLeads = async () => {
        try {
          setLeadsLoading(true);
          const fetchedLeads = await leadsApi.getAll();
          // Map database fields to frontend format
          const mappedLeads = fetchedLeads.map(mapLeadFromDB);
          setLeads(mappedLeads);
        } catch (error: any) {
          console.error('Error fetching leads:', error);
          // Fallback to INITIAL_LEADS if API fails
          setLeads(INITIAL_LEADS);
        } finally {
          setLeadsLoading(false);
        }
      };
      fetchLeads();
    } else {
      // Clear leads when user logs out
      setLeads([]);
    }
  }, [user]);

  const handleLogin = (u: User) => {
    setUser(u);
    setActiveTab('dashboard');
    // Save user to localStorage
    try {
      localStorage.setItem('ariyana_user', JSON.stringify(u));
      localStorage.setItem('ariyana_activeTab', 'dashboard');
    } catch (error) {
      console.error('Error saving user to localStorage:', error);
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
    // Update user in localStorage
    try {
      localStorage.setItem('ariyana_user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Error updating user in localStorage:', error);
    }
  };

  const handleLogout = () => {
    setUser(null);
    // Clear localStorage
    try {
      localStorage.removeItem('ariyana_user');
      localStorage.removeItem('ariyana_activeTab');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
  };

  const handleUpdateLead = async (updatedLead: Lead) => {
    try {
      // Map to database format before updating
      const mappedLead = mapLeadToDB(updatedLead);
      // Update in database via API
      const updated = await leadsApi.update(updatedLead.id, mappedLead);
      // Map back to frontend format
      const mappedBack = mapLeadFromDB(updated);
      // Update local state
      setLeads(prev => prev.map(l => l.id === updatedLead.id ? mappedBack : l));
      if (selectedLead && selectedLead.id === updatedLead.id) {
        setSelectedLead(mappedBack);
      }
    } catch (error: any) {
      console.error('Error updating lead:', error);
      // Still update local state even if API fails
      setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      if (selectedLead && selectedLead.id === updatedLead.id) {
        setSelectedLead(updatedLead);
      }
    }
  };

  const handleAddLeads = async (newLeads: Lead[]): Promise<void> => {
    if (newLeads.length === 0) return;
    
    try {
      console.log('💾 Starting to save', newLeads.length, 'leads to database...');
      
      // Load existing leads to check for duplicates
      console.log('🔍 Checking for duplicates in database...');
      const existingLeads = await leadsApi.getAll();
      const existingCompanyNames = new Set(existingLeads.map(l => l.company_name?.toLowerCase().trim()).filter(Boolean));
      // Create a map for quick lookup: company_name (lowercase) -> lead
      const existingLeadsMap = new Map<string, any>();
      existingLeads.forEach(l => {
        const key = l.company_name?.toLowerCase().trim();
        if (key) {
          existingLeadsMap.set(key, l);
        }
      });
      
      let successCount = 0;
      let failCount = 0;
      let duplicateCount = 0;
      let updatedCount = 0;
      
      // Create leads in database via API
      for (const lead of newLeads) {
        try {
          // Check for duplicate by company name (case-insensitive)
          const companyNameLower = lead.companyName?.toLowerCase().trim();
          const existingLead = companyNameLower ? existingLeadsMap.get(companyNameLower) : null;
          
          if (existingLead) {
            // Lead already exists - check if we need to update key_person_email
            const existingKeyPersonEmail = existingLead.key_person_email || existingLead.keyPersonEmail || '';
            const importKeyPersonEmail = lead.keyPersonEmail || '';
            
            if (!existingKeyPersonEmail.trim() && importKeyPersonEmail.trim()) {
              // Update key_person_email if it's null in database but exists in import
              console.log(`🔄 Updating key_person_email for existing lead: ${lead.companyName}`);
              const updateData = mapLeadToDB(lead);
              await leadsApi.update(existingLead.id, { key_person_email: importKeyPersonEmail.trim() });
              updatedCount++;
              console.log(`✅ Updated key_person_email for: ${lead.companyName}`);
            } else {
              console.log(`⏭️  Skipping duplicate lead: ${lead.companyName} (already exists in database)`);
              duplicateCount++;
            }
            continue;
          }
          
          const mappedLead = mapLeadToDB(lead);
          console.log('💾 Saving lead:', lead.companyName);
          await leadsApi.create(mappedLead);
          successCount++;
          
          // Add to existing set to avoid duplicates in same batch
          if (companyNameLower) {
            existingCompanyNames.add(companyNameLower);
            existingLeadsMap.set(companyNameLower, { id: mappedLead.id, company_name: mappedLead.company_name });
          }
          
          console.log('✅ Saved lead:', lead.companyName);
        } catch (error: any) {
          // Check if error is due to duplicate (unique constraint violation)
          if (error.message?.includes('duplicate') || error.message?.includes('unique') || error.message?.includes('already exists')) {
            console.log(`⏭️  Skipping duplicate lead: ${lead.companyName} (database constraint)`);
            duplicateCount++;
          } else {
            console.error('❌ Error creating lead:', lead.companyName, error);
            failCount++;
          }
          // Continue with other leads even if one fails
        }
      }
      
      // Show summary to user
      let summaryMessage = `✅ Successfully saved ${successCount} lead${successCount !== 1 ? 's' : ''} to database`;
      if (updatedCount > 0) {
        summaryMessage += `\n🔄 Updated key_person_email for ${updatedCount} existing lead${updatedCount !== 1 ? 's' : ''}`;
      }
      if (duplicateCount > 0) {
        summaryMessage += `\n⏭️  Skipped ${duplicateCount} duplicate lead${duplicateCount !== 1 ? 's' : ''} (already exists)`;
      }
      if (failCount > 0) {
        summaryMessage += `\n⚠️ Failed to save ${failCount} lead${failCount !== 1 ? 's' : ''}`;
      }
      
      console.log(`✅ Successfully saved ${successCount}/${newLeads.length} leads to database`);
      if (updatedCount > 0) {
        console.log(`🔄 Updated key_person_email for ${updatedCount} existing leads`);
      }
      if (duplicateCount > 0) {
        console.log(`⏭️  Skipped ${duplicateCount} duplicate leads`);
      }
      if (failCount > 0) {
        console.warn(`⚠️ Failed to save ${failCount} leads`);
      }
      
      // Refresh leads from API
      console.log('🔄 Refreshing leads list from database...');
      const fetchedLeads = await leadsApi.getAll();
      const mappedLeads = fetchedLeads.map(mapLeadFromDB);
      setLeads(mappedLeads);
      console.log('✅ Leads list refreshed:', mappedLeads.length, 'total leads');
    } catch (error: any) {
      console.error('❌ Error adding leads:', error);
      throw error; // Re-throw to let caller handle it
    }
  };

  const handleAddNewLead = () => {
    // Create a new empty lead and open it in detail modal
    const newLead: Lead = {
      id: `new-${Date.now()}`,
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
      totalEvents: 0,
      vietnamEvents: 0,
      notes: '',
      status: 'New',
    };
    setSelectedLead(newLead);
  };

  // Helper function to map frontend format to database format
  // mapLeadToDB is now imported from utils/leadUtils

  // Login Screen Check
  if (!user) {
    return <LoginView onLogin={handleLogin} />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard leads={leads} loading={leadsLoading} />;
      case 'leads':
        return <LeadsView leads={leads} onSelectLead={setSelectedLead} onUpdateLead={handleUpdateLead} user={user} onAddLead={handleAddNewLead} />;
      case 'intelligent':
        // Double check in render for safety
        if (user.role !== 'Director') return <Dashboard leads={leads} />;
        return <IntelligentDataView onSaveToLeads={handleAddLeads} />;
      case 'analysis':
        return <VideoAnalysisView />;
      case 'chat':
        return <ChatAssistant user={user} />;
      case 'email-templates':
        // Only Director and Sales can access
        if (user.role !== 'Director' && user.role !== 'Sales') return <Dashboard leads={leads} />;
        return <EmailTemplatesView />;
      case 'profile':
        return <UserProfileView user={user} onUpdateUser={handleUpdateUser} />;
      default:
        return <Dashboard leads={leads} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />
      
      <main className={`flex-1 relative transition-all duration-300 ease-in-out ${
        sidebarOpen ? 'ml-52' : 'ml-0'
      }`}>
        {renderContent()}
      </main>

      {selectedLead && (
        <LeadDetail 
          lead={selectedLead} 
          onClose={() => setSelectedLead(null)} 
          onSave={handleUpdateLead}
          user={user}
        />
      )}
    </div>
  );
};

export default App;
