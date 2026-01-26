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
    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium ${active === id
        ? 'bg-gradient-to-r from-primary to-yellow-600 text-white shadow-lg shadow-primary/20' // Gold gradient for premium look
        : 'text-slate-400'
      }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);














