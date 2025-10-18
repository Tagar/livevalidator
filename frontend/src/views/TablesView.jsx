import React, { useState, useMemo } from 'react';
import { ErrorBox } from '../components/ErrorBox';

export function TablesView({ 
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
  const [filterText, setFilterText] = useState('');
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Filter data based on search text
  const filteredData = useMemo(() => {
    if (!filterText) return data;
    const search = filterText.toLowerCase();
    return data.filter(row => {
      const srcTable = `${row.src_schema}.${row.src_table}`.toLowerCase();
      const tgtTable = `${row.tgt_schema}.${row.tgt_table}`.toLowerCase();
      const name = row.name?.toLowerCase() || '';
      return srcTable.includes(search) || tgtTable.includes(search) || name.includes(search);
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
    selectedIds.forEach(id => onTrigger('table', id));
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
    selectedIds.forEach(id => onDelete('tables', id, true)); // Skip browser confirm - we already showed our modal
    setSelectedIds(new Set());
    setShowDeleteConfirm(false);
  };

  const allFilteredSelected = filteredData.length > 0 && filteredData.every(row => selectedIds.has(row.id));
  const someSelected = selectedIds.size > 0;

  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      
      <div className="mb-4">
        <h2 className="text-3xl font-bold text-rust-light mb-1">Tables</h2>
        <p className="text-gray-400 text-base">Manage table-to-table validation configurations</p>
      </div>
      
      <div className="mb-3 flex gap-2">
        <button onClick={() => onEdit({})} className="px-3 py-2 text-base bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 transition-colors font-medium">+ Add Table</button>
        <button onClick={onUploadCSV} className="px-3 py-2 text-base bg-rust text-gray-100 border-0 rounded-md cursor-pointer hover:bg-rust-light transition-colors font-medium">📂 Upload CSV</button>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg overflow-hidden">
          {/* Filter */}
          <div className="p-2 bg-charcoal-400 border-b border-charcoal-200">
            <input
              type="text"
              placeholder="Filter by name or table..."
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
                    <input
                      type="checkbox"
                      checked={allFilteredSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="cursor-pointer w-5 h-5 rounded border-2 border-gray-400 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 bg-charcoal-600 hover:border-purple-400 transition-colors"
                    />
                  </th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Table</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Last Run</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-40">Source</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold w-40">Target</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Compare Mode</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">PK Columns</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Include</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Exclude</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Schedules</th>
                  <th className="text-left px-2 py-1.5 text-sm text-gray-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
              {filteredData.map(row => {
                const entityBindings = bindings[`dataset_${row.id}`] || [];
                const scheduleNames = entityBindings.map(b => schedules.find(s => s.id === b.schedule_id)?.name).filter(Boolean).join(', ');
                const srcTable = `${row.src_schema}.${row.src_table}`;
                const tgtTable = `${row.tgt_schema}.${row.tgt_table}`;
                const tablesMatch = srcTable === tgtTable;
                
                const isSelected = selectedIds.has(row.id);
                
                return (
                  <tr 
                    key={row.id} 
                    className={`border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors ${isSelected ? 'bg-purple-900/20' : ''}`}
                  >
                    <td className="px-2 py-1 text-sm">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleSelectRow(row.id, e.target.checked)}
                        className="cursor-pointer w-5 h-5 rounded border-2 border-gray-400 text-purple-600 focus:ring-2 focus:ring-purple-500 focus:ring-offset-0 bg-charcoal-600 hover:border-purple-400 transition-colors"
                      />
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
                      ) : (
                        <span className="px-1.5 py-0.5 text-sm rounded-full bg-gray-900/40 text-gray-500 border border-gray-700 whitespace-nowrap">
                          No recent
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 text-gray-100 text-sm w-40">{renderCell('tables', row, 'src_system_id', systems)}</td>
                    <td className="px-2 py-1 text-gray-100 text-sm w-40">{renderCell('tables', row, 'tgt_system_id', systems)}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm whitespace-nowrap">{row.compare_mode}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm">{row.pk_columns?.join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm">{row.include_columns?.join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-gray-300 text-sm">{row.exclude_columns?.join(', ') || '-'}</td>
                    <td className="px-2 py-1 text-purple-400 text-sm">{scheduleNames || '-'}</td>
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
    </>
  );
}
