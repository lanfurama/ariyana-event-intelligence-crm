import type { Quote, QuoteItemKind, QuoteStatus, UserRole } from '../../types';
import type { QuoteItemPayload, QuotePayload } from '../../services/apiService';
import type { BadgeTone } from '../ui';

// Pure draft <-> payload helpers for the Quotes tab. Persisted totals always
// come from the server (computeQuoteTotals in api/utils/bookingHelpers); the
// mirror here exists only for the live preview while typing.

export const DISCOUNT_APPROVAL_THRESHOLD_PCT = 15;

export const QUOTE_ITEM_KINDS: QuoteItemKind[] = ['venue', 'fnb', 'av', 'service', 'other'];

export const QUOTE_ITEM_KIND_LABELS: Record<QuoteItemKind, string> = {
  venue: 'Venue rental',
  fnb: 'F&B',
  av: 'AV & equipment',
  service: 'Services',
  other: 'Other',
};

export const QUOTE_STATUSES: QuoteStatus[] = ['draft', 'sent', 'accepted', 'rejected', 'expired'];

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  accepted: 'Accepted',
  rejected: 'Rejected',
  expired: 'Expired',
};

export const QUOTE_STATUS_TONES: Record<QuoteStatus, BadgeTone> = {
  draft: 'slate',
  sent: 'sky',
  accepted: 'emerald',
  rejected: 'rose',
  expired: 'amber',
};

export interface QuoteItemDraft {
  key: string;
  kind: QuoteItemKind;
  description: string;
  quantity: string;
  unit_price: string;
}

export interface QuoteDraft {
  discount_pct: string;
  vat_pct: string;
  valid_until: string; // 'YYYY-MM-DD' or ''
  notes: string;
  items: QuoteItemDraft[];
}

export function newQuoteItemDraft(key: string): QuoteItemDraft {
  return { key, kind: 'venue', description: '', quantity: '1', unit_price: '0' };
}

export function emptyQuoteDraft(): QuoteDraft {
  return { discount_pct: '0', vat_pct: '8', valid_until: '', notes: '', items: [] };
}

/** Date/ISO → local 'YYYY-MM-DD' for <input type="date">. */
export function toDateInputValue(value: string | Date): string {
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function draftFromQuote(quote: Quote): QuoteDraft {
  return {
    discount_pct: String(quote.discount_pct),
    vat_pct: String(quote.vat_pct),
    valid_until: quote.valid_until ? toDateInputValue(quote.valid_until) : '',
    notes: quote.notes || '',
    items: quote.items.map((item, index) => ({
      key: `existing-${item.id ?? index}`,
      kind: item.kind,
      description: item.description,
      quantity: String(item.quantity),
      unit_price: String(item.unit_price),
    })),
  };
}

const toNumber = (value: string): number => {
  const n = Number(value);
  return isFinite(n) ? n : 0;
};

export interface QuoteTotalsPreview {
  subtotal: number;
  discountAmount: number;
  vatAmount: number;
  total: number;
}

/** Display mirror of the server's computeQuoteTotals (round per line, discount, then VAT). */
export function computeQuoteDraftTotals(draft: QuoteDraft): QuoteTotalsPreview {
  const subtotal = draft.items.reduce(
    (sum, item) => sum + Math.round(toNumber(item.quantity) * toNumber(item.unit_price)),
    0,
  );
  const discountAmount = Math.round((subtotal * toNumber(draft.discount_pct)) / 100);
  const taxable = subtotal - discountAmount;
  const vatAmount = Math.round((taxable * toNumber(draft.vat_pct)) / 100);
  return { subtotal, discountAmount, vatAmount, total: taxable + vatAmount };
}

export function validateQuoteDraft(draft: QuoteDraft): string[] {
  const errors: string[] = [];
  if (draft.items.length === 0) errors.push('Add at least one line item');
  draft.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    if (item.description.trim() === '') errors.push(`${label}: description is required`);
    const quantity = Number(item.quantity);
    if (!isFinite(quantity) || quantity <= 0) errors.push(`${label}: quantity must be positive`);
    const unitPrice = Number(item.unit_price);
    if (!isFinite(unitPrice) || unitPrice < 0) {
      errors.push(`${label}: unit price must be zero or more`);
    }
  });
  const discount = Number(draft.discount_pct);
  if (!isFinite(discount) || discount < 0 || discount > 100) {
    errors.push('Discount must be between 0 and 100');
  }
  const vat = Number(draft.vat_pct);
  if (!isFinite(vat) || vat < 0 || vat > 100) {
    errors.push('VAT must be between 0 and 100');
  }
  return errors;
}

/** Sales cannot save a discount above the approval threshold; Director can. */
export function discountRequiresDirector(discountPct: string, role: UserRole): boolean {
  return Number(discountPct) > DISCOUNT_APPROVAL_THRESHOLD_PCT && role !== 'Director';
}

export function draftToPayload(draft: QuoteDraft): QuotePayload & { items: QuoteItemPayload[] } {
  return {
    discount_pct: toNumber(draft.discount_pct),
    vat_pct: toNumber(draft.vat_pct),
    valid_until: draft.valid_until || null,
    notes: draft.notes.trim() || null,
    items: draft.items.map((item) => ({
      kind: item.kind,
      description: item.description.trim(),
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
    })),
  };
}
