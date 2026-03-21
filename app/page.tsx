"use client";
import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

/* ─────────────────────────────────────────
   DESIGN TOKENS
───────────────────────────────────────── */
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
};

/* ─────────────────────────────────────────
   TYPES
───────────────────────────────────────── */
type Trade = {
  id: string; createdTime: string; tradeName: string; stock: string;
  status: string; entryPrice: number | null; stopLoss: number | null;
  target: number | null; finalPnL: number | null; quantity: number | null;
  date: string | null; mode: string;
};

type Rule = { id: string; text: string; status: string };
type Learning = { id: string; text: string };
type Hypothesis = { id: string; text: string; status: string };

type Framework = {
  rules: Rule[];
  learnings: Learning[];
  hypotheses: Hypothesis[];
  cumPnL: number;
  dayCount: number;
};

type LatestReview = { title: string; date: string; summary: string };

/* ─────────────────────────────────────────
   STATUS CONFIG
───────────────────────────────────────── */
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

/* ─────────────────────────────────────────
   HELPERS
───────────────────────────────────────── */
function fmt(n: number | null) {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}₹${Math.abs(n).toFixed(0)}`;
}

/* ─────────────────────────────────────────
   MICRO COMPONENTS
───────────────────────────────────────── */
function Badge({ status }: { status: string }) {
  const c = SC[status] || { color: T.muted, bg: T.card, label: status };
  return (
    <span style={{
      background: c.bg, color: c.color,
      border: `1px solid ${c.color}30`,
      borderRadius: 4, fontSize: 9, fontWeight: 700,
      letterSpacing: 1.5, padding: "2px 7px",
      fontFamily: "'DM Mono', monospace",
      whiteSpace: "nowrap",
    }}>{c.label}</span>
  );
}

function KPI({ label, value, sub, color, onClick }: {
  label: string; value: string | number; sub?: string;
  color: string; onClick?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered && onClick ? `${color}0d` : T.card,
        border: `1px solid ${hovered && onClick ? color + "44" : T.border}`,
        borderRadius: 12, padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s",
        flex: 1, minWidth: 130,
      }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: T.muted,
        textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
        marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color,
        fontFamily: "'DM Mono', monospace", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.dim,
        fontFamily: "'DM Sans', sans-serif", marginTop: 5 }}>{sub}</div>}
      {onClick && <div style={{ fontSize: 9, color: color, marginTop: 6,
        opacity: hovered ? 1 : 0, transition: "opacity 0.15s",
        fontFamily: "'DM Sans', sans-serif", letterSpacing: 0.5 }}>
        TAP TO VIEW →
      </div>}
    </div>
  );
}

function Card({ children, style = {} }: {
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      background: T.card, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: "20px 22px", ...style,
    }}>{children}</div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 2.5, color: T.muted,
      textTransform: "uppercase", fontFamily: "'DM Sans', sans-serif",
      marginBottom: 16, display: "flex", alignItems: "center", gap: 8,
    }}>
      <div style={{ width: 16, height: 1, background: T.borderHi }} />
      {children}
      <div style={{ flex: 1, height: 1, background: T.border }} />
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      width: 14, height: 14,
      border: `2px solid ${T.border}`,
      borderTopColor: T.accent,
      borderRadius: "50%",
      display: "inline-block",
      animation: "spin 0.7s linear infinite",
    }} />
  );
}

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  return (
    <div style={{
      background: T.surface, border: `1px solid ${T.borderHi}`,
      borderRadius: 8, padding: "8px 12px",
      boxShadow: "0 4px 16px #00000088",
    }}>
      <div style={{ fontSize: 10, color: T.muted, marginBottom: 3,
        fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700,
        color: v >= 0 ? T.green : T.red,
        fontFamily: "'DM Mono', monospace" }}>
        {v >= 0 ? "+" : ""}₹{v}
      </div>
    </div>
  );
};

/* ─────────────────────────────────────────
   TRADE ROW
───────────────────────────────────────── */
function TradeRow({ trade: t, updating, onAction, mobile }: {
  trade: Trade; updating: string | null;
  onAction: (id: string, action: string, name: string) => void;
  mobile?: boolean;
}) {
  const actions = ACTIONS[t.status] || [];
  const busy = updating === t.id;
  const pnl = t.finalPnL;
  const name = t.tradeName || t.stock || "—";
  const date = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "";

  if (mobile) {
    return (
      <div style={{
        padding: "14px 16px",
        borderBottom: `1px solid ${T.border}`,
        background: busy ? "#0a1f35" : "transparent",
      }}>
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
          <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
            {actions.map(({ action, label, color }) => (
              <button key={action}
                onClick={() => onAction(t.id, action, name)}
                disabled={busy}
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}40`,
                  color, borderRadius: 6, padding: "6px 16px",
                  fontSize: 12, fontWeight: 600,
                  cursor: busy ? "default" : "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: busy ? 0.5 : 1, transition: "all 0.15s",
                }}>
                {busy ? "..." : label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "2fr 100px 90px 90px 90px 70px 90px 180px",
      padding: "12px 20px", borderBottom: `1px solid ${T.border}`,
      alignItems: "center", gap: 8,
      background: busy ? "#0a1f35" : "transparent",
      transition: "background 0.15s",
    }}
    onMouseEnter={e => { if (!busy) e.currentTarget.style.background = T.surface; }}
    onMouseLeave={e => { if (!busy) e.currentTarget.style.background = "transparent"; }}
    >
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text,
          fontFamily: "'DM Sans', sans-serif" }}>{name}</div>
        <div style={{ fontSize: 10, color: T.dim,
          fontFamily: "'DM Mono', monospace", marginTop: 2 }}>{date}</div>
      </div>
      <Badge status={t.status} />
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: T.muted }}>
        {t.entryPrice ? `₹${t.entryPrice}` : "—"}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
        color: `${T.red}88` }}>
        {t.stopLoss ? `₹${t.stopLoss}` : "—"}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
        color: `${T.green}88` }}>
        {t.target ? `₹${t.target}` : "—"}
      </div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12,
        color: T.dim }}>{t.quantity ?? "—"}</div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 14,
        fontWeight: 700,
        color: pnl == null ? T.dim : pnl >= 0 ? T.green : T.red }}>
        {pnl == null ? "—" : fmt(pnl)}
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {actions.map(({ action, label, color }) => (
          <button key={action}
            onClick={() => onAction(t.id, action, name)}
            disabled={busy}
            style={{
              background: `${color}12`,
              border: `1px solid ${color}40`,
              color, borderRadius: 5, padding: "5px 12px",
              fontSize: 11, fontWeight: 600,
              cursor: busy ? "default" : "pointer",
              fontFamily: "'DM Sans', sans-serif",
              opacity: busy ? 0.5 : 1, transition: "all 0.15s",
              whiteSpace: "nowrap",
            }}>
            {busy ? <Spinner /> : label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   HYPOTHESIS STATUS BADGE
───────────────────────────────────────── */
function HypoBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const color = s.includes("confirmed") ? T.green
    : s.includes("strengthening") || s.includes("testing") ? T.amber
    : s.includes("hold") ? T.muted : T.accent;
  return (
    <span style={{ fontSize: 9, color, background: `${color}15`,
      border: `1px solid ${color}30`, borderRadius: 4,
      padding: "2px 7px", fontFamily: "'DM Mono', monospace",
      fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>
      {status.replace(/[✅🟡⏸️🔥🧪]/g, "").trim().toUpperCase().slice(0, 20)}
    </span>
  );
}

/* ─────────────────────────────────────────
   MAIN DASHBOARD
───────────────────────────────────────── */
export default function Dashboard() {
  const [trades, setTrades]         = useState<Trade[]>([]);
  const [framework, setFramework]   = useState<Framework | null>(null);
  const [latestReview, setReview]   = useState<LatestReview | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [filter, setFilter]         = useState("ALL");
  const [tab, setTab]               = useState("overview");
  const [synced, setSynced]         = useState<Date | null>(null);
  const [updating, setUpdating]     = useState<string | null>(null);
  const [toast, setToast]           = useState<{ msg: string; ok: boolean } | null>(null);
  const [mobile, setMobile]         = useState(false);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrades(data.trades || []);
      if (data.framework) setFramework(data.framework);
      if (data.latestReview) setReview(data.latestReview);
      setSynced(new Date());
    } catch { setError("Could not reach Notion. Tap refresh to retry."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, action: string, name: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/update-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

  // ── Derived stats ──
  const closed   = trades.filter(t => t.status === "⚫ CLOSED");
  const open     = trades.filter(t =>
    ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));
  const wins     = closed.filter(t => (t.finalPnL ?? 0) > 0);
  const losses   = closed.filter(t => (t.finalPnL ?? 0) < 0);
  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winRate  = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin   = wins.length
    ? wins.reduce((s,t) => s + (t.finalPnL??0), 0) / wins.length : 0;
  const avgLoss  = losses.length
    ? losses.reduce((s,t) => s + (t.finalPnL??0), 0) / losses.length : 0;
  const pf = Math.abs(avgLoss) > 0
    ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "—";
  const best  = closed.length ? Math.max(...closed.map(t => t.finalPnL??0)) : 0;
  const worst = closed.length ? Math.min(...closed.map(t => t.finalPnL??0)) : 0;

  // Today
  const todayIST = new Date().toLocaleDateString("en-CA",
    { timeZone: "Asia/Kolkata" });
  const todayTrades = trades.filter(t =>
    (t.date?.split("T")[0] || t.createdTime?.split("T")[0]) === todayIST);
  const todayPnL = todayTrades.filter(t => t.status === "⚫ CLOSED")
    .reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const todayOpen = todayTrades.filter(t =>
    ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));

  // Charts
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

  const stockMap = closed.reduce((acc: Record<string,{pnl:number;count:number}>, t) => {
    const s = t.stock || t.tradeName?.split(" ")[0] || "?";
    if (!acc[s]) acc[s] = { pnl: 0, count: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].count++;
    return acc;
  }, {});
  const stockData = Object.entries(stockMap)
    .map(([stock,{pnl,count}]) => ({ stock, pnl: Math.round(pnl), count }))
    .sort((a,b) => b.pnl - a.pnl).slice(0, 8);

  const stratMap = closed.reduce((acc: Record<string,
    {pnl:number;wins:number;total:number}>, t) => {
    const n = t.tradeName || "";
    const s = n.includes("ORB") ? "ORB"
      : n.includes("Mean Reversion") ? "Mean Reversion"
      : n.includes("Momentum") ? "Momentum"
      : n.includes("Dual Signal") ? "Dual Signal"
      : n.includes("Crisis") ? "Crisis Play" : "Other";
    if (!acc[s]) acc[s] = { pnl: 0, wins: 0, total: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].total++;
    if ((t.finalPnL ?? 0) > 0) acc[s].wins++;
    return acc;
  }, {});

  // Clock
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes();
  const mktOpen = (h > 9 || (h === 9 && m >= 15)) && h < 15;
  const minsTo3 = mktOpen ? (15*60) - (h*60+m) : 0;
  const urgent  = mktOpen && minsTo3 <= 30 && open.length > 0;
  const istStr  = ist.toLocaleTimeString("en-IN",
    { hour: "2-digit", minute: "2-digit" });

  const filtered = filter === "ALL" ? trades
    : trades.filter(t => t.status?.includes(filter));

  // ── Nav ──
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
    <div style={{
      width: 230, background: T.surface,
      borderRight: `1px solid ${T.border}`,
      display: "flex", flexDirection: "column",
      height: "100vh", position: "sticky", top: 0, flexShrink: 0,
    }}>
      <div style={{ padding: "24px 20px 20px",
        borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: `linear-gradient(135deg, ${T.accent}22, ${T.purple}22)`,
            border: `1px solid ${T.accent}33`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 900, color: T.accent,
            fontFamily: "'DM Mono', monospace",
          }}>₹</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text,
              fontFamily: "'DM Sans', sans-serif" }}>Trading Desk</div>
            <div style={{ fontSize: 9, color: T.muted, letterSpacing: 1.5,
              fontFamily: "'DM Mono', monospace" }}>PAPER · NIFTY 100</div>
          </div>
        </div>
      </div>

      <div style={{ padding: "14px 20px",
        borderBottom: `1px solid ${T.border}` }}>
        <div style={{ display: "flex", alignItems: "center",
          justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{
              width: 7, height: 7, borderRadius: "50%",
              background: mktOpen ? T.green : T.red,
              boxShadow: `0 0 7px ${mktOpen ? T.green : T.red}`,
            }} />
            <span style={{ fontSize: 12, fontWeight: 700,
              color: mktOpen ? T.green : T.red,
              fontFamily: "'DM Mono', monospace" }}>
              {mktOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>
          <span style={{ fontSize: 11, color: T.muted,
            fontFamily: "'DM Mono', monospace" }}>{istStr}</span>
        </div>
        {mktOpen && (
          <div style={{ marginTop: 7, fontSize: 11,
            color: minsTo3 <= 30 ? T.red : T.amber,
            fontFamily: "'DM Mono', monospace" }}>
            {Math.floor(minsTo3/60)}h {minsTo3%60}m → 15:00 exit
          </div>
        )}
      </div>

      <nav style={{ flex: 1, padding: "10px 10px", overflowY: "auto" }}>
        {NAV.map(({ key, icon, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "11px 14px", borderRadius: 8, border: "none",
            background: tab === key
              ? `linear-gradient(90deg, ${T.accent}12, transparent)`
              : "transparent",
            borderLeft: tab === key
              ? `2px solid ${T.accent}` : "2px solid transparent",
            color: tab === key ? T.accent : T.muted,
            cursor: "pointer", marginBottom: 2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14, fontWeight: tab === key ? 600 : 400,
            transition: "all 0.15s", textAlign: "left",
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
            {key === "intelligence" && framework?.rules?.length && (
              <span style={{ marginLeft: "auto", background: `${T.purple}33`,
                color: T.purple, borderRadius: 10, fontSize: 9,
                fontWeight: 800, padding: "2px 7px",
                border: `1px solid ${T.purple}44` }}>
                {framework.rules.length}R
              </span>
            )}
          </button>
        ))}
      </nav>

      <div style={{ padding: "14px 16px",
        borderTop: `1px solid ${T.border}` }}>
        <button onClick={load} disabled={loading} style={{
          width: "100%",
          background: loading ? T.border
            : `linear-gradient(135deg, ${T.accent}18, ${T.purple}18)`,
          border: `1px solid ${loading ? T.border : T.accent + "33"}`,
          borderRadius: 8, color: loading ? T.muted : T.accent,
          padding: "10px", fontSize: 13, fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          fontFamily: "'DM Sans', sans-serif",
          display: "flex", alignItems: "center",
          justifyContent: "center", gap: 8, transition: "all 0.2s",
        }}>
          {loading ? <Spinner /> : "↻"} {loading ? "Syncing…" : "Refresh"}
        </button>
        {synced && (
          <div style={{ fontSize: 9, color: T.dim, textAlign: "center",
            marginTop: 6, fontFamily: "'DM Mono', monospace" }}>
            {synced.toLocaleTimeString("en-IN",
              { timeZone: "Asia/Kolkata" })} IST
          </div>
        )}
      </div>
    </div>
  );

  /* ── MOBILE BOTTOM BAR ── */
  const BottomBar = () => (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0,
      background: T.surface, borderTop: `1px solid ${T.border}`,
      display: "flex", zIndex: 20,
      paddingBottom: "env(safe-area-inset-bottom)",
    }}>
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
          transition: "all 0.15s",
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
    <div style={{
      background: T.surface, borderBottom: `1px solid ${T.border}`,
      padding: "14px 16px", display: "flex", alignItems: "center",
      justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7,
          background: `linear-gradient(135deg, ${T.accent}22, ${T.purple}22)`,
          border: `1px solid ${T.accent}33`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 900, color: T.accent,
          fontFamily: "'DM Mono', monospace",
        }}>₹</div>
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
            fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>
            {istStr}
          </span>
        </div>
        <button onClick={load} disabled={loading} style={{
          background: "transparent", border: `1px solid ${T.borderHi}`,
          borderRadius: 7, color: T.accent, padding: "6px 10px",
          fontSize: 13, cursor: "pointer", outline: "none",
        }}>
          {loading ? <Spinner /> : "↻"}
        </button>
      </div>
    </div>
  );

  /* ── CONTENT ── */
  const Content = () => (
    <div style={{
      flex: 1, overflowY: "auto",
      padding: mobile ? "16px 16px 80px" : "28px 32px",
    }}>
      {error && (
        <div style={{ background: "#2a0010",
          border: `1px solid ${T.red}`, borderRadius: 10,
          padding: "11px 16px", marginBottom: 20,
          color: T.red, fontSize: 12,
          fontFamily: "'DM Sans', sans-serif" }}>⚠ {error}</div>
      )}

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)",
            gap: 12 }}>
            <KPI label="Total P&L" value={fmt(totalPnL)}
              sub={`${closed.length} closed`}
              color={totalPnL >= 0 ? T.green : T.red}
              onClick={() => setTab("charts")} />
            <KPI label="Win Rate" value={`${winRate}%`}
              sub={`${wins.length}W · ${losses.length}L`}
              color={T.amber}
              onClick={() => setTab("strategy")} />
            <KPI label="Profit Factor" value={pf}
              sub={`Avg W ₹${avgWin.toFixed(0)}`}
              color={T.purple}
              onClick={() => setTab("strategy")} />
            <KPI label="Best Trade" value={`+₹${best.toFixed(0)}`}
              sub={`Worst ₹${worst.toFixed(0)}`}
              color={T.green}
              onClick={() => setTab("stocks")} />
            <KPI label="Open" value={open.length}
              sub="Need action"
              color={T.accent}
              onClick={() => setTab("today")} />
          </div>

          {/* Win/loss bar */}
          <Card>
            <SectionLabel>Win / Loss Ratio</SectionLabel>
            <div style={{ height: 10, borderRadius: 5, overflow: "hidden",
              background: T.surface, display: "flex", marginBottom: 10 }}>
              <div style={{ width: `${winRate}%`,
                background: `linear-gradient(90deg,${T.green},#00b050)`,
                transition: "width 1.2s ease" }} />
              <div style={{ flex: 1,
                background: `linear-gradient(90deg,${T.red},#c0003a)` }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between",
              fontSize: 12 }}>
              <span style={{ color: T.green, fontWeight: 700,
                fontFamily: "'DM Mono', monospace" }}>
                {wins.length} wins ({winRate}%)
              </span>
              <span style={{ color: T.red, fontWeight: 700,
                fontFamily: "'DM Mono', monospace" }}>
                {losses.length} losses
              </span>
            </div>
          </Card>

          {/* Latest review snippet */}
          {latestReview?.summary && (
            <Card>
              <SectionLabel>Latest Session Review</SectionLabel>
              <div style={{ fontSize: 12, color: T.text, lineHeight: 1.7,
                fontFamily: "'DM Sans', sans-serif",
                borderLeft: `2px solid ${T.accent}44`,
                paddingLeft: 14 }}>
                {latestReview.summary}
              </div>
              <div style={{ marginTop: 10, fontSize: 10, color: T.muted,
                fontFamily: "'DM Mono', monospace" }}>
                {latestReview.title} · {latestReview.date}
              </div>
            </Card>
          )}

          {/* System rules */}
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 12 }}>
            {([
              ["₹", "Capital / Trade", "₹2,000",     T.amber],
              ["↓", "Stop Loss",       "1% below",    T.red],
              ["↑", "Target",          "2% above",    T.green],
              ["⏱", "Exit Deadline",  "15:00 IST",   T.accent],
              ["◈", "Strategy",        "ORB + MR",    T.purple],
              ["◎", "Universe",        "Nifty 100",   T.muted],
            ] as const).map(([icon, label, val, color]) => (
              <Card key={label} style={{ display: "flex",
                alignItems: "center", gap: 12, padding: "14px 16px" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8,
                  background: `${color}12`,
                  border: `1px solid ${color}25`,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14,
                  color: color as string, flexShrink: 0,
                  fontFamily: "'DM Mono', monospace" }}>{icon}</div>
                <div>
                  <div style={{ fontSize: 9, color: T.muted,
                    letterSpacing: 1.5, textTransform: "uppercase",
                    fontFamily: "'DM Sans', sans-serif" }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700,
                    color: color as string,
                    fontFamily: "'DM Mono', monospace",
                    marginTop: 2 }}>{val}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── TODAY ── */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid",
            gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)",
            gap: 12 }}>
            <KPI label="Today P&L" value={fmt(todayPnL)}
              sub={`${todayTrades.filter(t => t.status === "⚫ CLOSED").length} closed`}
              color={todayPnL >= 0 ? T.green : T.red} />
            <KPI label="Open" value={todayOpen.length}
              sub="Need action"
              color={todayOpen.length > 0 ? T.amber : T.muted} />
            <KPI label="Total Today" value={todayTrades.length}
              sub="All trades" color={T.accent} />
          </div>
          {todayTrades.length === 0
            ? <Card style={{ padding: 48, textAlign: "center" }}>
                <div style={{ color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>
                  No trades logged today yet.
                </div>
              </Card>
            : <Card style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "14px 20px",
                  borderBottom: `1px solid ${T.border}` }}>
                  <SectionLabel>Today's Trades</SectionLabel>
                </div>
                {todayTrades.map(t => (
                  <TradeRow key={t.id} trade={t} updating={updating}
                    onAction={updateStatus} mobile={mobile} />
                ))}
              </Card>
          }
        </div>
      )}

      {/* ── INTELLIGENCE ── */}
      {tab === "intelligence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

          {/* Performance snapshot */}
          {framework && (
            <div style={{ display: "grid",
              gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: 12 }}>
              <KPI label="Trading Days" value={framework.dayCount || 5}
                sub="Sessions complete" color={T.accent} />
              <KPI label="Active Rules" value={framework.rules.length}
                sub="In the system" color={T.purple} />
              <KPI label="Hypotheses" value={framework.hypotheses.length}
                sub="Being tested" color={T.amber} />
              <KPI label="Learnings" value={framework.learnings.length}
                sub="Captured" color={T.green} />
            </div>
          )}

          {/* Active Rules */}
          {framework?.rules && framework.rules.length > 0 && (
            <Card>
              <SectionLabel>Active Trading Rules</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column",
                gap: 8 }}>
                {framework.rules
                  .filter(r => !r.status.toLowerCase().includes("terminat"))
                  .slice(0, 15)
                  .map((rule, i) => (
                  <div key={i} style={{ display: "flex", gap: 12,
                    padding: "10px 14px", background: T.surface,
                    borderRadius: 8, border: `1px solid ${T.border}`,
                    alignItems: "flex-start" }}>
                    <span style={{ fontSize: 10, fontWeight: 800,
                      color: T.accent, fontFamily: "'DM Mono', monospace",
                      minWidth: 28, paddingTop: 1 }}>{rule.id}</span>
                    <span style={{ fontSize: 12, color: T.text, flex: 1,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.5 }}>{rule.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Latest Learnings */}
          {framework?.learnings && framework.learnings.length > 0 && (
            <Card>
              <SectionLabel>Recent Learnings</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column",
                gap: 8 }}>
                {framework.learnings.slice(-8).reverse().map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 12,
                    padding: "10px 14px", background: T.surface,
                    borderRadius: 8, border: `1px solid ${T.border}`,
                    alignItems: "flex-start" }}>
                    <span style={{ fontSize: 10, fontWeight: 800,
                      color: T.green, fontFamily: "'DM Mono', monospace",
                      minWidth: 28, paddingTop: 1 }}>{l.id}</span>
                    <span style={{ fontSize: 12, color: T.text, flex: 1,
                      fontFamily: "'DM Sans', sans-serif",
                      lineHeight: 1.5 }}>{l.text}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Hypotheses */}
          {framework?.hypotheses && framework.hypotheses.length > 0 && (
            <Card>
              <SectionLabel>Hypothesis Tracker</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column",
                gap: 8 }}>
                {framework.hypotheses.map((hyp, i) => (
                  <div key={i} style={{ display: "flex", gap: 12,
                    padding: "12px 14px", background: T.surface,
                    borderRadius: 8, border: `1px solid ${T.border}`,
                    alignItems: "flex-start" }}>
                    <span style={{ fontSize: 10, fontWeight: 800,
                      color: T.purple,
                      fontFamily: "'DM Mono', monospace",
                      minWidth: 28, paddingTop: 2 }}>{hyp.id}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: T.text,
                        fontFamily: "'DM Sans', sans-serif",
                        lineHeight: 1.5, marginBottom: 6 }}>
                        {hyp.text}
                      </div>
                      <HypoBadge status={hyp.status} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Fallback */}
          {!framework && !loading && (
            <Card style={{ padding: 48, textAlign: "center" }}>
              <div style={{ color: T.dim, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif" }}>
                Intelligence data loading… tap Refresh if this persists.
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ── CHARTS ── */}
      {tab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card>
            <SectionLabel>Daily P&L</SectionLabel>
            {dailyData.length === 0
              ? <div style={{ padding: "32px 0", textAlign: "center",
                  color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>
                  No closed trades yet
                </div>
              : <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={dailyData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 4 }}
                    style={{ background: "transparent" }}>
                    <CartesianGrid strokeDasharray="3 3"
                      stroke={T.border} vertical={false} />
                    <XAxis dataKey="date"
                      tick={{ fontSize: 10, fill: T.muted,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={{ stroke: T.border }}
                      tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: T.muted,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: `${T.borderHi}44` }} />
                    <Bar dataKey="pnl" radius={[3,3,0,0]}>
                      {dailyData.map((e,i) => (
                        <Cell key={i}
                          fill={e.pnl >= 0 ? T.green : T.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
            }
          </Card>

          <Card>
            <SectionLabel>Cumulative P&L</SectionLabel>
            {cumData.length === 0
              ? <div style={{ padding: "32px 0", textAlign: "center",
                  color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>
                  No closed trades yet
                </div>
              : <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={cumData}
                    margin={{ top: 4, right: 4, left: -20, bottom: 4 }}
                    style={{ background: "transparent" }}>
                    <CartesianGrid strokeDasharray="3 3"
                      stroke={T.border} vertical={false} />
                    <XAxis dataKey="date"
                      tick={{ fontSize: 10, fill: T.muted,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={{ stroke: T.border }}
                      tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 10, fill: T.muted,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={false} tickLine={false} />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ stroke: T.borderHi, strokeWidth: 1 }} />
                    <Line type="monotone" dataKey="pnl"
                      stroke={T.accent} strokeWidth={2}
                      dot={{ fill: T.accent, r: 3,
                        strokeWidth: 0, fillOpacity: 1 }}
                      activeDot={{ r: 5, fill: T.accent,
                        stroke: T.surface, strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
            }
          </Card>
        </div>
      )}

      {/* ── STOCKS ── */}
      {tab === "stocks" && (
        <Card>
          <SectionLabel>P&L by Stock</SectionLabel>
          {stockData.length === 0
            ? <div style={{ padding: "32px 0", textAlign: "center",
                color: T.dim, fontSize: 13,
                fontFamily: "'DM Sans', sans-serif" }}>
                No closed trades yet
              </div>
            : <>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={stockData} layout="vertical"
                    margin={{ top: 4, right: 16, left: 8, bottom: 4 }}
                    style={{ background: "transparent" }}>
                    <CartesianGrid strokeDasharray="3 3"
                      stroke={T.border} horizontal={false} />
                    <XAxis type="number"
                      tick={{ fontSize: 10, fill: T.muted,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={false} tickLine={false} />
                    <YAxis dataKey="stock" type="category" width={76}
                      tick={{ fontSize: 10, fill: T.text,
                        fontFamily: "'DM Mono', monospace" }}
                      axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />}
                      cursor={{ fill: `${T.borderHi}44` }} />
                    <Bar dataKey="pnl" radius={[0,3,3,0]}>
                      {stockData.map((e,i) => (
                        <Cell key={i}
                          fill={e.pnl >= 0 ? T.green : T.red} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ marginTop: 16, display: "flex",
                  flexDirection: "column", gap: 6 }}>
                  {stockData.map(s => (
                    <div key={s.stock} style={{
                      display: "flex", justifyContent: "space-between",
                      alignItems: "center", padding: "10px 14px",
                      background: T.surface, borderRadius: 8,
                      border: `1px solid ${T.border}`,
                    }}>
                      <span style={{ fontWeight: 600, fontSize: 13,
                        color: T.text,
                        fontFamily: "'DM Mono', monospace" }}>
                        {s.stock}
                      </span>
                      <span style={{ fontSize: 11, color: T.muted,
                        fontFamily: "'DM Sans', sans-serif" }}>
                        {s.count} trade{s.count > 1 ? "s" : ""}
                      </span>
                      <span style={{ fontFamily: "'DM Mono', monospace",
                        fontWeight: 700, fontSize: 13,
                        color: s.pnl >= 0 ? T.green : T.red }}>
                        {s.pnl >= 0 ? "+" : ""}₹{s.pnl}
                      </span>
                    </div>
                  ))}
                </div>
              </>
          }
        </Card>
      )}

      {/* ── STRATEGY ── */}
      {tab === "strategy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionLabel>Strategy Performance</SectionLabel>
          {Object.keys(stratMap).length === 0
            ? <Card style={{ padding: 48, textAlign: "center" }}>
                <div style={{ color: T.dim, fontSize: 13,
                  fontFamily: "'DM Sans', sans-serif" }}>
                  No closed trades yet
                </div>
              </Card>
            : Object.entries(stratMap)
                .sort(([,a],[,b]) => b.pnl - a.pnl)
                .map(([name, data]) => {
                  const wr = Math.round((data.wins / data.total) * 100);
                  return (
                    <Card key={name}>
                      <div style={{ display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center", marginBottom: 14 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14,
                            color: T.text,
                            fontFamily: "'DM Sans', sans-serif" }}>
                            {name}
                          </div>
                          <div style={{ fontSize: 11, color: T.muted,
                            marginTop: 3,
                            fontFamily: "'DM Mono', monospace" }}>
                            {data.total} trades · {wr}% win rate
                          </div>
                        </div>
                        <div style={{ fontFamily: "'DM Mono', monospace",
                          fontSize: 20, fontWeight: 900,
                          color: data.pnl >= 0 ? T.green : T.red }}>
                          {data.pnl >= 0 ? "+" : ""}₹{data.pnl.toFixed(0)}
                        </div>
                      </div>
                      <div style={{ height: 6, borderRadius: 3,
                        overflow: "hidden", background: T.surface,
                        display: "flex" }}>
                        <div style={{ width: `${wr}%`,
                          background:
                            `linear-gradient(90deg,${T.green},#00b050)` }} />
                        <div style={{ flex: 1,
                          background:
                            `linear-gradient(90deg,${T.red},#c0003a)` }} />
                      </div>
                    </Card>
                  );
                })
          }
        </div>
      )}

      {/* ── TRADE LOG ── */}
      {tab === "log" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 16,
            flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 10, color: T.muted, marginRight: 4,
              letterSpacing: 1.5, textTransform: "uppercase",
              fontFamily: "'DM Sans', sans-serif" }}>Filter</span>
            {["ALL","PENDING","APPROVED","EXECUTED","CLOSED","REJECTED"]
              .map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? `${T.accent}15` : "transparent",
                border: filter === f
                  ? `1px solid ${T.accent}55` : `1px solid ${T.border}`,
                color: filter === f ? T.accent : T.muted,
                borderRadius: 6, padding: "5px 12px", fontSize: 11,
                fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
                fontFamily: "'DM Mono', monospace",
                transition: "all 0.15s", outline: "none",
              }}>{f}</button>
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
                  "2fr 100px 90px 90px 90px 70px 90px 180px",
                padding: "9px 20px", gap: 8,
                fontSize: 9, letterSpacing: 1.5, color: T.dim,
                textTransform: "uppercase",
                fontFamily: "'DM Mono', monospace", fontWeight: 700,
                borderBottom: `1px solid ${T.border}`,
                background: T.surface,
              }}>
                <div>Trade</div><div>Status</div><div>Entry</div>
                <div>SL</div><div>Target</div><div>Qty</div>
                <div>P&L</div><div>Actions</div>
              </div>
            )}
            {loading
              ? <div style={{ padding: 48, textAlign: "center" }}>
                  <Spinner />
                  <div style={{ color: T.dim, marginTop: 14, fontSize: 12,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    Fetching from Notion…
                  </div>
                </div>
              : filtered.length === 0
                ? <div style={{ padding: 48, textAlign: "center",
                    color: T.dim, fontSize: 13,
                    fontFamily: "'DM Sans', sans-serif" }}>
                    No trades{filter !== "ALL"
                      ? ` matching "${filter}"` : ""}.
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
                  TOTAL · {closed.length} CLOSED
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
        @keyframes spin  { to { transform: rotate(360deg) } }
        @keyframes flash { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from{transform:translateY(8px);opacity:0} to{transform:translateY(0);opacity:1} }
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        button:focus { outline: none; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: ${T.bg}; }
        ::-webkit-scrollbar-thumb { background: ${T.borderHi}; border-radius: 2px; }
        .recharts-wrapper, .recharts-surface { background: transparent !important; }
        html, body { margin: 0; padding: 0; background: ${T.bg}; }
      `}</style>

      {urgent && (
        <div style={{ background: "#3a0010",
          borderBottom: `1px solid ${T.red}`,
          padding: "9px 20px", textAlign: "center",
          fontSize: 12, fontWeight: 700, color: "#ff8099",
          animation: "flash 1.2s ease-in-out infinite",
          fontFamily: "'DM Mono', monospace", letterSpacing: 0.5,
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        }}>
          ⚠ {open.length} OPEN · {Math.floor(minsTo3/60)}H {minsTo3%60}M TO 15:00 EXIT
        </div>
      )}

      {toast && (
        <div style={{
          position: "fixed", bottom: mobile ? 80 : 24,
          right: 20, zIndex: 99,
          background: toast.ok ? "#001f0f" : "#2a0010",
          border: `1px solid ${toast.ok ? T.green : T.red}`,
          borderRadius: 10, padding: "11px 18px",
          fontSize: 12, fontWeight: 600,
          color: toast.ok ? T.green : T.red,
          fontFamily: "'DM Sans', sans-serif",
          boxShadow: "0 4px 24px #00000099",
          animation: "slideUp 0.2s ease",
        }}>
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
  );
}
