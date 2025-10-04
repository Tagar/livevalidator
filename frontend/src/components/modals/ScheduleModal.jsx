import React, { useState, useRef } from 'react';

export function ScheduleModal({ schedule, onSave, onClose }) {
  const [form, setForm] = useState(() => ({
    name: schedule?.name || "New Schedule",
    cron_expr: schedule?.cron_expr || "0 0 * * *",
    timezone: schedule?.timezone || "UTC",
    enabled: schedule?.enabled ?? true,
    max_concurrency: schedule?.max_concurrency || 4,
    backfill_policy: schedule?.backfill_policy || "none",
    version: schedule?.version || 0,
    updated_by: "user@company.com"
  }));
  
  const handleSave = async () => {
    await onSave(form);
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
      <div onClick={(e)=>e.stopPropagation()} className="bg-charcoal-500 rounded-xl w-full max-w-lg shadow-2xl border border-charcoal-200">
        <div className="border-b border-charcoal-200 px-4 py-3 bg-charcoal-400">
          <h3 className="m-0 text-rust text-lg font-semibold">{schedule ? "Edit Schedule" : "New Schedule"}</h3>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Name</label>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Cron Expression</label>
            <input value={form.cron_expr} onChange={e=>setForm({...form, cron_expr:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="0 0 * * *" />
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Timezone</label>
              <input value={form.timezone} onChange={e=>setForm({...form, timezone:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Max Concurrency</label>
              <input type="number" value={form.max_concurrency} onChange={e=>setForm({...form, max_concurrency:+e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Backfill Policy</label>
              <select value={form.backfill_policy} onChange={e=>setForm({...form, backfill_policy:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="none">None</option>
                <option value="catch_up">Catch Up</option>
                <option value="skip_missed">Skip Missed</option>
              </select>
            </div>
            <div>
              <label className="block mb-1 font-medium text-gray-400 text-sm">Enabled</label>
              <label className="flex items-center gap-2 px-2 py-2">
                <input type="checkbox" checked={form.enabled} onChange={e=>setForm({...form, enabled:e.target.checked})} className="w-4 h-4" />
                <span className="text-gray-300">{form.enabled ? "Yes" : "No"}</span>
              </label>
            </div>
          </div>
        </div>
        <div className="border-t border-charcoal-200 px-4 py-3 flex gap-2 justify-end bg-charcoal-400">
          <button onClick={onClose} className="px-3 py-2 bg-charcoal-700 text-gray-200 border border-charcoal-200 rounded-md cursor-pointer hover:bg-charcoal-600">Cancel</button>
          <button onClick={handleSave} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500">Save</button>
        </div>
      </div>
    </div>
  );
}

