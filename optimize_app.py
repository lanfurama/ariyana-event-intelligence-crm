
import os

app_path = r"c:\Users\Minimart\Desktop\python\Furama Projects\ariyana-event-intelligence-crm\App.tsx"

content = """import React, { useState, useEffect } from 'react';
import { LoginView } from './components/LoginView';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './views/Dashboard';
import { LeadsView } from './views/LeadsView';
import { LeadDetail } from './components/LeadDetail';
import { IntelligentDataView } from './views/IntelligentDataView';
import { ChatAssistant } from './components/ChatAssistant';
import { EmailTemplatesView } from './views/EmailTemplatesView';
import { UserProfileView } from './views/UserProfileView';
import { VideoAnalysisView } from './views/VideoAnalysisView';
import { useAuth } from './hooks/useAuth';
import { useLeads } from './hooks/useLeads';

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
    addNewLead 
  } = useLeads(user);

  // Tab State Management
  const [activeTab, setActiveTab] = useState(() => {
    try {
      return localStorage.getItem('ariyana_activeTab') || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

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
            user={user} 
            onAddLead={addNewLead} 
          />
        );
      case 'intelligent':
        if (user.role !== 'Director') return <Dashboard leads={leads} />;
        return <IntelligentDataView onSaveToLeads={addLeads} />;
      case 'analysis':
        return <VideoAnalysisView />;
      case 'chat':
        return <ChatAssistant user={user} />;
      case 'email-templates':
        if (user.role !== 'Director' && user.role !== 'Sales') return <Dashboard leads={leads} />;
        return <EmailTemplatesView />;
      case 'profile':
        return <UserProfileView user={user} onUpdateUser={updateUser} />;
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
        onLogout={logout}
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      <main className={`flex-1 relative transition-all duration-300 ease-in-out overflow-hidden ${sidebarOpen ? 'ml-52' : 'ml-0'}`}>
        <div className="h-full w-full overflow-auto">
          {renderContent()}
        </div>
      </main>

      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onSave={updateLead}
          user={user}
        />
      )}
    </div>
  );
};

export default App;
"""

print(f"Writing optimized App.tsx ...")
with open(app_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Optimization complete.")
