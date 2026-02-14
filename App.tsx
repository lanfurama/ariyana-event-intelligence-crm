import React, { useState, useEffect, Suspense } from 'react';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { useAuth } from './hooks/useAuth';
import { useLeads } from './hooks/useLeads';
import { LoadingSpinner } from './components/common/LoadingSpinner';

// Lazy load views for better initial load performance
const Dashboard = React.lazy(() => import('./views/Dashboard').then(module => ({ default: module.Dashboard })));
const LeadsView = React.lazy(() => import('./views/LeadsView').then(module => ({ default: module.LeadsView })));
const LeadDetail = React.lazy(() => import('./components/LeadDetail').then(module => ({ default: module.LeadDetail })));
const IntelligentDataView = React.lazy(() => import('./views/IntelligentDataView').then(module => ({ default: module.IntelligentDataView })));
const ChatAssistant = React.lazy(() => import('./components/ChatAssistant').then(module => ({ default: module.ChatAssistant })));
const EmailView = React.lazy(() => import('./views/EmailView').then(module => ({ default: module.EmailView })));
const UserProfileView = React.lazy(() => import('./views/UserProfileView').then(module => ({ default: module.UserProfileView })));
const VideoAnalysisView = React.lazy(() => import('./views/VideoAnalysisView').then(module => ({ default: module.VideoAnalysisView })));

const App = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Use Custom Hooks
  const { user, login, logout, updateUser } = useAuth();
  const {
    leads,
    loading: leadsLoading,
    selectedLead,
    setSelectedLead,
    updateLead,
    addLeads,
    addNewLead,
    fetchLeads,
  } = useLeads(user);

  // Tab State Management
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('ariyana_activeTab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  // Migrate legacy email tabs to single "email" tab
  useEffect(() => {
    if ((activeTab === 'email-templates' || activeTab === 'email-reports') && user) {
      setActiveTab('email');
    }
  }, [activeTab, user]);

  // Persist activeTab
  useEffect(() => {
    if (user) {
      localStorage.setItem('ariyana_activeTab', activeTab);
    }
  }, [activeTab, user]);

  // Handle Login Wrapper to reset tab
  const handleLogin = (u: any) => {
    login(u);
    setActiveTab('dashboard');
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
        return (
          <LeadsView
            leads={leads}
            onSelectLead={setSelectedLead}
            onUpdateLead={updateLead}
            onRefreshLeads={fetchLeads}
            user={user}
            onAddLead={addNewLead}
            loading={leadsLoading}
          />
        );
      case 'intelligent':
        if (user.role !== 'Director') return <Dashboard leads={leads} />;
        return (
          <IntelligentDataView
            leads={leads}
            onUpdateLead={async (updated) => {
              await updateLead(updated);
              await fetchLeads();
            }}
            loading={leadsLoading}
          />
        );
      case 'analysis':
        return <VideoAnalysisView />;
      case 'chat':
        return <ChatAssistant user={user} />;
      case 'email':
        if (user.role !== 'Director' && user.role !== 'Sales') return <Dashboard leads={leads} />;
        return <EmailView user={user} />;
      case 'profile':
        return <UserProfileView user={user} onUpdateUser={updateUser} />;
      default:
        return <Dashboard leads={leads} />;
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-200 font-sans text-slate-900 overflow-hidden relative">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={logout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className={`flex-1 relative transition-all duration-300 ease-in-out overflow-hidden h-full ${sidebarOpen ? 'md:ml-52' : 'ml-0'}`}>
        <div className="h-full w-full overflow-auto">
          <Suspense fallback={<LoadingSpinner />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>

      {selectedLead && (
        <Suspense fallback={null}>
          <LeadDetail
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onSave={updateLead}
            user={user}
          />
        </Suspense>
      )}
    </div>
  );
};

export default App;
