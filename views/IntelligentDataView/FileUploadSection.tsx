import React from 'react';
import { FileSpreadsheet, Loader2, X } from 'lucide-react';

interface EmailSendSummary {
  attempted: number;
  sent: number;
  failures: { eventName: string; email?: string; error: string }[];
  skipped?: boolean;
  message?: string;
}

interface FileUploadSectionProps {
  uploadingExcel: boolean;
  excelFile: File | null;
  excelSummary: any;
  emailSendSummary: EmailSendSummary | null;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
}

export const FileUploadSection: React.FC<FileUploadSectionProps> = ({
  uploadingExcel,
  excelFile,
  excelSummary,
  emailSendSummary,
  onFileChange,
  onClearFile,
}) => {
  return (
    <>
      {/* File Upload Status */}
      {uploadingExcel && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Loader2 className="animate-spin text-blue-600" size={18} />
            <p className="text-sm font-medium text-blue-800">Processing file...</p>
          </div>
        </div>
      )}

      {excelFile && excelSummary && !uploadingExcel && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <FileSpreadsheet size={18} className="text-green-600" />
              <div>
                <p className="text-sm font-semibold text-green-800">{excelFile.name}</p>
                <p className="text-xs text-green-700">
                  {excelSummary.totalRows} rows • {excelSummary.totalSheets} sheets
                </p>
              </div>
            </div>
            <button
              onClick={onClearFile}
              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-100"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {emailSendSummary && !uploadingExcel && (
        <div
          className={`rounded-lg p-4 border ${
            emailSendSummary.skipped
              ? 'bg-yellow-50 border-yellow-200'
              : emailSendSummary.failures.length > 0
              ? 'bg-orange-50 border-orange-200'
              : 'bg-indigo-50 border-indigo-200'
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-800">Auto email campaign</p>
              <p className="text-xs text-slate-600 mt-0.5">
                {emailSendSummary.skipped
                  ? emailSendSummary.message || 'Email automation skipped because credentials are missing.'
                  : `Sent ${emailSendSummary.sent} of ${emailSendSummary.attempted} emails automatically.`}
              </p>
              {!emailSendSummary.skipped && emailSendSummary.message && (
                <p className="text-[11px] text-slate-500 mt-1">{emailSendSummary.message}</p>
              )}
            </div>
          </div>
          {emailSendSummary.failures.length > 0 && (
            <div className="mt-3 bg-white border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-700 mb-1">Failed recipients</p>
              <ul className="text-xs text-slate-600 space-y-1">
                {emailSendSummary.failures.slice(0, 3).map((fail, idx) => (
                  <li key={idx}>
                    {fail.eventName}
                    {fail.email ? ` (${fail.email})` : ''}: {fail.error}
                  </li>
                ))}
              </ul>
              {emailSendSummary.failures.length > 3 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  +{emailSendSummary.failures.length - 3} more failures logged in console.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </>
  );
};
