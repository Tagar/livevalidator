import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ErrorBox } from '../components/ErrorBox';

export function ValidationResultsView({ data, loading, error, onClearError, highlightId, onClearHighlight }) {
  const [sortConfig, setSortConfig] = useState({ key: 'requested_at', direction: 'desc' });
  const [filters, setFilters] = useState({
    entity_name: '',
    entity_type: '',
    status: '',
    system_pair: '',
  });
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activePreset, setActivePreset] = useState('');
  const highlightedRowRef = useRef(null);

  // Scroll to and highlight the row when highlightId changes
  useEffect(() => {
    if (highlightId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        if (onClearHighlight) onClearHighlight();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [highlightId, onClearHighlight]);

  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handlePresetClick = (preset) => {
    const now = new Date();
    let from = new Date();

    switch (preset) {
      case '1h':
        from.setHours(now.getHours() - 1);
        break;
      case '3h':
        from.setHours(now.getHours() - 3);
        break;
      case '6h':
        from.setHours(now.getHours() - 6);
        break;
      case '12h':
        from.setHours(now.getHours() - 12);
        break;
      case '24h':
        from.setHours(now.getHours() - 24);
        break;
      case '7d':
        from.setDate(now.getDate() - 7);
        break;
      default:
        return;
    }

    // Format for datetime-local input
    const formatDateTime = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    setDateFrom(formatDateTime(from));
    setDateTo(formatDateTime(now));
    setActivePreset(preset);
  };

  const handleDateFromChange = (value) => {
    setDateFrom(value);
    setActivePreset('');
  };

  const handleDateToChange = (value) => {
    setDateTo(value);
    setActivePreset('');
  };

  const clearDateFilters = () => {
    setDateFrom('');
    setDateTo('');
    setActivePreset('');
  };

  const hasActiveFilters = filters.entity_name || filters.entity_type || filters.status || filters.system_pair || dateFrom || dateTo;

  const clearAllFilters = () => {
    setFilters({
      entity_name: '',
      entity_type: '',
      status: '',
      system_pair: '',
    });
    clearDateFilters();
  };

  // Extract unique system pairs from data
  const availableSystemPairs = useMemo(() => {
    const pairsSet = new Set();
    data.forEach(v => {
      if (v.source_system_name && v.target_system_name) {
        pairsSet.add(`${v.source_system_name} → ${v.target_system_name}`);
      }
    });
    return Array.from(pairsSet).sort();
  }, [data]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // Apply date filters
    if (dateFrom) {
      const fromTime = new Date(dateFrom).getTime();
      result = result.filter(v => new Date(v.requested_at).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).getTime();
      result = result.filter(v => new Date(v.requested_at).getTime() <= toTime);
    }

    // Apply filters
    if (filters.entity_name) {
      result = result.filter(v => 
        v.entity_name.toLowerCase().includes(filters.entity_name.toLowerCase())
      );
    }
    if (filters.entity_type) {
      result = result.filter(v => v.entity_type === filters.entity_type);
    }
    if (filters.status) {
      result = result.filter(v => v.status === filters.status);
    }
    if (filters.system_pair) {
      result = result.filter(v => 
        `${v.source_system_name} → ${v.target_system_name}` === filters.system_pair
      );
    }

    // Apply sorting
    result.sort((a, b) => {
      let aVal, bVal;

      switch (sortConfig.key) {
        case 'entity_name':
          aVal = a.entity_name.toLowerCase();
          bVal = b.entity_name.toLowerCase();
          break;
        case 'entity_type':
          aVal = a.entity_type;
          bVal = b.entity_type;
          break;
        case 'status':
          aVal = a.status;
          bVal = b.status;
          break;
        case 'duration':
          aVal = a.duration_seconds || 0;
          bVal = b.duration_seconds || 0;
          break;
        case 'systems':
          aVal = `${a.source_system_name} ${a.target_system_name}`.toLowerCase();
          bVal = `${b.source_system_name} ${b.target_system_name}`.toLowerCase();
          break;
        case 'row_counts':
          aVal = a.row_count_source || 0;
          bVal = b.row_count_source || 0;
          break;
        case 'differences':
          aVal = a.rows_different || 0;
          bVal = b.rows_different || 0;
          break;
        case 'requested_at':
          aVal = new Date(a.requested_at).getTime();
          bVal = new Date(b.requested_at).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, filters, sortConfig, dateFrom, dateTo]);

  const SortableHeader = ({ label, sortKey, className = "" }) => (
    <th 
      className={`text-left px-2 py-1.5 text-sm text-gray-300 font-semibold cursor-pointer hover:bg-charcoal-300/30 transition-colors select-none ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortConfig.key === sortKey && (
          <span className="text-rust-light">
            {sortConfig.direction === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
    </th>
  );

  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-rust-light mb-1">🎯 Validation Results</h2>
        <p className="text-gray-400 text-base">Recent validation history for the last 30 days</p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg p-2.5">
          <div className="text-gray-400 text-sm mb-0.5">Total Validations</div>
          <div className="text-3xl font-bold text-gray-100">{filteredAndSortedData.length}</div>
        </div>
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-2.5">
          <div className="text-green-400 text-sm mb-0.5">✓ Succeeded</div>
          <div className="text-3xl font-bold text-green-300">
            {filteredAndSortedData.filter(v => v.status === 'succeeded').length}
          </div>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-2.5">
          <div className="text-red-400 text-sm mb-0.5">✗ Failed</div>
          <div className="text-3xl font-bold text-red-300">
            {filteredAndSortedData.filter(v => v.status === 'failed').length}
          </div>
        </div>
        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-2.5">
          <div className="text-purple-400 text-sm mb-0.5">Avg Duration</div>
          <div className="text-3xl font-bold text-purple-300">
            {filteredAndSortedData.length > 0 
              ? ((filteredAndSortedData.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / filteredAndSortedData.length) / 60).toFixed(1)
              : 0}m
          </div>
        </div>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg overflow-hidden">
          {/* Date Range Filter */}
          <div className="p-2 bg-charcoal-400 border-b border-charcoal-200">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-300 text-sm font-semibold">Time:</span>
              {['1h', '3h', '6h', '12h', '24h', '7d'].map(preset => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`px-2 py-1 text-sm rounded transition-all ${
                    activePreset === preset
                      ? 'bg-rust-light text-white border border-rust-light shadow-sm'
                      : 'bg-charcoal-600 text-gray-300 border border-charcoal-300 hover:border-rust-light/50 hover:bg-charcoal-500'
                  }`}
                >
                  {preset}
                </button>
              ))}
              {(dateFrom || dateTo) && (
                <button
                  onClick={clearDateFilters}
                  className="px-2 py-1 text-sm rounded bg-red-900/40 text-red-300 border border-red-700 hover:bg-red-900/60 transition-all"
                >
                  Clear
                </button>
              )}
              <div className="flex items-center gap-1 ml-auto">
                <label className="text-gray-400 text-sm">From:</label>
                <input
                  type="datetime-local"
                  value={dateFrom}
                  onChange={(e) => handleDateFromChange(e.target.value)}
                  className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light"
                />
              </div>
              <div className="flex items-center gap-1">
                <label className="text-gray-400 text-sm">To:</label>
                <input
                  type="datetime-local"
                  value={dateTo}
                  onChange={(e) => handleDateToChange(e.target.value)}
                  className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light"
                />
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-2 bg-charcoal-400 border-b border-charcoal-200">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300 text-sm font-semibold">Filters:</span>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="px-2 py-1 text-sm rounded bg-red-900/40 text-red-300 border border-red-700 hover:bg-red-900/60 transition-all"
                >
                  Clear All
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input
              type="text"
              placeholder="Filter by entity..."
              value={filters.entity_name}
              onChange={(e) => handleFilterChange('entity_name', e.target.value)}
              className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light"
            />
            <select
              value={filters.entity_type}
              onChange={(e) => handleFilterChange('entity_type', e.target.value)}
              className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light hover:border-charcoal-100 transition-colors cursor-pointer"
            >
              <option value="">All Types</option>
              <option value="table">Table</option>
              <option value="query">Query</option>
            </select>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light hover:border-charcoal-100 transition-colors cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
            </select>
            <select
              value={filters.system_pair}
              onChange={(e) => handleFilterChange('system_pair', e.target.value)}
              className="px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light hover:border-charcoal-100 transition-colors cursor-pointer"
            >
              <option value="">All System Pairs</option>
              {availableSystemPairs.map(pair => (
                <option key={pair} value={pair}>
                  {pair}
                </option>
              ))}
            </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-charcoal-400 border-b border-charcoal-200">
                <tr>
                  <SortableHeader label="Entity" sortKey="entity_name" />
                  <SortableHeader label="Type" sortKey="entity_type" />
                  <SortableHeader label="Status" sortKey="status" />
                  <SortableHeader label="Duration" sortKey="duration" />
                  <SortableHeader label="Source → Target" sortKey="systems" />
                  <SortableHeader label="Row Counts" sortKey="row_counts" />
                  <SortableHeader label="Differences" sortKey="differences" />
                  <SortableHeader label="Triggered" sortKey="requested_at" />
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedData.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-8 text-gray-500 text-base">
                      {data.length === 0 
                        ? "No validation history yet. Run a validation from Tables or Queries!"
                        : "No results match the current filters."}
                    </td>
                  </tr>
                ) : (
                  filteredAndSortedData.map((v) => (
                    <tr 
                      key={v.id} 
                      ref={v.id === highlightId ? highlightedRowRef : null}
                      className={`border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors ${
                        v.id === highlightId ? 'bg-rust-light/20 ring-2 ring-rust-light' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 text-gray-200 font-medium text-sm">{v.entity_name}</td>
                      <td className="px-2 py-1.5">
                        <span className={`px-1.5 py-0.5 text-sm rounded-full ${
                          v.entity_type === 'table' 
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-700' 
                            : 'bg-purple-900/40 text-purple-300 border border-purple-700'
                        }`}>
                          {v.entity_type}
                        </span>
                      </td>
                      <td className="px-2 py-1.5">
                        {v.status === 'succeeded' ? (
                          <span className="px-1.5 py-0.5 text-sm rounded-full bg-green-900/40 text-green-300 border border-green-700 whitespace-nowrap">
                            ✓ Success
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-sm rounded-full bg-red-900/40 text-red-300 border border-red-700 whitespace-nowrap">
                            ✗ Failed
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-gray-300 text-sm whitespace-nowrap">{((v.duration_seconds || 0) / 60).toFixed(1)}m</td>
                      <td className="px-2 py-1.5 text-sm text-gray-400 whitespace-nowrap">
                        {v.source_system_name} → {v.target_system_name}
                      </td>
                      <td className="px-2 py-1.5 text-sm whitespace-nowrap">
                        {v.row_count_match ? (
                          <span className="text-green-400">✓ {v.row_count_source?.toLocaleString()}</span>
                        ) : (
                          <span className="text-red-400">
                            {v.row_count_source?.toLocaleString()} ≠ {v.row_count_target?.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-sm whitespace-nowrap">
                        {v.rows_different === null || v.rows_different === undefined ? (
                          <span className="text-gray-500">-</span>
                        ) : v.rows_different > 0 ? (
                          <span className="text-rust-light font-medium">
                            {v.rows_different.toLocaleString()} ({v.difference_pct}%)
                          </span>
                        ) : (
                          <span className="text-green-400">0</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-sm text-gray-400 whitespace-nowrap">
                        {new Date(v.requested_at).toLocaleString()}
                      </td>
                      <td className="px-2 py-1.5 text-sm whitespace-nowrap">
                        {v.databricks_run_url && (
                          <a 
                            href={v.databricks_run_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 underline"
                          >
                            View
                          </a>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
