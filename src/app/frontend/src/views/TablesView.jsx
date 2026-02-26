import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ErrorBox } from '../components/ErrorBox';
import { TagList, TagBadge } from '../components/TagBadge';
import { BulkTagModal } from '../components/TagInput';
import { Checkbox } from '../components/Checkbox';
import { useTagFilter } from '../hooks/useTagFilter';

export function TablesView({ 
  data, 
  loading, 
  error, 
  systems,
  schedules,
  onEdit, 
  onDelete, 
  onTrigger,
  onBulkTrigger,
  onUploadCSV,
  onClearError,
  renderCell,
  onNavigateToResult,
  onRefresh,
  highlightEntityId,
  onClearEntityHighlight
}) {
  const [filterText, setFilterText] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showBulkTagModal, setShowBulkTagModal] = useState(false);
  const [bulkTagMode, setBulkTagMode] = useState('add');
  const highlightedRowRef = useRef(null);

  // Scroll to and highlight the row when highlightEntityId changes
  useEffect(() => {
    if (highlightEntityId && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Clear highlight after 3 seconds
      const timer = setTimeout(() => {
        if (onClearEntityHighlight) onClearEntityHighlight();
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [highlightEntityId, onClearEntityHighlight]);

  // Helper to safely parse arrays (handle JSON strings from backend)
  const parseArray = (arr) => {
    if (!arr) return [];
    if (Array.isArray(arr)) return arr;
    if (typeof arr === 'string') {
      try {
        const parsed = JSON.parse(arr);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  const parseTags = parseArray;

  // Get all unique tags from data
  const allTags = useMemo(() => {
    const tagSet = new Set();
    data.forEach(row => {
      parseTags(row.tags).forEach(tag => tagSet.add(tag));
    });
    return Array.from(tagSet).sort();
  }, [data]);

  const {
    filterTags, tagInput, setTagInput, showSuggestions, setShowSuggestions,
    selectedSuggestionIndex, tagInputRef, inputElementRef, tagSuggestions,
    addTagFilter, removeTagFilter, clearTags, handleTagKeyDown, filterByTags,
  } = useTagFilter(allTags);

  // Filter data based on search text, status, and tags
  const filteredData = useMemo(() => {
    let result = data;
    
    // Apply text filter
    if (filterText) {
      const search = filterText.toLowerCase();
      result = result.filter(row => {
        const srcTable = `${row.src_schema}.${row.src_table}`.toLowerCase();
        const tgtTable = `${row.tgt_schema}.${row.tgt_table}`.toLowerCase();
        const name = row.name?.toLowerCase() || '';
        return srcTable.includes(search) || tgtTable.includes(search) || name.includes(search);
      });
    }
    
    // Apply status filter
    if (filterStatus) {
      if (filterStatus === 'none') {
        result = result.filter(row => !row.last_run_status);
      } else {
        result = result.filter(row => row.last_run_status === filterStatus);
      }
    }
    
    // Apply tag filter
    result = filterByTags(result, row => parseTags(row.tags));
    
    // Sort: enabled items first, disabled items last
    result.sort((a, b) => {
      if (a.is_active === b.is_active) return 0;
      return a.is_active ? -1 : 1;
    });
    
    return result;
  }, [data, filterText, filterStatus, filterByTags]);

  // Handle select all (only filtered items)
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredData.map(row => row.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // Handle individual row selection
  const handleSelectRow = (id, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  // Bulk actions
  const handleBulkTrigger = () => {
    onBulkTrigger(Array.from(selectedIds));
    setSelectedIds(new Set());
  };

  const handleBulkToggleActive = async (isActive) => {
    try {
      const promises = Array.from(selectedIds).map(async (id) => {
        const row = data.find(r => r.id === id);
        if (row) {
          const response = await fetch(`/api/tables/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              is_active: isActive,
              version: row.version
            })
          });
          if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to update table ${id}:`, error);
          }
        }
      });
      await Promise.all(promises);
      if (onRefresh) onRefresh();
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error toggling active state:', err);
    }
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete('tables', id, true)); // Skip browser confirm - we already showed our modal
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const handleBulkTagSubmit = async (tags) => {
    try {
      const entityIds = Array.from(selectedIds);
      if (bulkTagMode === 'add') {
        await fetch('/api/tags/entity/bulk-add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_type: 'table', entity_ids: entityIds, tags })
        });
      } else {
        await fetch('/api/tags/entity/bulk-remove', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_type: 'table', entity_ids: entityIds, tags })
        });
      }
      if (onRefresh) onRefresh();
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Error updating tags:', err);
    }
  };

  const allFilteredSelected = filteredData.length > 0 && filteredData.every(row => selectedIds.has(row.id));
  const someSelected = selectedIds.size > 0;

  // Export CSV handler
  const handleExportCSV = () => {
    const rowsToExport = someSelected 
      ? data.filter(row => selectedIds.has(row.id))
      : data;
    
    if (rowsToExport.length === 0) return;

    const headers = ['name', 'src_schema', 'src_table', 'tgt_schema', 'tgt_table', 'source', 'target', 'schedule_name', 'is_active', 'compare_mode', 'pk_columns', 'watermark_filter', 'exclude_columns', 'tags'];
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = rowsToExport.map(row => {
      const srcSystem = systems.find(s => s.id === row.src_system_id)?.name || '';
      const tgtSystem = systems.find(s => s.id === row.tgt_system_id)?.name || '';
      const scheduleNames = parseArray(row.schedules).join(',');
      const pkCols = Array.isArray(row.pk_columns) ? row.pk_columns.join(',') : (row.pk_columns || '');
      const excludeCols = Array.isArray(row.exclude_columns) ? row.exclude_columns.join(',') : (row.exclude_columns || '');
      const tags = parseArray(row.tags).join(',');

      return [
        row.name,
        row.src_schema,
        row.src_table,
        row.tgt_schema,
        row.tgt_table,
        srcSystem,
        tgtSystem,
        scheduleNames,
        row.is_active ? 'true' : 'false',
        row.compare_mode || 'except_all',
        pkCols,
        row.watermark_filter || '',
        excludeCols,
        tags
      ].map(escapeCSV).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const now = new Date();
    const timestamp = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tables_${timestamp}.csv`;
    a.click();
  };

  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-rust-light mb-1">Tables</h2>
        <p className="text-gray-400 text-base">Manage table-to-table validation configurations</p>
      </div>
      
      <div className="mb-3 flex gap-2">
        <button onClick={() => onEdit({})} className="px-3 py-2 text-base bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 transition-colors font-medium">+ Add Table</button>
        <button onClick={onUploadCSV} className="px-3 py-2 text-base bg-rust text-gray-100 border-0 rounded-md cursor-pointer hover:bg-rust-light transition-colors font-medium">Upload CSV</button>
        <button onClick={handleExportCSV} className="px-3 py-2 text-base bg-blue-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-blue-500 transition-colors font-medium">
          {someSelected ? `Export Selected (${selectedIds.size})` : 'Export CSV'}
        </button>
        <button onClick={onRefresh} className="px-3 py-2 text-base bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 transition-colors font-medium ml-auto">Refresh</button>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg overflow-hidden">
          {/* Filter and Bulk Actions Bar */}
          <div className="p-2 bg-charcoal-400 border-b border-charcoal-200">
            <div className="flex gap-2 items-center">
              {/* Name/Table Filter */}
              <input
                type="text"
                placeholder="Filter by name..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                className="w-[36rem] px-3 py-1.5 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light"
              />
              
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-36 px-2 py-1.5 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="succeeded">Succeeded</option>
                <option value="failed">Failed</option>
                <option value="error">Error</option>
                <option value="none">No runs</option>
              </select>
              
              {/* Tag Filter */}
              <div className="relative w-40" ref={tagInputRef}>
                <div 
                  className="flex flex-wrap gap-1 items-center px-2 py-1 bg-charcoal-600 border border-charcoal-300 rounded min-h-[34px] cursor-text focus-within:border-rust-light"
                  onClick={() => inputElementRef.current?.focus()}
                >
                  {filterTags.map(tag => (
                    <TagBadge key={tag} tag={tag} onRemove={() => removeTagFilter(tag)} />
                  ))}
                  <input
                    ref={inputElementRef}
                    type="text"
                    placeholder={filterTags.length === 0 ? "Tags..." : ""}
                    value={tagInput}
                    onChange={(e) => {
                      setTagInput(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onKeyDown={handleTagKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    className="flex-1 min-w-[40px] bg-transparent border-0 text-gray-200 text-sm focus:outline-none placeholder-gray-500"
                  />
                </div>
                {showSuggestions && tagSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-charcoal-600 border border-charcoal-300 rounded shadow-lg max-h-48 overflow-y-auto">
                    {tagSuggestions.map((tag, idx) => (
                      <button
                        key={tag}
                        onClick={() => addTagFilter(tag)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          idx === selectedSuggestionIndex
                            ? 'bg-purple-600 text-white'
                            : 'text-gray-200 hover:bg-charcoal-500'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bulk Actions */}
              <div className="ml-auto flex items-center gap-1.5">
                {someSelected ? (
                  <>
                    <span className="text-purple-300 font-medium text-sm whitespace-nowrap mr-1">{selectedIds.size} selected</span>
                    <button 
                      onClick={handleBulkTrigger}
                      className="px-2 py-1 text-sm bg-green-600 text-gray-100 rounded hover:bg-green-500 transition-colors"
                      title="Run selected"
                    >
                      ▶️
                    </button>
                    <button 
                      onClick={() => { setBulkTagMode('add'); setShowBulkTagModal(true); }}
                      className="px-2 py-1 text-sm bg-teal-600 text-gray-100 rounded hover:bg-teal-500 transition-colors whitespace-nowrap"
                    >
                      + Tags
                    </button>
                    <button 
                      onClick={() => { setBulkTagMode('remove'); setShowBulkTagModal(true); }}
                      className="px-2 py-1 text-sm bg-orange-600 text-gray-100 rounded hover:bg-orange-500 transition-colors whitespace-nowrap"
                    >
                      − Tags
                    </button>
                    <button 
                      onClick={() => handleBulkToggleActive(true)}
                      className="px-2 py-1 text-sm bg-blue-600 text-gray-100 rounded hover:bg-blue-500 transition-colors whitespace-nowrap"
                    >
                      Enable
                    </button>
                    <button 
                      onClick={() => handleBulkToggleActive(false)}
                      className="px-2 py-1 text-sm bg-gray-600 text-gray-100 rounded hover:bg-gray-500 transition-colors whitespace-nowrap"
                    >
                      Disable
                    </button>
                    <button 
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-2 py-1 text-sm bg-red-600 text-gray-100 rounded hover:bg-red-500 transition-colors"
                    >
                      🗑️
                    </button>
                    <button 
                      onClick={() => setSelectedIds(new Set())}
                      className="px-2 py-1 text-sm bg-charcoal-600 text-gray-300 rounded hover:bg-charcoal-500 transition-colors ml-auto whitespace-nowrap"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <span className="text-gray-500 text-sm">Select items for bulk actions</span>
                )}
              </div>
            </div>
          </div>

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-charcoal-500 border border-red-700 rounded-lg p-4 max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-red-400 mb-2">⚠️ Confirm Delete</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <strong>{selectedIds.size}</strong> table{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 bg-charcoal-600 text-gray-200 rounded hover:bg-charcoal-500"
              >
                Cancel
              </button>
              <button 
                onClick={handleBulkDelete}
                className="px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-500"
              >
                Delete {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-charcoal-400 border-b border-charcoal-200">
                <tr>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="text-center px-2 py-1.5 text-sm text-gray-300 font-semibold w-16">Status</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Table</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-24">Last Run</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Source</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Target</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-24">Compare Mode</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold" style={{ maxWidth: '200px' }}>PK Columns</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold" style={{ maxWidth: '250px' }}>Exclude Columns</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-20">Schedules</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-24">Tags</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-20">Actions</th>
                </tr>
              </thead>
              <tbody>
              {filteredData.map(row => {
                const scheduleNames = parseArray(row.schedules).join(', ');
                const srcTable = `${row.src_schema}.${row.src_table}`;
                const tgtTable = `${row.tgt_schema}.${row.tgt_table}`;
                const tablesMatch = srcTable === tgtTable;
                
                const isSelected = selectedIds.has(row.id);
                
                const isHighlighted = row.id === highlightEntityId;
                
                return (
                  <tr 
                    key={row.id}
                    ref={isHighlighted ? highlightedRowRef : null}
                    className={`border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors ${
                      isSelected ? 'bg-purple-900/20' : ''
                    } ${!row.is_active ? 'opacity-50' : ''} ${
                      isHighlighted ? 'bg-rust-light/20 ring-2 ring-rust-light' : ''
                    }`}
                  >
                    <td className="px-2 py-1 text-sm">
                      <Checkbox
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                      />
                    </td>
                    <td className="px-2 py-1 text-center">
                      {row.is_active ? (
                        <span className="text-green-500 text-lg" title="Active">●</span>
                      ) : (
                        <span className="text-gray-600 text-lg" title="Disabled">○</span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-sm">
                      <div className="flex flex-col gap-0.5">
                        {tablesMatch ? (
                          <span className="text-gray-100 whitespace-nowrap">{srcTable}</span>
                        ) : (
                          <div className="flex flex-col text-gray-100">
                            <span className="whitespace-nowrap">src: {srcTable}</span>
                            <span className="whitespace-nowrap">tgt: {tgtTable}</span>
                          </div>
                        )}
                        <span className="text-gray-500 text-xs whitespace-nowrap">{row.name}</span>
                      </div>
                    </td>
                    <td className="px-2 py-1">
                      {row.last_run_status === 'succeeded' ? (
                        <button
                          onClick={() => onNavigateToResult(row.last_run_id)}
                          className="px-1.5 py-0.5 text-sm rounded-full bg-green-900/40 text-green-300 border border-green-700 whitespace-nowrap hover:bg-green-900/60 transition-colors"
                          title={`Last run: ${new Date(row.last_run_timestamp).toLocaleString()}`}
                        >
                          ✓ Success
                        </button>
                      ) : row.last_run_status === 'failed' ? (
                        <button
                          onClick={() => onNavigateToResult(row.last_run_id)}
                          className="px-1.5 py-0.5 text-sm rounded-full bg-red-900/40 text-red-300 border border-red-700 whitespace-nowrap hover:bg-red-900/60 transition-colors"
                          title={`Last run: ${new Date(row.last_run_timestamp).toLocaleString()}`}
                        >
                          ✗ Failed
                        </button>
                      ) : row.last_run_status === 'error' ? (
                        <button
                          onClick={() => onNavigateToResult(row.last_run_id)}
                          className="px-1.5 py-0.5 text-sm rounded-full bg-orange-900/40 text-orange-300 border border-orange-700 hover:bg-orange-900/60 transition-colors animate-pulse max-w-[200px] truncate"
                          title={row.last_run_error || 'Unknown error'}
                        >
                          ⚠ {row.last_run_error ? row.last_run_error.substring(0, 30) + (row.last_run_error.length > 30 ? '...' : '') : 'Error'}
                        </button>
                      ) : (
                        <span className="px-1.5 py-0.5 text-sm rounded-full bg-gray-900/40 text-gray-500 border border-gray-700 whitespace-nowrap">
                          No recent
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-100 text-sm w-40">{renderCell('tables', row, 'src_system_id', systems)}</td>
                    <td className="px-2 py-1 text-gray-100 text-sm w-40">{renderCell('tables', row, 'tgt_system_id', systems)}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm whitespace-nowrap">{row.compare_mode}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm" style={{ maxWidth: '200px' }}>{row.pk_columns?.join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm" style={{ maxWidth: '250px' }}>{row.exclude_columns?.join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-purple-400 text-sm">{scheduleNames || '-'}</td>
                    <td className="px-2 py-1">
                      <TagList tags={parseTags(row.tags)} maxVisible={3} />
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <button onClick={() => onEdit(row)} className="px-1.5 py-0.5 text-sm bg-purple-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-purple-500 mr-1">Edit</button>
                      <button onClick={() => onDelete('tables', row.id)} className="px-1.5 py-0.5 text-sm bg-red-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-red-500 mr-1">Del</button>
                      <button onClick={() => onTrigger('table', row.id)} className="px-1.5 py-0.5 text-sm bg-green-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-green-500">▶️</button>
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Bulk Tag Modal */}
      <BulkTagModal
        isOpen={showBulkTagModal}
        onClose={() => setShowBulkTagModal(false)}
        mode={bulkTagMode}
        onSubmit={handleBulkTagSubmit}
        entityCount={selectedIds.size}
      />
    </>
  );
}
