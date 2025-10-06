import React from 'react';
import { ErrorBox } from '../components/ErrorBox';

export function ValidationResultsView({ data, loading, error, onClearError }) {
  return (
    <>
      {error && error.action !== "setup_required" && <ErrorBox message={error.message} onClose={onClearError} />}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-rust-light mb-2">🎯 Validation Results</h2>
        <p className="text-gray-400">Recent validation history for the last 30 days</p>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg p-4">
          <div className="text-gray-400 text-sm mb-1">Total Validations</div>
          <div className="text-3xl font-bold text-gray-100">{data.length}</div>
        </div>
        <div className="bg-green-900/20 border border-green-700 rounded-lg p-4">
          <div className="text-green-400 text-sm mb-1">✓ Succeeded</div>
          <div className="text-3xl font-bold text-green-300">
            {data.filter(v => v.status === 'succeeded').length}
          </div>
        </div>
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
          <div className="text-red-400 text-sm mb-1">✗ Failed</div>
          <div className="text-3xl font-bold text-red-300">
            {data.filter(v => v.status === 'failed').length}
          </div>
        </div>
        <div className="bg-purple-900/20 border border-purple-700 rounded-lg p-4">
          <div className="text-purple-400 text-sm mb-1">Avg Duration</div>
          <div className="text-3xl font-bold text-purple-300">
            {data.length > 0 
              ? Math.round(data.reduce((sum, v) => sum + (v.duration_seconds || 0), 0) / data.length) 
              : 0}s
          </div>
        </div>
      </div>

      {loading ? <p className="text-gray-400">Loading…</p> : (
        <div className="bg-charcoal-500 border border-charcoal-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-charcoal-400 border-b border-charcoal-200">
                <tr>
                  <th className="text-left p-3 text-gray-300 font-semibold">Entity</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Type</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Status</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Duration</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Source → Target</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Row Counts</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Differences</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Finished</th>
                  <th className="text-left p-3 text-gray-300 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody>
                {data.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="text-center p-8 text-gray-500">
                      No validation history yet. Run a validation from Tables or Queries!
                    </td>
                  </tr>
                ) : (
                  data.map((v) => (
                    <tr key={v.id} className="border-b border-charcoal-300/30 hover:bg-charcoal-400/50 transition-colors">
                      <td className="p-3 text-gray-200 font-medium">{v.entity_name}</td>
                      <td className="p-3">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          v.entity_type === 'table' 
                            ? 'bg-blue-900/40 text-blue-300 border border-blue-700' 
                            : 'bg-purple-900/40 text-purple-300 border border-purple-700'
                        }`}>
                          {v.entity_type}
                        </span>
                      </td>
                      <td className="p-3">
                        {v.status === 'succeeded' ? (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-900/40 text-green-300 border border-green-700">
                            ✓ Success
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-red-900/40 text-red-300 border border-red-700">
                            ✗ Failed
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-gray-300">{v.duration_seconds}s</td>
                      <td className="p-3 text-sm text-gray-400">
                        {v.source_system_name} → {v.target_system_name}
                      </td>
                      <td className="p-3">
                        {v.row_count_match ? (
                          <span className="text-green-400">✓ {v.row_count_source?.toLocaleString()}</span>
                        ) : (
                          <span className="text-red-400">
                            {v.row_count_source?.toLocaleString()} ≠ {v.row_count_target?.toLocaleString()}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {v.rows_different > 0 ? (
                          <span className="text-rust-light font-medium">
                            {v.rows_different.toLocaleString()} ({v.difference_pct}%)
                          </span>
                        ) : (
                          <span className="text-green-400">0</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-400">
                        {new Date(v.finished_at).toLocaleString()}
                      </td>
                      <td className="p-3">
                        {v.databricks_run_url && (
                          <a 
                            href={v.databricks_run_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 underline text-sm"
                          >
                            View Run
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
