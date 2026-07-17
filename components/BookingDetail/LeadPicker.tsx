import { useMemo, useState } from 'react';
import type React from 'react';
import { X } from 'lucide-react';
import type { Lead } from '../../types';
import { inputClass } from '../ui';

interface LeadPickerProps {
  leads: Lead[];
  value: string;
  onChange: (leadId: string) => void;
  disabled?: boolean;
}

/** Lightweight search-combobox over the (already loaded) leads list. */
export const LeadPicker: React.FC<LeadPickerProps> = ({ leads, value, onChange, disabled }) => {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => leads.find((lead) => lead.id === value), [leads, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === '') return [];
    return leads
      .filter(
        (lead) =>
          lead.companyName.toLowerCase().includes(q) ||
          (lead.keyPersonName || '').toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [leads, query]);

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm bg-brand-50/60 border border-brand-200 rounded-lg">
        <span className="flex-1 min-w-0 truncate">
          <span className="font-semibold text-slate-900">{selected.companyName}</span>
          {selected.keyPersonName && (
            <span className="text-slate-500"> · {selected.keyPersonName}</span>
          )}
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="text-slate-400 hover:text-slate-600 shrink-0"
            title="Unlink lead"
          >
            <X size={14} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        disabled={disabled}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search company or contact to link a lead (optional)"
        className={inputClass}
      />
      {open && matches.length > 0 && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
          {matches.map((lead) => (
            <button
              key={lead.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(lead.id);
                setQuery('');
                setOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
            >
              <span className="font-semibold text-slate-900">{lead.companyName}</span>
              <span className="text-slate-500">
                {' '}
                · {lead.keyPersonName || 'No contact'} · {lead.country}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
