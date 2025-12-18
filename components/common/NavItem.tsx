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
    className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium ${
      active === id
        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
        : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
    }`}
  >
    {icon}
    <span>{label}</span>
  </button>
);





