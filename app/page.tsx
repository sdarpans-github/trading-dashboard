"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
} from "recharts";

/* ─── TIME-BASED DEFAULT ─── */
function getDefaultTheme(): "dark" | "warm" | "green" {
  const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours();
  return (h >= 6 && h < 19) ? "warm" : "dark";
}

/* ─── THEMES ─── */
const THEMES = {
  dark: {
    bg: "#0d1117", surface: "#161b22", card: "#1c2128",
    border: "#30363d", borderHi: "#484f58",
    text: "#e6edf3", muted: "#7d8590", dim: "#3d444d",
    accent: "#2f81f7", green: "#3fb950", red: "#f85149",
    amber: "#e3b341", purple: "#a371f7", teal: "#39d353",
    greenBg: "#0d2b1a", redBg: "#2d0f0f", amberBg: "#2b1d0e",
  },
  warm: {
    bg: "#faf8f5", surface: "#f2ede8", card: "#ffffff",
    border: "#e0d8ce", borderHi: "#c8bdb0",
    text: "#1c1917", muted: "#78716c", dim: "#c4b9af",
    accent: "#0f766e", green: "#15803d", red: "#be123c",
    amber: "#b45309", purple: "#7c3aed", teal: "#0e7490",
    greenBg: "#dcfce7", redBg: "#ffe4e6", amberBg: "#fef3c7",
  },
  green: {
    bg: "#f0fdf4", surface: "#dcfce7", card: "#ffffff",
    border: "#bbf7d0", borderHi: "#86efac",
    text: "#1a2e1a", muted: "#3d6b52", dim: "#a3c9b0",
    accent: "#0369a1", green: "#15803d", red: "#b91c1c",
    amber: "#a16207", purple: "#6d28d9", teal: "#0e7490",
    greenBg: "#dcfce7", redBg: "#fee2e2", amberBg: "#fef9c3",
  },
};

type ThemeKey = keyof typeof THEMES;
type Theme = typeof THEMES.dark;

/* ─── STATIC DATA ─── */
const STRATEGY_INFO: Record<string, { icon: string; short: string; when: string }> = {
  "ORB": { icon: "📐", short: "Opening Range Breakout", when: "VIX < 18, trending market. Entry after 9:30 AM candle." },
  "Mean Rev": { icon: "↩️", short: "Mean Reversion Bounce", when: "VIX > 20. Stock near 52-week low with DII buying." },
  "Momentum": { icon: "🚀", short: "Relative Strength Play", when: "Stock up while Nifty is flat or negative. Volume above avg." },
  "Dual Signal": { icon: "⭐", short: "Momentum + Mean Rev combo", when: "Highest conviction — 87.5% win rate across all sessions." },
  "Crisis": { icon: "⚡", short: "Crisis Beneficiary", when: "Geopolitical/oil shock. Upstream E&P + domestic fuel stocks." },
  "Other": { icon: "◈", short: "Custom Setup", when: "Context-specific trade outside standard strategies." },
};

const KPI_INFO: Record<string, string> = {
  "Total P&L": "Sum of Final P&L from all closed trades. Target: positive.",
  "Win Rate": "% of closed trades that were profitable. Target: above 55%. W=Win L=Loss F=Flat(time exit).",
  "Profit Factor": "Gross profit ÷ gross loss. Target: above 1.5. Green = above target.",
  "Streak": "Current consecutive WIN or LOSS run measured by trading DAY, not individual trades.",
  "Open Now": "Trades currently EXECUTED and needing your 3PM close action.",
  "Today P&L": "P&L from today's closed trades only.",
  "Needs Action": "Today's open trades waiting for approval or closing.",
  "Total Today": "All trades logged today, any status.",
  "Trading Days": "Number of trading sessions with at least one closed trade.",
  "Active Rules": "System rules currently governing trade selection and execution.",
  "Learnings": "Key insights captured and applied from past trading sessions.",
  "Hypotheses": "Patterns being tested — need 10+ data points to confirm.",
};

const LEARNING_GROUPS: { label: string; color: string; ids: string[] }[] = [
  { label: "🎯 Strategy", color: "#2f81f7", ids: ["L1","L2","L6","L11","L21"] },
  { label: "⚠️ Execution", color: "#e3b341", ids: ["L3","L10","L16"] },
  { label: "🧠 Market", color: "#a371f7", ids: ["L8","L13","L17","L20"] },
  { label: "🛡️ Risk", color: "#3fb950", ids: ["L4","L7","L9","L14","L15","L18"] },
  { label: "📈 Stocks", color: "#39d353", ids: ["L5","L12","L19"] },
];

type Trade = {
  id: string; createdTime: string; tradeName: string; stock: string;
  status: string; entryPrice: number | null; actualEntry: number | null;
  actualExit: number | null; stopLoss: number | null;
  target: number | null; finalPnL: number | null; quantity: number | null;
  date: string | null; mode: string; notes: string; reason: string;
};

type Rule = { id: string; text: string; status: string };
type Learning = { id: string; text: string };
type Hypothesis = { id: string; text: string; status: string };
type Framework = { rules: Rule[]; learnings: Learning[]; hypotheses: Hypothesis[]; dayCount: number };
type Review = { title: string; date: string; summary: string };

const makeSC = (T: Theme) => ({
  "🟡 PENDING": { color: T.amber, bg: T.amberBg, label: "PENDING" },
  "✅ APPROVED": { color: T.green, bg: T.greenBg, label: "APPROVED" },
  "🔵 EXECUTED": { color: T.accent, bg: T.accent+"18", label: "EXECUTED" },
  "⚫ CLOSED": { color: T.muted, bg: T.surface, label: "CLOSED" },
  "❌ REJECTED": { color: T.red, bg: T.redBg, label: "REJECTED" },
});

const ACTIONS: Record<string, { action: string; label: string; key: keyof Theme }[]> = {
  "🟡 PENDING": [{ action:"APPROVE",label:"Approve",key:"green"},{action:"REJECT",label:"Reject",key:"red"}],
  "✅ APPROVED": [{ action:"EXECUTE",label:"Execute",key:"accent"},{action:"REJECT",label:"Reject",key:"red"}],
  "🔵 EXECUTED": [{ action:"CLOSE", label:"Close", key:"muted"}],
};

/* ─── HELPERS ─── */
function fmt(n: number | null) {
  if (n == null) return "—";
  return (n >= 0 ? "+" : "") + "₹" + Math.abs(n).toFixed(0);
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  const raw = d.split("T")[0];
  return new Date(raw + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/* ─── TOOLTIP PORTAL ─── */
function Tip({ text, T }: { text: string; T: Theme }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLButtonElement>(null);

  const open = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    setPos({ top: r.top - 8 + window.scrollY, left: r.left + r.width / 2 });
    setShow(s => !s);
  };

  useEffect(() => {
    if (!show) return;
    const h = () => setShow(false);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, [show]);

  return (
    <>
      <button ref={ref} onClick={open}
        style={{ background: "transparent", border: "1px solid " + T.border,
          borderRadius: "50%", width: 15, height: 15, color: T.muted,
          fontSize: 8, cursor: "pointer", display: "inline-flex", alignItems: "center",
          justifyContent: "center", fontWeight: 800, outline: "none", flexShrink: 0,
          verticalAlign: "middle" }}>
        ?
      </button>
      {show && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: "absolute", top: pos.top - 8, left: pos.left,
            transform: "translate(-50%, -100%)",
            background: T.card, border: "1px solid " + T.borderHi,
            borderRadius: 8, padding: "8px 12px", fontSize: 11, color: T.text,
            fontFamily: "DM Sans, sans-serif", lineHeight: "1.5",
            maxWidth: 260, zIndex: 9999,
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            pointerEvents: "none" }}>
          {text}
        </div>
      )}
    </>
  );
}

/* ─── STRATEGY TAG ─── */
function StrategyTag({ name, T }: { name: string; T: Theme }) {
  const [show, setShow] = useState(false);
  const info = STRATEGY_INFO[name] || STRATEGY_INFO["Other"];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!show) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setShow(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [show]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button onClick={() => setShow(!show)} style={{
        background: "transparent", border: "none", cursor: "pointer",
        outline: "none", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 16 }}>{info.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{name}</span>
        <span style={{ fontSize: 11, color: T.muted, opacity: 0.7 }}>ⓘ</span>
      </button>
      {show && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0,
          background: T.card, border: "1px solid " + T.borderHi,
          borderRadius: 10, padding: "12px 16px", zIndex: 200, minWidth: 260,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>{info.short}</div>
          <div style={{ fontSize: 11, color: T.muted, fontFamily: "DM Sans, sans-serif", lineHeight: "1.6" }}>{info.when}</div>
        </div>
      )}
    </div>
  );
}

/* ─── BADGE ─── */
function Badge({ status, T }: { status: string; T: Theme }) {
  const sc = makeSC(T);
  const c = sc[status as keyof typeof sc] || { color: T.muted, bg: T.surface, label: status };
  return (
    <span style={{ background: c.bg, color: c.color, border: "1px solid " + c.color + "40",
      borderRadius: 4, fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
      padding: "2px 7px", fontFamily: "DM Mono, monospace", whiteSpace: "nowrap" }}>
      {c.label}
    </span>
  );
}

/* ─── KPI CARD ─── */
function KPI({ label, value, sub, color, onClick, T }: {
  label: string; value: string | number; sub?: string;
  color: string; onClick?: () => void; T: Theme;
}) {
  const [hov, setHov] = useState(false);
  const tip = KPI_INFO[label];
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background: hov && onClick ? color + "0f" : T.card,
        border: "1px solid " + (hov && onClick ? color + "66" : T.border),
        borderRadius: 12, padding: "16px 18px",
        cursor: onClick ? "pointer" : "default",
        transition: "all 0.18s", flex: 1, minWidth: 120,
        position: "relative", overflow: "visible",
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
      {onClick && hov && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: "linear-gradient(90deg," + color + "00," + color + "99," + color + "00)",
          borderRadius: "12px 12px 0 0" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 8 }}>
        <div style={{ fontSize: 9, letterSpacing: 2, color: T.muted,
          textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{label}</div>
        {tip && <Tip text={tip} T={T} />}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color, fontFamily: "DM Mono, monospace", lineHeight: "1" }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: T.muted, fontFamily: "DM Sans, sans-serif", marginTop: 5 }}>{sub}</div>}
      {onClick && hov && (
        <div style={{ fontSize: 9, color, marginTop: 6, fontFamily: "DM Sans, sans-serif", letterSpacing: 0.5 }}>
          VIEW DETAILS →
        </div>
      )}
    </div>
  );
}

/* ─── CARD ─── */
function Card({ children, style, accent, T }: {
  children: React.ReactNode; style?: React.CSSProperties; accent?: string; T: Theme;
}) {
  return (
    <div style={{ background: T.card, border: "1px solid " + T.border, borderRadius: 12,
      padding: "20px 22px", borderTop: accent ? "2px solid " + accent : "1px solid " + T.border,
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)", ...style }}>
      {children}
    </div>
  );
}

/* ─── SECTION LABEL ─── */
function SLabel({ children, color, T }: { children: React.ReactNode; color?: string; T: Theme }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 2.5, color: color || T.muted,
      textTransform: "uppercase", fontFamily: "DM Sans, sans-serif",
      marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 3, height: 14, borderRadius: 2, background: color || T.borderHi }} />
      {children}
    </div>
  );
}

/* ─── SPINNER ─── */
function Spin({ size, T }: { size?: number; T: Theme }) {
  return (
    <span style={{ width: size || 14, height: size || 14,
      border: "2px solid " + T.border, borderTopColor: T.accent,
      borderRadius: "50%", display: "inline-block",
      animation: "spin 0.7s linear infinite" }} />
  );
}

/* ─── CHART TOOLTIP ─── */
function makeTooltip(T: Theme) {
  return function CT({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    const v = payload[0].value;
    return (
      <div style={{ background: T.surface, border: "1px solid " + T.borderHi,
        borderRadius: 8, padding: "8px 12px", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}>
        <div style={{ fontSize: 10, color: T.muted, marginBottom: 3, fontFamily: "DM Sans, sans-serif" }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: v >= 0 ? T.green : T.red,
          fontFamily: "DM Mono, monospace" }}>{v >= 0 ? "+" : ""}₹{v}</div>
      </div>
    );
  };
}

/* ─── THEME TOGGLE ─── */
function ThemeToggle({ current, onChange, T }: { current: ThemeKey; onChange: (k: ThemeKey) => void; T: Theme }) {
  return (
    <div style={{ display: "inline-flex", background: T.bg,
      border: "1px solid " + T.border, borderRadius: 22, padding: 3, gap: 2 }}>
      {([["dark","🌙","Dark"],["warm","🌅","Warm"],["green","🌿","Green"]] as const).map(([key,icon,label]) => {
        const active = current === key;
        return (
          <button key={key} onClick={() => onChange(key)} style={{
            padding: "4px 10px", borderRadius: 18, fontSize: 11,
            fontWeight: active ? 700 : 400, border: "none",
            cursor: active ? "default" : "pointer",
            background: active ? T.accent : "transparent",
            color: active ? "#fff" : T.muted,
            display: "flex", alignItems: "center", gap: 4,
            transition: "all 0.2s", outline: "none",
            boxShadow: active ? "0 1px 5px " + T.accent + "55" : "none",
            whiteSpace: "nowrap" }}>
            {icon} {label} {active && "✓"}
          </button>
        );
      })}
    </div>
  );
}

/* ─── TRADE ROW ─── */
function TradeRow({ trade: t, updating, onAction, mobile, T }: {
  trade: Trade; updating: string | null;
  onAction: (id: string, action: string, name: string) => void;
  mobile?: boolean; T: Theme;
}) {
  const [expanded, setExpanded] = useState(false);
  const actions = ACTIONS[t.status] || [];
  const busy = updating === t.id;
  const pnl = t.finalPnL;
  const name = t.tradeName || t.stock || "—";
  const displayEntry = t.actualEntry ?? t.entryPrice;
  const entryMismatch = t.actualEntry && t.entryPrice && t.actualEntry !== t.entryPrice;

  if (mobile) {
    return (
      <div style={{ borderBottom: "1px solid " + T.border }}>
        <div style={{ padding: "14px 16px" }} onClick={() => (t.notes || t.reason) && setExpanded(!expanded)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div style={{ flex: 1, paddingRight: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif", marginBottom: 5 }}>{name}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Badge status={t.status} T={T} />
                <span style={{ fontSize: 10, color: T.dim, fontFamily: "DM Mono, monospace" }}>{fmtDate(t.date || t.createdTime)}</span>
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              {pnl != null
                ? <div style={{ fontSize: 15, fontWeight: 700, color: pnl > 0 ? T.green : pnl < 0 ? T.red : T.muted, fontFamily: "DM Mono, monospace" }}>
                    {pnl === 0 ? <span style={{ color: T.muted }}>FLAT</span> : fmt(pnl)}
                  </div>
                : displayEntry ? <div style={{ fontSize: 13, color: T.muted, fontFamily: "DM Mono, monospace" }}>₹{displayEntry}</div> : null
              }
              {t.stopLoss && pnl == null && (
                <div style={{ fontSize: 10, color: T.dim, marginTop: 2, fontFamily: "DM Mono, monospace" }}>SL {t.stopLoss} · T {t.target}</div>
              )}
            </div>
          </div>
          {actions.length > 0 && (
            <div style={{ display: "flex", gap: 8 }}>
              {actions.map(({ action, label, key }) => {
                const color = T[key] as string;
                return (
                  <button key={action}
                    onClick={e => { e.stopPropagation(); if (!busy) onAction(t.id, action, name); }}
                    style={{ background: color + "18", border: "1px solid " + color + "50",
                      color, borderRadius: 6, padding: "5px 14px", fontSize: 12,
                      fontWeight: 600, cursor: busy ? "default" : "pointer",
                      fontFamily: "DM Sans, sans-serif", opacity: busy ? 0.5 : 1 }}>
                    {busy ? "..." : label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {expanded && (t.notes || t.reason) && (
          <div style={{ padding: "0 16px 14px", borderTop: "1px solid " + T.border, paddingTop: 10 }}>
            {t.reason && (
              <div style={{ marginBottom: t.notes ? 8 : 0 }}>
                <div style={{ fontSize: 8, color: T.amber, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif", marginBottom: 3 }}>THESIS</div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: "1.6", fontFamily: "DM Sans, sans-serif", borderLeft: "2px solid " + T.amber + "66", paddingLeft: 10 }}>{t.reason}</div>
              </div>
            )}
            {t.notes && (
              <div>
                <div style={{ fontSize: 8, color: T.accent, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif", marginBottom: 3 }}>NOTES</div>
                <div style={{ fontSize: 11, color: T.muted, lineHeight: "1.6", fontFamily: "DM Sans, sans-serif", borderLeft: "2px solid " + T.accent + "66", paddingLeft: 10 }}>{t.notes}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 110px 90px 90px 60px 90px 1fr",
        padding: "11px 20px", borderBottom: "1px solid " + T.border,
        alignItems: "center", gap: 8, background: "transparent",
        transition: "background 0.12s", cursor: (t.notes || t.reason) ? "pointer" : "default" }}
        onClick={() => (t.notes || t.reason) && setExpanded(!expanded)}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = T.surface; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text, fontFamily: "DM Sans, sans-serif",
            display: "flex", alignItems: "center", gap: 5 }}>
            {name}{(t.notes || t.reason) && <span style={{ fontSize: 9, color: T.dim }}>{expanded ? "▴" : "▾"}</span>}
          </div>
          <div style={{ fontSize: 10, color: T.dim, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{fmtDate(t.date || t.createdTime)}</div>
        </div>
        <Badge status={t.status} T={T} />
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: T.muted }}>
          {displayEntry ? "₹" + displayEntry : "—"}
          {entryMismatch && (
            <div style={{ fontSize: 9, color: T.dim }}>est. ₹{t.entryPrice}</div>
          )}
        </div>
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: T.red + "bb" }}>{t.stopLoss ? "₹" + t.stopLoss : "—"}</div>
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: T.green + "bb" }}>{t.target ? "₹" + t.target : "—"}</div>
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, color: T.dim }}>{t.quantity ?? "—"}</div>
        <div style={{ fontFamily: "DM Mono, monospace", fontSize: 14, fontWeight: 700,
          color: pnl == null ? T.dim : pnl > 0 ? T.green : pnl < 0 ? T.red : T.muted }}>
          {pnl == null ? "—" : pnl === 0 ? <span style={{ fontSize: 11 }}>FLAT</span> : fmt(pnl)}
        </div>
        <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
          {actions.map(({ action, label, key }) => {
            const color = T[key] as string;
            return (
              <button key={action}
                onClick={e => { e.stopPropagation(); if (!busy) onAction(t.id, action, name); }}
                style={{ background: color + "18", border: "1px solid " + color + "50",
                  color, borderRadius: 5, padding: "4px 10px", fontSize: 10,
                  fontWeight: 600, cursor: busy ? "default" : "pointer",
                  fontFamily: "DM Sans, sans-serif", opacity: busy ? 0.5 : 1,
                  transition: "all 0.15s", whiteSpace: "nowrap", outline: "none" }}>
                {busy ? <Spin size={10} T={T} /> : label}
              </button>
            );
          })}
        </div>
      </div>
      {expanded && (t.notes || t.reason) && (
        <div style={{ background: T.surface, borderBottom: "1px solid " + T.border }}>
          {t.reason && (
            <div style={{ padding: "10px 20px 0 20px" }}>
              <div style={{ fontSize: 8, color: T.amber, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>THESIS</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: "1.7", fontFamily: "DM Sans, sans-serif",
                borderLeft: "2px solid " + T.amber + "66", paddingLeft: 12, paddingBottom: 10 }}>
                {t.reason}
              </div>
            </div>
          )}
          {t.notes && (
            <div style={{ padding: "0 20px 14px 20px" }}>
              <div style={{ fontSize: 8, color: T.accent, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>NOTES</div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: "1.7", fontFamily: "DM Sans, sans-serif",
                borderLeft: "2px solid " + T.accent + "66", paddingLeft: 12 }}>
                {t.notes}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

/* ─── HYPOTHESIS BADGE ─── */
function HBadge({ status, T }: { status: string; T: Theme }) {
  const s = status.toLowerCase();
  const color = s.includes("confirm") ? T.green : s.includes("strength") || s.includes("testing") || s.includes("ongoing") ? T.amber : s.includes("hold") ? T.muted : T.purple;
  const label = s.includes("confirm") ? "CONFIRMED" : s.includes("strength") ? "STRENGTHENING" : s.includes("testing") ? "TESTING" : s.includes("ongoing") ? "ONGOING" : s.includes("hold") ? "ON HOLD" : "ACTIVE";
  return (
    <span style={{ fontSize: 9, color, background: color + "18", border: "1px solid " + color + "40",
      borderRadius: 4, padding: "2px 7px", fontFamily: "DM Mono, monospace",
      fontWeight: 700, letterSpacing: 1, whiteSpace: "nowrap" }}>{label}</span>
  );
}

/* ─── INSIGHT METRIC ─── */
function Metric({ label, value, sub, color, T }: {
  label: string; value: string | number; sub?: string; color: string; T: Theme;
}) {
  return (
    <div style={{ background: T.bg, borderRadius: 10, padding: "12px 14px",
      border: "1px solid " + T.border }}>
      <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase",
        fontFamily: "DM Sans, sans-serif", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: "DM Mono, monospace", lineHeight: "1" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T.muted, fontFamily: "DM Sans, sans-serif", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

/* ═══════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════ */
export default function Dashboard() {
  /* ── FIX: Theme persisted to localStorage ── */
  const [themeKey, setThemeKey] = useState<ThemeKey>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("trading-theme") as ThemeKey | null;
      if (saved && saved in THEMES) return saved;
    }
    return getDefaultTheme();
  });

  const handleThemeChange = useCallback((k: ThemeKey) => {
    setThemeKey(k);
    if (typeof window !== "undefined") localStorage.setItem("trading-theme", k);
  }, []);

  const T = THEMES[themeKey];

  const [trades, setTrades] = useState<Trade[]>([]);
  const [fw, setFw] = useState<Framework | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState("overview");
  const [synced, setSynced] = useState<Date | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [mobile, setMobile] = useState(false);
  const [lgGroup, setLgGroup] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  /* ── FIX: Keyboard shortcut R to refresh ── */
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrades(data.trades || []);
      if (data.framework) setFw(data.framework);
      if (data.latestReview) setReview(data.latestReview);
      setSynced(new Date());
    } catch { setError("Could not reach Notion. Press R or tap refresh to retry."); }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "r" && !e.ctrlKey && !e.metaKey &&
          (e.target as HTMLElement).tagName !== "INPUT" &&
          (e.target as HTMLElement).tagName !== "TEXTAREA") {
        load();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [load]);

  const updateStatus = async (id: string, action: string, name: string) => {
    setUpdating(id);
    try {
      const res = await fetch("/api/update-trade", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId: id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToast({ msg: name + " → " + data.newStatus, ok: true });
      await load();
    } catch (e: any) {
      setToast({ msg: "Failed: " + e.message, ok: false });
    }
    setUpdating(null);
    setTimeout(() => setToast(null), 4000);
  };

  /* ── Stats ── */
  const closed  = trades.filter(t => t.status === "⚫ CLOSED");
  const open    = trades.filter(t => ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));
  const wins    = closed.filter(t => (t.finalPnL ?? 0) > 0);
  const losses  = closed.filter(t => (t.finalPnL ?? 0) < 0);
  const flats   = closed.filter(t => (t.finalPnL ?? 0) === 0);
  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winRate  = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin   = wins.length   ? wins.reduce((s,t)   => s + (t.finalPnL??0), 0) / wins.length   : 0;
  const avgLoss  = losses.length ? losses.reduce((s,t) => s + (t.finalPnL??0), 0) / losses.length : 0;
  const grossWin  = wins.reduce((s,t)   => s + (t.finalPnL??0), 0);
  const grossLoss = Math.abs(losses.reduce((s,t) => s + (t.finalPnL??0), 0));
  const pf = grossLoss > 0 ? (grossWin / grossLoss).toFixed(2) : "—";
  const pfNum = grossLoss > 0 ? grossWin / grossLoss : 0;
  const best  = closed.length ? Math.max(...closed.map(t => t.finalPnL??0)) : 0;
  const worst = closed.length ? Math.min(...closed.map(t => t.finalPnL??0)) : 0;

  /* ── FIX: Streak by DAY, newest-first, skip flat days ── */
  let streak = 0, streakType = "";
  const _streakDayMap = closed.reduce((acc: Record<string,number>, t) => {
    const d = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "?";
    acc[d] = (acc[d] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  for (const [, pnl] of Object.entries(_streakDayMap).sort(([a],[b]) => b.localeCompare(a))) {
    if (pnl === 0) continue; // skip flat days
    const w = pnl > 0;
    if (streak === 0) { streakType = w ? "W" : "L"; streak = 1; }
    else if ((w && streakType === "W") || (!w && streakType === "L")) streak++;
    else break;
  }

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const todayTrades = trades.filter(t => (t.date?.split("T")[0] || t.createdTime?.split("T")[0]) === todayIST);
  const todayPnL    = todayTrades.filter(t => t.status === "⚫ CLOSED").reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const todayOpen   = todayTrades.filter(t => ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));

  /* ── Chart data ── */
  const dailyMap = closed.reduce((acc: Record<string,number>, t) => {
    const d = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "?";
    acc[d] = (acc[d] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  const dailyData = Object.entries(dailyMap).sort(([a],[b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({ date: fmtDate(date), pnl: Math.round(pnl) }));
  let cum = 0;
  const cumData = dailyData.map(d => ({ date: d.date, pnl: (cum += d.pnl, Math.round(cum)) }));

  const dowMap = closed.reduce((acc: Record<string,number>, t) => {
    const d = t.date?.split("T")[0] || t.createdTime?.split("T")[0];
    if (!d) return acc;
    const day = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(d).getDay()];
    acc[day] = (acc[day] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  const dowData = ["Mon","Tue","Wed","Thu","Fri"].map(day => ({ day, pnl: Math.round(dowMap[day] || 0) }));

  const stockMap = closed.reduce((acc: Record<string,{pnl:number;count:number;wins:number}>, t) => {
    const s = t.stock || t.tradeName?.split(" ")[0] || "?";
    if (!acc[s]) acc[s] = { pnl: 0, count: 0, wins: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].count++;
    if ((t.finalPnL ?? 0) > 0) acc[s].wins++;
    return acc;
  }, {});
  const stockData = Object.entries(stockMap)
    .map(([stock,d]) => ({ stock, pnl: Math.round(d.pnl), count: d.count, wr: Math.round((d.wins/d.count)*100) }))
    .sort((a,b) => b.pnl - a.pnl).slice(0, 8);

  const stratMap = closed.reduce((acc: Record<string,{pnl:number;wins:number;total:number}>, t) => {
    const n = t.tradeName || "";
    const s = n.includes("ORB") ? "ORB" : n.includes("Mean Reversion") ? "Mean Rev"
      : n.includes("Momentum") ? "Momentum" : n.includes("Dual Signal") ? "Dual Signal"
      : n.includes("Crisis") ? "Crisis" : "Other";
    if (!acc[s]) acc[s] = { pnl: 0, wins: 0, total: 0 };
    acc[s].pnl += (t.finalPnL ?? 0); acc[s].total++;
    if ((t.finalPnL ?? 0) > 0) acc[s].wins++;
    return acc;
  }, {});

  const radarData = Object.entries(stratMap).map(([name, d]) => ({
    strategy: name, winRate: Math.round((d.wins / d.total) * 100),
  }));

  const exitMap = closed.reduce((acc: Record<string,number>, t) => {
    const r = (t.reason || t.notes || "").toLowerCase();
    const type = r.includes("sl") || r.includes("stop") ? "Stop Loss"
      : r.includes("target") || r.includes("2%") ? "Target Hit"
      : r.includes("3") || r.includes("deadline") || r.includes("pm") ? "3PM Exit" : "Other";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});
  const exitData = Object.entries(exitMap).map(([type, count]) => ({ type, count })).sort((a,b) => b.count - a.count);

  /* ── Insight metrics ── */
  const slHits = closed.filter(t => (t.finalPnL ?? 0) < 0).length;
  const slRate  = closed.length ? Math.round((slHits / closed.length) * 100) : 0;
  const halfIdx    = Math.floor(closed.length / 2);
  const firstHalf  = closed.slice(0, halfIdx);
  const secondHalf = closed.slice(halfIdx);
  const wrFirst  = firstHalf.length  ? Math.round(firstHalf.filter(t  => (t.finalPnL??0) > 0).length / firstHalf.length  * 100) : 0;
  const wrSecond = secondHalf.length ? Math.round(secondHalf.filter(t => (t.finalPnL??0) > 0).length / secondHalf.length * 100) : 0;
  const improving = wrSecond > wrFirst;

  let peak = 0, dd = 0, maxDd = 0;
  cumData.forEach(d => {
    if (d.pnl > peak) peak = d.pnl;
    dd = peak - d.pnl;
    if (dd > maxDd) maxDd = dd;
  });

  const dailyWrData = Object.entries(dailyMap).sort(([a],[b]) => a.localeCompare(b)).map(([date]) => {
    const dayTrades = closed.filter(t => (t.date?.split("T")[0] || t.createdTime?.split("T")[0]) === date);
    const w = dayTrades.filter(t => (t.finalPnL??0) > 0).length;
    return { date: fmtDate(date), wr: dayTrades.length ? Math.round(w / dayTrades.length * 100) : 0 };
  });

  const daysLogged = fw?.dayCount || Object.keys(dailyMap).length;
  const daysTarget = 60;
  const daysPct    = Math.min(100, Math.round((daysLogged / daysTarget) * 100));
  const insufficientDow = Object.keys(dailyMap).length < 15;

  /* ── Clock ── */
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes();
  const mktOpen  = (h > 9 || (h === 9 && m >= 15)) && h < 15;
  const minsTo3  = mktOpen ? (15*60) - (h*60+m) : 0;
  const urgent   = mktOpen && minsTo3 <= 30 && open.length > 0;
  const istStr   = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const filtered = filter === "ALL" ? trades : trades.filter(t => t.status?.includes(filter));

  const CT  = makeTooltip(T);
  const cg  = <CartesianGrid strokeDasharray="3 3" stroke={T.border} vertical={false} />;
  const xAP = { tick: { fontSize: 10, fill: T.muted, fontFamily: "DM Mono, monospace" }, axisLine: { stroke: T.border }, tickLine: false as false };
  const yAP = { tick: { fontSize: 10, fill: T.muted, fontFamily: "DM Mono, monospace" }, axisLine: false as false, tickLine: false as false };
  const ttP = { content: <CT />, cursor: { fill: T.border + "55" } };

  const NAV = [
    { key: "overview",      label: "Overview" },
    { key: "today",         label: "Today" },
    { key: "insights",      label: "Insights" },
    { key: "intelligence",  label: "Intelligence" },
    { key: "charts",        label: "Charts" },
    { key: "stocks",        label: "Stocks" },
    { key: "strategy",      label: "Strategy" },
    { key: "log",           label: "Trade Log" },
  ];

  /* ─── SIDEBAR ─── */
  const Sidebar = () => (
    <div style={{ width: 230, background: T.surface, borderRight: "1px solid " + T.border,
      display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, flexShrink: 0 }}>
      <div style={{ padding: "20px 18px 14px", borderBottom: "1px solid " + T.border }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8,
            background: "linear-gradient(135deg," + T.accent + "33," + T.purple + "22)",
            border: "1px solid " + T.accent + "44",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 900, color: T.accent, fontFamily: "DM Mono, monospace" }}>₹</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "DM Sans, sans-serif" }}>Trading Desk</div>
            <div style={{ fontSize: 8, color: T.muted, letterSpacing: 1.5, fontFamily: "DM Mono, monospace" }}>PAPER · NIFTY 100</div>
          </div>
        </div>
        <ThemeToggle current={themeKey} onChange={handleThemeChange} T={T} />
      </div>

      <div style={{ padding: "10px 18px", borderBottom: "1px solid " + T.border }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: mktOpen ? T.green : T.red, boxShadow: "0 0 6px " + (mktOpen ? T.green : T.red) }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: mktOpen ? T.green : T.red, fontFamily: "DM Mono, monospace" }}>{mktOpen ? "LIVE" : "CLOSED"}</span>
          </div>
          <span style={{ fontSize: 10, color: T.muted, fontFamily: "DM Mono, monospace" }}>{istStr}</span>
        </div>
        {mktOpen && (
          <div style={{ fontSize: 10, color: minsTo3 <= 30 ? T.red : T.amber, fontFamily: "DM Mono, monospace" }}>
            {Math.floor(minsTo3/60)}h {minsTo3%60}m → 15:00 exit
          </div>
        )}
      </div>

      <div style={{ padding: "10px 14px", borderBottom: "1px solid " + T.border,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {[
          { label: "P&L",    value: fmt(totalPnL),                                               color: totalPnL >= 0 ? T.green : T.red },
          { label: "Win",    value: winRate + "%",                                               color: T.amber },
          { label: "Streak", value: streak > 0 ? streak + streakType : "—",                     color: streakType === "W" ? T.green : streakType === "L" ? T.red : T.muted },
          { label: "Open",   value: open.length,                                                 color: open.length > 0 ? T.accent : T.muted },
        ].map(s => (
          <div key={s.label} style={{ background: T.card, borderRadius: 7, padding: "7px 10px", border: "1px solid " + T.border }}>
            <div style={{ fontSize: 7, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{s.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: s.color as string, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{s.value}</div>
          </div>
        ))}
      </div>

      <nav style={{ flex: 1, padding: "6px 8px", overflowY: "auto" }}>
        {NAV.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", borderRadius: 8, border: "none",
            background: tab === key ? "linear-gradient(90deg," + T.accent + "18,transparent)" : "transparent",
            borderLeft: tab === key ? "2px solid " + T.accent : "2px solid transparent",
            color: tab === key ? T.accent : T.muted,
            cursor: "pointer", marginBottom: 1,
            fontFamily: "DM Sans, sans-serif", fontSize: 14,
            fontWeight: tab === key ? 600 : 400,
            transition: "all 0.15s", textAlign: "left", outline: "none" }}>
            {label}
            {key === "today" && todayOpen.length > 0 && (
              <span style={{ marginLeft: "auto", background: T.amber, color: themeKey === "dark" ? "#000" : "#fff", borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 6px" }}>{todayOpen.length}</span>
            )}
            {key === "intelligence" && fw?.rules?.length ? (
              <span style={{ marginLeft: "auto", background: T.purple + "22", color: T.purple, borderRadius: 10, fontSize: 9, fontWeight: 800, padding: "1px 6px", border: "1px solid " + T.purple + "33" }}>{fw.rules.length}</span>
            ) : null}
          </button>
        ))}
      </nav>

      <div style={{ padding: "10px 14px", borderTop: "1px solid " + T.border }}>
        <button onClick={load} disabled={loading} style={{
          width: "100%",
          background: loading ? T.border : "linear-gradient(135deg," + T.accent + "18," + T.purple + "12)",
          border: "1px solid " + (loading ? T.border : T.accent + "44"),
          borderRadius: 8, color: loading ? T.muted : T.accent,
          padding: "9px", fontSize: 12, fontWeight: 600,
          cursor: loading ? "default" : "pointer",
          fontFamily: "DM Sans, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 8, outline: "none" }}>
          {loading ? <Spin T={T} /> : "↻"} {loading ? "Syncing..." : "Refresh (R)"}
        </button>
        {synced && (
          <div style={{ fontSize: 9, color: T.dim, textAlign: "center", marginTop: 6, fontFamily: "DM Mono, monospace" }}>
            {synced.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
          </div>
        )}
      </div>
    </div>
  );

  /* ─── MOBILE HEADER ─── */
  const MobileHeader = () => (
    <div style={{ background: T.surface, borderBottom: "1px solid " + T.border,
      position: "sticky", top: 0, zIndex: 30 }}>
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 24, height: 24, borderRadius: 6,
            background: "linear-gradient(135deg," + T.accent + "33," + T.purple + "22)",
            border: "1px solid " + T.accent + "44",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 900, color: T.accent, fontFamily: "DM Mono, monospace" }}>₹</div>
          <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "DM Sans, sans-serif" }}>Trading Desk</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ThemeToggle current={themeKey} onChange={handleThemeChange} T={T} />
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: mktOpen ? T.green : T.red }} />
            <span style={{ fontSize: 9, color: mktOpen ? T.green : T.red, fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{istStr}</span>
          </div>
          <button onClick={load} disabled={loading} style={{
            background: "transparent", border: "1px solid " + T.border,
            borderRadius: 6, color: T.accent, padding: "4px 8px",
            fontSize: 11, cursor: "pointer", outline: "none" }}>
            {loading ? <Spin T={T} /> : "↻"}
          </button>
        </div>
      </div>
      <div style={{ display: "flex", borderTop: "1px solid " + T.border, overflowX: "auto", scrollbarWidth: "none" }}>
        {NAV.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: "0 0 auto", padding: "9px 14px", border: "none",
            background: "transparent",
            color: tab === key ? T.accent : T.muted,
            cursor: "pointer",
            borderBottom: tab === key ? "2px solid " + T.accent : "2px solid transparent",
            transition: "all 0.15s", outline: "none",
            fontFamily: "DM Sans, sans-serif", fontSize: 12,
            fontWeight: tab === key ? 700 : 400,
            whiteSpace: "nowrap", position: "relative" }}>
            {label}
            {key === "today" && todayOpen.length > 0 && (
              <span style={{ position: "absolute", top: 4, right: 4, background: T.amber,
                color: themeKey === "dark" ? "#000" : "#fff",
                borderRadius: "50%", fontSize: 7, fontWeight: 800,
                width: 13, height: 13, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {todayOpen.length}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );

  /* ─── CONTENT ─── */
  const Content = () => (
    <div style={{ flex: 1, overflowY: "auto", padding: mobile ? "16px" : "28px 32px" }}>
      {error && (
        <div style={{ background: T.redBg, border: "1px solid " + T.red, borderRadius: 10,
          padding: "11px 16px", marginBottom: 20, color: T.red, fontSize: 12, fontFamily: "DM Sans, sans-serif",
          display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>⚠ {error}</span>
          <button onClick={load} style={{ background: T.red + "22", border: "1px solid " + T.red + "55",
            color: T.red, borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer",
            fontFamily: "DM Sans, sans-serif", fontWeight: 600, outline: "none" }}>Retry</button>
        </div>
      )}

      {/* ─── OVERVIEW ─── */}
      {tab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(5, 1fr)", gap: 12 }}>
            {/* FIX: Total P&L → charts */}
            <KPI T={T} label="Total P&L" value={fmt(totalPnL)} sub={closed.length + " closed"} color={totalPnL >= 0 ? T.green : T.red} onClick={() => setTab("charts")} />
            {/* FIX: Win Rate → insights, sub shows flat count */}
            <KPI T={T} label="Win Rate" value={winRate + "%"} sub={wins.length + "W · " + losses.length + "L · " + flats.length + "F"} color={winRate >= 55 ? T.green : winRate >= 40 ? T.amber : T.red} onClick={() => setTab("insights")} />
            {/* FIX: Profit Factor → insights, green when above target, shows avg loss */}
            <KPI T={T} label="Profit Factor" value={pf} sub={"Avg W ₹" + avgWin.toFixed(0) + " · L ₹" + Math.abs(avgLoss).toFixed(0)} color={pfNum >= 1.5 ? T.green : T.purple} onClick={() => setTab("insights")} />
            {/* FIX: Streak uses day-based calculation */}
            <KPI T={T} label="Streak" value={streak > 0 ? streak + " " + (streakType === "W" ? "Wins" : "Losses") : "—"} sub={streak > 0 ? "Current " + (streakType === "W" ? "win" : "loss") + " run (by day)" : "No data"} color={streakType === "W" ? T.green : streakType === "L" ? T.red : T.muted} />
            <KPI T={T} label="Open Now" value={open.length} sub={open.length > 0 ? "Need action" : "All clear"} color={open.length > 0 ? T.accent : T.muted} onClick={open.length > 0 ? () => setTab("today") : undefined} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr" : "1fr 1fr", gap: 16 }}>
            <Card T={T} accent={T.green}>
              <SLabel color={T.green} T={T}>Win / Loss Breakdown</SLabel>
              <div style={{ height: 10, borderRadius: 5, overflow: "hidden", background: T.bg, display: "flex", marginBottom: 12 }}>
                <div style={{ width: winRate + "%", background: "linear-gradient(90deg," + T.green + ",#059669)", transition: "width 1.2s ease" }} />
                <div style={{ flex: 1, background: "linear-gradient(90deg," + T.red + ",#dc2626)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ color: T.green, fontWeight: 700, fontSize: 13, fontFamily: "DM Mono, monospace" }}>{wins.length} wins ({winRate}%)</span>
                <span style={{ color: T.muted, fontSize: 13, fontFamily: "DM Mono, monospace" }}>{flats.length} flat</span>
                <span style={{ color: T.red, fontWeight: 700, fontSize: 13, fontFamily: "DM Mono, monospace" }}>{losses.length} losses</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[["Best","+₹"+best.toFixed(0),T.green],["Worst","₹"+worst.toFixed(0),T.red],["Avg Win","+₹"+avgWin.toFixed(0),T.green],["Avg Loss","₹"+Math.abs(avgLoss).toFixed(0),T.red]].map(([l,v,c]) => (
                  <div key={l as string} style={{ background: T.bg, borderRadius: 8, padding: "8px 12px", border: "1px solid " + T.border }}>
                    <div style={{ fontSize: 9, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{l}</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c as string, fontFamily: "DM Mono, monospace", marginTop: 3 }}>{v}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card T={T} accent={T.accent}>
              <SLabel color={T.accent} T={T}>Latest Session</SLabel>
              {review?.summary
                ? <>
                    <div style={{ fontSize: 12, color: T.text, lineHeight: "1.8", fontFamily: "DM Sans, sans-serif", borderLeft: "2px solid " + T.accent + "55", paddingLeft: 12, marginBottom: 12 }}>
                      {/* FIX: truncate at sentence boundary */}
                      {(() => {
                        const s = review.summary;
                        if (s.length <= 280) return s;
                        const cut = s.slice(0, 280);
                        const lastDot = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("| "), cut.lastIndexOf(". "));
                        return (lastDot > 180 ? s.slice(0, lastDot + 1) : cut) + "...";
                      })()}
                    </div>
                    <div style={{ fontSize: 9, color: T.dim, fontFamily: "DM Mono, monospace" }}>{review.title} · {review.date}</div>
                  </>
                : <div style={{ color: T.dim, fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>No session review found. Press R to refresh.</div>
              }
            </Card>
          </div>

          <Card T={T}>
            <SLabel T={T}>System Parameters</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              {[
                ["₹","Capital / Trade","₹2,000",T.amber],
                ["↓","Stop Loss","1% below",T.red],
                ["↑","Target","2% above",T.green],
                ["⏱","Exit Deadline","15:00 IST",T.accent],
                ["◈","Strategy","ORB + MR",T.purple],
                ["◎","Universe","Nifty 100",T.muted],
                ["∑","EV / Trade", (() => {
                  if (!closed.length) return "—";
                  const wr = wins.length / closed.length;
                  const ev = (wr * avgWin) - ((1-wr) * Math.abs(avgLoss));
                  return (ev >= 0 ? "+" : "") + "₹" + ev.toFixed(0);
                })(), T.teal],
                ["◑","Profit Factor",pf + "×",pfNum >= 1.5 ? T.green : T.amber],
              ].map(([icon,label,val,color]) => (
                <div key={label as string} style={{ background: T.bg, borderRadius: 8, padding: "11px 14px", border: "1px solid " + T.border, display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: (color as string)+"18", border: "1px solid "+(color as string)+"30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: color as string, flexShrink: 0, fontFamily: "DM Mono, monospace", fontWeight: 700 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: color as string, fontFamily: "DM Mono, monospace", marginTop: 2 }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ─── TODAY ─── */}
      {tab === "today" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12 }}>
            <KPI T={T} label="Today P&L" value={fmt(todayPnL)} sub={todayTrades.filter(t => t.status === "⚫ CLOSED").length + " closed"} color={todayPnL >= 0 ? T.green : T.red} />
            <KPI T={T} label="Needs Action" value={todayOpen.length} sub="Pending/Approved/Executed" color={todayOpen.length > 0 ? T.amber : T.muted} />
            <KPI T={T} label="Total Today" value={todayTrades.length} sub="All trades logged" color={T.accent} />
          </div>
          {todayTrades.length === 0
            ? <Card T={T} style={{ padding: 48, textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
                <div style={{ color: T.muted, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>No trades logged today yet.</div>
              </Card>
            : <Card T={T} style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 20px", borderBottom: "1px solid " + T.border, background: T.bg }}>
                  <SLabel T={T}>Today&apos;s Trades</SLabel>
                </div>
                {!mobile && (
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 110px 90px 90px 60px 90px 1fr",
                    padding: "7px 20px", borderBottom: "1px solid " + T.border, background: T.bg }}>
                    {["Trade","Status","Entry","SL","Target","Qty","P&L","Actions"].map(h => (
                      <div key={h} style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{h}</div>
                    ))}
                  </div>
                )}
                {todayTrades.map(t => (
                  <TradeRow key={t.id} trade={t} updating={updating} onAction={updateStatus} mobile={mobile} T={T} />
                ))}
              </Card>
          }
        </div>
      )}

      {/* ─── INSIGHTS ─── */}
      {tab === "insights" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card T={T} accent={T.accent}>
            {/* FIX: Phase 2 tooltip */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <div style={{ width: 3, height: 14, borderRadius: 2, background: T.accent }} />
              <div style={{ fontSize: 10, letterSpacing: 2.5, color: T.accent, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>Phase 2 Progress</div>
              <Tip text="60 days paper + 55%+ win rate → unlocks ₹5,000–10,000 per trade" T={T} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10, marginBottom: 16 }}>
              <Metric T={T} label="Days Logged" value={daysLogged} sub={"of " + daysTarget + " target"} color={T.accent} />
              <Metric T={T} label="Win Rate" value={winRate + "%"} sub={winRate >= 55 ? "✓ target met" : "need 55%"} color={winRate >= 55 ? T.green : T.amber} />
              <Metric T={T} label="Trend" value={closed.length >= 4 ? (improving ? "↑ Improving" : "↓ Declining") : "—"} sub={closed.length >= 4 ? (wrFirst + "% → " + wrSecond + "%") : "need more data"} color={improving ? T.green : T.red} />
              <Metric T={T} label="Profit Factor" value={pf} sub={pfNum >= 1.5 ? "✓ target met" : "target: 1.5+"} color={pfNum >= 1.5 ? T.green : T.amber} />
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: T.text, fontFamily: "DM Sans, sans-serif" }}>Days progress ({daysLogged}/{daysTarget})</span>
                <span style={{ fontSize: 11, color: T.accent, fontWeight: 700, fontFamily: "DM Mono, monospace" }}>{daysPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: T.bg, overflow: "hidden" }}>
                <div style={{ width: daysPct + "%", height: "100%", borderRadius: 4,
                  background: "linear-gradient(90deg," + T.accent + "," + T.purple + ")",
                  transition: "width 1s ease" }} />
              </div>
            </div>
          </Card>

          <Card T={T} accent={T.red}>
            <SLabel color={T.red} T={T}>Risk Metrics</SLabel>
            <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4, 1fr)", gap: 10 }}>
              <Metric T={T} label="SL Hit Rate" value={slRate + "%"} sub={slHits + " of " + closed.length + " trades"} color={slRate < 40 ? T.green : T.red} />
              <Metric T={T} label="Max Drawdown" value={"₹" + maxDd.toFixed(0)} sub="peak to trough" color={maxDd > 200 ? T.red : T.amber} />
              <Metric T={T} label="Avg Loss" value={"₹" + Math.abs(avgLoss).toFixed(0)} sub="per losing trade" color={T.red} />
              <Metric T={T} label="Avg Win" value={"₹" + avgWin.toFixed(0)} sub={"ratio " + (Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(1) : "—") + ":1"} color={T.green} />
            </div>
          </Card>

          {dailyWrData.length > 0 && (
            <Card T={T}>
              <SLabel color={T.purple} T={T}>Win Rate by Session</SLabel>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailyWrData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  {cg}
                  <XAxis dataKey="date" {...xAP} />
                  <YAxis domain={[0,100]} {...yAP} />
                  <Tooltip content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div style={{ background: T.surface, border: "1px solid " + T.borderHi, borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: T.muted, fontFamily: "DM Sans, sans-serif" }}>{label}</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: T.purple, fontFamily: "DM Mono, monospace" }}>{payload[0].value}% win rate</div>
                      </div>
                    );
                  }} cursor={{ fill: T.border + "55" }} />
                  <Bar dataKey="wr" radius={[3,3,0,0]}>
                    {dailyWrData.map((e,i) => (
                      <Cell key={i} fill={e.wr >= 55 ? T.green : e.wr >= 33 ? T.amber : T.red} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, justifyContent: "center", marginTop: 8 }}>
                {[[T.green,"≥55% (target)"],[T.amber,"33–54%"],[T.red,"<33%"]].map(([c,l]) => (
                  <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, background: c as string }} />
                    <span style={{ fontSize: 10, color: T.muted, fontFamily: "DM Sans, sans-serif" }}>{l}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {Object.keys(stratMap).length > 0 && (
            <Card T={T}>
              <SLabel color={T.amber} T={T}>Strategy Scorecard</SLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(stratMap).sort(([,a],[,b]) => b.pnl - a.pnl).map(([name, d]) => {
                  const wr = Math.round((d.wins / d.total) * 100);
                  const info = STRATEGY_INFO[name] || STRATEGY_INFO["Other"];
                  const spf = d.wins > 0 && (d.total - d.wins) > 0
                    ? (d.wins * Math.abs(avgWin) / ((d.total - d.wins) * Math.abs(avgLoss))).toFixed(1)
                    : "—";
                  return (
                    <div key={name} style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 80px 60px" : "120px 1fr 80px 80px 70px",
                      alignItems: "center", gap: 10, padding: "10px 14px",
                      background: T.bg, borderRadius: 8, border: "1px solid " + T.border }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 14 }}>{info.icon}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{name}</span>
                      </div>
                      {!mobile && (
                        <div style={{ position: "relative", height: 6, background: T.border, borderRadius: 3 }}>
                          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: wr + "%",
                            background: wr >= 55 ? T.green : wr >= 40 ? T.amber : T.red, borderRadius: 3 }} />
                        </div>
                      )}
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: d.pnl >= 0 ? T.green : T.red, fontFamily: "DM Mono, monospace" }}>{d.pnl >= 0 ? "+" : ""}₹{d.pnl}</div>
                        <div style={{ fontSize: 9, color: T.dim, fontFamily: "DM Mono, monospace" }}>{d.total} trades</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: wr >= 55 ? T.green : T.amber, fontFamily: "DM Mono, monospace" }}>{wr}%</div>
                        <div style={{ fontSize: 9, color: T.dim, fontFamily: "DM Mono, monospace" }}>{d.wins}W/{d.total-d.wins}L</div>
                      </div>
                      {!mobile && (
                        <div style={{ textAlign: "right", fontSize: 10, color: T.muted, fontFamily: "DM Mono, monospace" }}>PF {spf}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── INTELLIGENCE ─── */}
      {tab === "intelligence" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(3, 1fr)", gap: 12 }}>
            <KPI T={T} label="Trading Days" value={daysLogged} sub={"of " + daysTarget + " to Phase 2"} color={T.accent} onClick={() => setTab("insights")} />
            <KPI T={T} label="Active Rules" value={fw?.rules?.length || "—"} sub="governing today's trades" color={T.purple} />
            <KPI T={T} label="Learnings" value={fw?.learnings?.length || "—"} sub={"+ " + (fw?.hypotheses?.length || 0) + " hypotheses"} color={T.amber} />
          </div>

          {fw?.rules?.length ? (
            <Card T={T} accent={T.purple}>
              <SLabel color={T.purple} T={T}>Active Rules ({fw.rules.length})</SLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fw.rules.map(r => (
                  <div key={r.id} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                    padding: "10px 14px", background: T.bg, borderRadius: 8,
                    border: "1px solid " + T.border }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.purple,
                      fontFamily: "DM Mono, monospace", minWidth: 32, paddingTop: 1 }}>{r.id}</div>
                    <div style={{ fontSize: 12, color: T.text, fontFamily: "DM Sans, sans-serif", lineHeight: "1.6", flex: 1 }}>{r.text}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card T={T} accent={T.purple}>
              <SLabel color={T.purple} T={T}>Active Rules</SLabel>
              <div style={{ color: T.dim, fontSize: 12, fontFamily: "DM Sans, sans-serif", textAlign: "center", padding: "20px 0" }}>
                Rules parsing pending — framework doc section heading needs update.<br />
                <span style={{ fontSize: 10, marginTop: 4, display: "block" }}>All 23 rules are stored in Notion Trading Intelligence Framework.</span>
              </div>
            </Card>
          )}

          {fw?.learnings?.length ? (
            <Card T={T} accent={T.amber}>
              <SLabel color={T.amber} T={T}>Learnings Log ({fw.learnings.length})</SLabel>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
                {LEARNING_GROUPS.map(g => (
                  <button key={g.label} onClick={() => setLgGroup(lgGroup === g.label ? null : g.label)}
                    style={{ background: lgGroup === g.label ? g.color + "22" : T.bg,
                      border: "1px solid " + (lgGroup === g.label ? g.color : T.border),
                      borderRadius: 6, padding: "4px 10px", fontSize: 10, color: lgGroup === g.label ? g.color : T.muted,
                      cursor: "pointer", fontFamily: "DM Sans, sans-serif", fontWeight: lgGroup === g.label ? 700 : 400, outline: "none" }}>
                    {g.label}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {fw.learnings
                  .filter(l => !lgGroup || LEARNING_GROUPS.find(g => g.label === lgGroup)?.ids.includes(l.id))
                  .map(l => {
                    const group = LEARNING_GROUPS.find(g => g.ids.includes(l.id));
                    return (
                      <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "flex-start",
                        padding: "10px 14px", background: T.bg, borderRadius: 8,
                        border: "1px solid " + T.border,
                        borderLeft: group ? "3px solid " + group.color : "3px solid " + T.border }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: group?.color || T.amber,
                          fontFamily: "DM Mono, monospace", minWidth: 28, paddingTop: 1 }}>{l.id}</div>
                        <div style={{ fontSize: 12, color: T.text, fontFamily: "DM Sans, sans-serif", lineHeight: "1.6" }}>{l.text}</div>
                      </div>
                    );
                  })}
              </div>
            </Card>
          ) : null}

          {fw?.hypotheses?.length ? (
            <Card T={T} accent={T.teal}>
              <SLabel color={T.teal} T={T}>Hypothesis Tracker</SLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {fw.hypotheses.map(h => (
                  <div key={h.id} style={{ display: "grid", gridTemplateColumns: "32px 1fr auto",
                    gap: 12, alignItems: "flex-start", padding: "12px 14px",
                    background: T.bg, borderRadius: 8, border: "1px solid " + T.border }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: T.teal, fontFamily: "DM Mono, monospace" }}>{h.id}</div>
                    <div style={{ fontSize: 12, color: T.text, fontFamily: "DM Sans, sans-serif", lineHeight: "1.6" }}>{h.text}</div>
                    <HBadge status={h.status} T={T} />
                  </div>
                ))}
              </div>
            </Card>
          ) : null}

          {review?.summary && (
            <Card T={T} accent={T.accent}>
              <SLabel color={T.accent} T={T}>Latest Daily Review</SLabel>
              <div style={{ fontSize: 12, color: T.text, lineHeight: "1.8", fontFamily: "DM Sans, sans-serif",
                borderLeft: "2px solid " + T.accent + "55", paddingLeft: 12, marginBottom: 12 }}>
                {review.summary.slice(0, 500)}{review.summary.length > 500 ? "..." : ""}
              </div>
              <div style={{ fontSize: 9, color: T.dim, fontFamily: "DM Mono, monospace" }}>{review.title} · {review.date}</div>
            </Card>
          )}
        </div>
      )}

      {/* ─── CHARTS ─── */}
      {tab === "charts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {cumData.length > 0 && (
            <Card T={T}>
              <SLabel color={T.green} T={T}>Cumulative P&L</SLabel>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={cumData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  {cg}
                  <XAxis dataKey="date" {...xAP} />
                  <YAxis {...yAP} />
                  <Tooltip content={<CT />} />
                  <Line type="monotone" dataKey="pnl" stroke={totalPnL >= 0 ? T.green : T.red}
                    strokeWidth={2} dot={{ r: 4, fill: totalPnL >= 0 ? T.green : T.red }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {dailyData.length > 0 && (
            <Card T={T}>
              <SLabel color={T.accent} T={T}>Daily P&L</SLabel>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  {cg}
                  <XAxis dataKey="date" {...xAP} />
                  <YAxis {...yAP} />
                  <Tooltip {...ttP} />
                  <Bar dataKey="pnl" radius={[3,3,0,0]}>
                    {dailyData.map((e,i) => <Cell key={i} fill={e.pnl >= 0 ? T.green : T.red} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* FIX: DoW chart shows insufficient data warning */}
          {dowData.some(d => d.pnl !== 0) && (
            <Card T={T}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <SLabel color={T.amber} T={T}>P&L by Day of Week</SLabel>
                {insufficientDow && (
                  <span style={{ fontSize: 9, color: T.amber, fontFamily: "DM Mono, monospace",
                    background: T.amberBg, padding: "2px 8px", borderRadius: 4,
                    border: "1px solid " + T.amber + "40", marginBottom: 16 }}>
                    ⚠ LOW DATA — {Object.keys(dailyMap).length} days
                  </span>
                )}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dowData} margin={{ top: 4, right: 4, left: -20, bottom: 4 }}>
                  {cg}
                  <XAxis dataKey="day" {...xAP} />
                  <YAxis {...yAP} />
                  <Tooltip {...ttP} />
                  <Bar dataKey="pnl" radius={[3,3,0,0]}>
                    {dowData.map((e,i) => <Cell key={i} fill={e.pnl >= 0 ? T.green : T.red} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {exitData.length > 0 && (
            <Card T={T}>
              <SLabel color={T.muted} T={T}>Exit Type Distribution</SLabel>
              <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "repeat(4,1fr)", gap: 10 }}>
                {exitData.map(e => (
                  <div key={e.type} style={{ background: T.bg, borderRadius: 8, padding: "12px 14px", border: "1px solid " + T.border, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: T.accent, fontFamily: "DM Mono, monospace" }}>{e.count}</div>
                    <div style={{ fontSize: 10, color: T.muted, fontFamily: "DM Sans, sans-serif", marginTop: 4 }}>{e.type}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {radarData.length > 0 && (
            <Card T={T}>
              <SLabel color={T.purple} T={T}>Strategy Win Rate Radar</SLabel>
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke={T.border} />
                  <PolarAngleAxis dataKey="strategy" tick={{ fontSize: 10, fill: T.muted, fontFamily: "DM Mono, monospace" }} />
                  <Radar name="Win Rate" dataKey="winRate" stroke={T.purple} fill={T.purple} fillOpacity={0.15} />
                </RadarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </div>
      )}

      {/* ─── STOCKS ─── */}
      {tab === "stocks" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {stockData.length > 0 ? (
            <Card T={T}>
              <SLabel T={T}>Stock Performance</SLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {stockData.map(s => (
                  <div key={s.stock} style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 80px 50px" : "140px 1fr 80px 60px 60px",
                    gap: 12, alignItems: "center", padding: "10px 14px",
                    background: T.bg, borderRadius: 8, border: "1px solid " + T.border }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.text, fontFamily: "DM Mono, monospace" }}>{s.stock}</div>
                    {!mobile && (
                      <div style={{ position: "relative", height: 6, background: T.border, borderRadius: 3 }}>
                        <div style={{ position: "absolute", left: s.pnl < 0 ? (50 + (s.pnl / Math.abs(worst)) * 50) + "%" : "50%",
                          width: Math.abs(s.pnl) / Math.max(Math.abs(best), Math.abs(worst)) * 50 + "%",
                          top: 0, height: "100%",
                          background: s.pnl >= 0 ? T.green : T.red, borderRadius: 3 }} />
                        <div style={{ position: "absolute", left: "50%", top: 0, width: 1, height: "100%", background: T.borderHi }} />
                      </div>
                    )}
                    <div style={{ fontWeight: 700, fontSize: 13, color: s.pnl >= 0 ? T.green : T.red, fontFamily: "DM Mono, monospace", textAlign: "right" }}>
                      {s.pnl >= 0 ? "+" : ""}₹{s.pnl}
                    </div>
                    <div style={{ fontSize: 11, color: T.muted, fontFamily: "DM Mono, monospace", textAlign: "right" }}>{s.wr}% WR</div>
                    {!mobile && <div style={{ fontSize: 10, color: T.dim, fontFamily: "DM Mono, monospace", textAlign: "right" }}>{s.count}T</div>}
                  </div>
                ))}
              </div>
            </Card>
          ) : (
            <Card T={T} style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <div style={{ color: T.muted, fontSize: 13, fontFamily: "DM Sans, sans-serif" }}>No closed trades yet to analyse.</div>
            </Card>
          )}
        </div>
      )}

      {/* ─── STRATEGY ─── */}
      {tab === "strategy" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {Object.entries(STRATEGY_INFO).filter(([k]) => k !== "Other").map(([name, info]) => {
            const d = stratMap[name];
            return (
              <Card key={name} T={T} accent={T.accent}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 24 }}>{info.icon}</div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, fontFamily: "DM Sans, sans-serif" }}>{name}</div>
                    <div style={{ fontSize: 12, color: T.muted, fontFamily: "DM Sans, sans-serif" }}>{info.short}</div>
                  </div>
                  {d && (
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: d.pnl >= 0 ? T.green : T.red, fontFamily: "DM Mono, monospace" }}>{d.pnl >= 0 ? "+" : ""}₹{d.pnl}</div>
                      <div style={{ fontSize: 10, color: T.muted, fontFamily: "DM Mono, monospace" }}>{Math.round(d.wins/d.total*100)}% WR · {d.total} trades</div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: T.muted, fontFamily: "DM Sans, sans-serif", lineHeight: "1.6",
                  background: T.bg, borderRadius: 8, padding: "10px 14px", border: "1px solid " + T.border }}>
                  <span style={{ fontWeight: 600, color: T.text }}>When to use: </span>{info.when}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ─── TRADE LOG ─── */}
      {tab === "log" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["ALL","PENDING","EXECUTED","CLOSED","REJECTED"].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                background: filter === f ? T.accent + "22" : T.card,
                border: "1px solid " + (filter === f ? T.accent : T.border),
                borderRadius: 6, padding: "5px 12px", fontSize: 11,
                color: filter === f ? T.accent : T.muted,
                cursor: "pointer", fontFamily: "DM Sans, sans-serif",
                fontWeight: filter === f ? 700 : 400, outline: "none" }}>
                {f} {f === "ALL" ? `(${trades.length})` : `(${trades.filter(t => t.status?.includes(f)).length})`}
              </button>
            ))}
          </div>
          <Card T={T} style={{ padding: 0, overflow: "hidden" }}>
            {!mobile && (
              <div style={{ display: "grid", gridTemplateColumns: "2fr 100px 110px 90px 90px 60px 90px 1fr",
                padding: "8px 20px", background: T.bg, borderBottom: "1px solid " + T.border }}>
                {["Trade","Status","Entry (Actual)","SL","Target","Qty","P&L","Actions"].map(h => (
                  <div key={h} style={{ fontSize: 8, color: T.dim, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "DM Sans, sans-serif" }}>{h}</div>
                ))}
              </div>
            )}
            {filtered.length === 0
              ? <div style={{ padding: 40, textAlign: "center", color: T.dim, fontSize: 12, fontFamily: "DM Sans, sans-serif" }}>No trades match this filter.</div>
              : filtered.map(t => (
                  <TradeRow key={t.id} trade={t} updating={updating} onAction={updateStatus} mobile={mobile} T={T} />
                ))
            }
          </Card>
        </div>
      )}
    </div>
  );

  /* ─── RENDER ─── */
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=DM+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        body { margin: 0; background: ${T.bg}; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
      `}</style>

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000,
          background: toast.ok ? T.greenBg : T.redBg,
          border: "1px solid " + (toast.ok ? T.green : T.red),
          borderRadius: 10, padding: "10px 16px", color: toast.ok ? T.green : T.red,
          fontSize: 12, fontFamily: "DM Sans, sans-serif", fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.15)", maxWidth: 300 }}>
          {toast.msg}
        </div>
      )}

      {mobile ? (
        <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: T.bg }}>
          <MobileHeader />
          <Content />
        </div>
      ) : (
        <div style={{ display: "flex", minHeight: "100vh", background: T.bg }}>
          <Sidebar />
          <Content />
        </div>
      )}
    </>
  );
}
