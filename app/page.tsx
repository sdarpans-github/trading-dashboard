"use client";
import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  "🟡 PENDING":  { color: "#f59e0b", bg: "#451a0322", label: "PENDING"  },
  "✅ APPROVED": { color: "#22c55e", bg: "#05280f33", label: "APPROVED" },
  "🔵 EXECUTED": { color: "#38bdf8", bg: "#0c1f2a33", label: "EXECUTED" },
  "⚫ CLOSED":   { color: "#94a3b8", bg: "#1e293b",   label: "CLOSED"   },
  "❌ REJECTED": { color: "#ef4444", bg: "#2d0a0a33", label: "REJECTED" },
};

type Trade = {
  id: string; createdTime: string; tradeName: string; stock: string;
  status: string; entryPrice: number | null; stopLoss: number | null;
  target: number | null; finalPnL: number | null; quantity: number | null;
  date: string | null; mode: string;
};

function Chip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#1e293b", label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`,
      borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "2px 8px",
      whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#0f172a", border: `1px solid ${color}33`,
      borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const val = payload[0].value;
    return (
      <div style={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, padding: "10px 14px" }}>
        <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: val >= 0 ? "#22c55e" : "#ef4444", fontFamily: "monospace" }}>
          {val >= 0 ? "+" : ""}₹{val.toFixed(0)}
        </div>
      </div>
    );
  }
  return null;
};

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [tab, setTab] = useState("overview");
  const [synced, setSynced] = useState<Date | null>(null);

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/trades");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setTrades(data.trades || []);
      setSynced(new Date());
    } catch { setError("Could not load trades. Try refreshing."); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Core stats
  const closed  = trades.filter(t => t.status === "⚫ CLOSED");
  const open    = trades.filter(t => ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));
  const wins    = closed.filter(t => (t.finalPnL ?? 0) > 0);
  const losses  = closed.filter(t => (t.finalPnL ?? 0) < 0);
  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winRate  = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;
  const avgWin   = wins.length ? wins.reduce((s,t) => s + (t.finalPnL ?? 0), 0) / wins.length : 0;
  const avgLoss  = losses.length ? losses.reduce((s,t) => s + (t.finalPnL ?? 0), 0) / losses.length : 0;
  const bestTrade = closed.length ? Math.max(...closed.map(t => t.finalPnL ?? 0)) : 0;
  const worstTrade = closed.length ? Math.min(...closed.map(t => t.finalPnL ?? 0)) : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : "—";

  // Daily P&L chart data
  const dailyPnL = closed.reduce((acc: Record<string, number>, t) => {
    const day = t.date?.split("T")[0] || t.createdTime?.split("T")[0] || "Unknown";
    acc[day] = (acc[day] || 0) + (t.finalPnL ?? 0);
    return acc;
  }, {});
  const pnlChartData = Object.entries(dailyPnL)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, pnl]) => ({
      date: date.slice(5),
      pnl: Math.round(pnl),
    }));

  // Cumulative P&L
  let cumulative = 0;
  const cumulativeData = pnlChartData.map(d => {
    cumulative += d.pnl;
    return { date: d.date, pnl: Math.round(cumulative) };
  });

  // Stock performance
  const stockPnL = closed.reduce((acc: Record<string, { pnl: number; count: number }>, t) => {
    const s = t.stock || t.tradeName?.split(" ")[0] || "Unknown";
    if (!acc[s]) acc[s] = { pnl: 0, count: 0 };
    acc[s].pnl += (t.finalPnL ?? 0);
    acc[s].count += 1;
    return acc;
  }, {});
  const stockChartData = Object.entries(stockPnL)
    .map(([stock, { pnl, count }]) => ({ stock, pnl: Math.round(pnl), count }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 8);

  // Strategy breakdown
  const strategyMap = closed.reduce((acc: Record<string, { pnl: number; wins: number; total: number }>, t) => {
    const name = t.tradeName || "";
    let strategy = "Other";
    if (name.includes("ORB")) strategy = "ORB";
    else if (name.includes("Mean Reversion")) strategy = "Mean Reversion";
    else if (name.includes("Momentum")) strategy = "Momentum";
    else if (name.includes("Dual Signal")) strategy = "Dual Signal";
    else if (name.includes("Crisis")) strategy = "Crisis Play";
    if (!acc[strategy]) acc[strategy] = { pnl: 0, wins: 0, total: 0 };
    acc[strategy].pnl += (t.finalPnL ?? 0);
    acc[strategy].total += 1;
    if ((t.finalPnL ?? 0) > 0) acc[strategy].wins += 1;
    return acc;
  }, {});

  // Clock
  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes();
  const mktOpen = (h > 9 || (h === 9 && m >= 15)) && h < 15;
  const istStr  = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const minsTo3 = mktOpen ? (15 * 60) - (h * 60 + m) : 0;

  const filtered = filter === "ALL" ? trades : trades.filter(t => t.status?.includes(filter));

  const tabs = [
    { key: "overview", label: "📊 Overview" },
    { key: "charts",   label: "📈 Charts" },
    { key: "stocks",   label: "🏆 Stocks" },
    { key: "strategy", label: "📐 Strategy" },
    { key: "log",      label: "📋 Trade Log" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#e2e8f0",
      fontFamily: "sans-serif", paddingBottom: 60 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#334155;border-radius:2px}`}
      </style>

      {/* Header */}
      <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "15px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900 }}>₹</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Paper Trading Desk</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1.5 }}>NIFTY 50 · ORB · PAPER MODE</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: mktOpen ? "#22c55e" : "#ef4444" }}>
              {mktOpen ? "● OPEN" : "● CLOSED"}
              {mktOpen && <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 8 }}>
                {Math.floor(minsTo3 / 60)}h {minsTo3 % 60}m to 3 PM
              </span>}
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{istStr} IST</div>
          </div>
          <button onClick={load} disabled={loading} style={{
            background: loading ? "#1e293b" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
            border: "none", borderRadius: 9, color: "#fff", padding: "8px 14px",
            fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer",
            display: "flex", alignItems: "center", gap: 6 }}>
            {loading
              ? <span style={{ width: 13, height: 13, border: "2px solid #fff4",
                  borderTopColor: "#fff", borderRadius: "50%", display: "inline-block",
                  animation: "spin 0.7s linear infinite" }} />
              : "↻"} {loading ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 0" }}>
        {error && <div style={{ background: "#2d0a0a", border: "1px solid #ef4444",
          borderRadius: 10, padding: "11px 18px", marginBottom: 18,
          color: "#ef4444", fontSize: 13 }}>⚠ {error}</div>}

        {/* Stat Cards */}
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat label="Total P&L"    value={`${totalPnL >= 0 ? "+" : ""}₹${totalPnL.toFixed(0)}`}
            sub={`${closed.length} closed trades`}            color={totalPnL >= 0 ? "#22c55e" : "#ef4444"} />
          <Stat label="Win Rate"     value={`${winRate}%`}
            sub={`${wins.length}W · ${losses.length}L`}       color="#f59e0b" />
          <Stat label="Profit Factor" value={profitFactor}
            sub={`Avg W: ₹${avgWin.toFixed(0)}`}              color="#6366f1" />
          <Stat label="Best Trade"   value={`+₹${bestTrade.toFixed(0)}`}
            sub={`Worst: ₹${worstTrade.toFixed(0)}`}          color="#22c55e" />
          <Stat label="Open"         value={open.length}
            sub="Pending/Approved/Executed"                    color="#38bdf8" />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, flexWrap: "wrap" }}>
          {tabs.map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key)} style={{
              background: tab === key ? "#1e293b" : "transparent",
              border: tab === key ? "1px solid #334155" : "1px solid transparent",
              color: tab === key ? "#e2e8f0" : "#475569",
              borderRadius: 8, padding: "7px 14px", fontSize: 12,
              fontWeight: 600, cursor: "pointer" }}>{label}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Win/Loss bar */}
            <div style={{ background: "#0d1929", border: "1px solid #1e293b",
              borderRadius: 14, padding: "22px 24px", gridColumn: "1/-1" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, color: "#475569",
                textTransform: "uppercase", fontWeight: 700, marginBottom: 14 }}>
                Win / Loss Ratio
              </div>
              <div style={{ height: 16, borderRadius: 8, overflow: "hidden",
                background: "#1e293b", display: "flex" }}>
                <div style={{ width: `${winRate}%`,
                  background: "linear-gradient(90deg,#22c55e,#16a34a)",
                  transition: "width 1s ease" }} />
                <div style={{ flex: 1,
                  background: "linear-gradient(90deg,#ef4444,#b91c1c)" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between",
                marginTop: 9, fontSize: 12 }}>
                <span style={{ color: "#22c55e", fontWeight: 700 }}>✓ {wins.length} Wins ({winRate}%)</span>
                <span style={{ color: "#ef4444", fontWeight: 700 }}>{losses.length} Losses</span>
              </div>
            </div>

            {/* Key metrics */}
            {[
              ["💰", "Capital / Trade", "₹2,000", "#f59e0b"],
              ["🛑", "Stop Loss", "1% below entry", "#ef4444"],
              ["🎯", "Target", "2% above entry", "#22c55e"],
              ["⏰", "Exit Deadline", "3:00 PM IST", "#38bdf8"],
              ["📐", "Strategy", "ORB + Mean Reversion", "#6366f1"],
              ["🇮🇳", "Universe", "Nifty 50 only", "#f97316"],
            ].map(([icon, label, val, color]) => (
              <div key={label as string} style={{ background: "#0d1929",
                border: "1px solid #1e293b", borderRadius: 13, padding: "16px 20px",
                display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                <div>
                  <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase",
                    letterSpacing: 1, marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: color as string }}>{val}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── CHARTS TAB ── */}
        {tab === "charts" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Daily P&L */}
            <div style={{ background: "#0d1929", border: "1px solid #1e293b",
              borderRadius: 14, padding: "22px 24px" }}>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1.5,
                textTransform: "uppercase", fontWeight: 700, marginBottom: 20 }}>
                Daily P&L
              </div>
              {pnlChartData.length === 0
                ? <div style={{ textAlign: "center", color: "#334155", padding: 40 }}>No closed trades yet</div>
                : <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={pnlChartData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {pnlChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
              }
            </div>

            {/* Cumulative P&L */}
            <div style={{ background: "#0d1929", border: "1px solid #1e293b",
              borderRadius: 14, padding: "22px 24px" }}>
              <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1.5,
                textTransform: "uppercase", fontWeight: 700, marginBottom: 20 }}>
                Cumulative P&L
              </div>
              {cumulativeData.length === 0
                ? <div style={{ textAlign: "center", color: "#334155", padding: 40 }}>No closed trades yet</div>
                : <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={cumulativeData} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis tick={{ fontSize: 11, fill: "#475569" }} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="pnl" stroke="#6366f1"
                        strokeWidth={2} dot={{ fill: "#6366f1", r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
              }
            </div>
          </div>
        )}

        {/* ── STOCKS TAB ── */}
        {tab === "stocks" && (
          <div style={{ background: "#0d1929", border: "1px solid #1e293b",
            borderRadius: 14, padding: "22px 24px" }}>
            <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1.5,
              textTransform: "uppercase", fontWeight: 700, marginBottom: 20 }}>
              P&L by Stock (Top 8)
            </div>
            {stockChartData.length === 0
              ? <div style={{ textAlign: "center", color: "#334155", padding: 40 }}>No closed trades yet</div>
              : <>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stockChartData} layout="vertical"
                      margin={{ top: 4, right: 16, left: 16, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} />
                      <YAxis dataKey="stock" type="category"
                        tick={{ fontSize: 11, fill: "#94a3b8" }} width={80} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                        {stockChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.pnl >= 0 ? "#22c55e" : "#ef4444"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                    {stockChartData.map(s => (
                      <div key={s.stock} style={{ display: "flex", justifyContent: "space-between",
                        alignItems: "center", padding: "10px 14px",
                        background: "#0f172a", borderRadius: 9 }}>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{s.stock}</span>
                        <span style={{ fontSize: 11, color: "#475569" }}>{s.count} trade{s.count > 1 ? "s" : ""}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 13,
                          color: s.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                          {s.pnl >= 0 ? "+" : ""}₹{s.pnl}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
            }
          </div>
        )}

        {/* ── STRATEGY TAB ── */}
        {tab === "strategy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {Object.keys(strategyMap).length === 0
              ? <div style={{ background: "#0d1929", border: "1px solid #1e293b",
                  borderRadius: 14, padding: 48, textAlign: "center", color: "#334155" }}>
                  No closed trades yet
                </div>
              : Object.entries(strategyMap)
                  .sort(([,a],[,b]) => b.pnl - a.pnl)
                  .map(([name, data]) => {
                    const wr = Math.round((data.wins / data.total) * 100);
                    return (
                      <div key={name} style={{ background: "#0d1929",
                        border: "1px solid #1e293b", borderRadius: 14, padding: "20px 24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between",
                          alignItems: "center", marginBottom: 14 }}>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 14 }}>{name}</div>
                            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                              {data.total} trades · {wr}% win rate
                            </div>
                          </div>
                          <div style={{ fontFamily: "monospace", fontSize: 18, fontWeight: 900,
                            color: data.pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                            {data.pnl >= 0 ? "+" : ""}₹{data.pnl.toFixed(0)}
                          </div>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, overflow: "hidden",
                          background: "#1e293b", display: "flex" }}>
                          <div style={{ width: `${wr}%`,
                            background: "linear-gradient(90deg,#22c55e,#16a34a)" }} />
                          <div style={{ flex: 1,
                            background: "linear-gradient(90deg,#ef4444,#b91c1c)" }} />
                        </div>
                      </div>
                    );
                  })
            }
          </div>
        )}

        {/* ── TRADE LOG TAB ── */}
        {tab === "log" && (
          <div style={{ background: "#0d1929", border: "1px solid #1e293b",
            borderRadius: 14, overflow: "hidden" }}>
            {/* Filter bar */}
            <div style={{ display: "flex", gap: 6, padding: "13px 16px",
              borderBottom: "1px solid #1e293b", alignItems: "center", flexWrap: "wrap" }}>
              {["ALL","PENDING","APPROVED","EXECUTED","CLOSED","REJECTED"].map(f => (
                <button key={f} onClick={() => setFilter(f)} style={{
                  background: filter === f ? "#1e3a5f" : "transparent",
                  border: filter === f ? "1px solid #38bdf8" : "1px solid #1e293b",
                  color: filter === f ? "#38bdf8" : "#475569",
                  borderRadius: 6, padding: "3px 10px", fontSize: 10,
                  fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>{f}</button>
              ))}
              {synced && <span style={{ marginLeft: "auto", fontSize: 10,
                color: "#334155", fontFamily: "monospace" }}>
                Synced {synced.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST
              </span>}
            </div>
            {/* Col headers */}
            <div style={{ display: "grid",
              gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 1fr",
              padding: "9px 16px", fontSize: 9, letterSpacing: 1.5, color: "#334155",
              textTransform: "uppercase", fontWeight: 700,
              borderBottom: "1px solid #1e293b", gap: 8 }}>
              <div>Trade</div><div>Status</div><div>Entry</div>
              <div>SL</div><div>Target</div><div>Qty</div><div>P&L</div>
            </div>
            {loading
              ? <div style={{ padding: 48, textAlign: "center", color: "#334155" }}>
                  <div style={{ width: 26, height: 26, border: "3px solid #1e293b",
                    borderTopColor: "#38bdf8", borderRadius: "50%",
                    animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />
                  Fetching from Notion…
                </div>
              : filtered.length === 0
                ? <div style={{ padding: 48, textAlign: "center",
                    color: "#334155", fontSize: 14 }}>
                    No trades{filter !== "ALL" ? ` matching "${filter}"` : ""}.
                  </div>
                : filtered.map(t => {
                    const pnl = t.finalPnL;
                    return (
                      <div key={t.id} style={{ display: "grid",
                        gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 1fr",
                        padding: "12px 16px", borderBottom: "1px solid #0f172a",
                        gap: 8, alignItems: "center" }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 12,
                            color: "#e2e8f0", lineHeight: 1.3 }}>
                            {t.tradeName || t.stock || "—"}
                          </div>
                          <div style={{ fontSize: 10, color: "#334155", marginTop: 2 }}>
                            {t.date?.split("T")[0] || t.createdTime?.split("T")[0] || ""}
                          </div>
                        </div>
                        <Chip status={t.status} />
                        <div style={{ fontFamily: "monospace", fontSize: 12,
                          color: "#94a3b8" }}>
                          {t.entryPrice ? `₹${t.entryPrice}` : "—"}
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 12,
                          color: "#ef444499" }}>
                          {t.stopLoss ? `₹${t.stopLoss}` : "—"}
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 12,
                          color: "#38bdf899" }}>
                          {t.target ? `₹${t.target}` : "—"}
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 12,
                          color: "#64748b" }}>
                          {t.quantity ?? "—"}
                        </div>
                        <div style={{ fontFamily: "monospace", fontSize: 13,
                          fontWeight: 700,
                          color: pnl == null ? "#475569" : pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                          {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}₹${pnl.toFixed(0)}`}
                        </div>
                      </div>
                    );
                  })
            }
            {/* Summary row */}
            {filtered.length > 0 && closed.length > 0 && (
              <div style={{ display: "grid",
                gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 1fr",
                padding: "12px 16px", gap: 8, alignItems: "center",
                background: "#0f172a", borderTop: "1px solid #1e293b" }}>
                <div style={{ fontSize: 11, color: "#475569", fontWeight: 700 }}>
                  TOTAL ({closed.length} closed)
                </div>
                <div /><div /><div /><div /><div />
                <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 900,
                  color: totalPnL >= 0 ? "#22c55e" : "#ef4444" }}>
                  {totalPnL >= 0 ? "+" : ""}₹{totalPnL.toFixed(0)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
