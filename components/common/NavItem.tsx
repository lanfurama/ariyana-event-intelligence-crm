import React from 'react';

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  id: string;
  active: string;
  onClick: (id: string) => void;
}

export const NavItem = ({ icon, label, id, active, onClick }: NavItemProps) => (
  <button
    onClick={() => onClick(id)}
    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm font-medium ${active === id
        ? 'bg-gradient-to-r from-primary to-yellow-600 text-white shadow-sm'
        : 'text-slate-400'
      }`}
  >
    {icon}
    <span className="truncate">{label}</span>
  </button>
);














