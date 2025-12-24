import React from 'react';

export const InfoItem = ({ label, value, isLink }: any) => (
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









