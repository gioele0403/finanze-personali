import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://kxdyxybdainrgljyrfuc.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4ZHl4eWJkYWlucmdsanlyZnVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1ODcyMzYsImV4cCI6MjA5MjE2MzIzNn0.EaUgVimHWeyazy2km-nONIQSxHs0njenZZSzXwZkh_E";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const AUTH_KEY = "finanze_auth";
const THEME_KEY = "finanze_theme";
const DEFAULT_CATEGORIES = ["Stipendio","Affitto","Spesa","Trasporti","Ristoranti","Svago","Salute","Abbigliamento","Bollette","Risparmi","Altro"];
const COLORS = ["#1a56db","#0e9f6e","#e3a008","#e02424","#7e3af2","#3f83f8","#f05252","#0694a2","#ff5a1f","#6875f5"];

function hashPassword(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) h = (Math.imul(31, h) + p.charCodeAt(i)) | 0;
  return h.toString(36);
}

function fmt(n) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(n);
}

function PieChart({ data, dark }) {
  const size = 180, cx = 90, cy = 90, r = 75;
  if (!data.length) return <div style={{textAlign:"center",color:dark?"#6b7280":"#9ca3af",fontSize:13,padding:"40px 0"}}>Nessuna spesa registrata</div>;
  const total = data.reduce((s, d) => s + d.value, 0);
  let angle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const a = (d.value / total) * 2 * Math.PI;
    const x1 = cx + r * Math.cos(angle), y1 = cy + r * Math.sin(angle);
    const x2 = cx + r * Math.cos(angle + a), y2 = cy + r * Math.sin(angle + a);
    const large = a > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r},0,${large},1,${x2},${y2} Z`;
    angle += a;
    return { path, color: COLORS[i % COLORS.length], label: d.label, value: d.value, pct: Math.round(d.value / total * 100) };
  });
  return (
    <div style={{display:"flex",alignItems:"center",gap:32,flexWrap:"wrap"}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{flexShrink:0}}>
        {slices.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke={dark?"#1f2937":"#fff"} strokeWidth={2}/>)}
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {slices.map((s, i) => (
          <div key={i} style={{display:"flex",alignItems:"center",gap:8,fontSize:13}}>
            <span style={{width:12,height:12,borderRadius:2,background:s.color,flexShrink:0}}/>
            <span style={{color:dark?"#d1d5db":"#374151",minWidth:100}}>{s.label}</span>
            <span style={{color:dark?"#6b7280":"#9ca3af"}}>{s.pct}%</span>
            <span style={{fontWeight:600,color:dark?"#f9fafb":"#111827",marginLeft:4}}>{fmt(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(() => localStorage.getItem(THEME_KEY) === "dark");
  const [screen, setScreen] = useState("loading");
  const [pwInput, setPwInput] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwError, setPwError] = useState("");
  const [userHash, setUserHash] = useState(null);
  const [conti, setConti] = useState([]);
  const [transazioni, setTransazioni] = useState([]);
  const [selectedConto, setSelectedConto] = useState("tutti");
  const [tab, setTab] = useState("dashboard");
  const [showAddConto, setShowAddConto] = useState(false);
  const [showAddTx, setShowAddTx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nuovoConto, setNuovoConto] = useState({ nome:"", colore: COLORS[0] });
  const [nuovaTx, setNuovaTx] = useState({ tipo:"uscita", importo:"", categoria:"Altro", descrizione:"", data: new Date().toISOString().split("T")[0], contoId:"" });

  const d = dark;
  const bg = d ? "#111827" : "#f3f4f6";
  const surface = d ? "#1f2937" : "#ffffff";
  const surfaceAlt = d ? "#374151" : "#f9fafb";
  const border = d ? "#374151" : "#e5e7eb";
  const textPrimary = d ? "#f9fafb" : "#111827";
  const textSecondary = d ? "#9ca3af" : "#6b7280";
  const headerBg = d ? "#0f172a" : "#1e3a5f";
  const tabActiveColor = d ? "#3b82f6" : "#1e3a5f";

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    localStorage.setItem(THEME_KEY, next ? "dark" : "light");
  }

  useEffect(() => {
    const hash = localStorage.getItem(AUTH_KEY);
    if (hash) { setUserHash(hash); loadData(hash); }
    else setScreen("setup");
  }, []);

  async function loadData(hash) {
    setLoading(true);
    const [{ data: c }, { data: t }] = await Promise.all([
      supabase.from("conti").select("*").eq("user_hash", hash),
      supabase.from("transazioni").select("*").eq("user_hash", hash).order("data", { ascending: false })
    ]);
    setConti(c || []);
    setTransazioni((t || []).map(tx => ({ ...tx, contoId: tx.conto_id })));
    setLoading(false);
    setScreen("app");
  }

  async function handleSetup() {
    if (pwInput.length < 4) { setPwError("Minimo 4 caratteri"); return; }
    if (pwInput !== pwConfirm) { setPwError("Le password non coincidono"); return; }
    const h = hashPassword(pwInput);
    localStorage.setItem(AUTH_KEY, h);
    setUserHash(h);
    await loadData(h);
  }

  async function handleLogin() {
    const h = hashPassword(pwInput);
    setLoading(true);
    const { data } = await supabase.from("conti").select("id").eq("user_hash", h).limit(1);
    setLoading(false);
    const storedHash = localStorage.getItem(AUTH_KEY);
    if (storedHash && storedHash !== h) { setPwError("Password errata"); return; }
    localStorage.setItem(AUTH_KEY, h);
    setUserHash(h);
    await loadData(h);
    setPwError("");
  }

  async function addConto() {
    if (!nuovoConto.nome.trim()) return;
    const c = { id: Date.now().toString(), user_hash: userHash, nome: nuovoConto.nome.trim(), colore: nuovoConto.colore };
    await supabase.from("conti").insert(c);
    setConti(prev => [...prev, c]);
    setNuovoConto({ nome:"", colore: COLORS[(conti.length + 1) % COLORS.length] });
    setShowAddConto(false);
  }

  async function deleteConto(id) {
    await supabase.from("transazioni").delete().eq("conto_id", id);
    await supabase.from("conti").delete().eq("id", id);
    setConti(prev => prev.filter(c => c.id !== id));
    setTransazioni(prev => prev.filter(t => t.contoId !== id));
    if (selectedConto === id) setSelectedConto("tutti");
  }

  async function addTx() {
    if (!nuovaTx.importo || !nuovaTx.contoId) return;
    const tx = {
      id: Date.now().toString(),
      user_hash: userHash,
      conto_id: nuovaTx.contoId,
      tipo: nuovaTx.tipo,
      importo: parseFloat(nuovaTx.importo),
      categoria: nuovaTx.categoria,
      descrizione: nuovaTx.descrizione,
      data: nuovaTx.data
    };
    await supabase.from("transazioni").insert(tx);
    setTransazioni(prev => [{ ...tx, contoId: tx.conto_id }, ...prev]);
    setNuovaTx({ tipo:"uscita", importo:"", categoria:"Altro", descrizione:"", data: new Date().toISOString().split("T")[0], contoId: nuovaTx.contoId });
    setShowAddTx(false);
  }

  async function deleteTx(id) {
    await supabase.from("transazioni").delete().eq("id", id);
    setTransazioni(prev => prev.filter(t => t.id !== id));
  }

  function getSaldo(id) {
    return transazioni.filter(t => t.contoId === id).reduce((s, t) => t.tipo === "entrata" ? s + t.importo : s - t.importo, 0);
  }

  const txFiltered = selectedConto === "tutti" ? transazioni : transazioni.filter(t => t.contoId === selectedConto);
  const entrate = txFiltered.filter(t => t.tipo === "entrata").reduce((s, t) => s + t.importo, 0);
  const uscite = txFiltered.filter(t => t.tipo === "uscita").reduce((s, t) => s + t.importo, 0);
  const saldoTotale = conti.reduce((s, c) => s + getSaldo(c.id), 0);

  function getSpese() {
    const map = {};
    txFiltered.filter(t => t.tipo === "uscita").forEach(t => { map[t.categoria] = (map[t.categoria] || 0) + t.importo; });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }

  const inputStyle = { width:"100%", boxSizing:"border-box", padding:"8px 12px", border:`1px solid ${border}`, borderRadius:6, fontSize:14, marginBottom:10, color:textPrimary, background:surface };
  const selectStyle = { ...inputStyle, appearance:"auto" };
  const cardStyle = { background:surface, borderRadius:8, border:`1px solid ${border}`, padding:"1.5rem", marginBottom:16 };
  const btnStyle = { padding:"8px 18px", borderRadius:6, border:`1px solid ${border}`, background:surface, cursor:"pointer", fontSize:13, fontWeight:500, color:textPrimary };
  const btnPrimary = { padding:"8px 18px", borderRadius:6, border:"none", background:"#1a56db", cursor:"pointer", fontSize:13, fontWeight:500, color:"#fff" };
  const modalStyle = { position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 };
  const modalBox = { background:surface, borderRadius:10, padding:"1.75rem", width:360, boxShadow:"0 20px 60px rgba(0,0,0,0.3)", border:`1px solid ${border}` };

  const isMobile = window.innerWidth < 640;

  if (screen === "loading" || loading) return (
    <div style={{minHeight:"100vh",width:"100%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:12}}>
      <div style={{width:40,height:40,border:`3px solid ${border}`,borderTop:"3px solid #1a56db",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <span style={{color:textSecondary,fontSize:14}}>Caricamento...</span>
    </div>
  );

  if (screen === "setup" || screen === "login") {
    const isSetup = screen === "setup";
    return (
      <div style={{minHeight:"100vh",width:"100%",background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
        <div style={{...cardStyle,width:380,padding:"2.5rem",boxShadow:"0 4px 24px rgba(0,0,0,0.15)"}}>
          <div style={{textAlign:"center",marginBottom:"2rem"}}>
            <div style={{width:52,height:52,borderRadius:12,background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",fontSize:24}}>💰</div>
            <h2 style={{margin:0,fontSize:20,fontWeight:700,color:textPrimary}}>Finanze Personali</h2>
            <p style={{margin:"6px 0 0",fontSize:13,color:textSecondary}}>{isSetup?"Crea la tua password master":"Accedi al tuo account"}</p>
          </div>
          <input type="password" placeholder="Password" value={pwInput} onChange={e=>{setPwInput(e.target.value);setPwError("");}} onKeyDown={e=>e.key==="Enter"&&(isSetup?handleSetup():handleLogin())} style={inputStyle}/>
          {isSetup && <input type="password" placeholder="Conferma password" value={pwConfirm} onChange={e=>{setPwConfirm(e.target.value);setPwError("");}} onKeyDown={e=>e.key==="Enter"&&handleSetup()} style={inputStyle}/>}
          {pwError && <div style={{fontSize:13,color:"#e02424",marginBottom:10}}>{pwError}</div>}
          <button onClick={isSetup?handleSetup:handleLogin} style={{...btnPrimary,width:"100%",padding:"10px",fontSize:15}}>{isSetup?"Crea account":"Accedi"}</button>
          <div style={{textAlign:"center",marginTop:12}}>
            <button onClick={()=>setScreen(isSetup?"login":"setup")} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:textSecondary}}>
              {isSetup?"Hai già un account? Accedi":"Non hai un account? Registrati"}
            </button>
          </div>
          <div style={{textAlign:"right",marginTop:8}}>
            <button onClick={toggleTheme} style={{background:"transparent",border:"none",cursor:"pointer",fontSize:13,color:textSecondary}}>{dark?"☀️ Chiaro":"🌙 Scuro"}</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{minHeight:"100vh",width:"100%",background:bg,fontFamily:"'Segoe UI',system-ui,sans-serif",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:headerBg,padding:"0 1rem",display:"flex",alignItems:"center",height:56,gap:8,flexShrink:0}}>
        <div style={{width:32,height:32,borderRadius:8,background:"#3b82f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>💰</div>
        {!isMobile && <span style={{color:"#fff",fontWeight:600,fontSize:17,whiteSpace:"nowrap"}}>Finanze Personali</span>}
        <select value={selectedConto} onChange={e=>setSelectedConto(e.target.value)} style={{marginLeft:"auto",padding:"5px 8px",borderRadius:6,border:"1px solid #3b82f6",background:"#1e3a5f",color:"#fff",fontSize:12,cursor:"pointer",maxWidth:120}}>
          <option value="tutti">Tutti i conti</option>
          {conti.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
        </select>
        <span style={{color:"#93c5fd",fontSize:12,fontWeight:600,whiteSpace:"nowrap"}}>{fmt(saldoTotale)}</span>
        <button onClick={toggleTheme} style={{padding:"5px 8px",borderRadius:6,border:"1px solid #3b82f6",background:"transparent",color:"#93c5fd",fontSize:13,cursor:"pointer",flexShrink:0}}>{dark?"☀️":"🌙"}</button>
        <button onClick={()=>{setScreen("login");setPwInput("");setPwError("");}} style={{padding:"5px 8px",borderRadius:6,border:"1px solid #3b82f6",background:"transparent",color:"#93c5fd",fontSize:11,cursor:"pointer",flexShrink:0}}>Esci</button>
      </div>

      {/* Tabs */}
      <div style={{background:surface,borderBottom:`1px solid ${border}`,padding:"0 0.5rem",display:"flex",flexShrink:0,overflowX:"auto"}}>
        {["dashboard","transazioni","conti","analisi"].map(t => (
          <button key={t} onClick={()=>setTab(t)} style={{padding:isMobile?"10px 12px":"14px 20px",fontSize:isMobile?12:14,fontWeight:tab===t?600:400,color:tab===t?tabActiveColor:textSecondary,border:"none",background:"transparent",borderBottom:tab===t?`2px solid ${tabActiveColor}`:"2px solid transparent",cursor:"pointer",whiteSpace:"nowrap",flexShrink:0}}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
        <div style={{flex:1}}/>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"6px 4px",flexShrink:0}}>
          <button onClick={()=>setShowAddConto(true)} style={{...btnStyle,padding:"6px 10px",fontSize:12}}>+ Conto</button>
          <button onClick={()=>{setShowAddTx(true);setNuovaTx(x=>({...x,contoId:selectedConto!=="tutti"?selectedConto:conti[0]?.id||""}));}} style={{...btnPrimary,padding:"6px 10px",fontSize:12}}>+ Transazione</button>
        </div>
      </div>

      {/* Body */}
      <div style={{flex:1,padding:isMobile?"1rem":"2rem",width:"100%",boxSizing:"border-box"}}>

        {tab==="dashboard" && (
          <div>
            <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:12,marginBottom:16}}>
              {[{label:"Saldo",val:entrate-uscite,color:"#1a56db"},{label:"Entrate",val:entrate,color:"#0e9f6e"},{label:"Uscite",val:uscite,color:"#e02424"}].map((m,i)=>(
                <div key={i} style={{...cardStyle,marginBottom:0,borderLeft:`4px solid ${m.color}`}}>
                  <div style={{fontSize:11,color:textSecondary,textTransform:"uppercase",letterSpacing:0.8,fontWeight:500,marginBottom:6}}>{m.label}</div>
                  <div style={{fontSize:24,fontWeight:700,color:i===0&&m.val<0?"#e02424":m.color}}>{fmt(m.val)}</div>
                </div>
              ))}
            </div>
            <div style={cardStyle}>
              <p style={{fontSize:15,fontWeight:600,color:tabActiveColor,margin:"0 0 12px"}}>Ultime transazioni</p>
              <div style={{borderTop:`1px solid ${border}`,marginBottom:12}}/>
              {txFiltered.length===0 && <div style={{color:textSecondary,fontSize:13}}>Nessuna transazione ancora.</div>}
              {txFiltered.slice(0,8).map(tx=>{
                const c=conti.find(c=>c.id===tx.contoId);
                return (
                  <div key={tx.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${surfaceAlt}`}}>
                    <div style={{width:36,height:36,borderRadius:8,background:(c?.colore||"#1a56db")+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{tx.tipo==="entrata"?"↑":"↓"}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:14,fontWeight:500,color:textPrimary}}>{tx.descrizione||tx.categoria}</div>
                      <div style={{fontSize:12,color:textSecondary}}>{tx.categoria} · {tx.data} · {c?.nome}</div>
                    </div>
                    <div style={{fontWeight:700,fontSize:15,color:tx.tipo==="entrata"?"#0e9f6e":"#e02424"}}>{tx.tipo==="entrata"?"+":"-"}{fmt(tx.importo)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==="transazioni" && (
          <div style={cardStyle}>
            <p style={{fontSize:15,fontWeight:600,color:tabActiveColor,margin:"0 0 12px"}}>{txFiltered.length} transazioni</p>
            <div style={{borderTop:`1px solid ${border}`,marginBottom:12}}/>
            {txFiltered.length===0 && <div style={{color:textSecondary,fontSize:13}}>Nessuna transazione.</div>}
            {txFiltered.map(tx=>{
              const c=conti.find(c=>c.id===tx.contoId);
              return (
                <div key={tx.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 0",borderBottom:`1px solid ${surfaceAlt}`}}>
                  <div style={{width:36,height:36,borderRadius:8,background:(c?.colore||"#1a56db")+"33",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>{tx.tipo==="entrata"?"↑":"↓"}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:500,color:textPrimary}}>{tx.descrizione||tx.categoria}</div>
                    <div style={{fontSize:12,color:textSecondary}}>{tx.categoria} · {tx.data} · {c?.nome}</div>
                  </div>
                  <span style={{display:"inline-block",padding:"2px 10px",borderRadius:12,fontSize:11,fontWeight:600,background:tx.tipo==="entrata"?"#0e9f6e22":"#e0242222",color:tx.tipo==="entrata"?"#0e9f6e":"#e02424"}}>{tx.tipo}</span>
                  <div style={{fontWeight:700,color:tx.tipo==="entrata"?"#0e9f6e":"#e02424",minWidth:90,textAlign:"right"}}>{tx.tipo==="entrata"?"+":"-"}{fmt(tx.importo)}</div>
                  <button onClick={()=>deleteTx(tx.id)} style={{background:"transparent",border:"none",cursor:"pointer",color:textSecondary,fontSize:18,lineHeight:1,padding:"0 4px"}}>×</button>
                </div>
              );
            })}
          </div>
        )}

        {tab==="conti" && (
          <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(3,1fr)",gap:16}}>
            {conti.map(c=>(
              <div key={c.id} style={{...cardStyle,borderTop:`4px solid ${c.colore}`,marginBottom:0}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                  <span style={{width:12,height:12,borderRadius:"50%",background:c.colore}}/>
                  <span style={{fontWeight:600,fontSize:15,color:textPrimary}}>{c.nome}</span>
                </div>
                <div style={{fontSize:24,fontWeight:700,color:getSaldo(c.id)>=0?tabActiveColor:"#e02424",marginBottom:8}}>{fmt(getSaldo(c.id))}</div>
                <div style={{fontSize:12,color:textSecondary,marginBottom:12}}>{transazioni.filter(t=>t.contoId===c.id).length} transazioni</div>
                <button onClick={()=>{if(window.confirm("Eliminare questo conto?"))deleteConto(c.id);}} style={{padding:"6px 14px",borderRadius:6,border:"1px solid #fca5a5",background:surface,cursor:"pointer",fontSize:12,color:"#e02424"}}>Elimina</button>
              </div>
            ))}
            {conti.length===0 && <div style={{...cardStyle,gridColumn:"span 3",textAlign:"center",color:textSecondary,fontSize:13}}>Nessun conto. Crea il tuo primo conto con "+ Conto".</div>}
          </div>
        )}

        {tab==="analisi" && (
          <div style={cardStyle}>
            <p style={{fontSize:15,fontWeight:600,color:tabActiveColor,margin:"0 0 12px"}}>Spese per categoria</p>
            <div style={{borderTop:`1px solid ${border}`,marginBottom:16}}/>
            <PieChart data={getSpese()} dark={dark}/>
          </div>
        )}
      </div>

      {/* Modal: Nuovo conto */}
      {showAddConto && (
        <div style={modalStyle} onClick={()=>setShowAddConto(false)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 1.25rem",fontWeight:700,fontSize:17,color:textPrimary}}>Nuovo conto</h3>
            <input placeholder="Nome conto" value={nuovoConto.nome} onChange={e=>setNuovoConto(n=>({...n,nome:e.target.value}))} style={inputStyle}/>
            <div style={{marginBottom:16}}>
              <div style={{fontSize:12,color:textSecondary,marginBottom:8,fontWeight:500}}>Colore</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {COLORS.map(col=><div key={col} onClick={()=>setNuovoConto(n=>({...n,colore:col}))} style={{width:26,height:26,borderRadius:6,background:col,cursor:"pointer",outline:nuovoConto.colore===col?"3px solid #3b82f6":"none",outlineOffset:2}}/>)}
              </div>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowAddConto(false)} style={btnStyle}>Annulla</button>
              <button onClick={addConto} style={btnPrimary}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Nuova transazione */}
      {showAddTx && (
        <div style={modalStyle} onClick={()=>setShowAddTx(false)}>
          <div style={modalBox} onClick={e=>e.stopPropagation()}>
            <h3 style={{margin:"0 0 1.25rem",fontWeight:700,fontSize:17,color:textPrimary}}>Nuova transazione</h3>
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              {["uscita","entrata"].map(t=>(
                <button key={t} onClick={()=>setNuovaTx(tx=>({...tx,tipo:t}))} style={{flex:1,padding:"8px",borderRadius:6,border:`2px solid ${nuovaTx.tipo===t?(t==="entrata"?"#0e9f6e":"#e02424"):border}`,background:surface,cursor:"pointer",fontWeight:600,fontSize:13,color:nuovaTx.tipo===t?(t==="entrata"?"#0e9f6e":"#e02424"):textSecondary}}>
                  {t==="entrata"?"↑ Entrata":"↓ Uscita"}
                </button>
              ))}
            </div>
            <input type="number" placeholder="Importo (€)" value={nuovaTx.importo} onChange={e=>setNuovaTx(tx=>({...tx,importo:e.target.value}))} style={inputStyle} min="0" step="0.01"/>
            <select value={nuovaTx.categoria} onChange={e=>setNuovaTx(tx=>({...tx,categoria:e.target.value}))} style={selectStyle}>
              {DEFAULT_CATEGORIES.map(c=><option key={c}>{c}</option>)}
            </select>
            <input placeholder="Descrizione (opzionale)" value={nuovaTx.descrizione} onChange={e=>setNuovaTx(tx=>({...tx,descrizione:e.target.value}))} style={inputStyle}/>
            <input type="date" value={nuovaTx.data} onChange={e=>setNuovaTx(tx=>({...tx,data:e.target.value}))} style={inputStyle}/>
            <select value={nuovaTx.contoId} onChange={e=>setNuovaTx(tx=>({...tx,contoId:e.target.value}))} style={selectStyle}>
              <option value="">Seleziona conto</option>
              {conti.map(c=><option key={c.id} value={c.id}>{c.nome}</option>)}
            </select>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:4}}>
              <button onClick={()=>setShowAddTx(false)} style={btnStyle}>Annulla</button>
              <button onClick={addTx} disabled={!nuovaTx.importo||!nuovaTx.contoId} style={{...btnPrimary,opacity:(!nuovaTx.importo||!nuovaTx.contoId)?0.5:1}}>Aggiungi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}