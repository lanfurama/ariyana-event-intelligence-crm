/**
 * Shared form-control class strings. Views compose these instead of
 * hand-rolling input styles, so focus/border/disabled treatments stay uniform.
 */

export const inputClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg placeholder:text-slate-400 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-400 transition-colors';

export const selectClass =
  'w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 transition-colors';

export const textareaClass = inputClass + ' resize-y';

export const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1';
