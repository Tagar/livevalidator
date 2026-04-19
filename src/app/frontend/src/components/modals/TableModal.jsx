import React, { useState, useRef, useEffect } from 'react';
import { TagInput } from '../TagInput';
import { ConfigOverrides } from '../ConfigOverrides';

export function TableModal({ table, systems, schedules, onSave, onClose }) {
  const [errors, setErrors] = useState([]);
  const [saving, setSaving] = useState(false);
  
  // Combine schema.table for display
  const getSrcTableFull = () => {
    if (!table) return "";
    const schema = table.src_schema || "";
    const tbl = table.src_table || "";
    return schema && tbl ? `${schema}.${tbl}` : tbl;
  };
  
  const getTgtTableFull = () => {
    if (!table) return "";
    const schema = table.tgt_schema || "";
    const tbl = table.tgt_table || "";
    return schema && tbl ? `${schema}.${tbl}` : tbl;
  };
  
  const [srcTableFull, setSrcTableFull] = useState(getSrcTableFull());
  const [tgtTableFull, setTgtTableFull] = useState(getTgtTableFull());
  const [name, setName] = useState(table?.name || "");
  
  const [form, setForm] = useState(() => ({
    src_system_id: table?.src_system_id || (systems[0]?.id || 1),
    tgt_system_id: table?.tgt_system_id || (systems[1]?.id || 2),
    compare_mode: table?.compare_mode || "except_all",
    pk_columns: table?.pk_columns || [],
    watermark_filter: table?.watermark_filter || "",
    exclude_columns: table?.exclude_columns || [],
    options: (typeof table?.options === 'string' ? JSON.parse(table.options || '{}') : table?.options) || {},
    config_overrides: (typeof table?.config_overrides === 'string' ? JSON.parse(table.config_overrides) : table?.config_overrides) || null,
    version: table?.version || 0
  }));
  
  const [selectedSchedules, setSelectedSchedules] = useState([]);
  const [tags, setTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [overridesExpanded, setOverridesExpanded] = useState(
    () => Object.keys(form.options?.column_overrides || {}).length > 0
  );
  const [addingOverride, setAddingOverride] = useState(false);
  const [newOverrideCol, setNewOverrideCol] = useState('');
  const [newOverrideSystem, setNewOverrideSystem] = useState('');
  const [newOverrideExpr, setNewOverrideExpr] = useState('');

  const columnOverrides = form.options?.column_overrides || {};

  const srcSystem = systems.find(s => s.id === form.src_system_id);
  const tgtSystem = systems.find(s => s.id === form.tgt_system_id);
  const overrideSystemOptions = [srcSystem, tgtSystem].filter(Boolean);

  const setColumnOverrides = (next) => {
    const cleaned = Object.fromEntries(Object.entries(next).filter(([, v]) => Object.keys(v).length > 0));
    setForm(f => ({ ...f, options: { ...f.options, column_overrides: Object.keys(cleaned).length ? cleaned : undefined } }));
  };

  const handleAddOverride = () => {
    const col = newOverrideCol.trim().toLowerCase();
    const sysId = newOverrideSystem;
    const expr = newOverrideExpr.trim();
    if (!col || !sysId || !expr) return;
    if (columnOverrides[col]?.[sysId]) return; // duplicate blocked
    const updated = { ...columnOverrides, [col]: { ...(columnOverrides[col] || {}), [sysId]: expr } };
    setColumnOverrides(updated);
    setNewOverrideCol('');
    setNewOverrideSystem('');
    setNewOverrideExpr('');
    setAddingOverride(false);
  };

  const handleRemoveOverride = (col, sysId) => {
    const colEntry = { ...columnOverrides[col] };
    delete colEntry[sysId];
    const updated = { ...columnOverrides };
    if (Object.keys(colEntry).length === 0) delete updated[col];
    else updated[col] = colEntry;
    setColumnOverrides(updated);
  };

  const handleUpdateOverrideExpr = (col, sysId, expr) => {
    setColumnOverrides({
      ...columnOverrides,
      [col]: { ...(columnOverrides[col] || {}), [sysId]: expr }
    });
  };
  
  // Fetch existing bindings and tags for this table
  useEffect(() => {
    if (table?.id) {
      fetch(`/api/bindings/table/${table.id}`)
        .then(r => r.json())
        .then(bindings => {
          const scheduleIds = bindings.map(b => b.schedule_id);
          setSelectedSchedules(scheduleIds);
        })
        .catch(() => setSelectedSchedules([]));
      
      fetch(`/api/tags/entity/table/${table.id}`)
        .then(r => r.json())
        .then(data => setTags(data.map(t => t.name)))
        .catch(() => setTags([]));
    } else {
      setTags(table?.tags || []);
    }
    
    // Fetch all existing tags for autocomplete
    fetch('/api/tags')
      .then(r => r.json())
      .then(data => setAllTags(data.map(t => t.name)))
      .catch(() => setAllTags([]));
  }, [table?.id]);
  
  // Auto-populate target and name when source changes
  const handleSrcChange = (value) => {
    setSrcTableFull(value);
    // Auto-populate target if it's empty or was auto-filled
    if (!tgtTableFull || tgtTableFull === srcTableFull) {
      setTgtTableFull(value);
    }
    // Auto-populate name if it's empty or was auto-filled
    if (!name || name === srcTableFull || name === "New Table") {
      setName(value);
    }
  };
  
  const handleSave = async () => {
    setErrors([]);

    // Validate column overrides: warn on empty expressions
    const overrideErrors = [];
    for (const [col, entries] of Object.entries(columnOverrides)) {
      for (const [sysId, expr] of Object.entries(entries)) {
        if (!expr.trim()) {
          const sysName = systems.find(s => String(s.id) === String(sysId))?.name || sysId;
          overrideErrors.push(`Column override "${col}" for ${sysName} has an empty expression`);
        }
      }
    }
    if (overrideErrors.length) { setErrors(overrideErrors); return; }

    setSaving(true);
    
    // Parse schema.table format
    const parseSchematable = (full) => {
      const parts = full.split('.');
      if (parts.length >= 2) {
        return { schema: parts.slice(0, -1).join('.'), table: parts[parts.length - 1] };
      }
      return { schema: '', table: full };
    };
    
    const src = parseSchematable(srcTableFull);
    const tgt = parseSchematable(tgtTableFull);
    
    const payload = {
      ...form,
      name,
      entity_type: "table",
      src_schema: src.schema,
      src_table: src.table,
      tgt_schema: tgt.schema,
      tgt_table: tgt.table
    };
    
    try {
      await onSave(payload, selectedSchedules, tags);
    } catch (err) {
      // Parse error response
      const errorMessages = [];
      if (err.response) {
        const data = err.response;
        if (Array.isArray(data)) {
          // Pydantic validation errors
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
      <div onClick={(e)=>e.stopPropagation()} className="bg-charcoal-500 rounded-xl w-full max-w-3xl shadow-2xl border border-charcoal-200">
        <div className="border-b border-charcoal-200 px-4 py-3 bg-charcoal-400">
          <h3 className="m-0 text-rust text-lg font-semibold">{table ? "Edit Table" : "New Table"}</h3>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
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
          
          {/* Source System & Table */}
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Source Table <span className="text-gray-500 text-xs">(include schema: schema.table)</span></label>
            <input 
              value={srcTableFull} 
              onChange={e=>handleSrcChange(e.target.value)} 
              className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" 
              placeholder="e.g., my_schema.my_table"
            />
          </div>
          {/* Source & Target Systems side-by-side */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Source System</label>
              <select value={form.src_system_id} onChange={e=>setForm({...form, src_system_id:+e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500">
                {systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Target System</label>
              <select value={form.tgt_system_id} onChange={e=>setForm({...form, tgt_system_id:+e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500">
                {systems.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          
          {/* Target Table */}
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Target Table <span className="text-gray-500 text-xs">(include schema: schema.table)</span></label>
            <input 
              value={tgtTableFull} 
              onChange={e=>setTgtTableFull(e.target.value)} 
              className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" 
              placeholder="e.g., my_schema.my_table"
            />
          </div>
          
          {/* Name - moved lower */}
          <div className="mb-3 pb-3 border-t border-charcoal-200 pt-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Name <span className="text-gray-500 text-xs">(defaults to source table)</span></label>
            <input 
              value={name} 
              onChange={e=>setName(e.target.value)} 
              className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" 
            />
          </div>
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Compare Mode</label>
            <select value={form.compare_mode} onChange={e=>setForm({...form, compare_mode:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500">
              <option value="except_all">Except All</option>
              <option value="primary_key">Primary Key</option>
            </select>
          </div>
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Primary Key Columns (comma-separated)</label>
            {(() => {
              const showVetBadge = form.compare_mode === 'primary_key' && Array.isArray(form.pk_columns) && form.pk_columns.filter(Boolean).length > 0;
              const vetted = table?.pk_vetted;
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
                    className="min-w-0 flex-1 bg-transparent py-1 text-gray-100 placeholder-gray-500 focus:outline-none"
                    placeholder="id, user_id"
                  />
                  {showVetBadge && (
                    <span className={`shrink-0 text-xs font-medium ${vetted ? 'text-green-400' : 'text-amber-400'}`}>
                      {vetted ? 'Vetted' : 'Unvetted'}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Watermark Filter</label>
            <input value={form.watermark_filter} onChange={e=>setForm({...form, watermark_filter:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g., created_at > '2024-01-01' OR status = 'active'" />
            <p className="text-gray-500 text-xs mt-1">Optional WHERE clause to filter rows before comparison (applied to both source and target)</p>
          </div>
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Exclude Columns (comma-separated)</label>
            <textarea value={Array.isArray(form.exclude_columns)?form.exclude_columns.join(', '):''} onChange={e=>setForm({...form, exclude_columns:e.target.value.split(',').map(s=>s.trim())})} onBlur={e=>setForm(f=>({...f, exclude_columns:(Array.isArray(f.exclude_columns)?f.exclude_columns:e.target.value.split(',').map(s=>s.trim())).filter(Boolean)}))} rows={3} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="column1, column2, column3" />
          </div>
          
          {/* Column Overrides */}
          <div className="mb-3 pb-3 border-t border-charcoal-200 pt-3">
            <button
              type="button"
              onClick={() => setOverridesExpanded(v => !v)}
              className="flex items-center gap-2 mb-2 text-gray-400 hover:text-rust-light transition-colors"
            >
              <svg className="w-4 h-4 transition-transform" style={{ transform: overridesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              <span className="font-medium text-sm">Column Type Overrides</span>
              {Object.keys(columnOverrides).length > 0 && (
                <span className="text-xs text-purple-400">({Object.values(columnOverrides).reduce((n, v) => n + Object.keys(v).length, 0)})</span>
              )}
            </button>
            {overridesExpanded && (
              <div className="space-y-3">
                <p className="text-gray-500 text-xs">Override the system-pair type mapping for specific columns. Expression is used as-is in the SELECT.</p>
                {Object.entries(columnOverrides).map(([col, entries]) => (
                  <div key={col} className="bg-charcoal-600 rounded-md p-2">
                    <div className="text-sm font-mono text-purple-300 mb-1">{col}</div>
                    {Object.entries(entries).map(([sysId, expr]) => {
                      const sysName = systems.find(s => String(s.id) === String(sysId))?.name || `System ${sysId}`;
                      return (
                        <div key={sysId} className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400 w-28 shrink-0 truncate" title={sysName}>{sysName}:</span>
                          <input
                            value={expr}
                            onChange={e => handleUpdateOverrideExpr(col, sysId, e.target.value)}
                            className="flex-1 min-w-0 px-2 py-1 bg-charcoal-400 border border-charcoal-300 rounded text-xs font-mono text-gray-100 focus:outline-none focus:border-rust-light"
                          />
                          <span className="text-xs text-gray-500 font-mono shrink-0">AS {col}</span>
                          <button onClick={() => handleRemoveOverride(col, sysId)} className="text-red-400 hover:text-red-300 text-sm shrink-0" title="Remove">×</button>
                        </div>
                      );
                    })}
                  </div>
                ))}
                {addingOverride ? (
                  <div className="bg-charcoal-600 rounded-md p-2 space-y-2">
                    <div className="flex gap-2">
                      <input
                        value={newOverrideCol}
                        onChange={e => setNewOverrideCol(e.target.value)}
                        placeholder="column name"
                        className="flex-1 px-2 py-1 bg-charcoal-400 border border-charcoal-300 rounded text-xs font-mono text-gray-100 focus:outline-none focus:border-rust-light"
                      />
                      <select
                        value={newOverrideSystem}
                        onChange={e => setNewOverrideSystem(e.target.value)}
                        className="px-2 py-1 bg-charcoal-400 border border-charcoal-300 rounded text-xs text-gray-100 focus:outline-none focus:border-rust-light"
                      >
                        <option value="">System...</option>
                        {overrideSystemOptions.map(s => {
                          const col = newOverrideCol.trim().toLowerCase();
                          const blocked = col && columnOverrides[col]?.[String(s.id)];
                          return <option key={s.id} value={String(s.id)} disabled={!!blocked}>{s.name}{blocked ? ' (exists)' : ''}</option>;
                        })}
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        value={newOverrideExpr}
                        onChange={e => setNewOverrideExpr(e.target.value)}
                        placeholder="e.g. CAST(col_x AS DATETIME)"
                        className="flex-1 min-w-0 px-2 py-1 bg-charcoal-400 border border-charcoal-300 rounded text-xs font-mono text-gray-100 focus:outline-none focus:border-rust-light"
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddOverride(); } }}
                      />
                      {newOverrideCol.trim() && (
                        <span className="text-xs text-gray-500 font-mono shrink-0">AS {newOverrideCol.trim().toLowerCase()}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddOverride} disabled={!newOverrideCol.trim() || !newOverrideSystem || !newOverrideExpr.trim()} className="px-2 py-1 text-xs bg-purple-600 text-gray-100 rounded hover:bg-purple-500 disabled:opacity-40">Add</button>
                      <button onClick={() => { setAddingOverride(false); setNewOverrideCol(''); setNewOverrideSystem(''); setNewOverrideExpr(''); }} className="px-2 py-1 text-xs bg-charcoal-400 text-gray-300 rounded hover:bg-charcoal-300">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setAddingOverride(true)} className="text-xs text-purple-400 hover:text-purple-300">+ Add Override</button>
                )}
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="mb-3 pb-3 border-t border-charcoal-200 pt-3">
            <label className="block mb-2 font-medium text-gray-400 text-sm">Tags</label>
            <TagInput 
              tags={tags}
              allTags={allTags}
              onChange={setTags}
              placeholder="Add tags (press Enter)..."
            />
          </div>
          
          {/* Schedule Bindings */}
          <div className="mb-3 pb-3 border-t border-charcoal-200 pt-3">
            <label className="block mb-2 font-medium text-gray-400 text-sm">Schedules</label>
            <div className="max-h-32 overflow-y-auto bg-charcoal-600 rounded-md p-2">
              {schedules.length === 0 ? (
                <p className="text-gray-500 text-xs">No schedules available</p>
              ) : (
                schedules.map(schedule => (
                  <label key={schedule.id} className="flex items-center gap-2 p-1 hover:bg-charcoal-500 rounded cursor-pointer">
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
          <div className="mb-3 pb-3 border-t border-charcoal-200 pt-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Config Overrides</label>
            <p className="text-gray-500 text-xs mb-3">Override global validation settings for this table only</p>
            <ConfigOverrides
              value={form.config_overrides}
              onChange={(val) => setForm({...form, config_overrides: val})}
            />
          </div>
        </div>
        
        {table && (
          <div className="px-4 py-2 bg-charcoal-500 border-t border-charcoal-200">
            <div className="text-xs text-gray-400 space-y-1">
              {table.created_by && (
                <div>Created by: <span className="text-gray-300">{table.created_by}</span></div>
              )}
              {table.updated_by && (
                <div>Last updated by: <span className="text-gray-300">{table.updated_by}</span></div>
              )}
            </div>
          </div>
        )}
        
        <div className="border-t border-charcoal-200 px-4 py-3 flex gap-2 justify-end bg-charcoal-400">
          <button onClick={onClose} className="px-3 py-2 bg-charcoal-700 text-gray-200 border border-charcoal-200 rounded-md cursor-pointer hover:bg-charcoal-600">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Saving...' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

