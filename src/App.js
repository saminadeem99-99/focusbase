import { useState, useEffect, useRef } from "react";

// ─── Persistence ──────────────────────────────
const STORAGE_KEY = "focusbase-v2";

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

// ─── Helpers ─────────────────────────────────
const today = () => new Date().toISOString().split("T")[0];

const fmtDate = (d) =>
  new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(d);

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

// ─── Focus Timer Hook ────────────────────────
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
          if (r <= 1) {
            setRunning(false);
            setDone(true);
            clearInterval(intervalRef.current);
            return 0;
          }
          return r - 1;
        });
      }, 1000);
    }
    return () => clearInterval(intervalRef.current);
  }, [running]);

  const start = () => { setDone(false); setRunning(true); };
  const pause = () => setRunning(false);
  const reset = (mins) => {
    setRunning(false);
    setDone(false);
    const s = (mins || duration / 60) * 60;
    setDuration(s);
    setRemaining(s);
  };
  const pick = (mins) => {
    setRunning(false);
    setDone(false);
    setDuration(mins * 60);
    setRemaining(mins * 60);
  };

  return { duration, remaining, running, done, start, pause, reset, pick, setDone };
}

// ─── App ─────────────────────────────────────
export default function App() {
  const [priorities, setPriorities] = useState([]);
  const [dumps, setDumps] = useState([]);
  const [sleepLog, setSleepLog] = useState([]);
  const [focusSessions, setFocusSessions] = useState(0);
  const [newP, setNewP] = useState("");
  const [newD, setNewD] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [dateKey] = useState(today());
  const [now, setNow] = useState(new Date());
  const [userName, setUserName] = useState("");
  const [nameInput, setNameInput] = useState("");
  const timer = useTimer();

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Load from localStorage on mount
  useEffect(() => {
    const storedName = localStorage.getItem("focusbase-name");
    if (storedName) setUserName(storedName);
    const d = loadData();
    if (d) {
      if (d.date === today()) {
        setPriorities(d.priorities || []);
        setDumps(d.dumps || []);
        setFocusSessions(d.focusSessions || 0);
      }
      setSleepLog(d.sleepLog || []);
    }
    setLoaded(true);
  }, []);

  const submitName = () => {
    const name = nameInput.trim();
    if (!name) return;
    localStorage.setItem("focusbase-name", name);
    setUserName(name);
  };

  // Save to localStorage on every state change
  useEffect(() => {
    if (!loaded) return;
    saveData({ date: dateKey, priorities, dumps, sleepLog, focusSessions });
  }, [priorities, dumps, sleepLog, focusSessions, loaded, dateKey]);

  // Count completed focus sessions
  useEffect(() => {
    if (timer.done) {
      setFocusSessions((s) => s + 1);
      timer.setDone(false);
    }
  }); // eslint-disable-line

  // ─── Priority actions
  const addP = () => {
    if (!newP.trim() || priorities.length >= 3) return;
    setPriorities([...priorities, { text: newP.trim(), done: false }]);
    setNewP("");
  };
  const toggleP = (i) => {
    const n = [...priorities];
    n[i] = { ...n[i], done: !n[i].done };
    setPriorities(n);
  };
  const delP = (i) => setPriorities(priorities.filter((_, x) => x !== i));

  // ─── Brain Dump actions
  const addD = () => {
    if (!newD.trim()) return;
    const t = new Date().toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    setDumps([{ text: newD.trim(), time: t }, ...dumps]);
    setNewD("");
  };
  const delD = (i) => setDumps(dumps.filter((_, x) => x !== i));

  // ─── Sleep actions
  const logWake = () => {
    if (!wakeTime) return;
    const entry = { date: today(), time: wakeTime };
    const updated = [...sleepLog.filter((s) => s.date !== today()), entry].slice(-30);
    setSleepLog(updated);
    setWakeTime("");
  };

  // ─── Derived values
  const todayWake = sleepLog.find((s) => s.date === today());
  const last7 = sleepLog.slice(-7);
  const streak = (() => {
    let s = 0;
    const sorted = [...sleepLog].sort((a, b) => b.date.localeCompare(a.date));
    for (const entry of sorted) {
      const [h, m] = entry.time.split(":").map(Number);
      if (h < 8 || (h === 8 && m <= 30)) s++;
      else break;
    }
    return s;
  })();

  const completedP = priorities.filter((p) => p.done).length;
  const timerPct = timer.duration > 0 ? ((timer.duration - timer.remaining) / timer.duration) * 100 : 0;
  const timerMins = Math.floor(timer.remaining / 60);
  const timerSecs = timer.remaining % 60;
  const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // ─── Design tokens
  const c = {
    bg0: "#09090b", bg1: "#0f0f12", bg2: "#16161c",
    border: "rgba(255,255,255,0.06)", borderHover: "rgba(139,92,246,0.3)",
    accent: "#8b5cf6", accentLight: "#a78bfa",
    accentDim: "rgba(139,92,246,0.15)", accentGlow: "rgba(139,92,246,0.08)",
    green: "#34d399", amber: "#fbbf24", red: "#f87171",
    text1: "#fafafa", text2: "rgba(255,255,255,0.55)", text3: "rgba(255,255,255,0.25)",
  };

  const cardStyle = {
    background: `linear-gradient(135deg, ${c.bg1} 0%, ${c.bg2} 100%)`,
    borderRadius: "16px",
    border: `1px solid ${c.border}`,
    padding: "24px",
    position: "relative",
    overflow: "hidden",
    transition: "border-color 0.3s ease, box-shadow 0.3s ease",
  };

  const inputStyle = {
    flex: 1,
    background: c.bg0,
    border: `1px solid ${c.border}`,
    borderRadius: "10px",
    padding: "12px 16px",
    color: c.text1,
    fontSize: "14px",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    outline: "none",
    transition: "border-color 0.25s ease",
  };

  const btnStyle = (active) => ({
    background: active ? c.accentDim : "rgba(255,255,255,0.03)",
    border: `1px solid ${active ? c.borderHover : c.border}`,
    borderRadius: "10px",
    padding: "12px 16px",
    color: active ? c.accent : c.text3,
    fontSize: "16px",
    cursor: active ? "pointer" : "default",
    transition: "all 0.25s ease",
    lineHeight: 1,
  });

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes glow {
          0%, 100% { opacity: 0.5; }
          50%       { opacity: 1;   }
        }
        @keyframes completePulse {
          0%   { transform: scale(1);    }
          50%  { transform: scale(1.05); }
          100% { transform: scale(1);    }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,0.2) !important; }
        input[type="time"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 3px; }

        .fb-card:hover {
          border-color: rgba(139,92,246,0.2) !important;
          box-shadow: 0 0 40px rgba(139,92,246,0.04);
        }
        .priority-item:hover .del-btn { opacity: 1 !important; }
        .dump-item:hover .del-btn     { opacity: 1 !important; }
        .timer-btn:hover {
          background: rgba(139,92,246,0.2) !important;
          border-color: rgba(139,92,246,0.4) !important;
          color: #a78bfa !important;
        }
      `}</style>

      {/* ── Name prompt modal ── */}
      {loaded && !userName && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(9,9,11,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: "24px" }}>
          <div style={{ background: `linear-gradient(135deg, #0f0f12, #16161c)`, border: `1px solid rgba(139,92,246,0.2)`, borderRadius: "20px", padding: "40px", width: "100%", maxWidth: "380px", boxShadow: "0 0 80px rgba(139,92,246,0.1)", animation: "modalIn 0.4s ease forwards" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: `linear-gradient(135deg, #8b5cf6, #6d28d9)`, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "24px" }}>
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" fill="white" /><path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.8 3.8L5.2 5.2M10.8 10.8L12.2 12.2M3.8 12.2L5.2 10.8M10.8 5.2L12.2 3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" /></svg>
            </div>
            <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: "8px" }}>Welcome to FocusBase</h2>
            <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", marginBottom: "28px", lineHeight: 1.5 }}>Built for brains that work differently. What should we call you?</p>
            <input
              autoFocus
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitName()}
              placeholder="Your first name"
              style={{ width: "100%", background: "#09090b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", padding: "13px 16px", color: "#fafafa", fontSize: "15px", fontFamily: "'Plus Jakarta Sans', sans-serif", outline: "none", marginBottom: "12px", boxSizing: "border-box" }}
              onFocus={(e) => (e.target.style.borderColor = "rgba(139,92,246,0.4)")}
              onBlur={(e)  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
            <button onClick={submitName} style={{ width: "100%", padding: "13px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, #8b5cf6, #6d28d9)`, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, cursor: nameInput.trim() ? "pointer" : "default", opacity: nameInput.trim() ? 1 : 0.4, transition: "opacity 0.2s", boxShadow: "0 4px 20px rgba(139,92,246,0.25)" }}>
              Let's go
            </button>
          </div>
        </div>
      )}

      <div style={{ minHeight: "100vh", background: c.bg0, color: c.text1, fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
        {/* Ambient background blobs */}
        <div style={{ position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)", width: "800px", height: "500px", background: "radial-gradient(ellipse, rgba(139,92,246,0.06) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
        <div style={{ position: "fixed", bottom: "-100px", right: "-100px", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(139,92,246,0.03) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

        <div style={{ maxWidth: "960px", margin: "0 auto", padding: "32px 24px 80px", position: "relative", zIndex: 1, animation: "fadeIn 0.5s ease" }}>

          {/* ── Top Nav ── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "40px", padding: "0 4px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: `linear-gradient(135deg, ${c.accent}, #6d28d9)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="3" fill="white" />
                  <path d="M8 2V4M8 12V14M2 8H4M12 8H14M3.8 3.8L5.2 5.2M10.8 10.8L12.2 12.2M3.8 12.2L5.2 10.8M10.8 5.2L12.2 3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 700, letterSpacing: "-0.02em" }}>FocusBase</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: c.text3 }}>{timeStr}</span>
              <span style={{ fontSize: "13px", color: c.text2 }}>{fmtDate(now)}</span>
            </div>
          </div>

          {/* ── Header ── */}
          <div style={{ marginBottom: "12px", padding: "0 4px" }}>
            <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "clamp(32px, 5vw, 44px)", fontWeight: 800, letterSpacing: "-0.03em", lineHeight: 1.1, background: `linear-gradient(135deg, ${c.text1} 0%, rgba(255,255,255,0.6) 100%)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              {greeting()}{userName ? `, ${userName}` : ""}
            </h1>
            <p style={{ fontSize: "14px", color: c.text3, marginTop: "10px", fontStyle: "italic", letterSpacing: "0.01em" }}>
              &ldquo;{MOTD[new Date().getDate() % MOTD.length]}&rdquo;
            </p>
          </div>

          {/* ── Stats Row ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px", margin: "28px 0", animation: "slideUp 0.5s ease forwards", animationDelay: "0.1s", opacity: 0 }}>
            {[
              { label: "Priorities",     value: `${completedP}/${priorities.length || 0}`, color: completedP === priorities.length && priorities.length > 0 ? c.accent : c.text3 },
              { label: "Focus Sessions", value: focusSessions,                              color: focusSessions > 0 ? c.accent : c.text3 },
              { label: "Wake Streak",    value: `${streak}d`,                               color: streak > 0 ? c.green : c.text3 },
              { label: "Brain Dumps",    value: dumps.length,                               color: dumps.length > 0 ? c.accentLight : c.text3 },
            ].map((s, i) => (
              <div key={i} style={{ background: c.bg1, borderRadius: "12px", border: `1px solid ${c.border}`, padding: "16px", textAlign: "center" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "24px", fontWeight: 700, color: s.color, letterSpacing: "-0.02em", transition: "color 0.3s" }}>{s.value}</div>
                <div style={{ fontSize: "11px", color: c.text3, marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ── Main Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px" }}>

            {/* ── PRIORITIES ── */}
            <div className="fb-card" style={{ ...cardStyle, animation: "slideUp 0.5s ease forwards", animationDelay: "0.15s", opacity: 0 }}>
              {/* Progress bar */}
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: completedP === priorities.length && priorities.length === 3 ? `linear-gradient(90deg, ${c.accent}, #6d28d9)` : `linear-gradient(90deg, ${c.accent} ${(completedP / Math.max(priorities.length, 1)) * 100}%, transparent ${(completedP / Math.max(priorities.length, 1)) * 100}%)`, transition: "all 0.6s ease", opacity: priorities.length > 0 ? 1 : 0 }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
                <div>
                  <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>Today's Priorities</h2>
                  <p style={{ fontSize: "12px", color: c.text3, marginTop: "3px" }}>Just three. That's all you need.</p>
                </div>
                {priorities.length > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: completedP === priorities.length ? c.accent : c.text3, padding: "4px 10px", background: completedP === priorities.length ? c.accentGlow : "transparent", borderRadius: "6px", transition: "all 0.3s" }}>
                    {completedP}/{priorities.length}
                  </span>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {priorities.map((item, i) => (
                  <div key={i} className="priority-item" style={{ display: "flex", alignItems: "center", gap: "12px", padding: "13px 16px", background: item.done ? c.accentGlow : "rgba(255,255,255,0.02)", borderRadius: "10px", border: `1px solid ${item.done ? "rgba(139,92,246,0.12)" : "rgba(255,255,255,0.04)"}`, transition: "all 0.3s ease", animation: "slideUp 0.35s ease forwards", animationDelay: `${i * 60}ms` }}>
                    <button onClick={() => toggleP(i)} style={{ width: "22px", height: "22px", borderRadius: "7px", border: `2px solid ${item.done ? c.accent : "rgba(255,255,255,0.15)"}`, background: item.done ? c.accent : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", padding: 0 }}>
                      {item.done && (
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </button>
                    <span style={{ flex: 1, color: item.done ? c.text3 : c.text1, fontSize: "14px", textDecoration: item.done ? "line-through" : "none", transition: "all 0.2s", letterSpacing: "0.01em" }}>{item.text}</span>
                    <button className="del-btn" onClick={() => delP(i)} style={{ background: "transparent", border: "none", color: c.text3, cursor: "pointer", fontSize: "15px", padding: "2px 4px", opacity: 0, transition: "opacity 0.2s" }}>×</button>
                  </div>
                ))}

                {priorities.length < 3 && (
                  <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                    <input
                      value={newP}
                      onChange={(e) => setNewP(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addP()}
                      placeholder={priorities.length === 0 ? "What matters most today?" : priorities.length === 1 ? "Second priority..." : "Last one..."}
                      style={inputStyle}
                      onFocus={(e) => (e.target.style.borderColor = c.borderHover)}
                      onBlur={(e)  => (e.target.style.borderColor = c.border)}
                    />
                    <button onClick={addP} style={btnStyle(!!newP.trim())}>+</button>
                  </div>
                )}

                {completedP === 3 && priorities.length === 3 && (
                  <div style={{ textAlign: "center", padding: "14px", background: c.accentGlow, borderRadius: "10px", border: `1px solid rgba(139,92,246,0.12)`, animation: "completePulse 0.5s ease" }}>
                    <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "13px", color: c.accent, fontWeight: 600 }}>All priorities done ✓</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── FOCUS TIMER ── */}
            <div className="fb-card" style={{ ...cardStyle, animation: "slideUp 0.5s ease forwards", animationDelay: "0.2s", opacity: 0 }}>
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>Focus Timer</h2>
                <p style={{ fontSize: "12px", color: c.text3, marginTop: "3px" }}>Lock in. One block at a time.</p>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "20px" }}>
                {/* Circular progress ring */}
                <div style={{ position: "relative", width: "160px", height: "160px" }}>
                  <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
                    <circle cx="80" cy="80" r="68" fill="none" stroke={c.bg0} strokeWidth="6" />
                    <circle cx="80" cy="80" r="68" fill="none" stroke="rgba(139,92,246,0.1)" strokeWidth="6" />
                    <circle
                      cx="80" cy="80" r="68" fill="none"
                      stroke="url(#timerGrad)" strokeWidth="6" strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 68}`}
                      strokeDashoffset={`${2 * Math.PI * 68 * (1 - timerPct / 100)}`}
                      style={{ transition: "stroke-dashoffset 1s linear", filter: timerPct > 0 ? "drop-shadow(0 0 8px rgba(139,92,246,0.3))" : "none" }}
                    />
                    <defs>
                      <linearGradient id="timerGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#6d28d9" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "32px", fontWeight: 500, color: timer.running ? c.text1 : c.text2, letterSpacing: "-0.02em", transition: "color 0.3s" }}>
                      {String(timerMins).padStart(2, "0")}:{String(timerSecs).padStart(2, "0")}
                    </span>
                    {timer.running && (
                      <span style={{ fontSize: "10px", color: c.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginTop: "4px", animation: "glow 2s ease infinite" }}>focusing</span>
                    )}
                  </div>
                </div>

                {/* Duration presets */}
                <div style={{ display: "flex", gap: "8px" }}>
                  {[25, 45, 60].map((m) => (
                    <button key={m} className="timer-btn" onClick={() => timer.pick(m)} style={{ padding: "8px 16px", borderRadius: "8px", border: `1px solid ${timer.duration === m * 60 ? c.borderHover : c.border}`, background: timer.duration === m * 60 ? c.accentDim : "rgba(255,255,255,0.02)", color: timer.duration === m * 60 ? c.accent : c.text3, fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", cursor: "pointer", transition: "all 0.2s" }}>
                      {m}m
                    </button>
                  ))}
                </div>

                {/* Controls */}
                <div style={{ display: "flex", gap: "10px" }}>
                  {!timer.running ? (
                    <button onClick={timer.start} style={{ padding: "10px 32px", borderRadius: "10px", border: "none", background: `linear-gradient(135deg, ${c.accent}, #6d28d9)`, color: "#fff", fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", boxShadow: "0 4px 20px rgba(139,92,246,0.25)" }}>
                      {timer.remaining < timer.duration && timer.remaining > 0 ? "Resume" : "Start"}
                    </button>
                  ) : (
                    <button onClick={timer.pause} style={{ padding: "10px 32px", borderRadius: "10px", border: `1px solid ${c.border}`, background: c.bg0, color: c.text2, fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}>
                      Pause
                    </button>
                  )}
                  <button onClick={() => timer.reset()} style={{ padding: "10px 16px", borderRadius: "10px", border: `1px solid ${c.border}`, background: "transparent", color: c.text3, fontSize: "13px", cursor: "pointer", transition: "all 0.2s" }}>
                    Reset
                  </button>
                </div>

                {focusSessions > 0 && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: c.text3 }}>
                    {focusSessions} session{focusSessions !== 1 ? "s" : ""} completed today
                  </span>
                )}
              </div>
            </div>

            {/* ── BRAIN DUMP ── */}
            <div className="fb-card" style={{ ...cardStyle, animation: "slideUp 0.5s ease forwards", animationDelay: "0.25s", opacity: 0 }}>
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>Brain Dump</h2>
                <p style={{ fontSize: "12px", color: c.text3, marginTop: "3px" }}>Get it out of your head. Deal with it later.</p>
              </div>

              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                <input
                  value={newD}
                  onChange={(e) => setNewD(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addD()}
                  placeholder="What's on your mind?"
                  style={inputStyle}
                  onFocus={(e) => (e.target.style.borderColor = c.borderHover)}
                  onBlur={(e)  => (e.target.style.borderColor = c.border)}
                />
                <button onClick={addD} style={btnStyle(!!newD.trim())}>+</button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "220px", overflowY: "auto" }}>
                {dumps.length === 0 ? (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80px", color: c.text3, fontSize: "13px", fontStyle: "italic" }}>
                    Nothing yet — your mind is clear
                  </div>
                ) : (
                  dumps.map((item, i) => (
                    <div key={i} className="dump-item" style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 14px", background: "rgba(255,255,255,0.02)", borderRadius: "8px", border: `1px solid rgba(255,255,255,0.03)`, animation: "slideUp 0.3s ease forwards", animationDelay: `${i * 40}ms` }}>
                      <span style={{ color: "rgba(139,92,246,0.35)", fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", marginTop: "3px", flexShrink: 0 }}>{item.time}</span>
                      <span style={{ flex: 1, color: c.text2, fontSize: "13px", lineHeight: 1.5 }}>{item.text}</span>
                      <button className="del-btn" onClick={() => delD(i)} style={{ background: "transparent", border: "none", color: c.text3, cursor: "pointer", fontSize: "14px", opacity: 0, transition: "opacity 0.2s", padding: "0 2px" }}>×</button>
                    </div>
                  ))
                )}
              </div>

              {dumps.length > 0 && (
                <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: `1px solid ${c.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: c.text3 }}>{dumps.length} captured</span>
                  <button onClick={() => setDumps([])} style={{ background: "transparent", border: "none", color: c.text3, fontSize: "10px", cursor: "pointer", padding: "3px 8px", borderRadius: "5px", transition: "all 0.2s" }}>Clear all</button>
                </div>
              )}
            </div>

            {/* ── SLEEP SCORECARD ── */}
            <div className="fb-card" style={{ ...cardStyle, animation: "slideUp 0.5s ease forwards", animationDelay: "0.3s", opacity: 0 }}>
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, letterSpacing: "-0.01em" }}>Sleep Scorecard</h2>
                <p style={{ fontSize: "12px", color: c.text3, marginTop: "3px" }}>Track your wake-up. Build the streak.</p>
              </div>

              {/* Streak display */}
              <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "20px", padding: "16px", background: streak > 0 ? "rgba(52,211,153,0.06)" : "rgba(255,255,255,0.02)", borderRadius: "12px", border: `1px solid ${streak > 0 ? "rgba(52,211,153,0.12)" : c.border}`, transition: "all 0.3s" }}>
                <div style={{ fontFamily: "'Outfit', sans-serif", fontSize: "36px", fontWeight: 800, color: streak > 0 ? c.green : c.text3, letterSpacing: "-0.03em", lineHeight: 1 }}>{streak}</div>
                <div>
                  <div style={{ fontSize: "13px", color: streak > 0 ? c.green : c.text3, fontWeight: 600, transition: "color 0.3s" }}>day streak</div>
                  <div style={{ fontSize: "11px", color: c.text3, marginTop: "2px" }}>waking by 8:30 AM</div>
                </div>
              </div>

              {/* Last 7 days visualization */}
              {last7.length > 0 && (
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ fontSize: "11px", color: c.text3, marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 500 }}>
                    Last {last7.length} day{last7.length !== 1 ? "s" : ""}
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {last7.map((entry, i) => {
                      const [h, m] = entry.time.split(":").map(Number);
                      const dotColor = h < 8 || (h === 8 && m <= 30) ? c.green : h < 10 ? c.amber : c.red;
                      const hr = h % 12 || 12;
                      const label = `${hr}:${String(m).padStart(2, "0")}`;
                      return (
                        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
                          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${dotColor}15`, border: `1px solid ${dotColor}30`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: dotColor, boxShadow: `0 0 8px ${dotColor}40` }} />
                          </div>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: c.text3 }}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Log today's wake time */}
              {todayWake ? (
                <div style={{ padding: "14px", background: c.accentGlow, borderRadius: "10px", border: `1px solid rgba(139,92,246,0.1)`, textAlign: "center" }}>
                  <span style={{ fontSize: "13px", color: c.text2 }}>Logged today: </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", color: c.accent, fontWeight: 500 }}>{todayWake.time}</span>
                </div>
              ) : (
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="time"
                    value={wakeTime}
                    onChange={(e) => setWakeTime(e.target.value)}
                    style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                    onFocus={(e) => (e.target.style.borderColor = c.borderHover)}
                    onBlur={(e)  => (e.target.style.borderColor = c.border)}
                  />
                  <button onClick={logWake} style={{ ...btnStyle(!!wakeTime), padding: "12px 20px", fontSize: "13px", fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
                    Log
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* ── Footer ── */}
          <div style={{ marginTop: "48px", textAlign: "center" }}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "rgba(255,255,255,0.08)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              FocusBase v1 — built for a brain that works differently
            </span>
          </div>

        </div>
      </div>
    </>
  );
}
