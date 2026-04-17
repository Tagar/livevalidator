import React, { useMemo, useState } from 'react';
import { ErrorBox } from '../components/ErrorBox';

export function SchedulesView({ 
  data, 
  loading, 
  error, 
  onEdit, 
  onDelete, 
  onUploadCSV,
  onRefresh,
  onClearError,
  renderCell 
}) {
  const [sortByNextRun, setSortByNextRun] = useState(false);

  const handleExportCSV = () => {
    if (data.length === 0) return;
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      return (str.includes(',') || str.includes('"') || str.includes('\n')) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const headers = ['name', 'cron_expr', 'timezone', 'enabled'];
    const rows = data.map(row => [row.name, row.cron_expr, row.timezone, row.enabled].map(escapeCSV).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const now = new Date();
    const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `schedules_${ts}.csv`;
    a.click();
  };

  const sorted = useMemo(() => {
    const rows = [...data];
    if (sortByNextRun) {
      rows.sort((a, b) => {
        if (!a.next_run_at && !b.next_run_at) return 0;
        if (!a.next_run_at) return 1;
        if (!b.next_run_at) return -1;
        return new Date(a.next_run_at) - new Date(b.next_run_at);
      });
    } else {
      rows.sort((a, b) => (a.enabled === b.enabled ? 0 : a.enabled ? -1 : 1));
    }
    return rows;
  }, [data, sortByNextRun]);

  return (
    <>
      {error && error.action !== "setup_required" && error.action !== "credentials_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      <h2 className="text-2xl font-semibold text-rust-light mb-4">Schedules</h2>
      <div className="flex gap-2 mb-3">
        <button onClick={() => onEdit({})} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500">Add Schedule</button>
        <button onClick={onUploadCSV} className="px-3 py-2 bg-rust text-gray-100 border-0 rounded-md cursor-pointer hover:bg-rust-light transition-colors">Upload CSV</button>
        <button onClick={handleExportCSV} className="px-3 py-2 bg-blue-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-blue-500 transition-colors">Export CSV</button>
        <button onClick={onRefresh} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 ml-auto">Refresh</button>
      </div>
      {loading ? <p className="text-gray-400">Loading…</p> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-charcoal-200">
              <th className="text-center px-2 py-1.5 text-gray-400 font-medium w-16">Status</th>
              <th className="text-left p-2 text-gray-400 font-medium">Name</th>
              <th className="text-left p-2 text-gray-400 font-medium">
                <a href="https://crontab.cronhub.io/" target="_blank" rel="noopener noreferrer" className="text-rust-light hover:text-rust underline">Cron</a>
              </th>
              <th className="text-left p-2 text-gray-400 font-medium">Timezone</th>
              <th className="text-left p-2 text-gray-400 font-medium">
                <button onClick={() => setSortByNextRun(prev => !prev)} className="bg-transparent border-0 cursor-pointer text-gray-400 hover:text-rust-light font-medium p-0">
                  Next Run {sortByNextRun ? '▲' : '⇅'}
                </button>
              </th>
              <th className="text-left p-2 text-gray-400 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => (
              <tr key={row.id} className={`border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors ${!row.enabled ? 'opacity-50' : ''}`}>
                <td className="px-2 py-1 text-center">
                  {row.enabled ? <span className="text-green-500 text-lg" title="Active">●</span> : <span className="text-gray-600 text-lg" title="Disabled">○</span>}
                </td>
                <td className="p-2 text-gray-100">{row.name}</td>
                <td className="p-2 text-gray-200 font-mono text-sm">{renderCell('schedules', row, 'cron_expr')}</td>
                <td className="p-2 text-gray-200">{renderCell('schedules', row, 'timezone')}</td>
                <td className="p-2 text-gray-200 text-sm">{!row.enabled ? '—' : row.next_run_at ? new Date(row.next_run_at).toLocaleString() : '—'}</td>
                <td className="p-2">
                  <button onClick={() => onEdit(row)} className="px-2 py-1 text-xs bg-purple-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-purple-500 mr-1">Edit</button>
                  <button onClick={() => onDelete('schedules', row.id)} className="px-2 py-1 text-xs bg-red-600 text-gray-100 border-0 rounded cursor-pointer hover:bg-red-500">Del</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
