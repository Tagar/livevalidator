import React, { useState, useMemo } from 'react';
import { ErrorBox } from '../components/ErrorBox';

export function QueriesView({ 
  data, 
  loading, 
  error, 
  systems,
  schedules,
  bindings,
  onEdit, 
  onDelete, 
  onTrigger,
  onUploadCSV,
  onClearError,
  renderCell,
  onNavigateToResult
}) {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const toggleRow = (rowId) => {
    setExpandedRowId(expandedRowId === rowId ? null : rowId);
  };

  // Filter data based on search text (name and SQL content)
  const filteredData = useMemo(() => {
    if (!filterText) return data;
    const search = filterText.toLowerCase();
    return data.filter(row => {
      const name = row.name?.toLowerCase() || '';
      const sql = (row.src_sql || row.sql || '').toLowerCase();
      const tgtSql = (row.tgt_sql || '').toLowerCase();
      return name.includes(search) || sql.includes(search) || tgtSql.includes(search);
    });
  }, [data, filterText]);

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
    selectedIds.forEach(id => onTrigger('compare_query', id));
    setSelectedIds(new Set());
  };

  const handleBulkToggleActive = (isActive) => {
    selectedIds.forEach(id => {
      const row = data.find(r => r.id === id);
      if (row) {
        onEdit({ ...row, is_active: isActive });
      }
    });
    setSelectedIds(new Set());
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete('queries', id, true)); // Skip browser confirm - we already showed our modal
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const allFilteredSelected = filteredData.length > 0 && filteredData.every(row => selectedIds.has(row.id));
  const someSelected = selectedIds.size > 0;

  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-rust-light mb-1">Compare Queries</h2>
        <p className="text-gray-400 text-base">Manage SQL query-to-query validation configurations</p>
      </div>
      
      <div className="mb-3 flex gap-2">
        <button onClick={() => onEdit({})} className="px-3 py-2 text-base bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 transition-colors font-medium">+ Add Query</button>
        <button onClick={onUploadCSV} className="px-3 py-2 text-base bg-rust text-gray-100 border-0 rounded-md cursor-pointer hover:bg-rust-light transition-colors font-medium">📂 Upload CSV</button>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg overflow-hidden">
          {/* Filter */}
          <div className="p-2 bg-charcoal-400 border-b border-charcoal-200">
            <input
              type="text"
              placeholder="Filter by name or SQL query..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full px-3 py-2 bg-charcoal-600 border border-charcoal-300 rounded text-gray-200 text-sm focus:outline-none focus:border-rust-light"
            />
          </div>

          {/* Bulk actions bar - only show when items are selected */}
          {someSelected && (
            <div className="p-2 bg-purple-900/20 border-b border-purple-700 flex items-center gap-2">
              <span className="text-purple-300 font-medium text-sm">{selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} selected</span>
              <div className="flex gap-1 ml-auto">
                <button 
                  onClick={handleBulkTrigger}
                  className="px-2 py-1 text-sm bg-green-600 text-gray-100 rounded hover:bg-green-500 transition-colors"
                >
                  ▶️ Run Selected
                </button>
                <button 
                  onClick={() => handleBulkToggleActive(true)}
                  className="px-2 py-1 text-sm bg-blue-600 text-gray-100 rounded hover:bg-blue-500 transition-colors"
                >
                  Enable
                </button>
                <button 
                  onClick={() => handleBulkToggleActive(false)}
                  className="px-2 py-1 text-sm bg-gray-600 text-gray-100 rounded hover:bg-gray-500 transition-colors"
                >
                  Disable
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-2 py-1 text-sm bg-red-600 text-gray-100 rounded hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="px-2 py-1 text-sm bg-charcoal-500 text-gray-300 rounded hover:bg-charcoal-400 transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-charcoal-500 border border-red-700 rounded-lg p-4 max-w-md" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-red-400 mb-2">⚠️ Confirm Delete</h3>
            <p className="text-gray-300 mb-4">
              Are you sure you want to delete <strong>{selectedIds.size}</strong> quer{selectedIds.size !== 1 ? 'ies' : 'y'}? This action cannot be undone.
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
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="cursor-pointer w-5 h-5 rounded border-2 border-gray-400 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 bg-charcoal-600 hover:border-purple-400 transition-colors"
                    />
                  </th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Name</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Source</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Target</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">SQL</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Compare Mode</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">PK Columns</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Schedules</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Last Run</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
              {filteredData.map(row => {
                const entityBindings = bindings[`compare_query_${row.id}`] || [];
                const scheduleNames = entityBindings.map(b => schedules.find(s => s.id === b.schedule_id)?.name).filter(Boolean).join(', ');
                const isExpanded = expandedRowId === row.id;
                const isSelected = selectedIds.has(row.id);
                
                return (
                  <React.Fragment key={row.id}>
                    <tr className={`border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors ${isSelected ? 'bg-purple-900/20' : ''}`}>
                      <td className="px-2 py-1 text-sm">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                          className="cursor-pointer w-5 h-5 rounded border-2 border-gray-400 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 bg-charcoal-600 hover:border-purple-400 transition-colors"
                        />
                      </td>
                      <td className="px-2 py-1 text-gray-100 text-sm whitespace-nowrap">{row.name}</td>
                      <td className="px-2 py-1 text-gray-200 text-sm">{renderCell('queries', row, 'src_system_id', systems)}</td>
                      <td className="px-2 py-1 text-gray-200 text-sm">{renderCell('queries', row, 'tgt_system_id', systems)}</td>
                      <td 
                        className="px-2 py-1 text-gray-300 text-sm max-w-xs truncate font-mono cursor-pointer hover:text-gray-100" 
                        onClick={() => toggleRow(row.id)}
                        title="Click to view full query"
                      >
                        <span className="text-gray-500 mr-1">{isExpanded ? '▼' : '▶'}</span>{row.src_sql || row.sql}
                      </td>
                      <td className="px-2 py-1 text-gray-300 text-sm whitespace-nowrap">{row.compare_mode}</td>
                      <td className="px-2 py-1 text-gray-300 text-sm">{row.pk_columns?.join(', ') || '-'}</td>
                      <td className="px-2 py-1 text-purple-400 text-sm">{scheduleNames || '-'}</td>
                      <td className="px-2 py-1 text-sm">
                        {row.last_run_status === 'succeeded' ? (
                          <button
                            onClick={() => onNavigateToResult(row.last_run_id)}
                            className="text-green-500 hover:text-green-400 cursor-pointer text-lg"
                            title={`Success - ${new Date(row.last_run_timestamp).toLocaleString()}`}
                          >
                            ✓
                          </button>
                        ) : row.last_run_status === 'failed' ? (
                          <button
                            onClick={() => onNavigateToResult(row.last_run_id)}
                            className="text-red-500 hover:text-red-400 cursor-pointer text-lg"
                            title={`Failed - ${new Date(row.last_run_timestamp).toLocaleString()}`}
                          >
                            ✗
                          </button>
                        ) : (
                          <span className="text-gray-500" title="No recent run">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1 whitespace-nowrap">
                        <button onClick={() => onEdit(row)} className="px-1.5 py-0.5 text-sm bg-purple-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-purple-500 mr-1">Edit</button>
                        <button onClick={() => onDelete('queries', row.id)} className="px-1.5 py-0.5 text-sm bg-red-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-red-500 mr-1">Del</button>
                        <button onClick={() => onTrigger('compare_query', row.id)} className="px-1.5 py-0.5 text-sm bg-green-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-green-500">▶️</button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-charcoal-300/30 bg-charcoal-600/30">
                        <td colSpan="9" className="p-3">
                          <pre className="bg-charcoal-700/50 rounded p-2 text-sm text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-words">
{row.src_sql || row.sql || 'No SQL'}
                          </pre>
                          {row.tgt_sql && (
                            <pre className="bg-charcoal-700/50 rounded p-2 text-sm text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap break-words mt-2">
{row.tgt_sql}
                            </pre>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
