import React, { useState, useRef } from 'react';

const SYSTEM_KINDS = ['Databricks', 'Netezza', 'Teradata', 'Oracle', 'Postgres', 'SQLServer', 'MySQL', 'other'];

// Helper to determine default max_rows based on system kind
const getDefaultMaxRows = (kind) => {
  // Databricks and Snowflake: unlimited (null)
  // All others: 1,000,000 default
  return ['Databricks', 'Snowflake'].includes(kind) ? null : 1000000;
};

// Helper to determine default port based on system kind
const getDefaultPort = (kind) => {
  switch (kind) {
    case 'Oracle': return 1521;
    case 'Postgres': return 5432;
    case 'MySQL': return 3306;
    case 'SQLServer': return 1433;
    case 'Netezza': return 5480;
    case 'Teradata': return 443;
    default: return 443;
  }
};

// Default JDBC driver classes by system type
const getDefaultDriver = (kind) => {
  switch (kind) {
    case 'Oracle': return 'oracle.jdbc.OracleDriver';
    case 'Postgres': return 'org.postgresql.Driver';
    case 'MySQL': return 'com.mysql.cj.jdbc.Driver';
    case 'SQLServer': return 'com.microsoft.sqlserver.jdbc.SQLServerDriver';
    case 'Netezza': return 'org.netezza.Driver';
    case 'Teradata': return 'com.teradata.jdbc.TeraDriver';
    default: return '';
  }
};

// Generate JDBC preview string based on system type
const getJdbcPreview = (kind, host, port, database) => {
  const h = host || '<host>';
  const p = port || '<port>';
  const d = database || '<database>';
  
  switch (kind) {
    case 'Oracle':
      return `jdbc:oracle:thin:@//${h}:${p}/${d}`;
    case 'SQLServer':
      return `jdbc:sqlserver://${h}:${p};databaseName=${d};encrypt=true;trustServerCertificate=true`;
    case 'Teradata':
      return `jdbc:teradata://${h}`;
    default:
      return `jdbc:${kind.toLowerCase()}://${h}:${p}/${d}`;
  }
};

export function SystemModal({ system, onSave, onClose }) {
  const [form, setForm] = useState(() => {
    const initialKind = system?.kind || "Databricks";
    return {
      name: system?.name || "New System",
      kind: initialKind,
      catalog: system?.catalog || "",
      host: system?.host || "",
      port: system?.port ?? getDefaultPort(initialKind),
      database: system?.database || "",
      secret_scope: system?.secret_scope || "livevalidator",
      user_secret_key: system?.user_secret_key || "",
      pass_secret_key: system?.pass_secret_key || "",
      jdbc_string: system?.jdbc_string || "",
      driver_connector: system?.driver_connector || getDefaultDriver(initialKind),
      concurrency: system?.concurrency ?? -1,
      max_rows: system?.max_rows !== undefined ? system.max_rows : getDefaultMaxRows(initialKind),
      options: (typeof system?.options === 'string' ? JSON.parse(system.options) : system?.options) || {jdbc: {}},
      version: system?.version || 0
    };
  });
  
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
  
  const isDatabricks = form.kind === 'Databricks';
  const isOracle = form.kind === 'Oracle';
  const isOther = form.kind === 'other';
  const isNetezza = form.kind === 'Netezza';
  const needsManualDriver = isNetezza || isOther;
  const driverNotInDBR = ['Netezza', 'Teradata', 'Oracle'].includes(form.kind);
  const showDatabase = ['Postgres', 'SQLServer', 'MySQL', 'Netezza', 'Oracle'].includes(form.kind);
  const showHostPort = !isDatabricks && !isOther;
  
  return (
    <div ref={backdropRef} onMouseDown={handleMouseDown} onMouseUp={handleMouseUp} className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
      <div onClick={(e)=>e.stopPropagation()} className="bg-charcoal-500 rounded-xl w-full max-w-lg shadow-2xl border border-charcoal-200">
        <div className="border-b border-charcoal-200 px-4 py-3 bg-charcoal-400">
          <h3 className="m-0 text-rust text-lg font-semibold">{system ? "Edit System" : "New System"}</h3>
        </div>
        <div className="p-4 max-h-[70vh] overflow-y-auto">
          {/* Name - Always shown */}
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Name</label>
            <input value={form.name} onChange={e=>setForm({...form, name:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
          </div>
          
          {/* Kind - Dropdown */}
          <div className="mb-3">
            <label className="block mb-1 font-medium text-gray-400 text-sm">Type</label>
            <select value={form.kind} onChange={e=>{
              const newKind = e.target.value;
              setForm({
                ...form, 
                kind: newKind,
                port: system?.port !== undefined ? form.port : getDefaultPort(newKind),
                max_rows: system?.max_rows !== undefined ? form.max_rows : getDefaultMaxRows(newKind),
                driver_connector: system?.driver_connector ? form.driver_connector : getDefaultDriver(newKind)
              });
            }} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500">
              {SYSTEM_KINDS.map(k => <option key={k} value={k}>{k === 'other' ? 'Other JDBC' : k}</option>)}
            </select>
            {needsManualDriver && (
              <div className="mt-2 px-3 py-2 bg-gradient-to-r from-amber-950/40 to-transparent border-l-2 border-amber-500 rounded-r text-xs text-amber-100/90">
                <span className="font-semibold text-amber-300">Driver Required</span> — {isNetezza ? 'Netezza' : 'This system type'} requires a JDBC driver JAR to be installed on the validation job's compute cluster.
              </div>
            )}
          </div>
          
          {/* Databricks: Only show catalog */}
          {isDatabricks && (
            <div className="mb-3">
              <label className="block mb-1 font-medium text-gray-400 text-sm">Catalog</label>
              <input value={form.catalog} onChange={e=>setForm({...form, catalog:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g., main" />
            </div>
          )}
          
          {/* Non-Databricks: Show connection fields */}
          {!isDatabricks && (
            <>
              {/* "other" type: JDBC String is required and shown first */}
              {isOther && (
                <div className="mb-3">
                  <label className="block mb-1 font-medium text-gray-400 text-sm">JDBC String</label>
                  <textarea value={form.jdbc_string} onChange={e=>setForm({...form, jdbc_string:e.target.value})} rows={3} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="jdbc:snowflake://account.snowflakecomputing.com/?db=mydb&warehouse=compute_wh" />
                  <p className="text-xs text-gray-500 mt-1">Full JDBC connection string (required)</p>
                </div>
              )}
              
              {/* Standard types: show host/port/database */}
              {showHostPort && (
                <>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <label className="block mb-1 font-medium text-gray-400 text-sm">Host</label>
                      <input value={form.host} onChange={e=>setForm({...form, host:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                    <div>
                      <label className="block mb-1 font-medium text-gray-400 text-sm">Port</label>
                      <input type="number" value={form.port} onChange={e=>setForm({...form, port:+e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    </div>
                  </div>
                  
                  {/* Database / Service Name - Only for specific kinds */}
                  {showDatabase && (
                    <div className="mb-3">
                      <label className="block mb-1 font-medium text-gray-400 text-sm">{isOracle ? 'Service Name' : 'Database'}</label>
                      <input value={form.database} onChange={e=>setForm({...form, database:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder={isOracle ? 'e.g., ORCL' : ''} />
                    </div>
                  )}
                </>
              )}
              
              <div className="mb-3">
                <label className="block mb-1 font-medium text-gray-400 text-sm">Secret Scope</label>
                <input value={form.secret_scope} onChange={e=>setForm({...form, secret_scope:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="livevalidator" />
                <p className="text-xs text-gray-500 mt-1">Databricks secret scope name (default: livevalidator)</p>
              </div>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block mb-1 font-medium text-gray-400 text-sm">User Secret Key</label>
                  <input value={form.user_secret_key} onChange={e=>setForm({...form, user_secret_key:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="username-key" />
                </div>
                <div>
                  <label className="block mb-1 font-medium text-gray-400 text-sm">Pass Secret Key</label>
                  <input value={form.pass_secret_key} onChange={e=>setForm({...form, pass_secret_key:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="password-key" />
                </div>
              </div>
              
              <div className="mb-3">
                <label className="block mb-1 font-medium text-gray-400 text-sm">JDBC Options</label>
                <div className="space-y-2">
                  {Object.entries(form.options.jdbc || {}).map(([key, val], idx) => (
                    <div key={idx} className="flex gap-2">
                      <input value={key} onChange={e => {
                        const newJdbc = {...(form.options.jdbc || {})};
                        const oldVal = newJdbc[key];
                        delete newJdbc[key];
                        newJdbc[e.target.value] = oldVal;
                        setForm({...form, options: {...form.options, jdbc: newJdbc}});
                      }} placeholder="key" className="flex-1 px-2 py-1 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                      <input value={val} onChange={e => setForm({...form, options: {...form.options, jdbc: {...(form.options.jdbc || {}), [key]: e.target.value}}})} placeholder="value" className="flex-1 px-2 py-1 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                      <button type="button" onClick={() => {
                        const newJdbc = {...(form.options.jdbc || {})};
                        delete newJdbc[key];
                        setForm({...form, options: {...form.options, jdbc: newJdbc}});
                      }} className="px-2 py-1 text-red-400 hover:text-red-300 text-sm">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={() => setForm({...form, options: {...form.options, jdbc: {...(form.options.jdbc || {}), '': ''}}})} className="text-xs text-purple-400 hover:text-purple-300">+ Add Option</button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Key-value pairs passed to Spark JDBC (e.g., sessionInitStatement, fetchsize)</p>
              </div>
              
              {/* Standard types: optional JDBC override */}
              {!isOther && (
                <div className="mb-3">
                  <label className="block mb-1 font-medium text-gray-400 text-sm">JDBC String (Optional)</label>
                  <textarea value={form.jdbc_string} onChange={e=>setForm({...form, jdbc_string:e.target.value})} rows={2} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder={getJdbcPreview(form.kind, form.host, form.port, form.database)} />
                  <p className="text-xs text-gray-500 mt-1">Leave empty to auto-generate from fields above</p>
                </div>
              )}
              
              <div className="mb-3">
                <label className="block mb-1 font-medium text-gray-400 text-sm">Driver</label>
                <input value={form.driver_connector} onChange={e=>setForm({...form, driver_connector:e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="e.g., net.snowflake.client.jdbc.SnowflakeDriver" />
                {driverNotInDBR && (
                  <p className="text-xs text-gray-500 mt-1">
                    Driver not included in Databricks Runtime. Add as a library dep in run_validation job or compute using <code className="text-gray-400">databricks.yml</code> and whitelist in <a href="https://docs.databricks.com/aws/en/data-governance/unity-catalog/manage-privileges/allowlist" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:text-purple-300 underline">Unity Catalog allowlist</a>.
                  </p>
                )}
              </div>
              
              <div className="mb-3">
                <label className="block mb-1 font-medium text-gray-400 text-sm">Concurrency Limit</label>
                <input type="number" value={form.concurrency} onChange={e=>setForm({...form, concurrency:+e.target.value})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="-1 for unlimited" />
                <p className="text-xs text-gray-500 mt-1">-1 = unlimited, 0 = disabled, positive = max concurrent connections</p>
              </div>
              
              <div className="mb-3">
                <label className="block mb-1 font-medium text-gray-400 text-sm">Max Rows per Query</label>
                <input type="number" value={form.max_rows ?? ""} onChange={e=>setForm({...form, max_rows: e.target.value ? +e.target.value : null})} className="w-full px-2 py-2 rounded-md border border-charcoal-200 bg-charcoal-400 text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500" placeholder="Default: 1,000,000" />
                <p className="text-xs text-gray-500 mt-1">Limits rows pulled during validation to protect system performance (empty = unlimited)</p>
              </div>
            </>
          )}
        </div>
        <div className="border-t border-charcoal-200 px-4 py-3 flex gap-2 justify-end bg-charcoal-400">
          <button onClick={onClose} className="px-3 py-2 bg-charcoal-700 text-gray-200 border border-charcoal-200 rounded-md cursor-pointer hover:bg-charcoal-600">Cancel</button>
          <button onClick={handleSave} className="px-3 py-2 bg-purple-600 text-gray-100 border-0 rounded-md cursor-pointer hover:bg-purple-500">Save</button>
        </div>
      </div>
    </div>
  );
}

