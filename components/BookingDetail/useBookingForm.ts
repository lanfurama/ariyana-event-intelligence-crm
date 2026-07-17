import { useState } from 'react';
import type { Booking, Venue } from '../../types';
import type { SpaceConflictsResult } from '../../services/apiService';
import { bookingsApi } from '../../services/apiService';
import type { VenueSuggestion } from './venueFitHelpers';
import { suggestVenues } from './venueFitHelpers';
import type { BookingDraft, SpaceDraft } from './bookingDetailHelpers';
import {
  draftFromBooking,
  draftToPayload,
  emptyBookingDraft,
  newSpaceDraft,
  spaceDraftToPayload,
  validateBookingDraft,
} from './bookingDetailHelpers';

export interface CreatePrefill {
  venueId?: string;
  day?: Date;
}

export interface SpaceConflictReport {
  label: string;
  result: SpaceConflictsResult;
}

let keyCounter = 0;
const nextKey = () => `space-${++keyCounter}`;

export function useBookingForm(
  initial: Booking | null,
  prefill: CreatePrefill | null,
  onSaved: () => void,
  onDeleted: () => void,
) {
  const [draft, setDraft] = useState<BookingDraft>(() => {
    if (initial) return draftFromBooking(initial);
    const base = emptyBookingDraft();
    base.spaces = [newSpaceDraft(nextKey(), prefill?.venueId, prefill?.day)];
    return base;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<SpaceConflictReport[] | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [suggestions, setSuggestions] = useState<VenueSuggestion[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const isEditing = initial !== null;

  const setField = <K extends keyof BookingDraft>(field: K, value: BookingDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const updateSpace = (key: string, patch: Partial<SpaceDraft>) => {
    setDraft((prev) => ({
      ...prev,
      spaces: prev.spaces.map((space) => (space.key === key ? { ...space, ...patch } : space)),
    }));
    setConflicts(null); // stale after any space change
  };

  const addSpace = () => {
    setDraft((prev) => ({
      ...prev,
      spaces: [
        ...prev.spaces,
        newSpaceDraft(nextKey(), prev.spaces[prev.spaces.length - 1]?.venue_id || ''),
      ],
    }));
    setConflicts(null);
  };

  const removeSpace = (key: string) => {
    setDraft((prev) => ({ ...prev, spaces: prev.spaces.filter((space) => space.key !== key) }));
    setConflicts(null);
  };

  /**
   * Deterministic venue suggestion (capacity fit + free/busy for the first
   * space's window) — arithmetic over structured data, not an LLM call.
   */
  const handleSuggestVenues = async (venues: Venue[]) => {
    setSuggesting(true);
    setError(null);
    try {
      const firstSpace = draft.spaces[0];
      let windowStart: Date | undefined;
      let windowEnd: Date | undefined;
      let busy: Array<{ venue_id: string; block_start_at: string; block_end_at: string }> = [];
      if (firstSpace && firstSpace.start_local && firstSpace.end_local) {
        const start = new Date(firstSpace.start_local);
        const end = new Date(firstSpace.end_local);
        if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && end > start) {
          windowStart = start;
          windowEnd = end;
          const blocks = await bookingsApi.getAvailability(start.toISOString(), end.toISOString());
          busy = initial ? blocks.filter((block) => block.booking_id !== initial.id) : blocks;
        }
      }
      const guests = Number(draft.expected_guests);
      setSuggestions(
        suggestVenues(venues, busy, {
          guests: Number.isFinite(guests) && guests > 0 ? guests : undefined,
          layout: draft.layout || undefined,
          windowStart,
          windowEnd,
        }),
      );
    } catch (e: any) {
      console.error('Error suggesting venues:', e);
      setError(e.message || 'Failed to suggest venues');
    } finally {
      setSuggesting(false);
    }
  };

  /** Apply a suggestion to the first space row (or start one when none exist). */
  const applySuggestion = (venueId: string) => {
    setDraft((prev) => {
      if (prev.spaces.length === 0) {
        return { ...prev, spaces: [newSpaceDraft(nextKey(), venueId)] };
      }
      const firstKey = prev.spaces[0].key;
      return {
        ...prev,
        spaces: prev.spaces.map((space) =>
          space.key === firstKey ? { ...space, venue_id: venueId } : space,
        ),
      };
    });
    setConflicts(null);
  };

  const handleCheckConflicts = async () => {
    const validation = validateBookingDraft(draft);
    if (validation.length > 0) {
      setError(validation.join('. '));
      return;
    }
    setCheckingConflicts(true);
    setError(null);
    try {
      const reports: SpaceConflictReport[] = [];
      for (const [index, space] of draft.spaces.entries()) {
        const payload = spaceDraftToPayload(space);
        const result = await bookingsApi.checkConflicts({
          ...payload,
          exclude_booking_id: initial?.id,
        });
        reports.push({ label: `Space ${index + 1}`, result });
      }
      setConflicts(reports);
    } catch (e: any) {
      console.error('Error checking conflicts:', e);
      setError(e.message || 'Failed to check conflicts');
    } finally {
      setCheckingConflicts(false);
    }
  };

  const handleSave = async () => {
    const validation = validateBookingDraft(draft);
    if (validation.length > 0) {
      setError(validation.join('. '));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = draftToPayload(draft);
      if (isEditing && initial) {
        await bookingsApi.update(initial.id, payload);
      } else {
        const { warnings } = await bookingsApi.create(payload);
        if (warnings.length > 0) {
          const hardCount = warnings.reduce((sum, w) => sum + w.hard.length, 0);
          const softCount = warnings.reduce((sum, w) => sum + w.soft.length, 0);
          alert(
            `Booking created. Heads up: it overlaps ${hardCount} confirmed and ${softCount} tentative booking(s) on the same venue(s).`,
          );
        }
      }
      onSaved();
    } catch (e: any) {
      console.error('Error saving booking:', e);
      setError(e.message || 'Failed to save booking');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!initial) return;
    if (!confirm(`Delete booking ${initial.code}? This cannot be undone.`)) return;
    setSaving(true);
    setError(null);
    try {
      await bookingsApi.delete(initial.id);
      onDeleted();
    } catch (e: any) {
      console.error('Error deleting booking:', e);
      setError(e.message || 'Failed to delete booking');
    } finally {
      setSaving(false);
    }
  };

  return {
    draft,
    isEditing,
    saving,
    error,
    conflicts,
    checkingConflicts,
    suggestions,
    suggesting,
    setField,
    updateSpace,
    addSpace,
    removeSpace,
    handleSuggestVenues,
    applySuggestion,
    handleCheckConflicts,
    handleSave,
    handleDelete,
  };
}
