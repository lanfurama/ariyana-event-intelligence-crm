import React from 'react';
import { X, Loader2, CheckCircle, AlertCircle, Database } from 'lucide-react';
import type { ParsedEnrichContact } from '../../utils/leadEnrichUtils';

export type ResearchModalStatus = 'loading' | 'success' | 'no_result' | 'error';

export interface ResearchModalProps {
  open: boolean;
  onClose: () => void;
  companyName: string;
  status: ResearchModalStatus;
  responseText?: string;
  errorMessage?: string;
  /** Parsed key person contact to show in the "information found" box (no need to scroll). */
  parsedContact?: ParsedEnrichContact | null;
  /** When true, show "Xác nhận đồng bộ vào hệ thống" button (after research done, before sync). */
  canSync?: boolean;
  /** Call when user clicks sync. Caller should persist to DB then close. */
  onConfirmSync?: () => void | Promise<void>;
  /** True while sync in progress. */
  syncing?: boolean;
}

export const ResearchModal: React.FC<ResearchModalProps> = ({
  open,
  onClose,
  companyName,
  status,
  responseText = '',
  errorMessage = '',
  parsedContact,
  canSync = false,
  onConfirmSync,
  syncing = false,
}) => {
  const hasParsedContact =
    parsedContact &&
    (parsedContact.keyPersonName ||
      parsedContact.keyPersonTitle ||
      parsedContact.keyPersonEmail ||
      parsedContact.keyPersonPhone);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-white rounded-xl shadow-xl border border-slate-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-modal-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 id="research-modal-title" className="text-lg font-semibold text-slate-900">
            AI Research: {companyName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {status === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="animate-spin text-primary mb-4" size={48} />
              <p className="text-slate-700 font-medium">Đang nghiên cứu...</p>
              <p className="text-sm text-slate-500 mt-1">
                AI đang tìm kiếm thông tin key person cho tổ chức này.
              </p>
            </div>
          )}

          {status === 'success' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle className="text-green-600 shrink-0 mt-0.5" size={22} />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="font-semibold text-green-800">Đã tìm thấy thông tin</p>
                  {hasParsedContact ? (
                    <div className="text-sm text-green-800 space-y-1">
                      {parsedContact.keyPersonName && (
                        <p><span className="font-medium">Tên:</span> {parsedContact.keyPersonName}</p>
                      )}
                      {parsedContact.keyPersonTitle && (
                        <p><span className="font-medium">Chức danh:</span> {parsedContact.keyPersonTitle}</p>
                      )}
                      {parsedContact.keyPersonEmail && (
                        <p><span className="font-medium">Email:</span> {parsedContact.keyPersonEmail}</p>
                      )}
                      {parsedContact.keyPersonPhone && (
                        <p><span className="font-medium">Điện thoại:</span> {parsedContact.keyPersonPhone}</p>
                      )}
                    </div>
                  ) : null}
                  <p className="text-sm text-green-700">
                    Bấm &quot;Đồng bộ vào hệ thống&quot; khi muốn lưu vào CRM.
                  </p>
                </div>
              </div>
              {responseText && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Quá trình nghiên cứu của AI:
                  </p>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto font-mono">
                    {responseText}
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'no_result' && (
            <>
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={22} />
                <div>
                  <p className="font-semibold text-amber-800">Không tìm thấy thông tin key person</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    AI không tìm được tên, email hoặc số điện thoại phù hợp. Bạn có thể tham khảo nội dung bên dưới và vẫn đồng bộ nếu cần.
                  </p>
                </div>
              </div>
              {responseText && (
                <div>
                  <p className="text-sm font-semibold text-slate-700 mb-2">
                    Nội dung phản hồi từ AI:
                  </p>
                  <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700 whitespace-pre-wrap overflow-x-auto max-h-64 overflow-y-auto font-mono">
                    {responseText}
                  </div>
                </div>
              )}
            </>
          )}

          {status === 'error' && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={22} />
              <div>
                <p className="font-semibold text-red-800">Lỗi nghiên cứu</p>
                <p className="text-sm text-red-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-col gap-3">
          {!canSync && (status === 'success' || status === 'no_result') && (
            <p className="text-sm text-amber-700">
              Chưa thể đồng bộ: cần có email hoặc số điện thoại của key person. Chỉ có tên/chức danh thì chưa đủ để lưu vào CRM.
            </p>
          )}
          <div className="flex justify-end gap-2">
            {canSync && onConfirmSync && (
              <button
                type="button"
                onClick={() => onConfirmSync()}
                disabled={syncing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 disabled:opacity-60 transition-colors"
              >
                {syncing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Database size={18} />
                )}
                {syncing ? 'Đang đồng bộ...' : 'Đồng bộ vào hệ thống'}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
