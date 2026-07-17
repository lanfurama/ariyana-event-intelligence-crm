import { describe, expect, it } from 'vitest';
import type { Quote } from '../../types';
import {
  computeQuoteDraftTotals,
  discountRequiresDirector,
  draftFromQuote,
  draftToPayload,
  emptyQuoteDraft,
  newQuoteItemDraft,
  toDateInputValue,
  validateQuoteDraft,
} from './quoteHelpers';

const draftWith = (over: Partial<ReturnType<typeof emptyQuoteDraft>>) => ({
  ...emptyQuoteDraft(),
  ...over,
});

describe('computeQuoteDraftTotals (mirror of server math)', () => {
  it('matches the server example: 625M subtotal, 10% discount, 8% VAT → 607.5M', () => {
    const draft = draftWith({
      discount_pct: '10',
      vat_pct: '8',
      items: [
        {
          key: 'a',
          kind: 'venue',
          description: 'Ballroom',
          quantity: '1',
          unit_price: '200000000',
        },
        { key: 'b', kind: 'fnb', description: 'Dinner', quantity: '500', unit_price: '850000' },
      ],
    });
    const totals = computeQuoteDraftTotals(draft);
    expect(totals.subtotal).toBe(625000000);
    expect(totals.discountAmount).toBe(62500000);
    expect(totals.vatAmount).toBe(45000000);
    expect(totals.total).toBe(607500000);
  });

  it('is NaN-safe while the user is typing', () => {
    const draft = draftWith({
      discount_pct: '',
      vat_pct: 'x',
      items: [{ key: 'a', kind: 'other', description: '', quantity: '', unit_price: 'abc' }],
    });
    expect(computeQuoteDraftTotals(draft)).toEqual({
      subtotal: 0,
      discountAmount: 0,
      vatAmount: 0,
      total: 0,
    });
  });
});

describe('validateQuoteDraft', () => {
  const valid = () =>
    draftWith({
      items: [{ key: 'a', kind: 'venue', description: 'Hall', quantity: '1', unit_price: '100' }],
    });

  it('accepts a valid draft', () => {
    expect(validateQuoteDraft(valid())).toHaveLength(0);
  });

  it('requires at least one item', () => {
    expect(validateQuoteDraft(emptyQuoteDraft())[0]).toContain('at least one line item');
  });

  it('rejects empty description, non-positive quantity, negative price', () => {
    const draft = valid();
    draft.items[0].description = ' ';
    draft.items[0].quantity = '0';
    draft.items[0].unit_price = '-5';
    expect(validateQuoteDraft(draft)).toHaveLength(3);
  });

  it('bounds discount and VAT to 0..100', () => {
    const draft = valid();
    draft.discount_pct = '101';
    draft.vat_pct = '-1';
    expect(validateQuoteDraft(draft)).toHaveLength(2);
  });
});

describe('discountRequiresDirector', () => {
  it('blocks Sales above the threshold, allows Director', () => {
    expect(discountRequiresDirector('20', 'Sales')).toBe(true);
    expect(discountRequiresDirector('20', 'Director')).toBe(false);
  });

  it('threshold itself does not require approval', () => {
    expect(discountRequiresDirector('15', 'Sales')).toBe(false);
    expect(discountRequiresDirector('10', 'Viewer')).toBe(false);
  });
});

describe('draft mapping', () => {
  const quote: Quote = {
    id: 'quote-1',
    booking_id: 'booking-1',
    version: 2,
    status: 'draft',
    currency: 'VND',
    subtotal: 100,
    discount_pct: 5,
    vat_pct: 8,
    total: 102,
    valid_until: '2026-08-15T00:00:00.000Z',
    notes: 'note',
    items: [
      { id: 7, kind: 'av', description: 'LED wall', quantity: 2, unit_price: 50, amount: 100 },
    ],
  };

  it('draftFromQuote stringifies fields and keys items', () => {
    const draft = draftFromQuote(quote);
    expect(draft.discount_pct).toBe('5');
    expect(draft.items[0]).toMatchObject({
      key: 'existing-7',
      kind: 'av',
      quantity: '2',
      unit_price: '50',
    });
  });

  it('toDateInputValue renders local YYYY-MM-DD', () => {
    expect(toDateInputValue(new Date(2026, 7, 15))).toBe('2026-08-15');
  });

  it('draftToPayload parses numbers and nulls empty optionals', () => {
    const draft = draftFromQuote(quote);
    draft.valid_until = '';
    draft.notes = '  ';
    const payload = draftToPayload(draft);
    expect(payload.discount_pct).toBe(5);
    expect(payload.valid_until).toBeNull();
    expect(payload.notes).toBeNull();
    expect(payload.items[0]).toEqual({
      kind: 'av',
      description: 'LED wall',
      quantity: 2,
      unit_price: 50,
    });
  });

  it('newQuoteItemDraft defaults', () => {
    expect(newQuoteItemDraft('k')).toEqual({
      key: 'k',
      kind: 'venue',
      description: '',
      quantity: '1',
      unit_price: '0',
    });
  });
});
