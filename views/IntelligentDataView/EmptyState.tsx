import React from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface EmptyStateProps {
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onFileChange }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-slate-300 p-10 text-center">
      <FileSpreadsheet size={56} className="mx-auto mb-3 text-slate-300" />
      <h3 className="text-lg font-semibold text-slate-900 mb-1">No Events Yet</h3>
      <p className="text-sm text-slate-600 mb-5 max-w-sm mx-auto">
        Upload an Excel or CSV file to start analyzing and scoring events automatically.
      </p>
      <label className="inline-flex items-center px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold cursor-pointer shadow-sm transition-colors">
        <FileSpreadsheet size={16} className="mr-2" /> Upload File
        <input
          type="file"
          onChange={onFileChange}
          accept=".xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
        />
      </label>
    </div>
  );
};
