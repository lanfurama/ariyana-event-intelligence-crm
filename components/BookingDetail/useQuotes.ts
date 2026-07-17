import { useCallback, useEffect, useState } from 'react';
import type { Booking, Lead, Quote, QuoteStatus } from '../../types';
import { leadsApi, quotesApi } from '../../services/apiService';
import { formatVnd } from '../../views/BookingsView/calendarHelpers';
import type { QuoteDraft, QuoteItemDraft } from './quoteHelpers';
import {
  draftFromQuote,
  draftToPayload,
  emptyQuoteDraft,
  newQuoteItemDraft,
  validateQuoteDraft,
} from './quoteHelpers';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

let keyCounter = 0;
const nextKey = () => `quote-item-${++keyCounter}`;

export interface QuoteEditorState {
  mode: 'new' | 'edit';
  quoteId?: string;
}

export function useQuotes(
  bookingId: string | null,
  active: boolean,
  booking: Booking | null,
  leads: Lead[],
) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<QuoteEditorState | null>(null);
  const [draft, setDraft] = useState<QuoteDraft>(emptyQuoteDraft());
  const [saving, setSaving] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!bookingId) return;
    setLoading(true);
    setError(null);
    try {
      setQuotes(await quotesApi.getAll(bookingId));
    } catch (e: any) {
      console.error('Error loading quotes:', e);
      setError(e.message || 'Failed to load quotes');
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  // Load when the Quotes tab opens
  useEffect(() => {
    if (active && bookingId) {
      reload();
    }
  }, [active, bookingId, reload]);

  const openNew = () => {
    const base = emptyQuoteDraft();
    base.items = [newQuoteItemDraft(nextKey())];
    setDraft(base);
    setEditor({ mode: 'new' });
    setError(null);
  };

  const openEdit = (quote: Quote) => {
    setDraft(draftFromQuote(quote));
    setEditor({ mode: 'edit', quoteId: quote.id });
    setError(null);
  };

  const closeEditor = () => {
    setEditor(null);
    setError(null);
  };

  const setDraftField = <K extends keyof QuoteDraft>(field: K, value: QuoteDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addItem = () => {
    setDraft((prev) => ({ ...prev, items: [...prev.items, newQuoteItemDraft(nextKey())] }));
  };

  const updateItem = (key: string, patch: Partial<QuoteItemDraft>) => {
    setDraft((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    }));
  };

  const removeItem = (key: string) => {
    setDraft((prev) => ({ ...prev, items: prev.items.filter((item) => item.key !== key) }));
  };

  const handleSave = async () => {
    if (!bookingId || !editor) return;
    const validation = validateQuoteDraft(draft);
    if (validation.length > 0) {
      setError(validation.join('. '));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToPayload(draft);
      if (editor.mode === 'edit' && editor.quoteId) {
        await quotesApi.update(editor.quoteId, payload);
      } else {
        await quotesApi.create(bookingId, payload);
      }
      setEditor(null);
      await reload();
    } catch (e: any) {
      console.error('Error saving quote:', e);
      setError(e.message || 'Failed to save quote');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (quote: Quote) => {
    if (!confirm(`Delete quote v${quote.version}? This cannot be undone.`)) return;
    try {
      await quotesApi.delete(quote.id);
      await reload();
    } catch (e: any) {
      console.error('Error deleting quote:', e);
      alert(e.message || 'Failed to delete quote');
    }
  };

  const handleMarkStatus = async (quote: Quote, status: QuoteStatus) => {
    try {
      await quotesApi.update(quote.id, { status });
      await reload();
    } catch (e: any) {
      console.error('Error updating quote status:', e);
      alert(e.message || 'Failed to update quote status');
    }
  };

  const handleDownload = async (quote: Quote) => {
    try {
      // Authenticated blob download — window.open cannot carry the Bearer header.
      await quotesApi.downloadDocx(quote.id);
    } catch (e: any) {
      console.error('Error downloading proposal:', e);
      alert(e.message || 'Failed to download proposal');
    }
  };

  /** Email the proposal DOCX to the linked lead via the existing send pipeline. */
  const handleSendProposal = async (quote: Quote) => {
    const lead = booking?.lead_id ? leads.find((l) => l.id === booking.lead_id) : undefined;
    if (!lead || !lead.keyPersonEmail) {
      alert('Link this booking to a lead with an email address first (Details tab).');
      return;
    }
    if (
      !confirm(
        `Send proposal v${quote.version} (${formatVnd(quote.total)}) to ${lead.keyPersonEmail}?`,
      )
    ) {
      return;
    }
    setSendingId(quote.id);
    try {
      const { fileName, dataUrl } = await quotesApi.fetchDocxAsDataUrl(quote.id);
      const subject = `Event Proposal ${booking?.code || ''} — ${booking?.title || ''}`.trim();
      const body =
        `<p>Dear ${lead.keyPersonName || 'Sir/Madam'},</p>` +
        `<p>Thank you for considering Ariyana Convention Centre Danang for <b>${booking?.title || 'your event'}</b>. ` +
        `Please find our proposal (v${quote.version}) attached.</p>` +
        `<p>We would be delighted to walk you through the details or tailor the package to your needs.</p>` +
        `<p>Warm regards,<br/>Ariyana Convention Centre Danang</p>`;
      const result = await leadsApi.sendEmail(lead.id, subject, body, undefined, [
        { name: fileName, file_data: dataUrl, type: DOCX_MIME },
      ]);
      if (result.success) {
        await quotesApi.update(quote.id, { status: 'sent', sent_at: new Date().toISOString() });
        alert('Proposal sent!');
        await reload();
      } else {
        alert('Failed to send proposal email.');
      }
    } catch (e: any) {
      console.error('Error sending proposal:', e);
      alert(e.message || 'Failed to send proposal');
    } finally {
      setSendingId(null);
    }
  };

  return {
    quotes,
    loading,
    error,
    editor,
    draft,
    saving,
    sendingId,
    reload,
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
  };
}
