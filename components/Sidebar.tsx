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
  Menu,
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

export const Sidebar = ({ activeTab, setActiveTab, user, onLogout, isOpen, onToggle }: SidebarProps) => <>
  {/* Sidebar - compact, clean */}
  <div className={`w-48 flex flex-col h-screen fixed left-0 top-0 z-20 transition-transform duration-300 ease-in-out bg-slate-900 border-r border-white/10 shadow-[4px_0_24px_rgba(0,0,0,0.4)] ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
    <div className="px-3 py-2.5 border-b border-white/10 flex items-center justify-between">
      <div className="flex-1 min-w-0">
        <h1 className="text-2xl font-bold text-primary tracking-tight leading-tight">Ariyana CRM</h1>
        <p className="text-xs text-slate-400 mt-0.5 font-medium tracking-wide">Event Intelligence System</p>
      </div>
      <button
        onClick={onToggle}
        className="p-1 rounded text-slate-400 hover:text-white flex-shrink-0"
        title="Close sidebar"
      >
        <ChevronLeft size={18} />
      </button>
    </div>

    <div className="px-2.5 py-2 border-b border-white/10 flex items-center gap-2">
      <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-primary/40 flex-shrink-0">
        <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-white truncate">{user.name}</p>
        <p className="text-xs text-primary uppercase font-semibold tracking-wider">{user.role}</p>
      </div>
    </div>

    <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto custom-scrollbar">
      <NavItem icon={<LayoutDashboard size={18} />} label="Dashboard" id="dashboard" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<Users size={18} />} label="ICCA Leads" id="leads" active={activeTab} onClick={setActiveTab} />

      {user.role === 'Director' && (
        <NavItem icon={<BrainCircuit size={18} />} label="Intelligent Data" id="intelligent" active={activeTab} onClick={setActiveTab} />
      )}

      <NavItem icon={<Film size={18} />} label="Video Analysis" id="analysis" active={activeTab} onClick={setActiveTab} />
      <NavItem icon={<MessageSquare size={18} />} label="AI Assistant" id="chat" active={activeTab} onClick={setActiveTab} />

      {(user.role === 'Director' || user.role === 'Sales') && (
        <NavItem icon={<Mail size={18} />} label="Email" id="email" active={activeTab} onClick={setActiveTab} />
      )}

      <NavItem icon={<UserIcon size={18} />} label="My Profile" id="profile" active={activeTab} onClick={setActiveTab} />
    </nav>

    <div className="px-2 py-2 border-t border-white/10">
      <button
        onClick={onLogout}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-slate-400 rounded-md text-sm font-medium"
      >
        <LogOut size={14} />
        <span>Sign Out</span>
      </button>
      <p className="text-xs text-slate-600 text-center mt-1.5">Powered by OpenAI & Gemini</p>
    </div>
  </div>

  {!isOpen && (
    <button
      onClick={onToggle}
      className="fixed left-3 top-3 z-30 p-2 bg-gradient-to-r from-primary to-yellow-600 text-white rounded-lg shadow-md"
      title="Open sidebar"
    >
      <Menu size={18} />
    </button>
  )}
</>












