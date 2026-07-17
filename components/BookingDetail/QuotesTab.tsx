import type React from 'react';
import { Check, Download, FileText, Loader2, Mail, Plus, Trash2, X } from 'lucide-react';
import type { User } from '../../types';
import {
  Badge,
  Button,
  EmptyState,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from '../ui';
import { formatVnd } from '../../views/BookingsView/calendarHelpers';
import type { useQuotes } from './useQuotes';
import {
  DISCOUNT_APPROVAL_THRESHOLD_PCT,
  QUOTE_ITEM_KINDS,
  QUOTE_ITEM_KIND_LABELS,
  QUOTE_STATUS_LABELS,
  QUOTE_STATUS_TONES,
  computeQuoteDraftTotals,
  discountRequiresDirector,
  toDateInputValue,
} from './quoteHelpers';

interface QuotesTabProps {
  quotes: ReturnType<typeof useQuotes>;
  user: User;
  canEdit: boolean;
}

export const QuotesTab: React.FC<QuotesTabProps> = ({ quotes, user, canEdit }) => {
  const {
    quotes: list,
    loading,
    error,
    editor,
    draft,
    saving,
    sendingId,
    openNew,
    openEdit,
    closeEditor,
    setDraftField,
    addItem,
    updateItem,
    removeItem,
    handleSave,
    handleDelete,
    handleMarkStatus,
    handleDownload,
    handleSendProposal,
  } = quotes;

  const totals = computeQuoteDraftTotals(draft);
  const needsDirector = discountRequiresDirector(draft.discount_pct, user.role);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {!editor && (
        <>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Quotes</h3>
            {canEdit && (
              <Button variant="secondary" size="sm" onClick={openNew}>
                <Plus size={14} /> New quote
              </Button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              <Loader2 className="animate-spin mx-auto mb-2" size={20} />
              Loading quotes…
            </div>
          ) : list.length === 0 ? (
            <EmptyState
              icon={<FileText size={22} />}
              title="No quotes yet"
              description="Create the first quote for this booking — line items, discount and VAT are turned into a client-ready proposal."
            />
          ) : (
            <div className="space-y-2">
              {list.map((quote) => (
                <div key={quote.id} className="border border-slate-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900">v{quote.version}</span>
                    <Badge tone={QUOTE_STATUS_TONES[quote.status]}>
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </Badge>
                    <span className="text-sm font-semibold text-slate-700 ml-auto">
                      {formatVnd(quote.total)}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">
                    {quote.items.length} item{quote.items.length === 1 ? '' : 's'}
                    {quote.discount_pct > 0 ? ` · ${quote.discount_pct}% discount` : ''}
                    {` · VAT ${quote.vat_pct}%`}
                    {quote.valid_until
                      ? ` · valid until ${toDateInputValue(quote.valid_until)}`
                      : ''}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <Button variant="secondary" size="sm" onClick={() => handleDownload(quote)}>
                      <Download size={13} /> DOCX
                    </Button>
                    {canEdit && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => openEdit(quote)}>
                          Edit
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSendProposal(quote)}
                          disabled={sendingId === quote.id}
                        >
                          {sendingId === quote.id ? (
                            <>
                              <Loader2 size={13} className="animate-spin" /> Sending…
                            </>
                          ) : (
                            <>
                              <Mail size={13} /> Send proposal
                            </>
                          )}
                        </Button>
                        {quote.status === 'sent' && (
                          <>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMarkStatus(quote, 'accepted')}
                            >
                              <Check size={13} /> Accepted
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleMarkStatus(quote, 'rejected')}
                            >
                              <X size={13} /> Rejected
                            </Button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(quote)}
                          className="text-slate-400 hover:text-rose-600 p-1.5 ml-auto"
                          title="Delete quote"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {editor && (
        <fieldset disabled={!canEdit || saving} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              {editor.mode === 'edit' ? 'Edit quote' : 'New quote'}
            </h3>
            <Button variant="secondary" size="sm" onClick={addItem}>
              <Plus size={14} /> Add item
            </Button>
          </div>

          <div className="space-y-2">
            {draft.items.map((item, index) => (
              <div
                key={item.key}
                className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 grid grid-cols-12 gap-2 items-end"
              >
                <div className="col-span-6 md:col-span-3">
                  <label className={labelClass}>Category</label>
                  <select
                    value={item.kind}
                    onChange={(e) =>
                      updateItem(item.key, { kind: e.target.value as typeof item.kind })
                    }
                    className={selectClass}
                  >
                    {QUOTE_ITEM_KINDS.map((kind) => (
                      <option key={kind} value={kind}>
                        {QUOTE_ITEM_KIND_LABELS[kind]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-6 md:col-span-4">
                  <label className={labelClass}>Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(item.key, { description: e.target.value })}
                    placeholder={`Item ${index + 1}`}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-4 md:col-span-1">
                  <label className={labelClass}>Qty</label>
                  <input
                    type="number"
                    min={0}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.key, { quantity: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-8 md:col-span-3">
                  <label className={labelClass}>Unit price (VND)</label>
                  <input
                    type="number"
                    min={0}
                    value={item.unit_price}
                    onChange={(e) => updateItem(item.key, { unit_price: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-12 md:col-span-1 flex items-center justify-between md:justify-end gap-2">
                  <span className="text-xs text-slate-500 md:hidden">
                    = {formatVnd(Math.round(Number(item.quantity) * Number(item.unit_price) || 0))}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.key)}
                    className="text-slate-400 hover:text-rose-600 p-1.5"
                    title="Remove item"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
            {draft.items.length === 0 && (
              <p className="text-sm text-slate-400 italic">No line items yet — add at least one.</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Discount %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.discount_pct}
                onChange={(e) => setDraftField('discount_pct', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>VAT %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={draft.vat_pct}
                onChange={(e) => setDraftField('vat_pct', e.target.value)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Valid until</label>
              <input
                type="date"
                value={draft.valid_until}
                onChange={(e) => setDraftField('valid_until', e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="col-span-3">
              <label className={labelClass}>Notes (shown on the proposal)</label>
              <textarea
                rows={2}
                value={draft.notes}
                onChange={(e) => setDraftField('notes', e.target.value)}
                className={textareaClass}
              />
            </div>
          </div>

          {needsDirector && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-3 py-2">
              Discounts above {DISCOUNT_APPROVAL_THRESHOLD_PCT}% require Director approval — ask a
              Director to save this quote.
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span>{formatVnd(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span>
                {totals.discountAmount > 0 ? `-${formatVnd(totals.discountAmount)}` : '0 ₫'}
              </span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>VAT</span>
              <span>{formatVnd(totals.vatAmount)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-1.5">
              <span>Total</span>
              <span>{formatVnd(totals.total)}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={closeEditor} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || needsDirector}>
              {saving ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Saving…
                </>
              ) : editor.mode === 'edit' ? (
                'Save quote'
              ) : (
                'Create quote'
              )}
            </Button>
          </div>
        </fieldset>
      )}
    </div>
  );
};
