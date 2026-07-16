import type React from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  id: string;
  active: string;
  onClick: (id: string) => void;
}

export const NavItem = ({ icon, label, id, active, onClick }: NavItemProps) => {
  const isActive = active === id;
  return (
    <button
      onClick={() => onClick(id)}
      aria-current={isActive ? 'page' : undefined}
      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive
          ? 'bg-gradient-to-r from-brand-500 to-brand-600 text-white shadow-sm'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
      }`}
    >
      {icon}
      <span className="truncate">{label}</span>
    </button>
  );
};
