"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

const T = {
  bg:       "#050d1a",
  surface:  "#0a1628",
  card:     "#0e1d35",
  border:   "#142444",
  borderHi: "#1e3460",
  text:     "#e8f0fe",
  muted:    "#4a6080",
  dim:      "#2a4060",
  accent:   "#00d4ff",
  green:    "#00e676",
  red:      "#ff4d6d",
  amber:    "#ffb300",
  purple:   "#7c6ef7",
  teal:     "#00bcd4",
};

type Trade = {
  id: string; createdTime: string; tradeName: string; stock: string;
  status: string; entryPrice: number | null; stopLoss: number | null;
  target: number | null; finalPnL: number | null; quantity: number | null;
  date: string | null; mode: string; notes: string; reason: string;
};
type Rule       = { id: string; text: string; status: string };
type Learning   = { id: string; text: string };
type Hypothesis = { id: string; text: string; status: string };
type Framework  = { rules: Rule[]; learnings: Learning[]; hypotheses: Hypothesis[]; dayCount: number };
type Review     = { title: string; date: string; summary: string };

const SC: Record<string, { color: string; bg: string; label: string }> = {
  "🟡 PENDING":  { color: T.amber,  bg: "#2a1f00", label: "PENDING"  },
  "✅ APPROVED": { color: T.green,  bg: "#001f0f", label: "APPROVED" },
  "🔵 EXECUTED": { color: T.accent, bg: "#001a2a", label: "EXECUTED" },
  "⚫ CLOSED":   { color: T.muted,  bg: T.card,    label: "CLOSED"   },
  "❌ REJECTED": { color: T.red,    bg: "#2a0010", label: "REJECTED" },
};

const ACTIONS: Record<string, { action: string; label: string; color: string }[]> = {
  "🟡 PENDING":  [
    { action: "APPROVE", label: "Approve", color: T.green  },
    { action: "REJECT",  label: "Reject",  color: T.red    },
  ],
  "✅ APPROVED": [
    { action: "EXECUTE", label: "Execute", color: T.accent },
    { action: "REJECT",  label: "Reject",  color: T.red    },
  ],
  "🔵 EXECUTED": [
    { action: "CLOSE",   label: "Close",   color: T.muted  },
  ],
};

function fmt(n: number | null) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}₹${Math.abs(n).toFixed(0)}`;
}

/* ── Badge ── */
function Badge({ status }: { status: string }) {
  const c = SC[status] || { color: T.muted, bg: T.card, label: status };
  return (
    <span style={{
      background: c.bg, color: c.color, border: `1px solid ${c.color}30`,
      borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
      padding: "2px 7px", fontFamily: "'DM Mono', monospace", whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

/* ── KPI Card ── */
function KPI({ label, value, sub, color, onClick, trend }: {
  label: string; value: string | number; sub?: string;
  color: string; onClick?: () => void; trend?: "up" | "down" | null;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov && onClick ? `${color}0d` : T.card,
        border: `1px solid ${hov && onClick ? color + "55" : T.border}`,
        borderRadius: 12, padding: "18px 20px", cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s", flex: 1, minWidth: 120,
        position: "relative", overflow: "hidden",
      }}>
      {onClick && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, ${color}00, ${color}88, ${color}00)`,
          opacity: hov ? 1 : 0, transition: "opacity 0.2s",
        }} />
      )}
      <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted,
        textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color,
          fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{value}</div>
        {trend && (
          <span style={{ fontSize: 12, color: trend === "up" ? T.green : T.red }}>
            {trend === "up" ? "↑" : "↓"}
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: T.dim,
        fontFamily: "'DM Sans', sans-serif", marginTop: 5 }}>{sub}</div>}
      {onClick && hov && (
        <div style={{ fontSize: 9, color, marginTop: 6,
          fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5 }}>
          VIEW DETAILS →
        </div>
      )}
    </div>
  );
}

/* ── Card ── */
function Card({ children, style = {}, accent }: {
  children: React.ReactNode; style?: React.CSSProperties; accent?: string;
}) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "20px 22px",
      borderTop: accent ? `2px solid ${accent}` : undefined,
      ...style,
    }}>{children}</div>
  );
}

/* ── Section Label ── */
function SLabel({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 2.5, color: color || T.muted,
      textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
      marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ width: 3, height: 14, borderRadius: 2,
        background: color || T.borderHi }} />
      {children}
    </div>
  );
}

/* ── Spinner ── */
function Spinner({ size = 14, color = T.accent }: { size?: number; color?: string }) {
  return (
    <span style={{
      width: size, height: size, border: `2px solid ${T.border}`,
      borderTopColor: color, borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

/* ── Chart Tooltip ── */
const CT = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{ background: T.surface, border: `1px solid ${T.borderHi}`,
      borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 20px #00000099" }}>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 3,
        fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: v >= 0 ? T.green : T.red,
        fontFamily: "'DM Mono', monospace" }}>{v >= 0 ? "+" : ""}₹{v}</div>
    </div>
  );
};

/* ── Trade Row ── */
function TradeRow({ trade: t, updating, onAction, mobile }: {
  trade: Trade; updating: string | null;
  onAction: (id: string, action: string, name: string) => void;
  mobile?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const actions = ACTIONS[t.status] || [];
  const busy    = updating === t.id;
  const pnl     = t.finalPnL;
  const name    = t.tradeName || t.stock || "—";
  const date    = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "";

  if (mobile) {
    return (
      <div style={{ borderBottom: `1px solid ${T.border}`,
        background: busy ? "#0a1f35" : "transparent" }}>
        <div style={{ padding: "14px 16px" }}
          onClick={() => t.notes && setExpanded(!expanded)}>
          <div style={{ display: "flex", justifyContent: "space-between",
            alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text,
                fontFamily: "'DM Sans', sans-serif", marginBottom: 5,
                lineHeight: 1.3 }}>{name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center",
                flexWrap: "wrap" }}>
                <Badge status={t.status} />
                <span style={{ fontSize: 10, color: T.dim,
                  fontFamily: "'DM Mono', monospace" }}>{date}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {pnl != null
                ? <div style={{ fontSize: 16, fontWeight: 700,
                    color: pnl >= 0 ? T.green : T.red,
                    fontFamily: "'DM Mono', monospace" }}>{fmt(pnl)}</div>
                : t.entryPrice
                  ? <div style={{ fontSize: 13, color: T.muted,
                      fontFamily: "'DM Mono', monospace" }}>₹{t.entryPrice}</div>
                  : null
              }
              {t.stopLoss && pnl == null && (
                <div style={{ fontSize: 10, color: T.dim, marginTop: 2,
                  fontFamily: "'DM Mono', monospace" }}>
                  SL {t.stopLoss} · T {t.target}
                </div>
              )}
            </div>
          </div>
          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {actions.map(({ action, label, color }) => (
                <button key={action}
                  onClick={e => { e.stopPropagation(); onAction(t.id, action, name); }}
                  disabled={busy}
                  style={{ background: `${color}12`, border: `1px solid ${color}40`,
                    color, borderRadius: 6, padding: "6px 16px", fontSize: 12,
                    fontWeight: 600, cursor: busy ? "default" : "pointer",
                    fontFamily: "'DM Sans', sans-serif", opacity: busy ? 0.5 : 1 }}>
                  {busy ? "..." : label}
                </button>
              ))}
            </div>
          )}
        </div>
        {expanded && t.notes && (
          <div style={{ padding: "0 16px 14px",
            borderTop: `1px solid ${T.border}`, paddingTop: 10 }}>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6,
              fontFamily: "'DM Sans', sans-serif" }}>{t.notes}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{
        display: "grid",
        gridTemplateColumns: "2fr 100px 90px 90px 90px 60px 90px 1fr",
        padding: "12px 20px", borderBottom: `1px solid ${T.border}`,
        alignItems: "center", gap: 8,
        background: busy ? "#0a1f35" : "transparent",
        transition: "background 0.15s", cursor: t.notes ? "pointer" : "default",
      }}
      onClick={() => t.notes && setExpanded(!expanded)}
      onMouseEnter={e => { if (!busy) e.currentTarget.style.background = T.surface; }}
      onMouseLeave={e => { if (!busy) e.currentTarget.style.background = "transparent"; }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text,
            fontFamily: "'DM Sans', sans-serif", display: "flex",
            alignItems: "center", gap: 6 }}>
            {name}
            {t.notes && <span style={{ fontSize: 9, color: T.dim }}>▾</span>}
          </div>
          <div style={{ fontSize: 10, color: T.dim,
            fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{date}</div>
        </div>
        <Badge status={t.status} />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.muted }}>
          {t.entryPrice ? `₹${t.entryPrice}` : "—"}
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: `${T.red}99` }}>
          {t.stopLoss ? `₹${t.stopLoss}` : "—"}
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: `${T.green}99` }}>
          {t.target ? `₹${t.target}` : "—"}
        </div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
          color: T.dim }}>{t.quantity ?? "—"}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700,
          color: pnl == null ? T.dim : pnl >= 0 ? T.green : T.red }}>
          {pnl == null ? "—" : fmt(pnl)}
        </div>
        <div style={{ display: "flex", gap: 6 }}
          onClick={e => e.stopPropagation()}>
          {actions.map(({ action, label, color }) => (
            <button key={action}
              onClick={() => onAction(t.id, action, name)}
              disabled={busy}
              style={{ background: `${color}12`, border: `1px solid ${color}40`,
                color, borderRadius: 5, padding: "4px 10px", fontSize: 10,
                fontWeight: 600, cursor: busy ? "default" : "pointer",
                fontFamily: "'DM Sans', sans-serif", opacity: busy ? 0.5 : 1,
                transition: "all 0.15s", whiteSpace: "nowrap", outline: "none" }}>
              {busy ? <Spinner size={10} color={color} /> : label}
            </button>
          ))}
        </div>
      </div>
      {expanded && t.notes && (
        <div style={{ padding: "12px 20px 14px",
          background: `${T.surface}88`, borderBottom: `1px solid ${T.border}` }}>
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7,
            fontFamily: "'DM Sans', sans-serif",
            borderLeft: `2px solid ${T.accent}44`, paddingLeft: 12 }}>
            {t.notes}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Hypothesis Badge ── */
function HBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color = s.includes("confirm") ? T.green
    : s.includes("strength") || s.includes("testing") || s.includes("ongoing") ? T.amber
    : s.includes("hold") ? T.muted : T.purple;
  const label = s.includes("confirm") ? "CONFIRMED"
    : s.includes("strength") ? "STRENGTHENING"
    : s.includes("testing") ? "TESTING"
    : s.includes("ongoing") ? "ONGOING"
    : s.includes("hold") ? "ON HOLD" : "ACTIVE";
  return (
    <span style={{ fontSize: 9, color, background: `${color}15`,
      border: `1px solid ${color}30`, borderRadius: 4, padding: "2px 7px",
      fontFamily: "'DM Mono', monospace", fontWeight: 700,
      letterSpacing: 1, whiteSpace: "nowrap" }}>{label}</span>
  );
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════ */
export default function Dashboard() {
  const [trades, setTrades]       = useState<Trade[]>([]);
  const [fw, setFw]               = useState<Framework | null>(null);
  const [review, setReview]       = useState<Review | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [filter, setFilter]       = useState("ALL");
  const [tab, setTab]             = useState("overview");
  const [synced, setSynced]       = useState<Date | null>(null);
  const [updating, setUpdating]   = useState<string | null>(null);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);
  const [mobile, setMobile]       = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res  = await fetch("/api/trades");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrades(data.trades || []);
      if (data.framework)    setFw(data.framework);
      if (data.latestReview) setReview(data.latestReview);
      setSynced(new Date());
    } catch { setError("Could not reach Notion. Tap refresh to retry."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, action: string, name: string) => {
    setUpdating(id);
    try {
      const res  = await fetch("/api/update-trade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ msg: `${name} → ${data.newStatus}`, ok: true });
      await load();
    } catch (e: any) {
      setToast({ msg: `Update failed: ${e.message}`, ok: false });
    }
    setUpdating(null);
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Derived Stats ── */
  const closed   = trades.filter(t => t.status === "⚫ CLOSED");
  const open     = trades.filter(t => ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));
  const wins     = closed.filter(t => (t.finalPnL ?? 0) > 0);
  const losses   = closed.filter(t => (t.finalPnL ?? 0) < 0);
  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winRate  = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin   = wins.length   ? wins.reduce((s,t)   => s + (t.finalPnL??0), 0) / wins.length   : 0;
  const avgLoss  = losses.length ? losses.reduce((s,t) => s + (t.finalPnL??0), 0) / losses.length : 0;
  const pf       = Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "—";
  const best     = closed.length ? Math.max(...closed.map(t => t.finalPnL??0)) : 0;
  const worst    = closed.length ? Math.min(...closed.map(t => t.finalPnL??0)) : 0;

  // Streak
  let streak = 0, streakType = "";
  for (const t of [...closed].reverse()) {
    const w = (t.finalPnL ?? 0) > 0;
    if (streak === 0) { streakType = w ? "W" : "L"; streak = 1; }
    else if ((w && streakType === "W") || (!w && streakType === "L")) streak++;
    else break;
  }

  // Today
  const todayIST    = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayTrades = trades.filter(t =>
    (t.date?.split("T")[0] || t.createdTime?.split("T")[0]) === todayIST);
  const todayPnL    = todayTrades.filter(t => t.status === "⚫ CLOSED")
    .reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const todayOpen   = todayTrades.filter(t =>
    ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));

  // Daily P&L chart
  const dailyMap = closed.reduce((acc: Record<string,number>, t) => {
    const d = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "?";
    acc[d] = (acc[d] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  const dailyData = Object.entries(dailyMap)
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: date.slice(5), pnl: Math.round(pnl) }));
  let cum = 0;
  const cumData = dailyData.map(d => ({
    date: d.date, pnl: (cum += d.pnl, Math.round(cum))
  }));

  // Day of week performance
  const dowMap = closed.reduce((acc: Record<string,number>, t) => {
    const d = t.date?.split("T")[0] || t.createdTime?.split("T")[0];
    if (!d) return acc;
    const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(d).getDay()];
    acc[day] = (acc[day] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  const dowData = ["Mon","Tue","Wed","Thu","Fri"]
    .map(day => ({ day, pnl: Math.round(dowMap[day] || 0) }));

  // Stock performance
  const stockMap = closed.reduce((acc: Record<string,{pnl:number;count:number;wins:number}>, t) => {
    const s = t.stock || t.tradeName?.split(" ")[0] || "?";
    if (!acc[s]) acc[s] = { pnl: 0, count: 0, wins: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].count++;
    if ((t.finalPnL ?? 0) > 0) acc[s].wins++;
    return acc;
  }, {});
  const stockData = Object.entries(stockMap)
    .map(([stock,d]) => ({ stock, pnl: Math.round(d.pnl), count: d.count,
      wr: Math.round((d.wins / d.count) * 100) }))
    .sort((a,b) => b.pnl - a.pnl).slice(0, 8);

  // Strategy
  const stratMap = closed.reduce((acc: Record<string,
    {pnl:number;wins:number;total:number}>, t) => {
    const n = t.tradeName || "";
    const s = n.includes("ORB") ? "ORB"
      : n.includes("Mean Reversion") ? "Mean Rev"
      : n.includes("Momentum") ? "Momentum"
      : n.includes("Dual Signal") ? "Dual Signal"
      : n.includes("Crisis") ? "Crisis" : "Other";
    if (!acc[s]) acc[s] = { pnl: 0, wins: 0, total: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].total++;
    if ((t.finalPnL ?? 0) > 0) acc[s].wins++;
    return acc;
  }, {});

  // Strategy radar data
  const radarData = Object.entries(stratMap).map(([name, d]) => ({
    strategy: name,
    winRate:  Math.round((d.wins / d.total) * 100),
    trades:   d.total,
    pnl:      Math.round(d.pnl),
  }));

  // Exit reason breakdown
  const exitMap = closed.reduce((acc: Record<string,number>, t) => {
    const r = (t.reason || t.notes || "").toLowerCase();
    const type = r.includes("sl") || r.includes("stop") ? "Stop Loss"
      : r.includes("target") || r.includes("2%") ? "Target Hit"
      : r.includes("3") || r.includes("deadline") || r.includes("pm") ? "3PM Exit"
      : "Other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const exitData = Object.entries(exitMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a,b) => b.count - a.count);

  // Clock
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes();
  const mktOpen = (h > 9 || (h === 9 && m >= 15)) && h < 15;
  const minsTo3 = mktOpen ? (15*60) - (h*60+m) : 0;
  const urgent  = mktOpen && minsTo3 <= 30 && open.length > 0;
  const istStr  = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const filtered = filter === "ALL" ? trades
    : trades.filter(t => t.status?.includes(filter));

  const NAV = [
    { key: "overview",     icon: "◈", label: "Overview"    },
    { key: "today",        icon: "◷", label: "Today"       },
    { key: "intelligence", icon: "🧠", label: "Intelligence" },
    { key: "charts",       icon: "◫", label: "Charts"      },
    { key: "stocks",       icon: "◉", label: "Stocks"      },
    { key: "strategy",     icon: "◐", label: "Strategy"    },
    { key: "log",          icon: "≡", label: "Trade Log"   },
  ];

  /* ── SIDEBAR ── */
  const Sidebar = () => (
    <div style={{ width: 230, background: T.surface,
      borderRight: `1px solid ${T.border}`, display: "flex",
      flexDirection: "column", height: "100vh",
      position: "sticky", top: 0, flexShrink: 0 }}>

      {/* Logo */}
      <div style={{ padding: "22px 20px 18px",
        borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.accent}22, ${T.purple}22)`,
            border: `1px solid ${T.accent}33`, display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: T.accent,
            fontFamily: "'DM Mono', monospace" }}>₹</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text,
              fontFamily: "'DM Sans', sans-serif" }}>Trading Desk</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5,
              fontFamily: "'DM Mono', monospace" }}>PAPER · NIFTY 100</div>
          </div>
        </div>
      </div>

      {/* Market clock */}
      <div style={{ padding: "12px 20px",
        borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between",
          alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%",
              background: mktOpen ? T.green : T.red,
              boxShadow: `0 0 8px ${mktOpen ? T.green : T.red}` }} />
            <span style={{ fontSize: 12, fontWeight: 700,
              color: mktOpen ? T.green : T.red,
              fontFamily: "'DM Mono', monospace" }}>
              {mktOpen ? "LIVE" : "CLOSED"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: T.muted,
            fontFamily: "'DM Mono', monospace" }}>{istStr}</span>
        </div>
        {mktOpen && (
          <div style={{ marginTop: 6, fontSize: 11,
            color: minsTo3 <= 30 ? T.red : T.amber,
            fontFamily: "'DM Mono', monospace" }}>
            {Math.floor(minsTo3/60)}h {minsTo3%60}m → 15:00 exit
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div style={{ padding: "12px 16px",
        borderBottom: `1px solid ${T.border}`,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {[
          { label: "P&L", value: fmt(totalPnL), color: totalPnL >= 0 ? T.green : T.red },
          { label: "Win %", value: `${winRate}%`, color: T.amber },
          { label: "Streak", value: streak > 0 ? `${streak}${streakType}` : "—",
            color: streakType === "W" ? T.green : streakType === "L" ? T.red : T.muted },
          { label: "Open", value: open.length, color: open.length > 0 ? T.accent : T.muted },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, borderRadius: 8,
            padding: "8px 10px", border: `1px solid ${T.border}` }}>
            <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5,
              textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif" }}>
              {s.label}
            </div>
            <div style={{ fontSize: 14, fontWeight: 700, color: s.color as string,
              fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "8px 10px", overflowY: "auto" }}>
        {NAV.map(({ key, icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", borderRadius: 8, border: "none",
            background: tab === key
              ? `linear-gradient(90deg, ${T.accent}12, transparent)` : "transparent",
            borderLeft: tab === key
              ? `2px solid ${T.accent}` : "2px solid transparent",
            color: tab === key ? T.accent : T.muted,
            cursor: "pointer", marginBottom: 2,
            fontFamily: "'DM Sans', sans-serif", fontSize: 14,
            fontWeight: tab === key ? 600 : 400,
            transition: "all 0.15s", textAlign: "left", outline: "none",
          }}>
            <span style={{ fontSize: 15 }}>{icon}</span>
            {label}
            {key === "today" && todayOpen.length > 0 && (
              <span style={{ marginLeft: "auto", background: T.amber,
                color: "#000", borderRadius: 10, fontSize: 9,
                fontWeight: 800, padding: "2px 7px" }}>
                {todayOpen.length}
              </span>
            )}
            {key === "intelligence" && fw?.rules?.length ? (
              <span style={{ marginLeft: "auto", background: `${T.purple}22`,
                color: T.purple, borderRadius: 10, fontSize: 9,
                fontWeight: 800, padding: "2px 7px",
                border: `1px solid ${T.purple}33` }}>
                {fw.rules.length}
              </span>
            ) : null}
          </button>
        ))}
      </nav>

      {/* Refresh */}
      <div style={{ padding: "12px 16px",
        borderTop: `1px solid ${T.border}` }}>
        <button onClick={load} disabled={loading} style={{
          width: "100%",
          background: loading ? T.border
            : `linear-gradient(135deg, ${T.accent}15, ${T.purple}15)`,
          border: `1px solid ${loading ? T.border : T.accent + "33"}`,
          borderRadius: 8, color: loading ? T.muted : T.accent,
          padding: "10px", fontSize: 13, fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, outline: "none",
        }}>
          {loading ? <Spinner /> : "↻"} {loading ? "Syncing…" : "Refresh"}
        </button>
        {synced && (
          <div style={{ fontSize: 9, color: T.dim, textAlign: "center",
            marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
            {synced.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </div>
        )}
      </div>
    </div>
  );

  /* ── MOBILE BOTTOM BAR ── */
  const BottomBar = () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.surface, borderTop: `1px solid ${T.border}`,
      display: "flex", zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom)" }}>
      {NAV.slice(0, 5).map(({ key, icon, label }) => (
        <button key={key} onClick={() => setTab(key)} style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "10px 4px 8px", border: "none",
          background: "transparent",
          color: tab === key ? T.accent : T.muted,
          cursor: "pointer",
          borderTop: tab === key
            ? `2px solid ${T.accent}` : "2px solid transparent",
          transition: "all 0.15s", outline: "none",
        }}>
          <span style={{ fontSize: 17 }}>{icon}</span>
          <span style={{ fontSize: 9, marginTop: 3, letterSpacing: 0.5,
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: tab === key ? 700 : 400 }}>
            {label.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );

  /* ── MOBILE HEADER ── */
  const MobileHeader = () => (
    <div style={{ background: T.surface, borderBottom: `1px solid ${T.border}`,
      padding: "14px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7,
          background: `linear-gradient(135deg, ${T.accent}22, ${T.purple}22)`,
          border: `1px solid ${T.accent}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: T.accent,
          fontFamily: "'DM Mono', monospace" }}>₹</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: T.text,
          fontFamily: "'DM Sans', sans-serif" }}>
          {NAV.find(n => n.key === tab)?.label || "Dashboard"}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%",
            background: mktOpen ? T.green : T.red,
            boxShadow: `0 0 5px ${mktOpen ? T.green : T.red}` }} />
          <span style={{ fontSize: 10, color: mktOpen ? T.green : T.red,
            fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{istStr}</span>
        </div>
        <button onClick={load} disabled={loading} style={{
          background: "transparent", border: `1px solid ${T.borderHi}`,
          borderRadius: 7, color: T.accent, padding: "6px 10px",
          fontSize: 13, cursor: "pointer", outline: "none" }}>
          {loading ? <Spinner /> : "↻"}
        </button>
      </div>
    </div>
  );

  /* ── SHARED CHART PROPS ── */
  const chartGrid = <CartesianGrid strokeDasharray="3 3"
    stroke={T.border} vertical={false} />;
  const xAxisProps = {
    tick: { fontSize: 10, fill: T.muted, fontFamily: "'DM Mono', monospace" },
    axisLine: { stroke: T.border }, tickLine: false,
  };
  const yAxisProps = {
    tick: { fontSize: 10, fill: T.muted, fontFamily: "'DM Mono', monospace" },
    axisLine: false, tickLine: false,
  };
  const tooltipProps = {
    content: <CT />,
    cursor: { fill: `${T.borderHi}33` },
  };

  /* ── CONTENT ── */
  const Content = () => (
    <div style={{ flex: 1, overflowY: "auto",
      padding: mobile ? "16px 16px 80px" : "28px 32px" }}>
      {error && (
        <div style={{ background: "#2a0010", border: `1px solid ${T.red}`,
          borderRadius: 10, padding: "11px 16px", marginBottom: 20,
          color: T.red, fontSize: 12, fontFamily: "'DM Sans', sans-serif" }}>
          ⚠ {error}
        </div>
      )}

      {/* ──────── OVERVIEW ──────── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* KPI row */}
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)",
            gap: 12 }}>
            <KPI label="Total P&L" value={fmt(totalPnL)}
              sub={`${closed.length} closed`}
              color={totalPnL >= 0 ? T.green : T.red}
              onClick={() => setTab("charts")}
              trend={totalPnL > 0 ? "up" : totalPnL < 0 ? "down" : null} />
            <KPI label="Win Rate" value={`${winRate}%`}
              sub={`${wins.length}W · ${losses.length}L`}
              color={winRate >= 55 ? T.green : winRate >= 40 ? T.amber : T.red}
              onClick={() => setTab("strategy")} />
            <KPI label="Profit Factor" value={pf}
              sub={`Avg W ₹${avgWin.toFixed(0)}`}
              color={T.purple}
              onClick={() => setTab("strategy")} />
            <KPI label="Streak"
              value={streak > 0 ? `${streak} ${streakType === "W" ? "Wins" : "Losses"}` : "—"}
              sub={streak > 0 ? `Current ${streakType === "W" ? "win" : "loss"} run` : "No data"}
              color={streakType === "W" ? T.green : streakType === "L" ? T.red : T.muted} />
            <KPI label="Open Now" value={open.length}
              sub="Need action"
              color={open.length > 0 ? T.accent : T.muted}
              onClick={() => setTab("today")} />
          </div>

          {/* Two column row */}
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>

            {/* Win/loss bar */}
            <Card accent={T.green}>
              <SLabel color={T.green}>Win / Loss</SLabel>
              <div style={{ height: 10, borderRadius: 5, overflow: "hidden",
                background: T.surface, display: "flex", marginBottom: 12 }}>
                <div style={{ width: `${winRate}%`,
                  background: `linear-gradient(90deg,${T.green},#00b050)`,
                  transition: "width 1.2s ease" }} />
                <div style={{ flex: 1,
                  background: `linear-gradient(90deg,${T.red},#c0003a)` }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                marginBottom: 16 }}>
                <span style={{ color: T.green, fontWeight: 700, fontSize: 13,
                  fontFamily: "'DM Mono', monospace" }}>
                  {wins.length} wins ({winRate}%)
                </span>
                <span style={{ color: T.red, fontWeight: 700, fontSize: 13,
                  fontFamily: "'DM Mono', monospace" }}>
                  {losses.length} losses
                </span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 8 }}>
                {[
                  ["Best", `+₹${best.toFixed(0)}`, T.green],
                  ["Worst", `₹${worst.toFixed(0)}`, T.red],
                  ["Avg Win", `+₹${avgWin.toFixed(0)}`, T.green],
                  ["Avg Loss", `₹${Math.abs(avgLoss).toFixed(0)}`, T.red],
                ].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: T.surface,
                    borderRadius: 8, padding: "8px 12px",
                    border: `1px solid ${T.border}` }}>
                    <div style={{ fontSize: 9, color: T.dim, letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Sans', sans-serif" }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700,
                      color: c as string,
                      fontFamily: "'DM Mono', monospace",
                      marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Latest review */}
            <Card accent={T.accent}>
              <SLabel color={T.accent}>Latest Session</SLabel>
              {review?.summary
                ? <>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: 1.8,
                      fontFamily: "'DM Sans', sans-serif',
                      borderLeft: `2px solid ${T.accent}44`,
                      paddingLeft: 12, marginBottom: 12 }}>
                      {review.summary.slice(0, 250)}
                      {review.summary.length > 250 ? "…" : ""}
                    </div>
                    <div style={{ fontSize: 9, color: T.dim,
                      fontFamily: "'DM Mono', monospace" }}>
                      {review.title} · {review.date}
                    </div>
                  </>
                : <div style={{ color: T.dim, fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    No session review found. Tap Refresh to load.
                  </div>
              }
            </Card>
          </div>

          {/* System rules */}
          <Card>
            <SLabel>System Parameters</SLabel>
            <div style={{ display: "grid",
              gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)",
              gap: 10 }}>
              {([
                ["₹", "Capital / Trade", "₹2,000",   T.amber],
                ["↓", "Stop Loss",       "1% below",  T.red  ],
                ["↑", "Target",          "2% above",  T.green],
                ["⏱", "Exit",           "15:00 IST", T.accent],
                ["◈", "Strategy",        "ORB + MR",  T.purple],
                ["◎", "Universe",        "Nifty 100", T.muted ],
              ] as const).map(([icon, label, val, color]) => (
                <div key={label} style={{ background: T.surface, borderRadius: 8,
                  padding: "12px 14px", border: `1px solid ${T.border}`,
                  display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6,
                    background: `${color}12`, border: `1px solid ${color}22`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, color: color as string, flexShrink: 0,
                    fontFamily: "'DM Mono', monospace" }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5,
                      textTransform: "uppercase",
                      fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700,
                      color: color as string,
                      fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ──────── TODAY ──────── */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 12 }}>
            <KPI label="Today P&L" value={fmt(todayPnL)}
              sub={`${todayTrades.filter(t => t.status === "⚫ CLOSED").length} closed`}
              color={todayPnL >= 0 ? T.green : T.red} />
            <KPI label="Needs Action" value={todayOpen.length}
              sub="Pending/Approved/Executed"
              color={todayOpen.length > 0 ? T.amber : T.muted} />
            <KPI label="Total Today" value={todayTrades.length}
              sub="All trades logged" color={T.accent} />
          </div>
          {todayTrades.length === 0
            ? <Card style={{ padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 12 }}>📭</div>
                <div style={{ color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>
                  No trades logged today yet.
                </div>
              </Card>
            : <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px",
                  borderBottom: `1px solid ${T.border}`,
                  background: T.surface }}>
                  <SLabel>Today's Trades</SLabel>
                </div>
                {todayTrades.map(t => (
                  <TradeRow key={t.id} trade={t} updating={updating}
                    onAction={updateStatus} mobile={mobile} />
                ))}
              </Card>
          }
        </div>
      )}

      {/* ──────── INTELLIGENCE ──────── */}
      {tab === "intelligence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {fw ? (
            <>
              {/* Stats */}
              <div style={{ display: "grid",
                gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
                gap: 12 }}>
                <KPI label="Trading Days" value={fw.dayCount}
                  sub="Sessions logged" color={T.accent} />
                <KPI label="Active Rules" value={fw.rules.length}
                  sub="Governing system" color={T.purple} />
                <KPI label="Learnings" value={fw.learnings.length}
                  sub="Captured insights" color={T.green} />
                <KPI label="Hypotheses" value={fw.hypotheses.length}
                  sub="Being tested" color={T.amber} />
              </div>

              {/* Active Rules */}
              {fw.rules.length > 0 && (
                <Card accent={T.purple}>
                  <SLabel color={T.purple}>Active Rules</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {fw.rules.map((r, i) => (
                      <div key={i} style={{ display: "flex", gap: 12,
                        padding: "10px 14px", background: T.surface,
                        borderRadius: 8, border: `1px solid ${T.border}`,
                        alignItems: "flex-start" }}>
                        <span style={{ fontSize: 10, fontWeight: 800,
                          color: T.purple, fontFamily: "'DM Mono', monospace",
                          minWidth: 28, paddingTop: 1, flexShrink: 0 }}>{r.id}</span>
                        <span style={{ fontSize: 12, color: T.text, flex: 1,
                          fontFamily: "'DM Sans', sans-serif",
                          lineHeight: 1.6 }}>{r.text}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Learnings */}
              {fw.learnings.length > 0 && (
                <Card accent={T.green}>
                  <SLabel color={T.green}>Recent Learnings</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {[...fw.learnings].reverse().map((l, i) => (
                      <div key={i} style={{ display: "flex", gap: 12,
                        padding: "10px 14px", background: T.surface,
                        borderRadius: 8, border: `1px solid ${T.border}`,
                        alignItems: "flex-start" }}>
                        <span style={{ fontSize: 10, fontWeight: 800,
                          color: T.green, fontFamily: "'DM Mono', monospace",
                          minWidth: 28, paddingTop: 1, flexShrink: 0 }}>{l.id}</span>
                        <span style={{ fontSize: 12, color: T.text, flex: 1,
                          fontFamily: "'DM Sans', sans-serif",
                          lineHeight: 1.6 }}>{l.text}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {/* Hypotheses */}
              {fw.hypotheses.length > 0 && (
                <Card accent={T.amber}>
                  <SLabel color={T.amber}>Hypothesis Tracker</SLabel>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {fw.hypotheses.map((h, i) => (
                      <div key={i} style={{ display: "flex", gap: 12,
                        padding: "12px 14px", background: T.surface,
                        borderRadius: 8, border: `1px solid ${T.border}`,
                        alignItems: "flex-start" }}>
                        <span style={{ fontSize: 10, fontWeight: 800,
                          color: T.amber, fontFamily: "'DM Mono', monospace",
                          minWidth: 28, paddingTop: 2, flexShrink: 0 }}>{h.id}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, color: T.text,
                            fontFamily: "'DM Sans', sans-serif",
                            lineHeight: 1.6, marginBottom: 6 }}>{h.text}</div>
                          <HBadge status={h.status} />
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {fw.rules.length === 0 && fw.learnings.length === 0 && (
                <Card style={{ padding: 48, textAlign: "center" }}>
                  <div style={{ fontSize: 24, marginBottom: 12 }}>🔄</div>
                  <div style={{ color: T.dim, fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    Parsing framework data… tap Refresh to reload.
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card style={{ padding: 48, textAlign: "center" }}>
              {loading
                ? <Spinner size={24} />
                : <div style={{ color: T.dim, fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    No intelligence data. Tap Refresh.
                  </div>
              }
            </Card>
          )}
        </div>
      )}

      {/* ──────── CHARTS ──────── */}
      {tab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Daily P&L */}
          <Card>
            <SLabel color={T.accent}>Daily P&L</SLabel>
            {dailyData.length === 0
              ? <div style={{ padding: "32px 0", textAlign: "center",
                  color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>No data yet</div>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    {chartGrid}
                    <XAxis dataKey="date" {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="pnl" radius={[3,3,0,0]}>
                      {dailyData.map((e,i) => (
                        <Cell key={i} fill={e.pnl >= 0 ? T.green : T.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </Card>

          {/* Cumulative P&L */}
          <Card>
            <SLabel color={T.purple}>Cumulative P&L</SLabel>
            {cumData.length === 0
              ? <div style={{ padding: "32px 0", textAlign: "center",
                  color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>No data yet</div>
              : <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={cumData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                    {chartGrid}
                    <XAxis dataKey="date" {...xAxisProps} />
                    <YAxis {...yAxisProps} />
                    <Tooltip content={<CT />}
                      cursor={{ stroke: T.borderHi, strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="pnl"
                      stroke={T.purple} strokeWidth={2}
                      dot={{ fill: T.purple, r: 3, strokeWidth: 0 }}
                      activeDot={{ r: 5, fill: T.purple,
                        stroke: T.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </Card>

          {/* Day of week */}
          <Card>
            <SLabel color={T.amber}>P&L by Day of Week</SLabel>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={dowData}
                margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                {chartGrid}
                <XAxis dataKey="day" {...xAxisProps} />
                <YAxis {...yAxisProps} />
                <Tooltip {...tooltipProps} />
                <Bar dataKey="pnl" radius={[3,3,0,0]}>
                  {dowData.map((e,i) => (
                    <Cell key={i} fill={e.pnl >= 0 ? T.green : e.pnl < 0 ? T.red : T.dim} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Exit reason */}
          {exitData.length > 0 && (
            <Card>
              <SLabel color={T.teal}>Exit Reason Breakdown</SLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {exitData.map(({ type, count }) => {
                  const pct = Math.round((count / closed.length) * 100);
                  const color = type === "Target Hit" ? T.green
                    : type === "Stop Loss" ? T.red : T.amber;
                  return (
                    <div key={type}>
                      <div style={{ display: "flex", justifyContent: "space-between",
                        marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: T.text,
                          fontFamily: "'DM Sans', sans-serif" }}>{type}</span>
                        <span style={{ fontSize: 12, color, fontWeight: 700,
                          fontFamily: "'DM Mono', monospace" }}>
                          {count} ({pct}%)
                        </span>
                      </div>
                      <div style={{ height: 6, borderRadius: 3,
                        background: T.surface, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%",
                          background: color, borderRadius: 3,
                          transition: "width 0.8s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ──────── STOCKS ──────── */}
      {tab === "stocks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card>
            <SLabel color={T.accent}>P&L by Stock</SLabel>
            {stockData.length === 0
              ? <div style={{ padding: "32px 0", textAlign: "center",
                  color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>No data yet</div>
              : <ResponsiveContainer width="100%" height={Math.max(200, stockData.length * 36)}>
                  <BarChart data={stockData} layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3"
                      stroke={T.border} horizontal={false} />
                    <XAxis type="number" {...xAxisProps} />
                    <YAxis dataKey="stock" type="category" width={80}
                      tick={{ fontSize: 10, fill: T.text,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={false} tickLine={false} />
                    <Tooltip {...tooltipProps} />
                    <Bar dataKey="pnl" radius={[0,3,3,0]}>
                      {stockData.map((e,i) => (
                        <Cell key={i} fill={e.pnl >= 0 ? T.green : T.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </Card>

          {/* Stock detail table */}
          {stockData.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "14px 20px",
                borderBottom: `1px solid ${T.border}`,
                background: T.surface }}>
                <SLabel>Stock Details</SLabel>
              </div>
              <div style={{ display: "grid",
                gridTemplateColumns: "1fr 60px 60px 80px",
                padding: "8px 20px",
                fontSize: 9, letterSpacing: 1.5, color: T.dim,
                textTransform: "uppercase",
                fontFamily: "'DM Mono', monospace", fontWeight: 700,
                borderBottom: `1px solid ${T.border}`,
                background: T.surface }}>
                <div>Stock</div>
                <div>Trades</div>
                <div>Win %</div>
                <div>P&L</div>
              </div>
              {stockData.map(s => (
                <div key={s.stock} style={{ display: "grid",
                  gridTemplateColumns: "1fr 60px 60px 80px",
                  padding: "12px 20px",
                  borderBottom: `1px solid ${T.border}`,
                  alignItems: "center" }}>
                  <span style={{ fontWeight: 600, fontSize: 13,
                    color: T.text,
                    fontFamily: "'DM Mono', monospace" }}>{s.stock}</span>
                  <span style={{ fontSize: 12, color: T.muted,
                    fontFamily: "'DM Mono', monospace" }}>{s.count}</span>
                  <span style={{ fontSize: 12, fontWeight: 700,
                    color: s.wr >= 55 ? T.green : s.wr >= 40 ? T.amber : T.red,
                    fontFamily: "'DM Mono', monospace" }}>{s.wr}%</span>
                  <span style={{ fontFamily: "'DM Mono', monospace",
                    fontWeight: 700, fontSize: 13,
                    color: s.pnl >= 0 ? T.green : T.red }}>
                    {s.pnl >= 0 ? "+" : ""}₹{s.pnl}
                  </span>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* ──────── STRATEGY ──────── */}
      {tab === "strategy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Strategy P&L chart */}
          {Object.keys(stratMap).length > 0 && (
            <Card>
              <SLabel color={T.purple}>Strategy P&L Comparison</SLabel>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={Object.entries(stratMap).map(([name, d]) => ({
                    name, pnl: Math.round(d.pnl),
                    wr: Math.round((d.wins/d.total)*100),
                  }))}
                  margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  {chartGrid}
                  <XAxis dataKey="name" {...xAxisProps} />
                  <YAxis {...yAxisProps} />
                  <Tooltip {...tooltipProps} />
                  <Bar dataKey="pnl" radius={[3,3,0,0]}>
                    {Object.entries(stratMap).map(([,d], i) => (
                      <Cell key={i}
                        fill={d.pnl >= 0 ? T.green : T.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Strategy radar */}
          {radarData.length > 1 && (
            <Card>
              <SLabel color={T.teal}>Win Rate by Strategy</SLabel>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="strategy"
                    tick={{ fontSize: 10, fill: T.muted,
                      fontFamily: "'DM Mono', monospace" }} />
                  <Radar dataKey="winRate" stroke={T.teal}
                    fill={T.teal} fillOpacity={0.15}
                    strokeWidth={2} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Strategy cards */}
          {Object.entries(stratMap)
            .sort(([,a],[,b]) => b.pnl - a.pnl)
            .map(([name, data]) => {
              const wr = Math.round((data.wins / data.total) * 100);
              return (
                <Card key={name} accent={data.pnl >= 0 ? T.green : T.red}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    alignItems: "flex-start", marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15,
                        color: T.text, fontFamily: "'DM Sans', sans-serif" }}>
                        {name}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 3,
                        fontFamily: "'DM Mono', monospace" }}>
                        {data.total} trades · {data.wins}W · {data.total - data.wins}L
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'DM Mono', monospace",
                        fontSize: 20, fontWeight: 900,
                        color: data.pnl >= 0 ? T.green : T.red }}>
                        {data.pnl >= 0 ? "+" : ""}₹{data.pnl.toFixed(0)}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted,
                        fontFamily: "'DM Mono', monospace', marginTop: 2 }}>
                        {wr}% win rate
                      </div>
                    </div>
                  </div>
                  <div style={{ height: 6, borderRadius: 3,
                    overflow: "hidden", background: T.surface, display: "flex" }}>
                    <div style={{ width: `${wr}%`,
                      background: `linear-gradient(90deg,${T.green},#00b050)` }} />
                    <div style={{ flex: 1,
                      background: `linear-gradient(90deg,${T.red},#c0003a)` }} />
                  </div>
                </Card>
              );
            })
          }

          {Object.keys(stratMap).length === 0 && (
            <Card style={{ padding: 48, textAlign: "center" }}>
              <div style={{ color: T.dim, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif" }}>
                No closed trades yet.
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ──────── TRADE LOG ──────── */}
      {tab === "log" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16,
            flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.muted, marginRight: 4,
              letterSpacing: 1.5, textTransform: "uppercase",
              fontFamily: "'DM Sans', sans-serif" }}>Filter</span>
            {["ALL","PENDING","APPROVED","EXECUTED","CLOSED","REJECTED"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? `${T.accent}15` : "transparent",
                border: filter === f
                  ? `1px solid ${T.accent}55` : `1px solid ${T.border}`,
                color: filter === f ? T.accent : T.muted,
                borderRadius: 6, padding: "5px 12px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
                fontFamily: "'DM Mono', monospace",
                transition: "all 0.15s", outline: "none" }}>{f}</button>
            ))}
            {synced && !mobile && (
              <span style={{ marginLeft: "auto", fontSize: 9,
                color: T.dim, fontFamily: "'DM Mono', monospace" }}>
                Synced {synced.toLocaleTimeString("en-IN",
                  { timeZone: "Asia/Kolkata" })} IST
              </span>
            )}
          </div>

          <Card style={{ padding: 0, overflow: "hidden" }}>
            {!mobile && (
              <div style={{ display: "grid",
                gridTemplateColumns:
                  "2fr 100px 90px 90px 90px 60px 90px 1fr",
                padding: "9px 20px", gap: 8,
                fontSize: 9, letterSpacing: 1.5, color: T.dim,
                textTransform: "uppercase",
                fontFamily: "'DM Mono', monospace", fontWeight: 700,
                borderBottom: `1px solid ${T.border}`,
                background: T.surface }}>
                <div>Trade</div><div>Status</div><div>Entry</div>
                <div>SL</div><div>Target</div><div>Qty</div>
                <div>P&L</div><div>Actions</div>
              </div>
            )}
            {loading
              ? <div style={{ padding: 48, textAlign: "center" }}>
                  <Spinner size={24} />
                  <div style={{ color: T.dim, marginTop: 14, fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    Fetching from Notion…
                  </div>
                </div>
              : filtered.length === 0
                ? <div style={{ padding: 48, textAlign: "center" }}>
                    <div style={{ fontSize: 24, marginBottom: 12 }}>📭</div>
                    <div style={{ color: T.dim, fontSize: 13,
                      fontFamily: "'DM Sans', sans-serif" }}>
                      No trades{filter !== "ALL" ? ` matching "${filter}"` : ""}.
                    </div>
                  </div>
                : filtered.map(t => (
                    <TradeRow key={t.id} trade={t} updating={updating}
                      onAction={updateStatus} mobile={mobile} />
                  ))
            }
            {filtered.length > 0 && closed.length > 0 && (
              <div style={{ padding: "12px 20px", background: T.surface,
                borderTop: `1px solid ${T.border}`,
                display: "flex", justifyContent: "space-between",
                alignItems: "center" }}>
                <span style={{ fontSize: 10, color: T.muted,
                  fontFamily: "'DM Mono', monospace", letterSpacing: 1 }}>
                  TOTAL · {closed.length} CLOSED TRADES
                </span>
                <span style={{ fontFamily: "'DM Mono', monospace",
                  fontSize: 15, fontWeight: 900,
                  color: totalPnL >= 0 ? T.green : T.red }}>
                  {fmt(totalPnL)}
                </span>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );

  /* ── ROOT ── */
  return (
    <div style={{ background: T.bg, minHeight: "100vh", color: T.text }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin    { to { transform: rotate(360deg) } }
        @keyframes flash   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        button:focus, button:focus-visible { outline: none !important; box-shadow: none !important; }
        .recharts-wrapper  { background: transparent !important; }
        .recharts-surface  { background: transparent !important; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.borderHi}; border-radius: 2px; }
        html, body { margin: 0; padding: 0; background: ${T.bg}; }
      `}</style>

      {urgent && (
        <div style={{ background: "#3a0010",
          borderBottom: `1px solid ${T.red}`,
          padding: "9px 20px", textAlign: "center",
          fontSize: 12, fontWeight: 700, color: "#ff8099",
          animation: "flash 1.2s ease-in-out infinite",
          fontFamily: "'DM Mono', monospace", letterSpacing: 0.5,
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100 }}>
          ⚠ {open.length} OPEN POSITION{open.length > 1 ? "S" : ""} · {Math.floor(minsTo3/60)}H {minsTo3%60}M TO 15:00 EXIT
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed",
          bottom: mobile ? 80 : 24, right: 20, zIndex: 99,
          background: toast.ok ? "#001f0f" : "#2a0010",
          border: `1px solid ${toast.ok ? T.green : T.red}`,
          borderRadius: 10, padding: "11px 18px",
          fontSize: 12, fontWeight: 600,
          color: toast.ok ? T.green : T.red,
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 4px 24px #00000099",
          animation: "slideUp 0.2s ease" }}>
          {toast.ok ? "✓ " : "⚠ "}{toast.msg}
        </div>
      )}

      {mobile ? (
        <>
          <MobileHeader />
          <Content />
          <BottomBar />
        </>
      ) : (
        <div style={{ display: "flex", height: "100vh", overflow: "hidden",
          marginTop: urgent ? 38 : 0 }}>
          <Sidebar />
          <main style={{ flex: 1, overflowY: "auto" }}>
            <Content />
          </main>
        </div>
      )}
    </div>
