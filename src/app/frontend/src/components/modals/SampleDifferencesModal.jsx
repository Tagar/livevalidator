import React from 'react';

/**
 * Modal to display sample differences from validation results.
 * Handles both except_all and primary_key comparison modes.
 */
export function SampleDifferencesModal({ validation, onClose }) {
  if (!validation) return null;

  const samples = validation.sample_differences;
  const isPKMode = samples?.mode === 'primary_key';
  const isExceptAllMode = Array.isArray(samples);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="bg-charcoal-500 border border-charcoal-200 rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-rust-light">
              Sample Differences
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {validation.entity_name} • {validation.compare_mode} mode • {validation.rows_different.toLocaleString()} total differences
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>
        
        {/* Content - Different for each mode */}
        <div className="flex-1 overflow-auto">
          {isPKMode && <PKModeView samples={samples} />}
          {isExceptAllMode && <ExceptAllModeView samples={samples} />}
          {!isPKMode && !isExceptAllMode && (
            <p className="text-gray-400">No sample data available</p>
          )}
        </div>
        
        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-charcoal-300 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-charcoal-600 text-gray-300 border border-charcoal-300 rounded hover:bg-charcoal-500 transition-all"
          >
            Close
          </button>
        </div>
        
      </div>
    </div>
  );
}

/**
 * Display for except_all mode - shows full mismatched rows
 */
function ExceptAllModeView({ samples }) {
  if (!samples || samples.length === 0) {
    return <p className="text-gray-400">No sample data available</p>;
  }
  
  // Get all column names from first row
  const columns = Object.keys(samples[0]);
  
  return (
    <div>
      <div className="mb-3 p-3 bg-blue-900/20 border border-blue-700 rounded">
        <p className="text-blue-300 text-sm">
          <strong>Showing {samples.length} sample rows from source</strong> that don't have an exact match in target. 
          These are complete rows returned by the EXCEPT ALL operation.
        </p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full border border-charcoal-300 rounded">
          <thead className="bg-charcoal-400 sticky top-0">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 border-r border-charcoal-300">#</th>
              {columns.map(col => (
                <th key={col} className="px-3 py-2 text-left text-sm font-semibold text-gray-300 border-r border-charcoal-300 last:border-r-0">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {samples.map((row, idx) => (
              <tr key={idx} className="border-t border-charcoal-300 hover:bg-charcoal-400/50">
                <td className="px-3 py-2 text-xs text-gray-500 border-r border-charcoal-300">{idx + 1}</td>
                {columns.map(col => (
                  <td key={col} className="px-3 py-2 text-sm text-gray-200 font-mono border-r border-charcoal-300 last:border-r-0">
                    {row[col] !== null && row[col] !== undefined ? (
                      <span className="break-all">{String(row[col])}</span>
                    ) : (
                      <span className="text-gray-500 italic">null</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Display for primary_key mode - shows side-by-side comparison grouped by PK
 */
function PKModeView({ samples }) {
  if (!samples?.samples || samples.samples.length === 0) {
    return <p className="text-gray-400">No sample data available</p>;
  }
  
  const { pk_columns, samples: pkSamples } = samples;
  
  return (
    <div className="space-y-4">
      <div className="p-3 bg-purple-900/20 border border-purple-700 rounded">
        <p className="text-purple-300 text-sm">
          <strong>Showing {pkSamples.length} records</strong> where row values differ between source and target. 
          Primary keys: <span className="font-mono text-rust-light">{pk_columns.join(', ')}</span>
        </p>
      </div>
      
      {pkSamples.map((sample, idx) => (
        <div key={idx} className="border border-charcoal-300 rounded-lg overflow-hidden">
          
          {/* PK Header */}
          <div className="bg-charcoal-400 px-4 py-2.5 border-b border-charcoal-300">
            <span className="text-gray-300 font-semibold text-sm">Record #{idx + 1} — </span>
            {Object.entries(sample.pk).map(([key, value], pkIdx) => (
              <span key={key}>
                <span className="text-gray-400 text-sm">{key}:</span>
                <span className="text-rust-light font-mono ml-1 mr-3">{value !== null ? String(value) : 'null'}</span>
                {pkIdx < Object.keys(sample.pk).length - 1 && <span className="text-gray-600">•</span>}
              </span>
            ))}
          </div>
          
          {/* Differences Table */}
          <table className="w-full">
            <thead className="bg-charcoal-400/50">
              <tr>
                <th className="px-4 py-2 text-left text-sm text-gray-300 w-1/4">Column</th>
                <th className="px-4 py-2 text-left text-sm text-blue-300 w-3/8">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-blue-500 rounded"></span>
                    Source Value
                  </span>
                </th>
                <th className="px-4 py-2 text-left text-sm text-purple-300 w-3/8">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 bg-purple-500 rounded"></span>
                    Target Value
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sample.differences.map((diff, diffIdx) => (
                <tr key={diffIdx} className="border-t border-charcoal-300">
                  <td className="px-4 py-2.5 text-sm font-mono text-gray-300 align-top">
                    {diff.column}
                  </td>
                  <td className="px-4 py-2.5 text-sm text-blue-200 bg-blue-900/10 align-top">
                    <div className="font-mono break-all">
                      {diff.source_value !== null && diff.source_value !== undefined ? (
                        String(diff.source_value)
                      ) : (
                        <span className="italic text-gray-500">null</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-sm text-purple-200 bg-purple-900/10 align-top">
                    <div className="font-mono break-all">
                      {diff.target_value !== null && diff.target_value !== undefined ? (
                        String(diff.target_value)
                      ) : (
                        <span className="italic text-gray-500">null</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
        </div>
      ))}
    </div>
  );
}
