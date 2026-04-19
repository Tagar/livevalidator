import React, { useState, useRef, useEffect } from 'react';
import { TagInput } from '../TagInput';
import { ConfigOverrides } from '../ConfigOverrides';

export function QueryModal({ query, systems, schedules, onSave, onClose }) {
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState(() => ({
    name: query?.name || "",
    src_system_id: query?.src_system_id || (systems[0]?.id || 1),
    tgt_system_id: query?.tgt_system_id || (systems[1]?.id || 2),
    src_sql: query?.src_sql || "SELECT 1",
    tgt_sql: query?.tgt_sql || "",
    compare_mode: query?.compare_mode || "except_all",
    pk_columns: query?.pk_columns || [],
    watermark_filter: query?.watermark_filter || "",
    exclude_columns: query?.exclude_columns || [],
    config_overrides: (typeof query?.config_overrides === 'string' ? JSON.parse(query.config_overrides) : query?.config_overrides) || null,
    is_active: query?.is_active ?? true,
    version: query?.version || 0
  }));
  
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const hasTargetSql = Boolean(form.tgt_sql?.trim());
  const [targetSqlExpanded, setTargetSqlExpanded] = useState(() => Boolean((query?.tgt_sql || '').trim()));
  const showTargetSqlEditor = hasTargetSql || targetSqlExpanded;

  useEffect(() => {
    setTargetSqlExpanded(Boolean((query?.tgt_sql || '').trim()));
  }, [query?.id]);

  // Fetch existing bindings and tags for this query
  useEffect(() => {
    if (query?.id) {
      fetch(`/api/bindings/compare_query/${query.id}`)
        .then(r => r.json())
        .then(bindings => {
          const scheduleIds = bindings.map(b => b.schedule_id);
          setSelectedSchedules(scheduleIds);
        })
        .catch(() => setSelectedSchedules([]));
      
      fetch(`/api/tags/entity/query/${query.id}`)
        .then(r => r.json())
        .then(data => setTags(data.map(t => t.name)))
        .catch(() => setTags([]));
    } else {
      setTags(query?.tags || []);
    }
    
    // Fetch all existing tags for autocomplete
    fetch('/api/tags')
      .then(r => r.json())
      .then(data => setAllTags(data.map(t => t.name)))
      .catch(() => setAllTags([]));
  }, [query?.id]);
  
  const handleSave = async () => {
    setErrors([]);
    setSaving(true);
    
    try {
      const payload = {
        ...form,
        tgt_sql: form.tgt_sql?.trim() ? form.tgt_sql.trim() : null,
      };
      await onSave(payload, selectedSchedules, tags);
    } catch (err) {
      const errorMessages = [];
      if (err.response) {
        const data = err.response;
        if (Array.isArray(data)) {
          data.forEach(e => {
            const field = e.loc?.slice(-1)[0] || 'field';
            errorMessages.push(e.msg?.replace('Value error, ', '') || `Invalid ${field}`);
          });
        } else if (data.detail) {
          if (Array.isArray(data.detail)) {
            data.detail.forEach(e => {
              const field = e.loc?.slice(-1)[0] || 'field';
              errorMessages.push(e.msg?.replace('Value error, ', '') || `Invalid ${field}`);
            });
          } else {
            errorMessages.push(data.detail);
          }
        } else if (data.message) {
          errorMessages.push(data.message);
        }
      }
      setErrors(errorMessages.length ? errorMessages : [err.message || 'Failed to save']);
    } finally {
      setSaving(false);
    }
  };
  
  const toggleSchedule = (scheduleId) => {
    setSelectedSchedules(prev => 
      prev.includes(scheduleId) 
        ? prev.filter(id => id !== scheduleId)
        : [...prev, scheduleId]
    );
  };
  
  const backdropRef = useRef(null);
  const mouseDownTarget = useRef(null);
  
  const handleMouseDown = (e) => {
    mouseDownTarget.current = e.target;
  };
  
  const handleMouseUp = (e) => {
    if (mouseDownTarget.current === backdropRef.current && e.target === backdropRef.current) {
      onClose();
    }
    mouseDownTarget.current = null;
  };
  
  return (
    <div ref={backdropRef} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div onClick={(e)=>e.stopPropagation()} className="bg-charcoal-500 rounded-xl w-full max-w-4xl shadow-2xl border border-charcoal-200">
        <div className="border-b border-charcoal-200 px-6 py-4 bg-charcoal-400">
          <h3 className="m-0 text-rust text-xl font-bold">{query ? "Edit Compare Query" : "New Compare Query"}</h3>
          <p className="text-gray-400 text-sm mt-1 mb-0">Configure SQL to compare data between two systems</p>
        </div>
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          {/* Error Display */}
          {errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <div className="flex items-start gap-2">
                <span className="text-red-400 text-lg">⚠</span>
                <div className="flex-1">
                  <p className="text-red-400 font-medium text-sm mb-1">Please fix the following:</p>
                  <ul className="text-red-300 text-sm list-disc list-inside space-y-0.5">
                    {errors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          )}
          
          {/* Basic Info Section */}
          <div className="mb-6 pb-6 border-b border-charcoal-200">
            <h4 className="text-rust-light font-semibold mb-3 text-base">Basic Information</h4>
            <div className="mb-4">
              <label className="block mb-1.5 font-medium text-gray-300 text-sm">Query Name *</label>
              <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} placeholder="e.g., Daily Sales Comparison" className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-1.5 font-medium text-gray-300 text-sm">Source System *</label>
                <select value={form.src_system_id} onChange={e=>setForm({...form, src_system_id:+e.target.value})} className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  {systems.map(s=><option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
                </select>
                <p className="text-gray-500 text-xs mt-1">System to query from</p>
              </div>
              <div>
                <label className="block mb-1.5 font-medium text-gray-300 text-sm">Target System *</label>
                <select value={form.tgt_system_id} onChange={e=>setForm({...form, tgt_system_id:+e.target.value})} className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  {systems.map(s=><option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
                </select>
                <p className="text-gray-500 text-xs mt-1">System to compare against</p>
              </div>
            </div>
          </div>

          {/* SQL Query Section */}
          <div className="mb-6 pb-6 border-b border-charcoal-200">
            <h4 className="text-rust-light font-semibold mb-3 text-base">SQL</h4>
            <div className="mb-4">
              <label className="block mb-1.5 font-medium text-gray-300 text-sm">Source SQL *</label>
              <textarea value={form.src_sql} onChange={e=>setForm({...form, src_sql:e.target.value})} rows={10} placeholder="SELECT id, name, value FROM my_table WHERE updated_at > '2024-01-01'" className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-600 text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              <p className="text-gray-500 text-xs mt-1">Runs on the source system</p>
            </div>
            <div className="mb-2">
              <div
                className={`flex items-center gap-2 ${showTargetSqlEditor ? 'mb-1.5' : 'mb-2'}`}
              >
                {!hasTargetSql && (
                  <button
                    type="button"
                    onClick={() => setTargetSqlExpanded((v) => !v)}
                    className="text-gray-400 hover:text-rust-light transition-colors shrink-0"
                    title={showTargetSqlEditor ? 'Collapse' : 'Expand'}
                    aria-expanded={showTargetSqlEditor}
                  >
                    <svg
                      className="w-5 h-5 transition-transform"
                      style={{ transform: showTargetSqlEditor ? 'rotate(0deg)' : 'rotate(-90deg)' }}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                )}
                <label className="font-medium text-gray-300 text-sm mb-0">Target SQL (optional)</label>
                {!hasTargetSql && !showTargetSqlEditor && (
                  <span className="text-gray-500 text-xs truncate">— same query on target</span>
                )}
              </div>
              {showTargetSqlEditor && (
                <>
                  <textarea
                    value={form.tgt_sql}
                    onChange={(e) => {
                      const v = e.target.value;
                      setForm({ ...form, tgt_sql: v });
                      if (!v.trim()) setTargetSqlExpanded(false);
                    }}
                    rows={8}
                    placeholder="Leave blank to use the same query on the target system"
                    className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-600 text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                  <p className="text-gray-500 text-xs mt-1">
                    When set, runs on the target instead of source SQL. Clear the field to use source SQL on both sides.
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Comparison Settings Section */}
          <div className="mb-6 pb-6 border-b border-charcoal-200">
            <h4 className="text-rust-light font-semibold mb-3 text-base">Comparison Settings</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block mb-1.5 font-medium text-gray-300 text-sm">Compare Mode *</label>
                <select value={form.compare_mode} onChange={e=>setForm({...form, compare_mode:e.target.value})} className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent">
                  <option value="except_all">Except All - Find all differences</option>
                  <option value="primary_key">Primary Key - Match by PK</option>
                </select>
                <p className="text-gray-500 text-xs mt-1">Strategy for comparing results</p>
              </div>
              <div>
                <label className="flex items-center gap-2 px-3 py-2.5 cursor-pointer">
                  <input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form, is_active:e.target.checked})} className="w-4 h-4 rounded border-charcoal-200 bg-charcoal-400 text-purple-600 focus:ring-2 focus:ring-purple-500" />
                  <span className="text-gray-300 font-medium text-sm">Active</span>
                </label>
                <p className="text-gray-500 text-xs mt-1 ml-3">Enable this query for execution</p>
              </div>
            </div>
            <div className="mb-4">
              <label className="block mb-1.5 font-medium text-gray-300 text-sm">Primary Key Columns</label>
              {(() => {
                const showVetBadge = form.compare_mode === 'primary_key' && Array.isArray(form.pk_columns) && form.pk_columns.filter(Boolean).length > 0;
                const vetted = query?.pk_vetted;
                return (
                  <div
                    className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                      showVetBadge
                        ? vetted ? 'border-2 border-green-600/80 bg-charcoal-600/50' : 'border-2 border-amber-600/80 bg-charcoal-600/50'
                        : 'border border-charcoal-200 bg-charcoal-400'
                    }`}
                    title={showVetBadge ? (vetted ? 'PK has been vetted by a validation job.' : 'Run a validation job to vet this PK. Editing PK columns resets vetted status.') : undefined}
                  >
                    <input
                      value={Array.isArray(form.pk_columns) ? form.pk_columns.join(', ') : ''}
                      onChange={(e) => setForm({ ...form, pk_columns: e.target.value.split(',').map((s) => s.trim()) })}
                      onBlur={(e) => setForm((f) => ({ ...f, pk_columns: (Array.isArray(f.pk_columns) ? f.pk_columns : e.target.value.split(',').map((s) => s.trim())).filter(Boolean) }))}
                      placeholder="e.g., id, user_id"
                      className="min-w-0 flex-1 bg-transparent py-1.5 text-gray-100 placeholder-gray-500 focus:outline-none"
                    />
                    {showVetBadge && (
                      <span className={`shrink-0 text-xs font-medium ${vetted ? 'text-green-400' : 'text-amber-400'}`}>
                        {vetted ? 'Vetted' : 'Unvetted'}
                      </span>
                    )}
                  </div>
                );
              })()}
              <p className="text-gray-500 text-xs mt-1">Comma-separated list of columns that uniquely identify rows</p>
            </div>
            <div className="mb-4">
              <label className="block mb-1.5 font-medium text-gray-300 text-sm">Watermark Filter</label>
              <input value={form.watermark_filter} onChange={e=>setForm({...form, watermark_filter:e.target.value})} placeholder="e.g., created_at > '2024-01-01' OR status = 'active'" className="w-full px-3 py-2.5 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent" />
              <p className="text-gray-500 text-xs mt-1">Optional WHERE clause for table-mode runs (not applied to raw SQL query mode in the notebook)</p>
            </div>
          </div>
          
          {/* Tags */}
          <div className="mb-6 pb-6 border-b border-charcoal-200">
            <h4 className="text-rust-light font-semibold mb-3 text-base">Tags</h4>
            <TagInput 
              tags={tags}
              allTags={allTags}
              onChange={setTags}
              placeholder="Add tags (press Enter)..."
            />
          </div>
          
          {/* Schedule Bindings */}
          <div className="mb-6 pb-6 border-b border-charcoal-200">
            <h4 className="text-rust-light font-semibold mb-3 text-base">Schedule Bindings</h4>
            <div className="max-h-48 overflow-y-auto bg-charcoal-600 rounded-md p-3">
              {schedules.length === 0 ? (
                <p className="text-gray-500 text-sm">No schedules available</p>
              ) : (
                schedules.map(schedule => (
                  <label key={schedule.id} className="flex items-center gap-3 p-2 hover:bg-charcoal-500 rounded cursor-pointer mb-1">
                    <input 
                      type="checkbox" 
                      checked={selectedSchedules.includes(schedule.id)}
                      onChange={() => toggleSchedule(schedule.id)}
                      className="w-4 h-4"
                    />
                    <span className="text-gray-200 text-sm flex-1">{schedule.name}</span>
                    <span className="text-gray-500 text-xs font-mono">{schedule.cron_expr}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          
          {/* Config Overrides */}
          <div className="mb-6">
            <h4 className="text-rust-light font-semibold mb-1 text-base">Config Overrides</h4>
            <p className="text-gray-500 text-xs mb-3">Override global validation settings for this query only</p>
            <ConfigOverrides
              value={form.config_overrides}
              onChange={(val) => setForm({...form, config_overrides: val})}
            />
          </div>
        </div>
        
        {query && (
          <div className="px-6 py-2 bg-charcoal-500 border-t border-charcoal-200">
            <div className="text-xs text-gray-400 space-y-1">
              {query.created_by && (
                <div>Created by: <span className="text-gray-300">{query.created_by}</span></div>
              )}
              {query.updated_by && (
                <div>Last updated by: <span className="text-gray-300">{query.updated_by}</span></div>
              )}
            </div>
          </div>
        )}
        
        <div className="border-t border-charcoal-200 px-6 py-4 flex gap-3 justify-end bg-charcoal-400">
          <button onClick={onClose} className="px-4 py-2.5 bg-charcoal-700 text-gray-200 border border-charcoal-200 rounded-md cursor-pointer hover:bg-charcoal-600 font-medium">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2.5 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving...' : '💾 Save Query'}</button>
        </div>
      </div>
    </div>
  );
}

