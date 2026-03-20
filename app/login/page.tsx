"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect password. Try again.");
      }
    } catch {
      setError("Something went wrong. Try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#020817", display: "flex",
      alignItems: "center", justifyContent: "center", fontFamily: "sans-serif" }}>
      <div style={{ background: "#0f172a", border: "1px solid #1e293b",
        borderRadius: 16, padding: "40px 36px", width: "100%", maxWidth: 360 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{ width: 36, height: 36, borderRadius: 9,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff" }}>₹</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f0" }}>Paper Trading Desk</div>
            <div style={{ fontSize: 10, color: "#475569", letterSpacing: 1.5 }}>PROTECTED DASHBOARD</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "#475569", letterSpacing: 1,
            textTransform: "uppercase", marginBottom: 8 }}>Password</div>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
            placeholder="Enter password"
            style={{ width: "100%", background: "#1e293b", border: "1px solid #334155",
              borderRadius: 9, padding: "11px 14px", color: "#e2e8f0", fontSize: 14,
              outline: "none", boxSizing: "border-box" }}
          />
        </div>

        {error && <div style={{ color: "#ef4444", fontSize: 12,
          marginBottom: 14 }}>⚠ {error}</div>}

        <button onClick={handleLogin} disabled={loading || !password} style={{
          width: "100%", background: loading || !password
            ? "#1e293b" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
          border: "none", borderRadius: 9, color: "#fff", padding: "12px",
          fontSize: 13, fontWeight: 700, cursor: loading || !password
            ? "default" : "pointer" }}>
          {loading ? "Verifying…" : "Enter Dashboard →"}
        </button>
      </div>
    </div>
  );
}
