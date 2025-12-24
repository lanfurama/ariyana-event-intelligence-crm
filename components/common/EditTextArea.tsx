import React from 'react';

export const EditTextArea = ({ label, value, onChange }: any) => (
  <div className="mt-4">
    <label className="text-xs font-medium text-slate-500 block mb-1">{label}</label>
    <textarea 
      rows={3}
      value={value || ''} 
      onChange={(e) => onChange(e.target.value)}
      className="w-full p-2 text-sm bg-white text-slate-900 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none"
    />
  </div>
);









