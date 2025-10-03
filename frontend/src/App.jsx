import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API || "https://live-validator-2263248446072504.aws.databricksapps.com/api";

const Section = ({title, children}) => (
  <div style={{border:"1px solid #ddd", borderRadius:12, padding:16, marginBottom:24}}>
    <h2 style={{marginTop:0}}>{title}</h2>
    {children}
  </div>
);

function useFetch(url, deps=[]) {
  const [data,setData] = useState([]);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState(null);
  const refresh = () => {
    setLoading(true);
    fetch(url)
      .then(async (r) => {
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          throw new Error(`${r.status} ${r.statusText}: ${text || "Request failed"}`);
        }
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e : new Error(String(e))))
      .finally(()=>setLoading(false));
  };
  useEffect(refresh, deps);
  const clearError = () => setError(null);
  return {data, loading, error, refresh, clearError};
}

const inline = {input:{padding:6, marginRight:8}, btn:{padding:"6px 10px", marginRight:8}};

export default function App(){
  const ds = useFetch(`${API}/datasets`, []);
  const qs = useFetch(`${API}/queries`, []);
  const sc = useFetch(`${API}/schedules`, []);

  const [formDS,setFormDS] = useState({name:"", src_system_id:1, tgt_system_id:2, updated_by:"user@company.com"});
  const [formQ,setFormQ] = useState({name:"", src_system_id:1, tgt_system_id:2, src_sql:"SELECT 1", tgt_sql:"SELECT 1", updated_by:"user@company.com"});
  const [formSCH,setFormSCH] = useState({name:"nightly", cron_expr:"0 2 * * *", timezone:"UTC", updated_by:"user@company.com"});

  const createDataset = async() => {
    await fetch(`${API}/datasets`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(formDS)});
    ds.refresh();
  };
  const deleteDataset = async(id) => { await fetch(`${API}/datasets/${id}`, {method:"DELETE"}); ds.refresh(); };

  const createQuery = async() => {
    await fetch(`${API}/queries`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(formQ)});
    qs.refresh();
  };
  const deleteQuery = async(id) => { await fetch(`${API}/queries/${id}`, {method:"DELETE"}); qs.refresh(); };

  const createSchedule = async() => {
    await fetch(`${API}/schedules`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(formSCH)});
    sc.refresh();
  };

  const bindSchedule = async(schedule_id, entity_type, entity_id) => {
    await fetch(`${API}/bindings`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({schedule_id, entity_type, entity_id})});
    alert("Bound ✓");
  };

  const triggerNow = async(entity_type, entity_id) => {
    await fetch(`${API}/triggers`, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({entity_type, entity_id, requested_by:"user@company.com"})});
    alert("Triggered ✓");
  };

  return (
    <div style={{maxWidth:1000, margin:"40px auto", fontFamily:"Inter, system-ui, sans-serif"}}>
      <h1>LiveValidator Control Plane</h1>

      <Section title="Datasets (table ↔ table)">
        {ds.error && (
          <div style={{background:"#fee", border:"1px solid #f99", borderRadius:8, padding:12, marginBottom:12}}>
            <div style={{display:"flex", alignItems:"center", justifyContent:"space-between"}}>
              <strong>Error</strong>
              <button onClick={ds.clearError} style={{border:"none", background:"transparent", fontSize:18, cursor:"pointer"}} aria-label="Close">×</button>
            </div>
            <div style={{marginTop:8, whiteSpace:"pre-wrap", wordBreak:"break-word"}}>{ds.error.message || "Something went wrong"}</div>
          </div>
        )}
        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
          <input style={inline.input} placeholder="name" value={formDS.name} onChange={e=>setFormDS({...formDS, name:e.target.value})}/>
          <input style={inline.input} placeholder="src_system_id" type="number" value={formDS.src_system_id} onChange={e=>setFormDS({...formDS, src_system_id:+e.target.value})}/>
          <input style={inline.input} placeholder="src_schema" value={formDS.src_schema||""} onChange={e=>setFormDS({...formDS, src_schema:e.target.value})}/>
          <input style={inline.input} placeholder="src_table" value={formDS.src_table||""} onChange={e=>setFormDS({...formDS, src_table:e.target.value})}/>
          <input style={inline.input} placeholder="tgt_system_id" type="number" value={formDS.tgt_system_id} onChange={e=>setFormDS({...formDS, tgt_system_id:+e.target.value})}/>
          <input style={inline.input} placeholder="tgt_schema" value={formDS.tgt_schema||""} onChange={e=>setFormDS({...formDS, tgt_schema:e.target.value})}/>
          <input style={inline.input} placeholder="tgt_table" value={formDS.tgt_table||""} onChange={e=>setFormDS({...formDS, tgt_table:e.target.value})}/>
          <button style={inline.btn} onClick={createDataset}>Add Dataset</button>
        </div>
        {ds.loading ? <p>Loading…</p> : (
          <table style={{width:"100%", marginTop:12}}>
            <thead><tr><th align="left">Name</th><th>Src</th><th>Tgt</th><th>Ver</th><th>Actions</th></tr></thead>
            <tbody>
              {ds.data.map(row => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.src_schema}.{row.src_table}</td>
                  <td>{row.tgt_schema}.{row.tgt_table}</td>
                  <td align="center">{row.version}</td>
                  <td>
                    <button style={inline.btn} onClick={()=>triggerNow('dataset', row.id)}>Trigger</button>
                    {sc.data.length>0 && (
                      <select onChange={(e)=>bindSchedule(+e.target.value, 'dataset', row.id)} defaultValue="">
                        <option value="" disabled>Bind schedule…</option>
                        {sc.data.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    <button style={inline.btn} onClick={()=>deleteDataset(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Compare Queries (SQL ↔ SQL)">
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <input style={inline.input} placeholder="name" value={formQ.name} onChange={e=>setFormQ({...formQ, name:e.target.value})}/>
          <input style={inline.input} placeholder="src_system_id" type="number" value={formQ.src_system_id} onChange={e=>setFormQ({...formQ, src_system_id:+e.target.value})}/>
          <input style={{...inline.input, width:260}} placeholder="src_sql" value={formQ.src_sql} onChange={e=>setFormQ({...formQ, src_sql:e.target.value})}/>
          <input style={inline.input} placeholder="tgt_system_id" type="number" value={formQ.tgt_system_id} onChange={e=>setFormQ({...formQ, tgt_system_id:+e.target.value})}/>
          <input style={{...inline.input, width:260}} placeholder="tgt_sql" value={formQ.tgt_sql} onChange={e=>setFormQ({...formQ, tgt_sql:e.target.value})}/>
          <button style={inline.btn} onClick={createQuery}>Add Query</button>
        </div>
        {qs.loading ? <p>Loading…</p> : (
          <table style={{width:"100%", marginTop:12}}>
            <thead><tr><th align="left">Name</th><th>Src SQL</th><th>Tgt SQL</th><th>Ver</th><th>Actions</th></tr></thead>
            <tbody>
              {qs.data.map(row => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td><code>{row.src_sql?.slice(0,60)}</code></td>
                  <td><code>{row.tgt_sql?.slice(0,60)}</code></td>
                  <td align="center">{row.version}</td>
                  <td>
                    <button style={inline.btn} onClick={()=>triggerNow('compare_query', row.id)}>Trigger</button>
                    {sc.data.length>0 && (
                      <select onChange={(e)=>bindSchedule(+e.target.value, 'compare_query', row.id)} defaultValue="">
                        <option value="" disabled>Bind schedule…</option>
                        {sc.data.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                    <button style={inline.btn} onClick={()=>deleteQuery(row.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Schedules">
        <div style={{display:"flex", gap:8, flexWrap:"wrap", alignItems:"center"}}>
          <input style={inline.input} placeholder="name" value={formSCH.name} onChange={e=>setFormSCH({...formSCH, name:e.target.value})}/>
          <input style={inline.input} placeholder="cron_expr" value={formSCH.cron_expr} onChange={e=>setFormSCH({...formSCH, cron_expr:e.target.value})}/>
          <input style={inline.input} placeholder="timezone" value={formSCH.timezone} onChange={e=>setFormSCH({...formSCH, timezone:e.target.value})}/>
          <button style={inline.btn} onClick={createSchedule}>Add Schedule</button>
        </div>
        <ul>
          {sc.data.map(s => (
            <li key={s.id}>{s.name} — {s.cron_expr} ({s.timezone})</li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
