import React from 'react';
import { Search, ChevronUp, ChevronDown, X } from 'lucide-react';

interface EventFiltersProps {
  searchTerm: string;
  countryFilter: string;
  industryFilter: string;
  statusFilter: string;
  priorityFilter: 'all' | 'high' | 'medium' | 'low';
  sortBy: 'score' | 'name' | 'status';
  sortOrder: 'asc' | 'desc';
  availableCountries: string[];
  availableIndustries: string[];
  filteredCount: number;
  totalCount: number;
  analyzedCount: number;
  notAnalyzedCount: number;
  onSearchChange: (value: string) => void;
  onCountryFilterChange: (value: string) => void;
  onIndustryFilterChange: (value: string) => void;
  onStatusFilterChange: (value: string) => void;
  onPriorityFilterChange: (value: 'all' | 'high' | 'medium' | 'low') => void;
  onSortByChange: (value: 'score' | 'name' | 'status') => void;
  onSortOrderToggle: () => void;
  onClearFilters: () => void;
}

export const EventFilters: React.FC<EventFiltersProps> = ({
  searchTerm,
  countryFilter,
  industryFilter,
  statusFilter,
  priorityFilter,
  sortBy,
  sortOrder,
  availableCountries,
  availableIndustries,
  filteredCount,
  totalCount,
  analyzedCount,
  notAnalyzedCount,
  onSearchChange,
  onCountryFilterChange,
  onIndustryFilterChange,
  onStatusFilterChange,
  onPriorityFilterChange,
  onSortByChange,
  onSortOrderToggle,
  onClearFilters,
}) => {
  const hasActiveFilters = searchTerm || countryFilter !== 'all' || industryFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-3">
      <div className="flex flex-col gap-3">
        {/* Row 1: Search */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Row 2: Advanced Filters */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* Country Filter */}
          <select
            value={countryFilter}
            onChange={(e) => onCountryFilterChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Countries</option>
            {availableCountries.map(country => (
              <option key={country} value={country}>{country}</option>
            ))}
          </select>

          {/* Industry Filter */}
          <select
            value={industryFilter}
            onChange={(e) => onIndustryFilterChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Industries</option>
            {availableIndustries.map(industry => (
              <option key={industry} value={industry}>{industry}</option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="analyzing">Analyzing</option>
            <option value="pending">Pending</option>
            <option value="error">Error</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => onPriorityFilterChange(e.target.value as any)}
            className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="all">All Priorities</option>
            <option value="high">High (≥50)</option>
            <option value="medium">Medium (30-49)</option>
            <option value="low">Low (&lt;30)</option>
          </select>
        </div>

        {/* Row 3: Sort Controls */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value as any)}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="score">Score</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
            </select>
            <button
              onClick={onSortOrderToggle}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
            >
              {sortOrder === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
            >
              <X size={14} />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mt-2 pt-2 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
        <p className="text-xs text-slate-600">
          Showing <strong className="text-slate-900">{filteredCount}</strong> of <strong className="text-slate-900">{totalCount}</strong> events
          {analyzedCount > 0 && (
            <span className="ml-2">• Analyzed: <strong className="text-slate-700">{analyzedCount}</strong></span>
          )}
        </p>
        {notAnalyzedCount > 0 && (
          <p className="text-xs text-amber-600 font-medium">
            ⚠️ {notAnalyzedCount} not analyzed
          </p>
        )}
      </div>
    </div>
  );
};
