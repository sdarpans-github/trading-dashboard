"use client";
import { useEffect, useState } from "react";

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
  target: number | null; finalPnL: number | null; quantity: number | null; date: string | null;
};

function Chip({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] || { color: "#64748b", bg: "#1e293b", label: status };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}55`, borderRadius: 5, fontSize: 10, fontWeight: 800, letterSpacing: 1, padding: "2px 8px" }}>
      {cfg.label}
    </span>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string | number; sub: string; color: string }) {
  return (
    <div style={{ flex: 1, minWidth: 130, background: "#0f172a", border: `1px solid ${color}33`, borderRadius: 14, padding: "18px 20px" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#475569", textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color, fontFamily: "monospace", lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, color: "#475569", marginTop: 5 }}>{sub}</div>
    </div>
  );
}

export default function Dashboard() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("ALL");
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

  const closed  = trades.filter(t => t.status === "⚫ CLOSED");
  const open    = trades.filter(t => ["🟡 PENDING","✅ APPROVED","🔵 EXECUTED"].includes(t.status));
  const wins    = closed.filter(t => (t.finalPnL ?? 0) > 0);
  const losses  = closed.filter(t => (t.finalPnL ?? 0) < 0);
  const totalPnL = closed.reduce((s, t) => s + (t.finalPnL ?? 0), 0);
  const winRate  = closed.length ? Math.round((wins.length / closed.length) * 100) : 0;

  const now = new Date();
  const ist = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const h = ist.getHours(), m = ist.getMinutes();
  const mktOpen = (h > 9 || (h === 9 && m >= 15)) && h < 15;
  const istStr  = ist.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  const minsTo3 = mktOpen ? (15 * 60) - (h * 60 + m) : 0;

  const filtered = filter === "ALL" ? trades : trades.filter(t => t.status?.includes(filter));

  return (
    <div style={{ minHeight: "100vh", background: "#020817", color: "#e2e8f0", fontFamily: "sans-serif", paddingBottom: 60 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} *{box-sizing:border-box}`}</style>

      {/* Header */}
      <div style={{ background: "#0f172a", borderBottom: "1px solid #1e293b", padding: "15px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 900 }}>₹</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>Paper Trading Desk</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1.5 }}>NIFTY 50 · ORB · PAPER MODE</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: mktOpen ? "#22c55e" : "#ef4444" }}>
              {mktOpen ? "● OPEN" : "● CLOSED"}
              {mktOpen && <span style={{ color: "#f59e0b", fontSize: 11, marginLeft: 8 }}>{Math.floor(minsTo3 / 60)}h {minsTo3 % 60}m to 3 PM</span>}
            </div>
            <div style={{ fontSize: 11, color: "#475569", fontFamily: "monospace" }}>{istStr} IST</div>
          </div>
          <button onClick={load} disabled={loading} style={{ background: loading ? "#1e293b" : "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", borderRadius: 9, color: "#fff", padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: loading ? "default" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            {loading ? <span style={{ width: 13, height: 13, border: "2px solid #fff4", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} /> : "↻"} {loading ? "Syncing…" : "Refresh"}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px 0" }}>
        {error && <div style={{ background: "#2d0a0a", border: "1px solid #ef4444", borderRadius: 10, padding: "11px 18px", marginBottom: 18, color: "#ef4444", fontSize: 13 }}>⚠ {error}</div>}

        {/* Stats */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 24 }}>
          <Stat label="Total P&L"   value={`${totalPnL >= 0 ? "+" : ""}₹${totalPnL.toFixed(0)}`} sub={`${closed.length} closed trades`}          color={totalPnL >= 0 ? "#22c55e" : "#ef4444"} />
          <Stat label="Win Rate"    value={`${winRate}%`}   sub={`${wins.length}W · ${losses.length}L of ${closed.length}`}  color="#f59e0b" />
          <Stat label="Open"        value={open.length}     sub="Pending / Approved / Executed"                               color="#38bdf8" />
          <Stat label="Total Logged" value={trades.length}  sub="All trades"                                                  color="#6366f1" />
        </div>

        {/* Filter bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#475569", marginRight: 4 }}>FILTER:</span>
          {["ALL","PENDING","APPROVED","EXECUTED","CLOSED","REJECTED"].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? "#1e3a5f" : "transparent", border: filter === f ? "1px solid #38bdf8" : "1px solid #1e293b", color: filter === f ? "#38bdf8" : "#475569", borderRadius: 6, padding: "3px 11px", fontSize: 10, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>{f}</button>
          ))}
          {synced && <span style={{ marginLeft: "auto", fontSize: 10, color: "#334155", fontFamily: "monospace" }}>Synced {synced.toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span>}
        </div>

        {/* Table */}
        <div style={{ background: "#0d1929", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 1fr", padding: "9px 18px", fontSize: 9, letterSpacing: 1.5, color: "#334155", textTransform: "uppercase", fontWeight: 700, borderBottom: "1px solid #1e293b", gap: 8 }}>
            <div>Trade</div><div>Status</div><div>Entry</div><div>SL</div><div>Target</div><div>Qty</div><div>P&L</div>
          </div>
          {loading
            ? <div style={{ padding: 48, textAlign: "center", color: "#334155" }}><div style={{ width: 26, height: 26, border: "3px solid #1e293b", borderTopColor: "#38bdf8", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 12px" }} />Fetching from Notion…</div>
            : filtered.length === 0
              ? <div style={{ padding: 48, textAlign: "center", color: "#334155", fontSize: 14 }}>No trades{filter !== "ALL" ? ` matching "${filter}"` : ""}.</div>
              : filtered.map(t => {
                  const pnl = t.finalPnL;
                  return (
                    <div key={t.id} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 0.8fr 1fr", padding: "13px 18px", borderBottom: "1px solid #0f172a", gap: 8, alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#e2e8f0" }}>{t.tradeName || t.stock || "—"}</div>
                        <div style={{ fontSize: 10, color: "#334155", marginTop: 1 }}>{t.date?.split("T")[0] || t.createdTime?.split("T")[0] || ""}</div>
                      </div>
                      <Chip status={t.status} />
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "#94a3b8"   }}>{t.entryPrice ? `₹${t.entryPrice}` : "—"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "#ef444499" }}>{t.stopLoss   ? `₹${t.stopLoss}`   : "—"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "#38bdf899" }}>{t.target     ? `₹${t.target}`     : "—"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 13, color: "#64748b"   }}>{t.quantity   ? t.quantity          : "—"}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 14, fontWeight: 700, color: pnl == null ? "#475569" : pnl >= 0 ? "#22c55e" : "#ef4444" }}>
                        {pnl == null ? "—" : `${pnl >= 0 ? "+" : ""}₹${pnl.toFixed(0)}`}
                      </div>
                    </div>
                  );
                })
          }
        </div>
      </div>
    </div>
  );
                    }
