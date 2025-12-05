import React, { useState, useRef, useEffect } from 'react';
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
  Lock
} from 'lucide-react';
import { INITIAL_LEADS, EMAIL_TEMPLATES, USERS } from './constants';
import { Lead, ChatMessage, User } from './types';
import * as GeminiService from './services/geminiService';
import { extractRetryDelay, isRateLimitError } from './services/geminiService';
import { chatMessagesApi, type ChatMessageDB } from './services/apiService';
import { usersApi, leadsApi } from './services/apiService';

// --- Components ---

// 0. Login View
const LoginView = ({ onLogin }: { onLogin: (user: User) => void }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch users from API
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const fetchedUsers = await usersApi.getAll();
        setUsers(fetchedUsers);
        if (fetchedUsers.length > 0) {
          setSelectedUser(fetchedUsers[0].username);
        }
      } catch (err: any) {
        console.error('Error fetching users:', err);
        setError(err.message || 'Failed to load users');
        // Fallback to constants if API fails
        setUsers(USERS);
        if (USERS.length > 0) {
          setSelectedUser(USERS[0].username);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleLogin = async () => {
    if (!selectedUser) return;
    
    try {
      const user = await usersApi.getByUsername(selectedUser);
      if (user) {
        onLogin(user);
      } else {
        // Fallback: try to find in local users array
        const localUser = users.find(u => u.username === selectedUser);
        if (localUser) {
          onLogin(localUser);
        } else {
          setError('User not found');
        }
      }
    } catch (err: any) {
      console.error('Error logging in:', err);
      // Fallback: try to find in local users array
      const localUser = users.find(u => u.username === selectedUser);
      if (localUser) {
        onLogin(localUser);
      } else {
        setError(err.message || 'Failed to login');
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden p-8 text-center">
          <Loader2 className="animate-spin mx-auto mb-4 text-blue-600" size={32} />
          <p className="text-slate-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
        <div className="bg-blue-600 p-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">Ariyana CRM</h1>
          <p className="text-blue-100">Event Intelligence System</p>
        </div>
        <div className="p-8 space-y-6">
          {error && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-3 rounded-lg text-sm space-y-2">
              <p className="font-semibold">⚠️ Warning:</p>
              <p>{error}</p>
              {error.includes('Cannot connect to API') && (
                <p className="text-xs mt-2 text-yellow-700">
                  Make sure the backend API is running: <code className="bg-yellow-100 px-1 rounded">npm run dev:api</code>
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Select User Role</label>
            <div className="relative">
              <select 
                value={selectedUser}
                onChange={(e) => setSelectedUser(e.target.value)}
                className="w-full p-3 pl-10 border border-slate-300 rounded-lg appearance-none focus:ring-2 focus:ring-blue-500 outline-none bg-slate-50"
                disabled={users.length === 0}
              >
                {users.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.name} — {u.role}
                  </option>
                ))}
              </select>
              <Users className="absolute left-3 top-3.5 text-slate-400" size={18} />
            </div>
          </div>
          
          <button 
            onClick={handleLogin}
            disabled={!selectedUser || users.length === 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-lg shadow-lg shadow-blue-200 transition-all flex justify-center items-center"
          >
            Sign In <ChevronRight size={18} className="ml-2" />
          </button>
          
          <div className="text-center text-xs text-slate-400 mt-4">
             Access is restricted to authorized personnel only.
          </div>
        </div>
      </div>
    </div>
  );
};

// 1. Sidebar
const Sidebar = ({ activeTab, setActiveTab, user, onLogout }: { activeTab: string, setActiveTab: (t: string) => void, user: User, onLogout: () => void }) => (
  <div className="w-64 bg-slate-900 text-white flex flex-col h-screen fixed left-0 top-0 border-r border-slate-800 shadow-xl z-20">
    <div className="p-6 border-b border-slate-800">
      <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent">Ariyana CRM</h1>
      <p className="text-xs text-slate-400 mt-1">Event Intelligence</p>
    </div>
    
    <div className="p-4 border-b border-slate-800 flex items-center space-x-3">
       <div className="w-10 h-10 rounded-full bg-slate-700 overflow-hidden border border-slate-600">
          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
       </div>
       <div>
         <p className="text-sm font-bold text-slate-200">{user.name}</p>
         <p className="text-xs text-blue-400 uppercase font-semibold">{user.role}</p>
       </div>
    </div>

    <nav className="flex-1 p-4 space-y-2">
      <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" id="dashboard" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<Users size={20} />} label="ICCA Leads" id="leads" active={activeTab} onClick={setActiveTab} />
      
      {/* Restrict Strategy to Director */}
      {user.role === 'Director' && (
        <NavItem icon={<BrainCircuit size={20} />} label="Intelligent Data" id="intelligent" active={activeTab} onClick={setActiveTab} />
      )}
      
      <NavItem icon={<Film size={20} />} label="Video Analysis" id="analysis" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<MessageSquare size={20} />} label="AI Assistant" id="chat" active={activeTab} onClick={setActiveTab} />
    </nav>
    
    <div className="p-4 border-t border-slate-800 space-y-4">
      <button 
        onClick={onLogout}
        className="w-full flex items-center space-x-3 px-4 py-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors text-sm"
      >
        <LogOut size={16} />
        <span>Sign Out</span>
      </button>
      <div className="text-xs text-slate-600 text-center">
        Powered by Gemini 2.5 & 3.0
      </div>
    </div>
  </div>
);

const NavItem = ({ icon, label, id, active, onClick }: any) => (
  <button 
    onClick={() => onClick(id)}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-all duration-200 ${active === id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
  >
    {icon}
    <span className="font-medium">{label}</span>
  </button>
);

// Helper function to map database fields to frontend format
const mapLeadFromDB = (dbLead: any): Lead => {
  return {
    id: dbLead.id,
    companyName: dbLead.company_name || dbLead.companyName,
    industry: dbLead.industry,
    country: dbLead.country,
    city: dbLead.city,
    website: dbLead.website || '',
    keyPersonName: dbLead.key_person_name || dbLead.keyPersonName,
    keyPersonTitle: dbLead.key_person_title || dbLead.keyPersonTitle || '',
    keyPersonEmail: dbLead.key_person_email || dbLead.keyPersonEmail || '',
    keyPersonPhone: dbLead.key_person_phone || dbLead.keyPersonPhone || '',
    keyPersonLinkedIn: dbLead.key_person_linkedin || dbLead.keyPersonLinkedIn || '',
    totalEvents: dbLead.total_events || dbLead.totalEvents || 0,
    vietnamEvents: dbLead.vietnam_events || dbLead.vietnamEvents || 0,
    notes: dbLead.notes || '',
    status: dbLead.status,
    lastContacted: dbLead.last_contacted || dbLead.lastContacted,
    pastEventsHistory: dbLead.past_events_history || dbLead.pastEventsHistory,
    secondaryPersonName: dbLead.secondary_person_name || dbLead.secondaryPersonName,
    secondaryPersonTitle: dbLead.secondary_person_title || dbLead.secondaryPersonTitle,
    secondaryPersonEmail: dbLead.secondary_person_email || dbLead.secondaryPersonEmail,
    researchNotes: dbLead.research_notes || dbLead.researchNotes,
    numberOfDelegates: dbLead.number_of_delegates || dbLead.numberOfDelegates,
  };
};

// 2. Dashboard View
const Dashboard = ({ leads, loading }: { leads: Lead[], loading?: boolean }) => {
  const stats = {
    total: leads.length,
    vietnam: leads.filter(l => l.vietnamEvents > 0).length,
    new: leads.filter(l => l.status === 'New').length,
    qualified: leads.filter(l => l.status === 'Qualified').length
  };

  const chartData = [
    { name: 'New', count: stats.new },
    { name: 'Contacted', count: leads.filter(l => l.status === 'Contacted').length },
    { name: 'Qualified', count: stats.qualified },
    { name: 'Won', count: leads.filter(l => l.status === 'Won').length },
  ];

  if (loading) {
    return (
      <div className="p-8 space-y-8 animate-fade-in">
        <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <span className="ml-3 text-slate-600">Loading leads...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <h2 className="text-2xl font-bold text-slate-800">Overview</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Total Leads" value={stats.total} icon={<Users className="text-blue-500" />} />
        <StatCard title="Vietnam Events" value={stats.vietnam} icon={<Search className="text-teal-500" />} />
        <StatCard title="New Opportunities" value={stats.new} icon={<Plus className="text-indigo-500" />} />
        <StatCard title="Qualified" value={stats.qualified} icon={<ChevronRight className="text-green-500" />} />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold mb-6">Pipeline Status</h3>
        <div className="h-64 w-full">
          <SimpleBarChart data={chartData} />
        </div>
      </div>
    </div>
  );
};

const SimpleBarChart = ({ data }: { data: { name: string, count: number }[] }) => {
  const max = Math.max(...data.map(d => d.count)) || 1; // Avoid division by zero
  
  return (
    <div className="h-full w-full flex items-end justify-around px-4 pb-6 pt-10 space-x-8">
      {data.map((d) => (
        <div key={d.name} className="flex flex-col items-center justify-end h-full flex-1 group">
           <div className="mb-3 opacity-100 text-sm font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded shadow-sm">
             {d.count}
           </div>
           <div className="w-full bg-slate-100 rounded-t-lg h-full relative flex items-end overflow-hidden">
             <div 
               className="w-full bg-blue-500 rounded-t-lg transition-all duration-700 ease-out hover:bg-blue-600"
               style={{ height: `${(d.count / max) * 100}%` }}
             ></div>
           </div>
           <p className="mt-4 text-sm text-slate-500 font-medium">{d.name}</p>
        </div>
      ))}
    </div>
  );
};

const StatCard = ({ title, value, icon }: any) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex items-center justify-between hover:shadow-md transition-shadow">
    <div>
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <p className="text-3xl font-bold text-slate-800 mt-1">{value}</p>
    </div>
    <div className="p-3 bg-slate-50 rounded-full">{icon}</div>
  </div>
);

// 3. Leads View
const LeadsView = ({ leads, onSelectLead, onUpdateLead, user, onAddLead }: { leads: Lead[], onSelectLead: (lead: Lead) => void, onUpdateLead: (lead: Lead) => void, user: User, onAddLead?: () => void }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLeads = leads.filter(lead => 
    lead.companyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.keyPersonName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.industry.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 h-screen flex flex-col">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 space-y-4 md:space-y-0">
        <h2 className="text-2xl font-bold text-slate-800">ICCA Association Leads</h2>
        
        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <input 
              type="text"
              placeholder="Search leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            />
            <Search className="absolute left-3 top-2.5 text-slate-400 pointer-events-none" size={16} />
          </div>
          {/* Only Director and Sales can add manual leads */}
          {(user.role === 'Director' || user.role === 'Sales') && (
            <button 
              onClick={onAddLead}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center shadow-sm shrink-0"
            >
              <Plus size={16} className="mr-2" /> Add Manually
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex-1 overflow-hidden flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="p-4 w-64">Company Name</th>
                <th className="p-4">Industry</th>
                <th className="p-4">City/Country</th>
                <th className="p-4">Key Person</th>
                <th className="p-4">Delegates</th>
                <th className="p-4">Status</th>
                <th className="p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length > 0 ? (
                filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900">{lead.companyName}</td>
                    <td className="p-4 text-slate-500">{lead.industry}</td>
                    <td className="p-4 text-slate-500">
                      <div className="flex flex-col">
                         <span>{lead.city}</span>
                         <span className="text-xs text-slate-400">{lead.country}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">
                      <div className="flex flex-col">
                        <span>{lead.keyPersonName}</span>
                        <span className="text-xs text-slate-400">{lead.keyPersonTitle}</span>
                      </div>
                    </td>
                    <td className="p-4 text-slate-500">{lead.numberOfDelegates || '-'}</td>
                    <td className="p-4">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="p-4">
                      <button 
                        onClick={() => onSelectLead(lead)}
                        className="text-blue-600 hover:text-blue-800 font-medium flex items-center text-xs"
                      >
                        Details <ChevronRight size={14} className="ml-1" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    No leads found matching "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const colors: any = {
    'New': 'bg-blue-100 text-blue-700',
    'Contacted': 'bg-yellow-100 text-yellow-700',
    'Qualified': 'bg-purple-100 text-purple-700',
    'Won': 'bg-green-100 text-green-700',
    'Lost': 'bg-red-100 text-red-700'
  };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100'}`}>
      {status}
    </span>
  );
};

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
  
  // Email States
  const [emailLoading, setEmailLoading] = useState(false);
  const [draftedEmail, setDraftedEmail] = useState<{subject: string, body: string} | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [emailRateLimitCountdown, setEmailRateLimitCountdown] = useState<number | null>(null);

  const canEdit = user.role === 'Director' || user.role === 'Sales';

  // Sync when prop lead changes
  useEffect(() => {
    setEditedLead(lead);
    setEnrichCompanyName(lead.companyName || '');
    setEnrichKeyPerson(lead.keyPersonName || '');
    setEnrichCity(lead.city || '');
  }, [lead]);

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

  const handleEnrich = async () => {
    if (!enrichCompanyName || enrichCompanyName.trim() === '') {
      alert('Please enter a company name to search');
      return;
    }
    
    setEnrichLoading(true);
    setRateLimitCountdown(null);
    try {
      const result = await GeminiService.enrichLeadData(
        enrichCompanyName.trim(), 
        enrichKeyPerson.trim() || '', 
        enrichCity.trim() || ''
      );
      setEnrichResult(result);
    } catch (e: any) {
      console.error(e);
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
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

    const template = EMAIL_TEMPLATES.find(t => t.id === tmplId);
    if (template) {
      setDraftedEmail({
        subject: template.subject.replace('[Company Name]', lead.companyName),
        body: template.body.replace('[Key Person Name]', lead.keyPersonName).replace('[Company Name]', lead.companyName)
      });
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
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
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

  const handleSendEmail = () => {
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
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col overflow-hidden animate-slide-in-right">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{lead.companyName}</h2>
            <p className="text-sm text-slate-500">{lead.industry} • {lead.country}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">Close</button>
        </div>

        <div className="flex border-b border-slate-200">
          <button onClick={() => setActiveTab('info')} className={`flex-1 py-3 font-medium text-sm ${activeTab === 'info' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>Contact Info</button>
          
          <button onClick={() => setActiveTab('enrich')} className={`flex-1 py-3 font-medium text-sm flex justify-center items-center ${activeTab === 'enrich' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>
             <Search size={14} className="mr-2" /> Google Enrich
          </button>
          
          {canEdit ? (
            <button onClick={() => setActiveTab('email')} className={`flex-1 py-3 font-medium text-sm flex justify-center items-center ${activeTab === 'email' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-500'}`}>
              <Mail size={14} className="mr-2" /> AI Email
            </button>
          ) : (
             <div className="flex-1 py-3 font-medium text-sm flex justify-center items-center text-slate-300 cursor-not-allowed" title="Viewer Only">
               <Lock size={14} className="mr-2" /> AI Email
             </div>
          )}
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center mb-4">
                 <h3 className="font-semibold text-slate-700">Lead Details</h3>
                 {canEdit && !isEditing && (
                   <button onClick={() => setIsEditing(true)} className="text-sm text-blue-600 flex items-center hover:bg-blue-50 px-3 py-1 rounded">
                     <Edit2 size={14} className="mr-2" /> Edit Info
                   </button>
                 )}
                 {!canEdit && (
                   <span className="text-xs bg-slate-100 text-slate-500 px-2 py-1 rounded flex items-center">
                     <Lock size={10} className="mr-1" /> Read Only
                   </span>
                 )}
                 {isEditing && (
                   <div className="flex space-x-2">
                     <button onClick={() => setIsEditing(false)} className="text-sm text-red-600 flex items-center hover:bg-red-50 px-3 py-1 rounded">
                       <X size={14} className="mr-2" /> Cancel
                     </button>
                     <button onClick={handleSaveChanges} className="text-sm text-green-600 flex items-center hover:bg-green-50 px-3 py-1 rounded font-bold">
                       <Check size={14} className="mr-2" /> Save
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
                          className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
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
                          className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
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
                  <div className="flex justify-between items-center mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                     <div>
                       <span className="text-xs font-bold text-slate-500 uppercase block">Status</span>
                       <StatusBadge status={lead.status} />
                     </div>
                     <div className="text-right">
                       <span className="text-xs font-bold text-slate-500 uppercase block">Est. Delegates</span>
                       <span className="text-sm font-bold text-slate-800">{lead.numberOfDelegates || 'N/A'}</span>
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
                </>
              )}
            </div>
          )}

          {activeTab === 'enrich' && (
            <div className="space-y-6">
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
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
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
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      disabled={enrichLoading}
                    />
                  </div>

                  <button 
                    onClick={handleEnrich}
                    disabled={enrichLoading || !canEdit || (rateLimitCountdown !== null && rateLimitCountdown > 0) || !enrichCompanyName.trim()}
                    className="w-full py-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg font-medium flex justify-center items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enrichLoading ? (
                      <>
                        <Loader2 className="animate-spin mr-2" />
                        Searching...
                      </>
                    ) : rateLimitCountdown !== null && rateLimitCountdown > 0 ? (
                      <>
                        <Loader2 className="mr-2" />
                        Retry in {rateLimitCountdown}s
                      </>
                    ) : (
                      <>
                        <Search className="mr-2" size={16} />
                        Search Live Data
                      </>
                    )}
                  </button>
                </div>
              )}

              {enrichResult && (
                <div className="space-y-4">
                  <div className="prose prose-sm max-w-none text-slate-700">
                    <h4 className="font-bold text-slate-900">AI Summary</h4>
                    <p className="whitespace-pre-wrap">{enrichResult.text}</p>
                  </div>
                  {enrichResult.grounding && (
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <h5 className="text-xs font-bold text-slate-500 uppercase mb-2">Sources</h5>
                      <ul className="space-y-1">
                        {enrichResult.grounding.map((chunk: any, i: number) => (
                           chunk.web?.uri && (
                             <li key={i}>
                               <a href={chunk.web.uri} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate block">
                                 {chunk.web.title || chunk.web.uri}
                               </a>
                             </li>
                           )
                        ))}
                      </ul>
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
            <div className="space-y-6">
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
                    <select 
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none cursor-pointer hover:border-slate-400 transition-colors"
                      value={selectedTemplate}
                      onChange={handleTemplateChange}
                    >
                      <option value="">-- Select Template --</option>
                      {EMAIL_TEMPLATES.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
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
                    <textarea 
                      className="w-full flex-1 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none mb-2 transition-colors" 
                      value={draftedEmail.body}
                      onChange={(e) => setDraftedEmail({...draftedEmail, body: e.target.value})}
                      placeholder="Email body content..."
                    ></textarea>
                    
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
                <div className="text-center py-10 bg-green-50 rounded-xl border border-green-100">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, isLink }: any) => (
  <div>
    <span className="text-xs font-medium text-slate-400 block mb-1">{label}</span>
    {isLink && value !== 'N/A' && value !== '-' ? (
      <a href={value.startsWith('http') ? value : `https://${value}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline break-all">
        {value}
      </a>
    ) : (
      <span className="text-sm font-medium text-slate-800 break-words">{value}</span>
    )}
  </div>
);

const EditField = ({ label, value, onChange }: any) => (
  <div>
    <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
    <input 
      type="text" 
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
    />
  </div>
);

const EditTextArea = ({ label, value, onChange }: any) => (
  <div className="mt-4">
    <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
    <textarea 
      rows={3}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
    />
  </div>
);

// 5. Intelligent Data View
const IntelligentDataView = ({ onSaveToLeads }: { onSaveToLeads: (newLeads: Lead[]) => void }) => {
  const [inputMode, setInputMode] = useState<'existing' | 'import'>('existing');
  const [importData, setImportData] = useState('');
  const [report, setReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractedLeads, setExtractedLeads] = useState<Lead[]>([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

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

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      alert("Please upload a .csv file. For Excel files, please 'Save As CSV' first.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (evt.target?.result) {
        setImportData(evt.target.result as string);
      }
    };
    reader.readAsText(file);
  };

  const handleAnalyze = async () => {
    setLoading(true);
    setReport('');
    setExtractedLeads([]);
    setRateLimitCountdown(null);
    
    // If "existing", we mock extracting from DB. If "import", use text area
    let dataToAnalyze = "";
    if (inputMode === 'existing') {
       dataToAnalyze = INITIAL_LEADS.map(l => `${l.companyName}, ${l.keyPersonName} (${l.keyPersonEmail}), ${l.vietnamEvents} VN Events, History: ${l.pastEventsHistory}`).join('\n');
    } else {
       dataToAnalyze = importData;
    }

    try {
      const result = await GeminiService.generateStrategicAnalysis(dataToAnalyze);
      
      // Parse JSON from Part C
      const jsonMatch = result.match(/```json([\s\S]*?)```/);
      if (jsonMatch && jsonMatch[1]) {
         try {
           const parsed = JSON.parse(jsonMatch[1]);
           const newLeads = parsed.map((p: any) => ({
             ...p,
             id: 'imported_' + Date.now() + Math.random().toString(36).substr(2, 5),
             totalEvents: 1, // default
             vietnamEvents: p.vietnamEvents || 0,
             status: 'New',
             companyName: p.companyName || 'Unknown Org'
           }));
           setExtractedLeads(newLeads);
         } catch (e) {
           console.error("Failed to parse extracted JSON leads", e);
         }
      }

      setReport(result);
    } catch (e: any) {
      console.error(e);
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        } else {
          alert("Rate limit exceeded. Please try again later.");
        }
      } else {
        alert("Analysis failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLeads = async () => {
    if (extractedLeads.length === 0) return;
    
    try {
      setSaving(true);
      console.log('💾 Saving', extractedLeads.length, 'leads to database...');
      await onSaveToLeads(extractedLeads);
      console.log('✅ Successfully saved', extractedLeads.length, 'leads to database');
      alert(`✅ Successfully saved ${extractedLeads.length} leads to database!`);
      setExtractedLeads([]);
      setReport(''); // Clear report after saving
    } catch (error: any) {
      console.error('❌ Error saving leads:', error);
      alert(`❌ Error saving leads: ${error.message || 'Please check console for details'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Intelligent Data Analysis</h2>
      
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-6">
        <div className="flex space-x-4 mb-4 border-b border-slate-100 pb-4">
           <button 
             onClick={() => setInputMode('existing')}
             className={`px-4 py-2 rounded-lg text-sm font-medium ${inputMode === 'existing' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
           >
             Analyze Existing DB
           </button>
           <button 
             onClick={() => setInputMode('import')}
             className={`px-4 py-2 rounded-lg text-sm font-medium ${inputMode === 'import' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-50'}`}
           >
             Import & Analyze (Excel/CSV)
           </button>
        </div>

        {inputMode === 'import' && (
           <div className="mb-4 space-y-3">
             <div className="flex space-x-3">
                <button 
                  onClick={downloadSampleCSV}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center text-xs font-bold"
                >
                  <Download size={14} className="mr-2" /> Download Sample CSV
                </button>
                <label className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center text-xs font-bold cursor-pointer">
                  <FileSpreadsheet size={14} className="mr-2" /> Upload CSV
                  <input type="file" onChange={handleFileImport} accept=".csv" className="hidden" />
                </label>
             </div>
             <textarea 
               className="w-full h-32 p-3 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-y transition-colors"
               placeholder="Paste CSV data here or upload a file..."
               value={importData}
               onChange={(e) => setImportData(e.target.value)}
             />
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

        <div className="flex justify-between items-center">
           <p className="text-sm text-slate-500">
             {inputMode === 'existing' 
               ? "Analyzes current 11 leads to find rotation patterns." 
               : "Analyze uploaded or pasted data to identify high-potential targets."}
           </p>
           <button 
             onClick={handleAnalyze} 
             disabled={loading || (inputMode === 'import' && !importData) || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
             className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 flex items-center shadow-md disabled:opacity-50"
           >
             {loading ? <Loader2 className="animate-spin mr-2" /> : <BrainCircuit className="mr-2" size={18} />}
             {rateLimitCountdown !== null && rateLimitCountdown > 0 
               ? `Retry in ${rateLimitCountdown}s` 
               : 'Run Strategy Analysis'}
           </button>
        </div>
      </div>

      {extractedLeads.length > 0 && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-xl mb-6 flex justify-between items-center animate-fade-in">
           <div>
             <h4 className="font-bold text-green-800">New High-Potential Leads Identified: {extractedLeads.length}</h4>
             <p className="text-xs text-green-600">Gemini extracted structured data for these organizations.</p>
             {saving && (
               <p className="text-xs text-green-700 mt-1 flex items-center">
                 <Loader2 className="animate-spin mr-1" size={12} /> Saving to database...
               </p>
             )}
           </div>
           <button 
             onClick={handleSaveLeads}
             disabled={saving}
             className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-green-700 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
           >
             {saving ? (
               <>
                 <Loader2 className="animate-spin mr-2" size={16} /> Saving...
               </>
             ) : (
               <>
                 <Save size={16} className="mr-2" /> Save to Database
               </>
             )}
           </button>
        </div>
      )}

      {report && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 animate-fade-in">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-slate-200">
            <h3 className="text-lg font-bold text-slate-800 flex items-center">
              <FileText className="mr-2 text-indigo-500" size={20} />
              Strategic Analysis Report
            </h3>
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
              className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded flex items-center"
            >
              <Download size={14} className="mr-1" /> Download Report
            </button>
          </div>
          <div className="max-h-[600px] overflow-y-auto pr-2">
            <div className="prose prose-slate max-w-none text-sm">
              {report.split('\n').map((line, i) => {
                if (line.trim() === '') return <br key={i} />;
                if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mb-4 mt-6 text-slate-900">{line.replace('# ', '')}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-bold mt-6 mb-3 text-slate-800">{line.replace('## ', '')}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2 text-slate-800">{line.replace('### ', '')}</h3>;
                if (line.startsWith('|')) return <div key={i} className="font-mono text-xs text-slate-600 overflow-x-auto whitespace-pre my-2 bg-slate-50 p-2 rounded">{line}</div>;
                if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 mb-1 text-slate-700">{line.replace(/^[-*] /, '')}</li>;
                if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-bold mb-2 text-slate-900">{line.replace(/\*\*/g, '')}</p>;
                return <p key={i} className="mb-2 text-slate-700 leading-relaxed">{line}</p>;
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
            role: 'model',
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
          role: 'model',
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
      // Prepare history for API
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await GeminiService.sendChatMessage(history, currentInput);
      
      const botMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: 'model', text: responseText, timestamp: new Date() };
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
      console.error(e);
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        }
        const errorMsg: ChatMessage = { 
          id: Date.now().toString(), 
          role: 'model', 
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
        const errorMsg: ChatMessage = { id: Date.now().toString(), role: 'model', text: "I'm having trouble connecting right now. Please try again.", timestamp: new Date() };
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
            <div className={`max-w-[80%] p-4 rounded-xl shadow-sm text-sm ${
              msg.role === 'user' 
                ? 'bg-blue-600 text-white rounded-br-none' 
                : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-xl border border-slate-200 rounded-bl-none flex items-center space-x-2">
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

// 7. Video Analysis View
const VideoAnalysisView = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);

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
        alert("File too large. Please upload an image or video under 9MB for this demo.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysis('');
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setRateLimitCountdown(null);
    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(',')[1];
          const result = await GeminiService.analyzeVideoContent(base64Str, selectedFile.type);
          setAnalysis(result);
        } catch (e: any) {
          console.error(e);
          if (isRateLimitError(e)) {
            const retryDelay = extractRetryDelay(e);
            if (retryDelay) {
              setRateLimitCountdown(retryDelay);
            } else {
              alert("Rate limit exceeded. Please try again later.");
            }
          } else {
            alert("Analysis failed.");
          }
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setLoading(false);
        alert("Error reading file");
      };
    } catch (e: any) {
      console.error(e);
      if (isRateLimitError(e)) {
        const retryDelay = extractRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
        } else {
          alert("Rate limit exceeded. Please try again later.");
        }
      } else {
        alert("Analysis failed.");
      }
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Competitor Video Intelligence</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors bg-white">
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

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-full min-h-[400px]">
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
      let successCount = 0;
      let failCount = 0;
      
      // Create leads in database via API
      for (const lead of newLeads) {
        try {
          const mappedLead = mapLeadToDB(lead);
          console.log('💾 Saving lead:', lead.companyName);
          await leadsApi.create(mappedLead);
          successCount++;
          console.log('✅ Saved lead:', lead.companyName);
        } catch (error: any) {
          console.error('❌ Error creating lead:', lead.companyName, error);
          failCount++;
          // Continue with other leads even if one fails
        }
      }
      
      console.log(`✅ Successfully saved ${successCount}/${newLeads.length} leads to database`);
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
  const mapLeadToDB = (lead: Lead): any => {
    return {
      id: lead.id,
      company_name: lead.companyName,
      industry: lead.industry,
      country: lead.country,
      city: lead.city,
      website: lead.website || null,
      key_person_name: lead.keyPersonName,
      key_person_title: lead.keyPersonTitle || null,
      key_person_email: lead.keyPersonEmail || null,
      key_person_phone: lead.keyPersonPhone || null,
      key_person_linkedin: lead.keyPersonLinkedIn || null,
      total_events: lead.totalEvents || 0,
      vietnam_events: lead.vietnamEvents || 0,
      notes: lead.notes || null,
      status: lead.status || 'New',
      last_contacted: lead.lastContacted || null,
      past_events_history: lead.pastEventsHistory || null,
      research_notes: lead.researchNotes || null,
      secondary_person_name: lead.secondaryPersonName || null,
      secondary_person_title: lead.secondaryPersonTitle || null,
      secondary_person_email: lead.secondaryPersonEmail || null,
      number_of_delegates: lead.numberOfDelegates || null,
    };
  };

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
      default:
        return <Dashboard leads={leads} />;
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} user={user} onLogout={handleLogout} />
      
      <main className="flex-1 ml-64 relative">
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