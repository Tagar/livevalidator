import React from 'react';
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
  renderCell 
}) {
  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      <h2 className="text-2xl font-semibold text-rust-light mb-4">Tables</h2>
      <div className="mb-3 flex gap-2">
        <button onClick={() => onEdit({})} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500">Add Table</button>
        <button onClick={onUploadCSV} className="px-3 py-2 bg-rust text-gray-100 border-0 rounded-md cursor-pointer hover:bg-rust-light">📂 Upload CSV</button>
      </div>
      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-charcoal-200">
                <th className="text-left p-2 text-gray-200 font-medium">Name</th>
                <th className="text-left p-2 text-gray-200 font-medium">Source Table</th>
                <th className="text-left p-2 text-gray-200 font-medium">Target Table</th>
                <th className="text-left p-2 text-gray-200 font-medium">Source</th>
                <th className="text-left p-2 text-gray-200 font-medium">Target</th>
                <th className="text-left p-2 text-gray-400 font-medium">Compare Mode</th>
                <th className="text-left p-2 text-gray-400 font-medium">Watermark</th>
                <th className="text-left p-2 text-gray-400 font-medium">PK Columns</th>
                <th className="text-left p-2 text-gray-400 font-medium">Include</th>
                <th className="text-left p-2 text-gray-400 font-medium">Exclude</th>
                <th className="text-left p-2 text-gray-400 font-medium">Schedules</th>
                <th className="text-left p-2 text-gray-200 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(row => {
                const entityBindings = bindings[`dataset_${row.id}`] || [];
                const scheduleNames = entityBindings.map(b => schedules.find(s => s.id === b.schedule_id)?.name).filter(Boolean).join(', ');
                return (
                  <tr key={row.id} className="border-b border-charcoal-200">
                    <td className="p-2 text-gray-100">{row.name}</td>
                    <td className="p-2 text-gray-500 text-sm">{row.src_schema}.{row.src_table}</td>
                    <td className="p-2 text-gray-500 text-sm">{row.tgt_schema}.{row.tgt_table}</td>
                    <td className="p-2 text-gray-100">{renderCell('tables', row, 'src_system_id', systems)}</td>
                    <td className="p-2 text-gray-100">{renderCell('tables', row, 'tgt_system_id', systems)}</td>
                    <td className="p-2 text-gray-300 text-sm">{row.compare_mode}</td>
                    <td className="p-2 text-gray-300 text-sm">{row.watermark_column || '-'}</td>
                    <td className="p-2 text-gray-300 text-xs">{row.pk_columns?.join(', ') || '-'}</td>
                    <td className="p-2 text-gray-300 text-xs">{row.include_columns?.join(', ') || '-'}</td>
                    <td className="p-2 text-gray-300 text-xs">{row.exclude_columns?.join(', ') || '-'}</td>
                    <td className="p-2 text-purple-400 text-xs">{scheduleNames || '-'}</td>
                    <td className="p-2">
                      <button onClick={() => onEdit(row)} className="px-2 py-1 text-xs bg-purple-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-purple-500 mr-1">Edit</button>
                      <button onClick={() => onDelete('tables', row.id)} className="px-2 py-1 text-xs bg-red-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-red-500 mr-1">Del</button>
                      <button onClick={() => onTrigger('table', row.id)} className="px-2 py-1 text-xs bg-green-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-green-500">▶️</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
