import type React from 'react';
import {
  LayoutDashboard,
  Users,
  Mail,
  Sparkles,
  LogOut,
  ChevronLeft,
  Menu,
  CalendarDays,
} from 'lucide-react';
import type { User } from '../types';
import { NavItem } from './common/NavItem';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (t: string) => void;
  user: User;
  onLogout: () => void;
  isOpen: boolean;
  onToggle: () => void;
}

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
    {children}
  </p>
);

export const Sidebar = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  isOpen,
  onToggle,
}: SidebarProps) => {
  // Auto-close drawer on mobile after selecting a nav item.
  const handleSelect = (id: string) => {
    setActiveTab(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      onToggle();
    }
  };

  return (
    <>
      {/* Mobile backdrop: only visible <md and when open */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onToggle}
          aria-hidden="true"
        />
      )}

      {/* Sidebar - drawer on mobile, persistent on desktop */}
      <div
        className={`w-56 flex flex-col h-screen fixed left-0 top-0 z-30 transition-transform duration-300 ease-in-out bg-slate-900 border-r border-white/10 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        {/* Brand */}
        <div className="px-3 py-3.5 border-b border-white/10 flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-md shrink-0">
            <Mail size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-white tracking-tight leading-tight">
              Ariyana <span className="text-brand-400">Mail</span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium tracking-wide">
              Email Marketing Suite
            </p>
          </div>
          <button
            onClick={onToggle}
            className="p-1 rounded text-slate-500 hover:text-white shrink-0"
            title="Close sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 pb-3 overflow-y-auto">
          <SectionLabel>Marketing</SectionLabel>
          <div className="space-y-0.5">
            <NavItem
              icon={<LayoutDashboard size={18} />}
              label="Dashboard"
              id="dashboard"
              active={activeTab}
              onClick={handleSelect}
            />
            <NavItem
              icon={<Users size={18} />}
              label="Audience"
              id="leads"
              active={activeTab}
              onClick={handleSelect}
            />
            {(user.role === 'Director' || user.role === 'Sales') && (
              <NavItem
                icon={<Mail size={18} />}
                label="Email Studio"
                id="email"
                active={activeTab}
                onClick={handleSelect}
              />
            )}
          </div>

          <SectionLabel>Venue</SectionLabel>
          <div className="space-y-0.5">
            <NavItem
              icon={<CalendarDays size={18} />}
              label="Bookings"
              id="bookings"
              active={activeTab}
              onClick={handleSelect}
            />
          </div>

          {user.role === 'Director' && (
            <>
              <SectionLabel>Data</SectionLabel>
              <div className="space-y-0.5">
                <NavItem
                  icon={<Sparkles size={18} />}
                  label="Enrichment"
                  id="intelligent"
                  active={activeTab}
                  onClick={handleSelect}
                />
              </div>
            </>
          )}
        </nav>

        {/* User block → profile, plus sign out */}
        <div className="px-2 py-2.5 border-t border-white/10 flex items-center gap-1.5">
          <button
            onClick={() => handleSelect('profile')}
            title="My Profile"
            className={`flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1.5 rounded-lg transition-colors ${
              activeTab === 'profile' ? 'bg-white/10' : 'hover:bg-white/5'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-brand-500/40 shrink-0">
              <img src={user.avatar} alt="avatar" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-brand-400 uppercase font-semibold tracking-wider">
                {user.role}
              </p>
            </div>
          </button>
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-white/5 transition-colors shrink-0"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed left-3 top-3 z-30 p-2 bg-gradient-to-r from-brand-500 to-brand-600 text-white rounded-lg shadow-md"
          title="Open sidebar"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>
      )}
    </>
  );
};
