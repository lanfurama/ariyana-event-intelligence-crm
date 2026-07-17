import {
  AlignmentType,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  ShadingType,
} from 'docx';
import type { Lead } from '../types/index.js';
import type { BookingWithSpaces } from '../models/BookingModel.js';
import type { QuoteWithItems } from '../models/QuoteModel.js';
import { computeQuoteTotals } from './bookingHelpers.js';

// Client-facing proposal document. All date/time rendering is pinned to
// Asia/Ho_Chi_Minh - the server may run in UTC (Vercel) but the venue does not.

const TZ = 'Asia/Ho_Chi_Minh';
const GOLD = 'B08A2E';
const SLATE = '1E293B';

const KIND_LABELS: Record<string, string> = {
  venue: 'Venue rental',
  fnb: 'F&B',
  av: 'AV & equipment',
  service: 'Services',
  other: 'Other',
};

const vnd = (amount: number) => `${Math.round(amount).toLocaleString('en-US')}`;

const fmtDate = (value: string | Date) =>
  new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });

const fmtTime = (value: string | Date) =>
  new Date(value).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

function cell(
  text: string,
  options: { bold?: boolean; shaded?: boolean; right?: boolean; size?: number } = {},
): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({ text: text || '—', bold: options.bold, size: options.size ?? 20 }),
        ],
        alignment: options.right ? AlignmentType.RIGHT : AlignmentType.LEFT,
      }),
    ],
    shading: options.shaded ? { fill: 'F1F5F9', type: ShadingType.CLEAR } : undefined,
  });
}

function fullWidth(table: { rows: TableRow[] }): Table {
  return new Table({
    rows: table.rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
  });
}

function heading(text: string): Paragraph {
  return new Paragraph({
    children: [new TextRun({ text, bold: true, size: 24, color: SLATE })],
    spacing: { before: 400, after: 160 },
  });
}

export async function buildProposalDocx(
  quote: QuoteWithItems,
  booking: BookingWithSpaces,
  venueNameById: Record<string, string>,
  lead: Lead | null,
): Promise<Buffer> {
  const sections: (Paragraph | Table)[] = [];

  // Header
  sections.push(
    new Paragraph({
      children: [new TextRun({ text: 'EVENT PROPOSAL', bold: true, size: 40, color: GOLD })],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: 'Ariyana Convention Centre Danang',
          bold: true,
          size: 22,
          color: SLATE,
        }),
      ],
      spacing: { after: 40 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: '105 Vo Nguyen Giap St., Danang City, Vietnam · www.ariyanacentre.com',
          size: 18,
          color: '64748B',
        }),
      ],
      spacing: { after: 300 },
    }),
  );

  // Overview
  const clientText = lead
    ? `${lead.company_name}${lead.key_person_name ? ` — ${lead.key_person_name}` : ''}${
        lead.key_person_email ? ` (${lead.key_person_email})` : ''
      }`
    : '—';

  sections.push(heading('Overview'));
  sections.push(
    fullWidth({
      rows: [
        new TableRow({
          children: [
            cell('Proposal No.', { shaded: true }),
            cell(`${booking.code} · v${quote.version}`),
          ],
        }),
        new TableRow({
          children: [cell('Date', { shaded: true }), cell(fmtDate(quote.created_at || new Date()))],
        }),
        new TableRow({
          children: [
            cell('Valid until', { shaded: true }),
            cell(quote.valid_until ? fmtDate(quote.valid_until) : '—'),
          ],
        }),
        new TableRow({ children: [cell('Client', { shaded: true }), cell(clientText)] }),
        new TableRow({ children: [cell('Event', { shaded: true }), cell(booking.title)] }),
        new TableRow({
          children: [cell('Event type', { shaded: true }), cell(booking.event_type || '—')],
        }),
        new TableRow({
          children: [
            cell('Expected guests', { shaded: true }),
            cell(booking.expected_guests != null ? `${booking.expected_guests} pax` : '—'),
          ],
        }),
        new TableRow({
          children: [cell('Layout', { shaded: true }), cell(booking.layout || '—')],
        }),
      ],
    }),
  );

  // Venue schedule
  sections.push(heading('Venue schedule'));
  sections.push(
    fullWidth({
      rows: [
        new TableRow({
          children: [
            cell('Venue', { bold: true, shaded: true }),
            cell('Date', { bold: true, shaded: true }),
            cell('Time', { bold: true, shaded: true }),
            cell('Setup / Teardown', { bold: true, shaded: true }),
          ],
        }),
        ...booking.spaces.map(
          (space) =>
            new TableRow({
              children: [
                cell(venueNameById[space.venue_id] || space.venue_id),
                cell(fmtDate(space.start_at)),
                cell(`${fmtTime(space.start_at)} – ${fmtTime(space.end_at)}`),
                cell(`${space.setup_minutes} / ${space.teardown_minutes} min`),
              ],
            }),
        ),
      ],
    }),
  );

  // Quotation
  const totals = computeQuoteTotals(
    quote.items.map((item) => ({ quantity: item.quantity, unit_price: item.unit_price })),
    quote.discount_pct,
    quote.vat_pct,
  );

  sections.push(heading('Quotation (VND)'));
  sections.push(
    fullWidth({
      rows: [
        new TableRow({
          children: [
            cell('#', { bold: true, shaded: true }),
            cell('Category', { bold: true, shaded: true }),
            cell('Description', { bold: true, shaded: true }),
            cell('Qty', { bold: true, shaded: true, right: true }),
            cell('Unit price', { bold: true, shaded: true, right: true }),
            cell('Amount', { bold: true, shaded: true, right: true }),
          ],
        }),
        ...quote.items.map(
          (item, index) =>
            new TableRow({
              children: [
                cell(String(index + 1)),
                cell(KIND_LABELS[item.kind] || item.kind),
                cell(item.description),
                cell(String(item.quantity), { right: true }),
                cell(vnd(item.unit_price), { right: true }),
                cell(vnd(item.amount), { right: true }),
              ],
            }),
        ),
        new TableRow({
          children: [
            cell(''),
            cell(''),
            cell(''),
            cell(''),
            cell('Subtotal', { bold: true }),
            cell(vnd(totals.subtotal), { right: true }),
          ],
        }),
        new TableRow({
          children: [
            cell(''),
            cell(''),
            cell(''),
            cell(''),
            cell(`Discount (${quote.discount_pct}%)`),
            cell(totals.discountAmount > 0 ? `-${vnd(totals.discountAmount)}` : '0', {
              right: true,
            }),
          ],
        }),
        new TableRow({
          children: [
            cell(''),
            cell(''),
            cell(''),
            cell(''),
            cell(`VAT (${quote.vat_pct}%)`),
            cell(vnd(totals.vatAmount), { right: true }),
          ],
        }),
        new TableRow({
          children: [
            cell(''),
            cell(''),
            cell(''),
            cell(''),
            cell('TOTAL', { bold: true, shaded: true }),
            cell(vnd(totals.total), { bold: true, shaded: true, right: true, size: 22 }),
          ],
        }),
      ],
    }),
  );

  // Notes + validity
  if (quote.notes) {
    sections.push(heading('Notes'));
    sections.push(new Paragraph({ children: [new TextRun({ text: quote.notes, size: 20 })] }));
  }
  if (quote.valid_until) {
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `This proposal is valid until ${fmtDate(quote.valid_until)}. Prices are quoted in Vietnamese Dong (VND).`,
            italics: true,
            size: 18,
            color: '64748B',
          }),
        ],
        spacing: { before: 300 },
      }),
    );
  }

  const doc = new Document({ sections: [{ children: sections }] });
  return Packer.toBuffer(doc);
}
