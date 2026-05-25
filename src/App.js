import { useState, useEffect, useRef } from "react";

// ─── Storage key ──────────────────────────────
const STORAGE_KEY = "focusbase-v2";

// New format: { history: { "YYYY-MM-DD": { priorities, focusSessions, dumps } }, sleepLog }
// Old format: { date, priorities, focusSessions, dumps, sleepLog }
function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { history: {}, sleepLog: [] };
    const d = JSON.parse(raw);
    if (d.history) return d; // already new format

    // ── Migrate old format ──
    const history = {};
    if (d.date) {
      history[d.date] = {
        priorities: d.priorities || [],
        focusSessions: d.focusSessions || 0,
        dumps: d.dumps || [],
      };
    }
    return { history, sleepLog: d.sleepLog || [] };
  } catch { return { history: {}, sleepLog: [] }; }
}

function saveData(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

// ─── Helpers ─────────────────────────────────
const todayStr = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
  new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(d);

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
};

const MOTD = [
  "Small steps still move you forward.",
  "You don't have to be perfect. Just present.",
  "Focus on the next 30 minutes.",
  "Done beats perfect. Every time.",
  "Your brain works differently. That's the edge.",
  "One task. That's all.",
  "Invisible progress is still progress.",
  "Start before you feel ready.",
  "You've restarted before. You'll keep going.",
  "The goal isn't discipline. It's momentum.",
];

// ─── Focus Timer Hook ─────────────────────────
function useTimer() {
  const [duration, setDuration] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const intervalRef = useRef(null);

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining((r) => {
          if (r <= 1) { setRunning(false); setDone(true); clearInterval(intervalRef.current); return 0; }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = () => { setDone(false); setRunning(true); };
  const pause = () => setRunning(false);
  const reset = (mins) => {
    setRunning(false); setDone(false);
    const s = (mins || duration / 60) * 60;
    setDuration(s); setRemaining(s);
  };
  const pick = (mins) => {
    setRunning(false); setDone(false);
    setDuration(mins * 60); setRemaining(mins * 60);
  };

  return { duration, remaining, running, done, start, pause, reset, pick, setDone };
}

// ─── App ─────────────────────────────────────
export default function App() {
  // ── Today's live state
  const [priorities, setPriorities] = useState([]);
  const [dumps, setDumps] = useState([]);
  const [focusSessions, setFocusSessions] = useState(0);
  // ── Persistent state
  const [history, setHistory] = useState({});   // past days only
  const [sleepLog, setSleepLog] = useState([]);
  // ── UI state
  const [newP, setNewP] = useState("");
  const [newD, setNewD] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dateKey] = useState(todayStr());
  const [now, setNow] = useState(new Date());
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const timer = useTimer();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load
  useEffect(() => {
    const stored = localStorage.getItem("focusbase-name");
    if (stored) setUserName(stored);

    const d = loadData();
    const { [dateKey]: todayEntry, ...pastHistory } = d.history;
    setHistory(pastHistory);
    if (todayEntry) {
      setPriorities(todayEntry.priorities || []);
      setDumps(todayEntry.dumps || []);
      setFocusSessions(todayEntry.focusSessions || 0);
    }
    setSleepLog(d.sleepLog || []);
    setLoaded(true);
  }, []); // eslint-disable-line

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem("focusbase-name", name);
    setUserName(name);
  };

  // Save on every change — history[today] always mirrors live state
  useEffect(() => {
    if (!loaded) return;
    saveData({
      history: { ...history, [dateKey]: { priorities, focusSessions, dumps } },
      sleepLog,
    });
  }, [priorities, dumps, sleepLog, focusSessions, loaded, dateKey]); // eslint-disable-line

  // Count completed focus sessions
  useEffect(() => {
    if (timer.done) { setFocusSessions((s) => s + 1); timer.setDone(false); }
  }); // eslint-disable-line

  // ── Priority actions
  const addP = () => {
    if (!newP.trim() || priorities.length >= 3) return;
    setPriorities([...priorities, { text: newP.trim(), done: false }]);
    setNewP("");
  };
  const toggleP = (i) => { const n = [...priorities]; n[i] = { ...n[i], done: !n[i].done }; setPriorities(n); };
  const delP = (i) => setPriorities(priorities.filter((_, x) => x !== i));

  // ── Brain Dump actions
  const addD = () => {
    if (!newD.trim()) return;
    const t = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
    setDumps([{ text: newD.trim(), time: t }, ...dumps]);
    setNewD("");
  };
  const delD = (i) => setDumps(dumps.filter((_, x) => x !== i));

  // ── Sleep actions
  const logWake = () => {
    if (!wakeTime) return;
    const updated = [...sleepLog.filter((s) => s.date !== todayStr()), { date: todayStr(), time: wakeTime }].slice(-30);
    setSleepLog(updated);
    setWakeTime("");
  };

  // ── Weekly data helper
  const getDayStats = (dateStr) => {
    const isToday = dateStr === dateKey;
    const entry = isToday
      ? { priorities, focusSessions, dumps }
      : (history[dateStr] || { priorities: [], focusSessions: 0, dumps: [] });
    const wakeEntry = sleepLog.find((s) => s.date === dateStr);
    let wakeColor = null;
    if (wakeEntry) {
      const [h, m] = wakeEntry.time.split(":").map(Number);
      wakeColor = (h < 8 || (h === 8 && m <= 30)) ? "green" : h < 10 ? "amber" : "red";
    }
    const completed = (entry.priorities || []).filter((p) => p.done).length;
    const total = (entry.priorities || []).length;
    return {
      priorities: entry.priorities || [],
      completed, total,
      focusSessions: entry.focusSessions || 0,
      dumpsCount: (entry.dumps || []).length,
      wakeEntry, wakeColor,
      hasData: total > 0 || entry.focusSessions > 0 || !!wakeEntry,
    };
  };

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().split("T")[0];
    const isToday = dateStr === dateKey;
    const label = isToday ? "Today" : i === 5 ? "Yest" : d.toLocaleDateString("en-US", { weekday: "short" });
    return { dateStr, label, dayNum: d.getDate(), isToday, ...getDayStats(dateStr) };
  });

  // ── Week summary stats
  const weekCompleted  = weekDays.reduce((a, d) => a + d.completed, 0);
  const weekFocus      = weekDays.reduce((a, d) => a + d.focusSessions, 0);
  const weekOnTime     = weekDays.filter((d) => d.wakeColor === "green").length;

  // ── Derived today values
  const todayWake   = sleepLog.find((s) => s.date === todayStr());
  const last7Sleep  = sleepLog.slice(-7);
  const streak      = (() => {
    let s = 0;
    const sorted = [...sleepLog].sort((a, b) => b.date.localeCompare(a.date));
    for (const entry of sorted) {
      const [h, m] = entry.time.split(":").map(Number);
      if (h < 8 || (h === 8 && m <= 30)) s++;
      else break;
    }
    return s;
  })();
  const completedP  = priorities.filter((p) => p.done).length;
  const timerPct    = timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0;
  const timerMins   = Math.floor(timer.remaining / 60);
  const timerSecs   = timer.remaining % 60;
  const timeStr     = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // ── Design tokens
  const c = {
    bg0: "#09090b", bg1: "#0f0f12", bg2: "#16161c",
    border: "rgba(255,255,255,0.07)", borderHover: "rgba(139,92,246,0.35)",
    accent: "#8b5cf6", accentLight: "#a78bfa",
    accentDim: "rgba(139,92,246,0.12)", accentGlow: "rgba(139,92,246,0.07)",
    green: "#34d399", amber: "#fbbf24", red: "#f87171",
    text1: "#fafafa", text2: "rgba(255,255,255,0.55)", text3: "rgba(255,255,255,0.22)",
  };

  const wakeColors = { green: c.green, amber: c.amber, red: c.red };

  const cardStyle = {
    background: `linear-gradient(145deg, ${c.bg1} 0%, ${c.bg2} 100%)`,
    borderRadius: "18px",
    border: `1px solid ${c.border}`,
    padding: "26px",
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.35s ease, box-shadow 0.35s ease, transform 0.2s ease",
  };

  const inputStyle = {
    flex: 1,
    background: "rgba(255,255,255,0.03)",
    border: `1px solid ${c.border}`,
    borderRadius: "10px",
    padding: "11px 15px",
    color: c.text1,
    fontSize: "14px",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: "none",
    transition: "border-color 0.25s ease, background 0.25s ease",
  };

  const btnStyle = (active) => ({
    background: active ? "rgba(139,92,246,0.18)" : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? "rgba(139,92,246,0.4)" : c.border}`,
    borderRadius: "10px",
    padding: "11px 15px",
    color: active ? "#a78bfa" : c.text3,
    fontSize: "18px",
    cursor: active ? "pointer" : "default",
    transition: "all 0.25s ease",
    lineHeight: 1,
    fontWeight: 300,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #09090b; color: #fafafa; }

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn  { from { opacity:0; } to { opacity:1; } }
        @keyframes glow    { 0%,100% { opacity:.4; } 50% { opacity:1; } }
        @keyframes orb     { 0%,100% { transform:translateX(-50%) scale(1); opacity:.6; } 50% { transform:translateX(-50%) scale(1.1); opacity:1; } }
        @keyframes timerPulse { 0%,100% { filter:drop-shadow(0 0 8px rgba(139,92,246,.3)); } 50% { filter:drop-shadow(0 0 20px rgba(139,92,246,.6)); } }
        @keyframes completePulse { 0%{transform:scale(1);}50%{transform:scale(1.03);}100%{transform:scale(1);} }
        @keyframes modalIn { from{opacity:0;transform:translateY(24px) scale(.96);} to{opacity:1;transform:translateY(0) scale(1);} }
        @keyframes shimmer { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }

        input::placeholder { color:rgba(255,255,255,.18) !important; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter:invert(.4) brightness(.8); cursor:pointer; }
        ::-webkit-scrollbar { width:2px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(139,92,246,.2); border-radius:2px; }

        .fb-card:hover { border-color:rgba(139,92,246,.25) !important; box-shadow:0 8px 48px rgba(139,92,246,.07),0 2px 8px rgba(0,0,0,.4) !important; transform:translateY(-1px); }
        .priority-item:hover { background:rgba(255,255,255,.03) !important; }
        .priority-item:hover .del-btn { opacity:1 !important; }
        .dump-item:hover .del-btn { opacity:1 !important; }
        .timer-btn:hover { background:rgba(139,92,246,.18) !important; border-color:rgba(139,92,246,.4) !important; color:#a78bfa !important; }
        .name-input:focus { border-color:rgba(139,92,246,.5) !important; background:rgba(139,92,246,.05) !important; }
        .go-btn:hover:not([disabled]) { box-shadow:0 6px 32px rgba(139,92,246,.45) !important; transform:translateY(-1px); }
        .stat-card:hover { border-color:rgba(139,92,246,.15) !important; }
        .clear-btn:hover { color:rgba(248,113,113,.7) !important; }
        .add-input:focus { border-color:rgba(139,92,246,.35) !important; background:rgba(139,92,246,.03) !important; }
        .week-day:hover { border-color:rgba(139,92,246,.2) !important; background:rgba(139,92,246,.04) !important; }
      `}</style>

      {/* ── Name modal ── */}
      {loaded && !userName && (
        <div style={{ position:"fixed", inset:0, zIndex:200, background:"radial-gradient(ellipse at 50% 40%, rgba(139,92,246,.12) 0%, rgba(9,9,11,.97) 60%)", backdropFilter:"blur(12px)", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px", color:"#fafafa", fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
          <div style={{ position:"absolute", top:"30%", left:"50%", width:"500px", height:"500px", borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,.12) 0%, transparent 70%)", transform:"translateX(-50%)", animation:"orb 6s ease-in-out infinite", pointerEvents:"none" }} />
          <div style={{ position:"relative", background:"linear-gradient(145deg, #111116 0%, #18181f 100%)", border:"1px solid rgba(139,92,246,.25)", borderRadius:"24px", padding:"44px 40px", width:"100%", maxWidth:"400px", boxShadow:"0 0 0 1px rgba(255,255,255,.04), 0 32px 80px rgba(0,0,0,.6), 0 0 60px rgba(139,92,246,.1)", animation:"modalIn .45s cubic-bezier(.16,1,.3,1) forwards" }}>
            <div style={{ position:"absolute", top:0, left:"10%", right:"10%", height:"1px", background:"linear-gradient(90deg, transparent, rgba(139,92,246,.6), transparent)" }} />
            <div style={{ display:"flex", alignItems:"center", gap:"10px", marginBottom:"32px" }}>
              <div style={{ width:"36px", height:"36px", borderRadius:"11px", background:"linear-gradient(135deg, #8b5cf6, #6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 4px 16px rgba(139,92,246,.35)" }}>
                <svg width="17" height="17" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="white"/><path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.8 3.8L5.2 5.2M10.8 10.8L12.2 12.2M3.8 12.2L5.2 10.8M10.8 5.2L12.2 3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontFamily:"'Outfit', sans-serif", fontSize:"16px", fontWeight:700, letterSpacing:"-0.01em" }}>FocusBase</span>
            </div>
            <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"26px", fontWeight:800, letterSpacing:"-0.03em", lineHeight:1.15, marginBottom:"10px" }}>
              Your space to<br/>
              <span style={{ background:"linear-gradient(135deg, #a78bfa, #8b5cf6)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>get things done.</span>
            </h2>
            <p style={{ fontSize:"14px", color:"rgba(255,255,255,.38)", marginBottom:"32px", lineHeight:1.6 }}>Built for brains that work differently.<br/>What should we call you?</p>
            <input autoFocus className="name-input" value={nameInput} onChange={(e)=>setNameInput(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&submitName()} placeholder="Your first name" style={{ width:"100%", display:"block", background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:"12px", padding:"14px 18px", color:"#fafafa", fontSize:"15px", fontFamily:"'Plus Jakarta Sans', sans-serif", outline:"none", marginBottom:"12px", transition:"border-color .25s, background .25s", letterSpacing:"0.01em" }}/>
            <button className="go-btn" onClick={submitName} disabled={!nameInput.trim()} style={{ width:"100%", display:"block", padding:"14px", borderRadius:"12px", border:"none", background:nameInput.trim()?"linear-gradient(135deg,#8b5cf6 0%,#6d28d9 100%)":"rgba(255,255,255,.05)", color:nameInput.trim()?"#fff":"rgba(255,255,255,.2)", fontFamily:"'Outfit', sans-serif", fontSize:"15px", fontWeight:600, cursor:nameInput.trim()?"pointer":"default", letterSpacing:"0.01em", boxShadow:nameInput.trim()?"0 4px 24px rgba(139,92,246,.3)":"none", transition:"all .25s" }}>Let's go →</button>
            <p style={{ textAlign:"center", fontSize:"11px", color:"rgba(255,255,255,.12)", marginTop:"20px", letterSpacing:"0.04em" }}>STORED LOCALLY · NEVER SHARED</p>
          </div>
        </div>
      )}

      {/* ── Main App ── */}
      <div style={{ minHeight:"100vh", background:c.bg0, color:c.text1, fontFamily:"'Plus Jakarta Sans', sans-serif" }}>
        <div style={{ position:"fixed", top:"-180px", left:"50%", transform:"translateX(-50%)", width:"900px", height:"600px", background:"radial-gradient(ellipse, rgba(139,92,246,.07) 0%, transparent 65%)", pointerEvents:"none", zIndex:0 }}/>
        <div style={{ position:"fixed", bottom:"-150px", right:"-50px", width:"500px", height:"500px", background:"radial-gradient(circle, rgba(109,40,217,.04) 0%, transparent 70%)", pointerEvents:"none", zIndex:0 }}/>

        <div style={{ maxWidth:"980px", margin:"0 auto", padding:"32px 24px 80px", position:"relative", zIndex:1, animation:"fadeIn .6s ease" }}>

          {/* ── Nav ── */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"44px" }}>
            <div style={{ display:"flex", alignItems:"center", gap:"11px" }}>
              <div style={{ width:"32px", height:"32px", borderRadius:"10px", background:"linear-gradient(135deg, #8b5cf6, #6d28d9)", display:"flex", alignItems:"center", justifyContent:"center", boxShadow:"0 2px 12px rgba(139,92,246,.3)" }}>
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="white"/><path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.8 3.8L5.2 5.2M10.8 10.8L12.2 12.2M3.8 12.2L5.2 10.8M10.8 5.2L12.2 3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <span style={{ fontFamily:"'Outfit', sans-serif", fontSize:"17px", fontWeight:700, letterSpacing:"-0.02em" }}>FocusBase</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:"6px", background:"rgba(255,255,255,.03)", border:`1px solid ${c.border}`, borderRadius:"10px", padding:"8px 14px" }}>
              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"13px", color:c.text2 }}>{timeStr}</span>
              <span style={{ color:c.text3, fontSize:"11px", margin:"0 2px" }}>·</span>
              <span style={{ fontSize:"12px", color:c.text3 }}>{fmtDate(now)}</span>
            </div>
          </div>

          {/* ── Header ── */}
          <div style={{ marginBottom:"8px" }}>
            <h1 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"clamp(34px, 5vw, 48px)", fontWeight:800, letterSpacing:"-0.04em", lineHeight:1.05, background:"linear-gradient(135deg, #ffffff 30%, rgba(255,255,255,.5) 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>
              {greeting()}{userName ? `, ${userName}` : ""}
            </h1>
            <p style={{ fontSize:"13px", color:c.text3, marginTop:"12px", fontStyle:"italic", letterSpacing:"0.02em" }}>
              &ldquo;{MOTD[new Date().getDate() % MOTD.length]}&rdquo;
            </p>
          </div>

          {/* ── Stats Row ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:"10px", margin:"28px 0 24px", animation:"slideUp .5s ease forwards", animationDelay:".08s", opacity:0 }}>
            {[
              { label:"Priorities",     value:`${completedP}/${priorities.length||0}`, color:completedP===priorities.length&&priorities.length>0?c.accent:c.text3 },
              { label:"Focus Sessions", value:focusSessions,                            color:focusSessions>0?c.accent:c.text3 },
              { label:"Wake Streak",    value:`${streak}d`,                             color:streak>0?c.green:c.text3 },
              { label:"Brain Dumps",    value:dumps.length,                             color:dumps.length>0?c.accentLight:c.text3 },
            ].map((s,i)=>(
              <div key={i} className="stat-card" style={{ background:c.bg1, borderRadius:"12px", border:`1px solid ${c.border}`, padding:"14px 16px", textAlign:"center", transition:"all .25s ease", cursor:"default" }}>
                <div style={{ fontFamily:"'Outfit', sans-serif", fontSize:"22px", fontWeight:700, color:s.color, letterSpacing:"-0.02em", transition:"color .4s" }}>{s.value}</div>
                <div style={{ fontSize:"10px", color:c.text3, marginTop:"5px", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Main Grid ── */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(340px, 1fr))", gap:"16px" }}>

            {/* ── PRIORITIES ── */}
            <div className="fb-card" style={{ ...cardStyle, animation:"slideUp .5s ease forwards", animationDelay:".13s", opacity:0 }}>
              <div style={{ position:"absolute", top:0, left:0, right:0, height:"2px", borderRadius:"18px 18px 0 0", background:priorities.length>0?`linear-gradient(90deg, #8b5cf6 ${(completedP/Math.max(priorities.length,1))*100}%, rgba(255,255,255,.05) ${(completedP/Math.max(priorities.length,1))*100}%)`:"transparent", transition:"all .7s ease" }}/>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px" }}>
                <div>
                  <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, letterSpacing:"0.01em", textTransform:"uppercase" }}>Today's Priorities</h2>
                  <p style={{ fontSize:"12px", color:c.text3, marginTop:"4px" }}>Just three. That's all you need.</p>
                </div>
                {priorities.length>0&&<span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", color:completedP===priorities.length?c.accent:c.text3, padding:"3px 9px", background:completedP===priorities.length?"rgba(139,92,246,.1)":"rgba(255,255,255,.03)", borderRadius:"6px", border:`1px solid ${completedP===priorities.length?"rgba(139,92,246,.2)":c.border}`, transition:"all .4s" }}>{completedP}/{priorities.length}</span>}
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
                {priorities.map((item,i)=>(
                  <div key={i} className="priority-item" style={{ display:"flex", alignItems:"center", gap:"12px", padding:"12px 14px", background:item.done?"rgba(139,92,246,.07)":"rgba(255,255,255,.02)", borderRadius:"10px", border:`1px solid ${item.done?"rgba(139,92,246,.15)":"rgba(255,255,255,.04)"}`, transition:"all .3s ease", animation:"slideUp .3s ease forwards", animationDelay:`${i*50}ms` }}>
                    <button onClick={()=>toggleP(i)} style={{ width:"20px", height:"20px", borderRadius:"6px", border:`1.5px solid ${item.done?c.accent:"rgba(255,255,255,.18)"}`, background:item.done?c.accent:"transparent", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .2s", padding:0 }}>
                      {item.done&&<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </button>
                    <span style={{ flex:1, color:item.done?c.text3:c.text1, fontSize:"14px", textDecoration:item.done?"line-through":"none", transition:"all .25s" }}>{item.text}</span>
                    <button className="del-btn" onClick={()=>delP(i)} style={{ background:"transparent", border:"none", color:c.text3, cursor:"pointer", fontSize:"16px", padding:"1px 4px", opacity:0, transition:"opacity .2s", lineHeight:1 }}>×</button>
                  </div>
                ))}
                {priorities.length<3&&(
                  <div style={{ display:"flex", gap:"8px", marginTop:"2px" }}>
                    <input className="add-input" value={newP} onChange={(e)=>setNewP(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addP()} placeholder={priorities.length===0?"What matters most today?":priorities.length===1?"Second priority...":"One last thing..."} style={inputStyle}/>
                    <button onClick={addP} style={btnStyle(!!newP.trim())}>+</button>
                  </div>
                )}
                {completedP===3&&priorities.length===3&&(
                  <div style={{ textAlign:"center", padding:"13px", background:"rgba(139,92,246,.08)", borderRadius:"10px", border:"1px solid rgba(139,92,246,.15)", animation:"completePulse .5s ease" }}>
                    <span style={{ fontFamily:"'Outfit', sans-serif", fontSize:"13px", color:c.accent, fontWeight:600 }}>All done today ✦</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── FOCUS TIMER ── */}
            <div className="fb-card" style={{ ...cardStyle, animation:"slideUp .5s ease forwards", animationDelay:".18s", opacity:0 }}>
              <div style={{ marginBottom:"20px" }}>
                <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, letterSpacing:"0.01em", textTransform:"uppercase" }}>Focus Timer</h2>
                <p style={{ fontSize:"12px", color:c.text3, marginTop:"4px" }}>Lock in. One block at a time.</p>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"22px" }}>
                <div style={{ position:"relative", width:"176px", height:"176px" }}>
                  {timer.running&&<div style={{ position:"absolute", inset:"-8px", borderRadius:"50%", background:"radial-gradient(circle, rgba(139,92,246,.1) 60%, transparent 70%)", animation:"glow 2.5s ease infinite" }}/>}
                  <svg width="176" height="176" viewBox="0 0 176 176" style={{ transform:"rotate(-90deg)" }}>
                    <circle cx="88" cy="88" r="76" fill="none" stroke={c.bg0} strokeWidth="7"/>
                    <circle cx="88" cy="88" r="76" fill="none" stroke="rgba(139,92,246,.08)" strokeWidth="7"/>
                    <circle cx="88" cy="88" r="76" fill="none" stroke="url(#timerGrad)" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${2*Math.PI*76}`} strokeDashoffset={`${2*Math.PI*76*(1-timerPct/100)}`} style={{ transition:"stroke-dashoffset 1s linear", animation:timer.running?"timerPulse 3s ease infinite":"none" }}/>
                    <defs><linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#a78bfa"/><stop offset="100%" stopColor="#6d28d9"/></linearGradient></defs>
                  </svg>
                  <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"4px" }}>
                    <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"34px", fontWeight:500, color:timer.running?c.text1:c.text2, letterSpacing:"-0.03em", transition:"color .4s" }}>{String(timerMins).padStart(2,"0")}:{String(timerSecs).padStart(2,"0")}</span>
                    <span style={{ fontSize:"10px", color:timer.running?c.accent:c.text3, textTransform:"uppercase", letterSpacing:"0.12em", fontWeight:500, transition:"color .4s", animation:timer.running?"glow 2s ease infinite":"none" }}>{timer.running?"focusing":timerPct>0?"paused":`${timer.duration/60}m`}</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  {[25,45,60].map((m)=>(
                    <button key={m} className="timer-btn" onClick={()=>timer.pick(m)} style={{ padding:"7px 18px", borderRadius:"8px", border:`1px solid ${timer.duration===m*60?"rgba(139,92,246,.4)":c.border}`, background:timer.duration===m*60?"rgba(139,92,246,.12)":"rgba(255,255,255,.02)", color:timer.duration===m*60?"#a78bfa":c.text3, fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", cursor:"pointer", transition:"all .2s" }}>{m}m</button>
                  ))}
                </div>
                <div style={{ display:"flex", gap:"8px" }}>
                  {!timer.running
                    ? <button onClick={timer.start} style={{ padding:"10px 36px", borderRadius:"10px", border:"none", background:"linear-gradient(135deg, #8b5cf6, #6d28d9)", color:"#fff", fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, cursor:"pointer", boxShadow:"0 4px 20px rgba(139,92,246,.3)", letterSpacing:"0.01em" }}>{timer.remaining<timer.duration&&timer.remaining>0?"Resume":"Start"}</button>
                    : <button onClick={timer.pause} style={{ padding:"10px 36px", borderRadius:"10px", border:`1px solid rgba(255,255,255,.08)`, background:"rgba(255,255,255,.04)", color:c.text2, fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:500, cursor:"pointer" }}>Pause</button>
                  }
                  <button onClick={()=>timer.reset()} style={{ padding:"10px 14px", borderRadius:"10px", border:`1px solid ${c.border}`, background:"transparent", color:c.text3, fontSize:"16px", cursor:"pointer" }}>↺</button>
                </div>
                {focusSessions>0&&(
                  <div style={{ display:"flex", alignItems:"center", gap:"5px" }}>
                    {Array.from({ length:Math.min(focusSessions,6) }).map((_,i)=>(
                      <div key={i} style={{ width:"6px", height:"6px", borderRadius:"50%", background:c.accent, opacity:.5+i*.08 }}/>
                    ))}
                    <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"10px", color:c.text3, marginLeft:"3px" }}>{focusSessions} session{focusSessions!==1?"s":""}</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── BRAIN DUMP ── */}
            <div className="fb-card" style={{ ...cardStyle, animation:"slideUp .5s ease forwards", animationDelay:".23s", opacity:0 }}>
              <div style={{ marginBottom:"20px" }}>
                <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, letterSpacing:"0.01em", textTransform:"uppercase" }}>Brain Dump</h2>
                <p style={{ fontSize:"12px", color:c.text3, marginTop:"4px" }}>Get it out of your head. Deal with it later.</p>
              </div>
              <div style={{ display:"flex", gap:"8px", marginBottom:"14px" }}>
                <input className="add-input" value={newD} onChange={(e)=>setNewD(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&addD()} placeholder="What's on your mind?" style={inputStyle}/>
                <button onClick={addD} style={btnStyle(!!newD.trim())}>+</button>
              </div>
              <div style={{ display:"flex", flexDirection:"column", gap:"6px", maxHeight:"210px", overflowY:"auto" }}>
                {dumps.length===0
                  ? <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"72px", color:c.text3, fontSize:"13px", fontStyle:"italic" }}>Nothing yet — mind is clear</div>
                  : dumps.map((item,i)=>(
                    <div key={i} className="dump-item" style={{ display:"flex", alignItems:"flex-start", gap:"10px", padding:"10px 13px", background:"rgba(255,255,255,.02)", borderRadius:"8px", border:"1px solid rgba(255,255,255,.03)", animation:"slideUp .28s ease forwards" }}>
                      <span style={{ color:"rgba(139,92,246,.4)", fontSize:"10px", fontFamily:"'JetBrains Mono', monospace", marginTop:"2px", flexShrink:0 }}>{item.time}</span>
                      <span style={{ flex:1, color:c.text2, fontSize:"13px", lineHeight:1.55 }}>{item.text}</span>
                      <button className="del-btn" onClick={()=>delD(i)} style={{ background:"transparent", border:"none", color:c.text3, cursor:"pointer", fontSize:"14px", opacity:0, transition:"opacity .2s", padding:"0 2px", lineHeight:1 }}>×</button>
                    </div>
                  ))
                }
              </div>
              {dumps.length>0&&(
                <div style={{ marginTop:"12px", paddingTop:"10px", borderTop:`1px solid ${c.border}`, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"10px", color:c.text3 }}>{dumps.length} captured</span>
                  <button className="clear-btn" onClick={()=>setDumps([])} style={{ background:"transparent", border:"none", color:c.text3, fontSize:"11px", cursor:"pointer", padding:"2px 6px", borderRadius:"4px", transition:"color .2s" }}>Clear all</button>
                </div>
              )}
            </div>

            {/* ── SLEEP SCORECARD ── */}
            <div className="fb-card" style={{ ...cardStyle, animation:"slideUp .5s ease forwards", animationDelay:".28s", opacity:0 }}>
              <div style={{ marginBottom:"20px" }}>
                <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, letterSpacing:"0.01em", textTransform:"uppercase" }}>Sleep Scorecard</h2>
                <p style={{ fontSize:"12px", color:c.text3, marginTop:"4px" }}>Track your wake-up. Build the streak.</p>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:"16px", marginBottom:"20px", padding:"16px 18px", background:streak>0?"rgba(52,211,153,.05)":"rgba(255,255,255,.02)", borderRadius:"12px", border:`1px solid ${streak>0?"rgba(52,211,153,.14)":c.border}`, transition:"all .4s" }}>
                <div style={{ fontFamily:"'Outfit', sans-serif", fontSize:"40px", fontWeight:800, color:streak>0?c.green:c.text3, letterSpacing:"-0.04em", lineHeight:1, transition:"color .4s" }}>{streak}</div>
                <div>
                  <div style={{ fontSize:"13px", color:streak>0?c.green:c.text3, fontWeight:600, transition:"color .4s" }}>day streak</div>
                  <div style={{ fontSize:"11px", color:c.text3, marginTop:"3px" }}>waking by 8:30 AM</div>
                </div>
                {streak>=3&&<div style={{ marginLeft:"auto", fontSize:"22px" }}>{streak>=7?"🔥":"⚡"}</div>}
              </div>
              {last7Sleep.length>0&&(
                <div style={{ marginBottom:"20px" }}>
                  <div style={{ fontSize:"10px", color:c.text3, marginBottom:"10px", textTransform:"uppercase", letterSpacing:"0.1em", fontWeight:500 }}>Last {last7Sleep.length} day{last7Sleep.length!==1?"s":""}</div>
                  <div style={{ display:"flex", gap:"7px" }}>
                    {last7Sleep.map((entry,i)=>{
                      const [h,m]=entry.time.split(":").map(Number);
                      const dotColor=h<8||(h===8&&m<=30)?c.green:h<10?c.amber:c.red;
                      const hr=h%12||12;
                      return (
                        <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"5px" }}>
                          <div style={{ width:"30px", height:"30px", borderRadius:"8px", background:`${dotColor}12`, border:`1px solid ${dotColor}25`, display:"flex", alignItems:"center", justifyContent:"center" }}>
                            <div style={{ width:"9px", height:"9px", borderRadius:"50%", background:dotColor, boxShadow:`0 0 6px ${dotColor}60` }}/>
                          </div>
                          <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"8px", color:c.text3 }}>{hr}:{String(m).padStart(2,"0")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {todayWake
                ? <div style={{ padding:"13px 16px", background:"rgba(139,92,246,.07)", borderRadius:"10px", border:"1px solid rgba(139,92,246,.12)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"13px", color:c.text3 }}>Logged today</span>
                    <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"14px", color:c.accent, fontWeight:500 }}>{todayWake.time}</span>
                  </div>
                : <div style={{ display:"flex", gap:"8px" }}>
                    <input type="time" className="add-input" value={wakeTime} onChange={(e)=>setWakeTime(e.target.value)} style={{ ...inputStyle, fontFamily:"'JetBrains Mono', monospace" }}/>
                    <button onClick={logWake} style={{ ...btnStyle(!!wakeTime), padding:"11px 18px", fontSize:"13px", fontFamily:"'Plus Jakarta Sans', sans-serif", fontWeight:500 }}>Log</button>
                  </div>
              }
            </div>

            {/* ── WEEKLY PROGRESS ── */}
            <div className="fb-card" style={{ ...cardStyle, gridColumn:"1 / -1", animation:"slideUp .5s ease forwards", animationDelay:".35s", opacity:0 }}>
              {/* Header */}
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"24px", flexWrap:"wrap", gap:"12px" }}>
                <div>
                  <h2 style={{ fontFamily:"'Outfit', sans-serif", fontSize:"14px", fontWeight:600, letterSpacing:"0.01em", textTransform:"uppercase" }}>Weekly Progress</h2>
                  <p style={{ fontSize:"12px", color:c.text3, marginTop:"4px" }}>Your last 7 days at a glance.</p>
                </div>
                {/* Week summary pills */}
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  {[
                    { label:`${weekCompleted} priorities`, color:weekCompleted>0?c.accentLight:c.text3 },
                    { label:`${weekFocus} sessions`,       color:weekFocus>0?c.accent:c.text3 },
                    { label:`${weekOnTime}/7 on time`,     color:weekOnTime>=5?c.green:weekOnTime>=3?c.amber:c.text3 },
                  ].map((p,i)=>(
                    <span key={i} style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"11px", color:p.color, padding:"4px 10px", background:"rgba(255,255,255,.03)", border:`1px solid ${c.border}`, borderRadius:"20px" }}>{p.label}</span>
                  ))}
                </div>
              </div>

              {/* Day columns */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:"8px" }}>
                {weekDays.map((day)=>{
                  const allDone = day.total>0 && day.completed===day.total;
                  const dayBg   = day.isToday ? "rgba(139,92,246,.08)" : allDone ? "rgba(52,211,153,.04)" : "rgba(255,255,255,.02)";
                  const dayBorder = day.isToday ? "rgba(139,92,246,.3)" : allDone ? "rgba(52,211,153,.12)" : c.border;

                  return (
                    <div key={day.dateStr} className="week-day" style={{ background:dayBg, border:`1px solid ${dayBorder}`, borderRadius:"12px", padding:"14px 10px", display:"flex", flexDirection:"column", alignItems:"center", gap:"10px", transition:"all .25s ease", position:"relative", overflow:"hidden" }}>
                      {day.isToday&&<div style={{ position:"absolute", top:0, left:"15%", right:"15%", height:"1.5px", background:"linear-gradient(90deg, transparent, rgba(139,92,246,.7), transparent)" }}/>}

                      {/* Day label */}
                      <div style={{ textAlign:"center" }}>
                        <div style={{ fontFamily:"'Outfit', sans-serif", fontSize:"10px", fontWeight:600, color:day.isToday?c.accent:c.text3, textTransform:"uppercase", letterSpacing:"0.08em" }}>{day.label}</div>
                        <div style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"18px", fontWeight:500, color:day.isToday?c.text1:day.hasData?c.text2:c.text3, lineHeight:1.2, marginTop:"2px" }}>{day.dayNum}</div>
                      </div>

                      {/* Divider */}
                      <div style={{ width:"100%", height:"1px", background:"rgba(255,255,255,.05)" }}/>

                      {/* Priorities dots */}
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"5px", width:"100%" }}>
                        <span style={{ fontSize:"9px", color:c.text3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Tasks</span>
                        {day.total===0
                          ? <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", color:c.text3 }}>—</span>
                          : <div style={{ display:"flex", gap:"4px" }}>
                              {Array.from({ length:day.total }).map((_,i)=>(
                                <div key={i} style={{ width:"8px", height:"8px", borderRadius:"50%", background:i<day.completed?c.accent:"rgba(255,255,255,.1)", boxShadow:i<day.completed?`0 0 5px rgba(139,92,246,.5)`:"none", transition:"all .3s" }}/>
                              ))}
                            </div>
                        }
                        {day.total>0&&<span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"9px", color:day.completed===day.total?c.accent:c.text3 }}>{day.completed}/{day.total}</span>}
                      </div>

                      {/* Focus sessions */}
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                        <span style={{ fontSize:"9px", color:c.text3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Focus</span>
                        {day.focusSessions===0
                          ? <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", color:c.text3 }}>—</span>
                          : <div style={{ display:"flex", alignItems:"center", gap:"3px" }}>
                              <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:c.accentLight, boxShadow:`0 0 4px rgba(167,139,250,.5)` }}/>
                              <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", color:c.accentLight }}>{day.focusSessions}</span>
                            </div>
                        }
                      </div>

                      {/* Wake time */}
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"4px" }}>
                        <span style={{ fontSize:"9px", color:c.text3, textTransform:"uppercase", letterSpacing:"0.08em" }}>Wake</span>
                        {!day.wakeEntry
                          ? <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"12px", color:c.text3 }}>—</span>
                          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"2px" }}>
                              <div style={{ width:"8px", height:"8px", borderRadius:"50%", background:wakeColors[day.wakeColor], boxShadow:`0 0 6px ${wakeColors[day.wakeColor]}60` }}/>
                              {(() => {
                                const [h,m]=day.wakeEntry.time.split(":").map(Number);
                                const hr=h%12||12;
                                return <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"8px", color:c.text3 }}>{hr}:{String(m).padStart(2,"0")}</span>;
                              })()}
                            </div>
                        }
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Legend */}
              <div style={{ display:"flex", gap:"16px", marginTop:"16px", paddingTop:"14px", borderTop:`1px solid ${c.border}`, flexWrap:"wrap" }}>
                {[
                  { dot:c.accent,  label:"Priority done" },
                  { dot:c.green,   label:"On time (≤8:30)" },
                  { dot:c.amber,   label:"Late (8:30–10)" },
                  { dot:c.red,     label:"Very late (10+)" },
                ].map((l,i)=>(
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                    <div style={{ width:"7px", height:"7px", borderRadius:"50%", background:l.dot }}/>
                    <span style={{ fontSize:"11px", color:c.text3 }}>{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* ── Footer ── */}
          <div style={{ marginTop:"52px", textAlign:"center" }}>
            <span style={{ fontFamily:"'JetBrains Mono', monospace", fontSize:"9px", color:"rgba(255,255,255,.07)", letterSpacing:"0.15em", textTransform:"uppercase" }}>FocusBase · built for a brain that works differently</span>
          </div>

        </div>
      </div>
    </>
  );
}
