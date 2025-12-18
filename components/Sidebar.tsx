import React from 'react';
import { 
  LayoutDashboard, 
  Users, 
  MessageSquare, 
  Mail, 
  Film,
  BrainCircuit,
  LogOut,
  ChevronLeft,
  User as UserIcon,
  Menu
} from 'lucide-react';
import { User } from '../types';
import { NavItem } from './common/NavItem';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  user: User;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar = ({ activeTab, setActiveTab, user, onLogout, isOpen, onToggle }: SidebarProps) => (
  <>
    {/* Sidebar */}
    <div className={`w-52 bg-gradient-to-b from-slate-900 to-slate-800 text-white flex flex-col h-screen fixed left-0 top-0 border-r border-slate-700/50 shadow-2xl z-20 transition-transform duration-300 ease-in-out ${
      isOpen ? 'translate-x-0' : '-translate-x-full'
    }`}>
      <div className="p-4 border-b border-slate-700/50 bg-slate-900/50 flex items-center justify-between">
        <div className="flex-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 via-blue-300 to-cyan-400 bg-clip-text text-transparent tracking-tight">Ariyana CRM</h1>
          <p className="text-xs text-slate-400 mt-1 font-medium tracking-wide">Event Intelligence System</p>
        </div>
        <button
          onClick={onToggle}
          className="p-1.5 hover:bg-slate-700/50 rounded-lg transition-colors text-slate-300 hover:text-white"
          title="Close sidebar"
        >
          <ChevronLeft size={20} />
        </button>
      </div>
    
    <div className="p-3 border-b border-slate-700/50 bg-slate-800/30 flex items-center space-x-3">
       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 overflow-hidden border-2 border-blue-400/50 shadow-lg">
          <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
       </div>
       <div className="flex-1 min-w-0">
         <p className="text-sm font-bold text-white truncate">{user.name}</p>
         <p className="text-xs text-blue-300 uppercase font-semibold tracking-wider">{user.role}</p>
       </div>
    </div>

    <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
      <NavItem icon={<LayoutDashboard size={20} />} label="Dashboard" id="dashboard" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<Users size={20} />} label="ICCA Leads" id="leads" active={activeTab} onClick={setActiveTab} />
      
      {/* Restrict Strategy to Director */}
      {user.role === 'Director' && (
        <NavItem icon={<BrainCircuit size={20} />} label="Intelligent Data" id="intelligent" active={activeTab} onClick={setActiveTab} />
      )}
      
      <NavItem icon={<Film size={20} />} label="Video Analysis" id="analysis" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<MessageSquare size={20} />} label="AI Assistant" id="chat" active={activeTab} onClick={setActiveTab} />
      
      {/* Email Templates - Only Director and Sales can manage */}
      {(user.role === 'Director' || user.role === 'Sales') && (
        <NavItem icon={<Mail size={20} />} label="Email Templates" id="email-templates" active={activeTab} onClick={setActiveTab} />
      )}
      
      <NavItem icon={<UserIcon size={20} />} label="My Profile" id="profile" active={activeTab} onClick={setActiveTab} />
    </nav>
    
    <div className="p-3 border-t border-slate-700/50 bg-slate-900/50 space-y-2">
      <button 
        onClick={onLogout}
        className="w-full flex items-center space-x-3 px-4 py-2 text-slate-300 hover:text-white hover:bg-slate-800/50 rounded-lg transition-all duration-200 text-sm font-medium group"
      >
        <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
        <span>Sign Out</span>
      </button>
      <div className="text-xs text-slate-500 text-center font-medium">
        Powered by AI
      </div>
    </div>
  </div>
  
  {/* Toggle Button - Show when sidebar is closed */}
  {!isOpen && (
    <button
      onClick={onToggle}
      className="fixed left-4 top-4 z-30 p-2 bg-slate-900 text-white rounded-lg shadow-lg hover:bg-slate-800 transition-all duration-200 hover:scale-110"
      title="Open sidebar"
    >
      <Menu size={20} />
    </button>
  )}
  </>
);




