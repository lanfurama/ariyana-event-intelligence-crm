import type React from 'react';
import { X } from 'lucide-react';

interface ModalHeaderProps {
  eventName: string;
  dataQualityScore?: number;
  onClose: () => void;
}

function getQualityBadgeClass(score: number): string {
  if (score >= 80) return 'bg-green-50 text-green-700 border border-green-200';
  if (score >= 60) return 'bg-yellow-50 text-yellow-700 border border-yellow-200';
  return 'bg-red-50 text-red-700 border border-red-200';
}

export const ModalHeader: React.FC<ModalHeaderProps> = ({
  eventName,
  dataQualityScore,
  onClose,
}) => {
  return (
    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center bg-white">
      <div className="flex-1">
        <h2 className="text-xl font-semibold text-slate-900 mb-1">{eventName}</h2>
        {dataQualityScore !== undefined && (
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-slate-500">Data Quality:</span>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${getQualityBadgeClass(dataQualityScore)}`}
            >
              {dataQualityScore}%
            </span>
          </div>
        )}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 p-1.5 rounded hover:bg-slate-100 transition-colors"
      >
        <X size={18} />
      </button>
    </div>
  );
};
