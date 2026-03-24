import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN     = process.env.NOTION_TOKEN!;
const DB_ID     = process.env.NOTION_DB_ID!;
const FW_ID     = "32547d7feabb8143b5f6c5a2599f1f28";
const ROOT_ID   = "32447d7feabb817b829be6b6ddcc0474";
const INDIA_ID  = "32847d7feabb814aa091e66134618f70"; // Daily reviews also live here

// ─── Core fetch — no caching ───────────────────────────────────────────────
async function nfetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
    cache: "no-store",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// ─── Rich-text extractor ────────────────────────────────────────────────────
function rt(arr: any[]): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((t: any) => t.plain_text ?? "").join("");
}

// ─── Generic auto-paginator — fetches ALL pages until has_more = false ──────
async function getAllPages<T>(url: string, method: "GET" | "POST", body?: object): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  do {
    const pageBody = method === "POST"
      ? JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
      : undefined;
    const pageUrl  = method === "GET"
      ? url + (url.includes("?") ? "&" : "?") + "page_size=100" + (cursor ? `&start_cursor=${cursor}` : "")
      : url;
    const res = await nfetch(pageUrl, { method, body: pageBody });
    if (!res.ok) break;
    const data = await res.json();
    results.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return results;
}

const getAllBlocks    = (id: string) => getAllPages<any>(`https://api.notion.com/v1/blocks/${id}/children`, "GET");
const getAllTradePgs  = ()           => getAllPages<any>(`https://api.notion.com/v1/databases/${DB_ID}/query`, "POST",
  { sorts: [{ timestamp: "created_time", direction: "descending" }] });

// ─── Emoji-safe normaliser — covers all present & future emoji ──────────────
function normalise(s: string): string {
  return s.replace(/\p{Emoji}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

// ─── Framework parser ───────────────────────────────────────────────────────
// Scalability: no hardcoded counts. Handles any number of rules/learnings/hypotheses.
// FIX: resets the current rules/hypo buffer each time a new section heading is seen,
// so the LAST (most complete) table wins — prevents stale Day-3 "Active Rules for
// Tomorrow" table from blocking the final Version 2.0 table via dedup.
function parseFramework(blocks: any[]) {
  const learnings:  { id: string; text: string }[] = [];

  // We collect rules and hypotheses into a "current buffer" that resets on each
  // new section heading, then commits to the final array. This way the last
  // occurrence of a rules/hypo table (which is always the most up-to-date) wins.
  let rulesBuf:     { id: string; text: string; status: string }[] = [];
  let hypoBuf:      { id: string; text: string; status: string }[] = [];
  const allRuleBufs:  (typeof rulesBuf)[] = [];
  const allHypoBufs:  (typeof hypoBuf)[] = [];

  let section      = "";
  let inRulesTable = false;
  let inHypoTable  = false;
  let dayCount     = 0;

  const commitRules = () => { if (rulesBuf.length) { allRuleBufs.push(rulesBuf); rulesBuf = []; } };
  const commitHypo  = () => { if (hypoBuf.length)  { allHypoBufs.push(hypoBuf);  hypoBuf  = []; } };

  for (const b of blocks) {
    const type = b.type as string;
    const text = b[type]?.rich_text
      ? rt(b[type].rich_text)
      : b[type]?.text   ? rt(b[type].text)
      : b[type]?.title  ? rt(b[type].title)
      : "";
    const t = normalise(text);

    // ── Heading_1 / Heading_2 — major section boundaries ──
    if (type === "heading_1" || type === "heading_2") {
      if (t.includes("adaptive learning") || t.includes("learnings log")) {
        commitRules(); commitHypo();
        section = "learnings"; inRulesTable = false; inHypoTable = false;
      }
      if (t.includes("active rules") || (t.includes("rules") && !t.includes("hypothesis") && !t.includes("step"))) {
        commitRules(); // commit any prior rules buffer before starting a new one
        section = "rules"; inRulesTable = true; inHypoTable = false;
      }
      if (t.includes("hypothesis tracker") || (t.includes("hypothesis") && !t.includes("rules"))) {
        commitHypo();
        section = "hypo"; inHypoTable = true; inRulesTable = false;
      }
    }

    // ── Heading_3 — day headers and sub-section boundaries ──
    if (type === "heading_3") {
      if (t.match(/day \d+/)) {
        commitRules(); commitHypo();
        dayCount++; section = "learnings"; inRulesTable = false; inHypoTable = false;
      }
      if (t.includes("active rules")) {
        commitRules();
        section = "rules"; inRulesTable = true; inHypoTable = false;
      }
      if (t.includes("hypothesis tracker") || (t.includes("hypothesis") && !t.includes("rules"))) {
        commitHypo();
        section = "hypo"; inHypoTable = true; inRulesTable = false;
      }
      // Parse learnings from h3: "L5 — Some text ✅"
      if (section === "learnings") {
        const m = text.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
        if (m && !learnings.some(l => l.id === m[1]))
          learnings.push({ id: m[1], text: m[2].replace(/\*\*/g, "").trim() });
      }
    }

    // ── Paragraphs — bold learnings "**L12 — text**" ──
    if (type === "paragraph" && section === "learnings") {
      const m = text.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
      if (m && !learnings.some(l => l.id === m[1]))
        learnings.push({ id: m[1], text: m[2].replace(/\*\*/g, "").trim() });
    }

    // ── Table rows ──
    if (type === "table_row") {
      const cells = b.table_row?.cells ?? [];
      if (cells.length < 2) continue;
      const c0 = rt(cells[0] ?? []).trim();
      const c1 = rt(cells[1] ?? []).trim();
      if (!c0 || c1.length <= 3) continue;

      // Rules: R# | rule text | source | status
      if ((inRulesTable || section === "rules") && /^R\d+$/.test(c0)) {
        const status = cells.length > 3 ? rt(cells[cells.length - 1] ?? []).trim() : "";
        if (!rulesBuf.some(r => r.id === c0))
          rulesBuf.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }

      // Hypotheses: H# | text | days tested | status
      if ((inHypoTable || section === "hypo") && /^H\d+$/.test(c0)) {
        const status = cells.length > 2 ? rt(cells[cells.length - 1] ?? []).trim() : "";
        if (!hypoBuf.some(h => h.id === c0))
          hypoBuf.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }
    }
  }

  // Commit any remaining buffers
  commitRules(); commitHypo();

  // Use the LAST (most complete) rules/hypo table seen in the document
  const finalRules = allRuleBufs.length ? allRuleBufs[allRuleBufs.length - 1] : [];
  const finalHypo  = allHypoBufs.length ? allHypoBufs[allHypoBufs.length - 1] : [];

  const byNum = (a: { id: string }, b: { id: string }) =>
    parseInt(a.id.replace(/\D/g, ""), 10) - parseInt(b.id.replace(/\D/g, ""), 10);

  return {
    rules:      finalRules.filter(r => !r.status.toLowerCase().includes("terminat")).sort(byNum),
    learnings:  learnings.sort(byNum),   // ALL learnings — no cap
    hypotheses: finalHypo.sort(byNum),
    dayCount,
  };
}

// ─── Per-day P&L ─────────────────────────────────────────────────────────────
function computeDailyPnL(trades: any[]) {
  const byDay: Record<string, { date: string; pnl: number; wins: number; losses: number; flat: number }> = {};
  for (const t of trades) {
    if (!t.date || ["❌ REJECTED", "🟡 PENDING", "✅ APPROVED"].includes(t.status)) continue;
    if (!byDay[t.date]) byDay[t.date] = { date: t.date, pnl: 0, wins: 0, losses: 0, flat: 0 };
    const pnl = t.finalPnL ?? 0;
    byDay[t.date].pnl = Math.round((byDay[t.date].pnl + pnl) * 100) / 100;
    if (pnl > 0)      byDay[t.date].wins++;
    else if (pnl < 0) byDay[t.date].losses++;
    else              byDay[t.date].flat++;
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Main handler ────────────────────────────────────────────────────────────
export async function GET() {
  try {

    // 1. All trades — fully paginated, no limit
    const rawPages = await getAllTradePgs();
    const allTrades = rawPages.map((p: any) => {
      const pr = p.properties;
      return {
        id:          p.id,
        createdTime: p.created_time,
        tradeName:   rt(pr["Trade Name"]?.title    ?? []) || "—",
        stock:       rt(pr["Stock"]?.rich_text     ?? []) || "—",
        status:      pr["Status"]?.select?.name    ?? "—",
        entryPrice:  pr["Entry Price"]?.number     ?? null,
        actualEntry: pr["Actual Entry"]?.number    ?? null,
        actualExit:  pr["Actual Exit"]?.number     ?? null,
        stopLoss:    pr["Stop Loss"]?.number       ?? null,
        target:      pr["Target"]?.number          ?? null,
        finalPnL:    pr["Final P&L"]?.number       ?? null,
        quantity:    pr["Quantity"]?.number        ?? null,
        date:        pr["Date"]?.date?.start       ?? null,
        mode:        pr["Mode"]?.select?.name      ?? "—",
        notes:       rt(pr["Notes"]?.rich_text     ?? []) || "",
        reason:      rt(pr["Reason"]?.rich_text    ?? []) || "",
      };
    });

    // 2. Overview — all computed live from trade data
    const closedTrades  = allTrades.filter((t: any) => t.status === "⚫ CLOSED");
    const totalPnL      = closedTrades.reduce((s: number, t: any) => s + (t.finalPnL ?? 0), 0);
    const winners       = closedTrades.filter((t: any) => (t.finalPnL ?? 0) > 0);
    const losers        = closedTrades.filter((t: any) => (t.finalPnL ?? 0) < 0);
    const flat          = closedTrades.filter((t: any) => (t.finalPnL ?? 0) === 0);
    const winRate       = closedTrades.length > 0 ? Math.round((winners.length / closedTrades.length) * 100) : 0;
    const bestTrade     = closedTrades.reduce((b: any, t: any) => (t.finalPnL ?? 0) > (b?.finalPnL ?? -Infinity) ? t : b, null);
    const worstTrade    = closedTrades.reduce((w: any, t: any) => (t.finalPnL ?? 0) < (w?.finalPnL ?? Infinity)  ? t : w, null);
    const avgWin        = winners.length > 0 ? winners.reduce((s: number, t: any) => s + (t.finalPnL ?? 0), 0) / winners.length : 0;
    const avgLoss       = losers.length  > 0 ? losers.reduce ((s: number, t: any) => s + (t.finalPnL ?? 0), 0) / losers.length  : 0;
    const uniqueDays    = new Set(closedTrades.filter((t: any) => t.date).map((t: any) => t.date)).size;

    const overview = {
      totalTrades:   closedTrades.length,
      totalPnL:      Math.round(totalPnL * 100) / 100,
      winRate,
      winners:       winners.length,
      losers:        losers.length,
      flat:          flat.length,
      avgWin:        Math.round(avgWin  * 100) / 100,
      avgLoss:       Math.round(avgLoss * 100) / 100,
      bestTrade:     bestTrade  ? { name: bestTrade.tradeName,  pnl: bestTrade.finalPnL  } : null,
      worstTrade:    worstTrade ? { name: worstTrade.tradeName, pnl: worstTrade.finalPnL } : null,
      activeTrades:  allTrades.filter((t: any) => t.status === "🔵 EXECUTED").length,
      pendingTrades: allTrades.filter((t: any) => t.status === "🟡 PENDING").length,
      tradingDays:   uniqueDays,
      dailyPnL:      computeDailyPnL(allTrades),
    };

    // 3. Framework — all blocks auto-paginated
    let framework = { rules: [] as any[], learnings: [] as any[], hypotheses: [] as any[], dayCount: uniqueDays };
    try {
      const blocks = await getAllBlocks(FW_ID);
      const parsed = parseFramework(blocks);
      framework = { ...parsed, dayCount: parsed.dayCount || uniqueDays };
    } catch { /* non-fatal */ }

    // 4. Latest daily review — FIX: search BOTH root page AND India Desk,
    //    then pick the most recently created one regardless of where it lives.
    let latestReview = { title: "", date: "", summary: "" };
    try {
      const isDailyReview = (b: any) =>
        b.type === "child_page" &&
        (b.child_page?.title?.includes("Daily Review") || b.child_page?.title?.includes("📅"));

      const [rootBlocks, indiaBlocks] = await Promise.all([
        getAllBlocks(ROOT_ID),
        getAllBlocks(INDIA_ID),
      ]);

      const allReviews = [...rootBlocks, ...indiaBlocks]
        .filter(isDailyReview)
        // deduplicate by page id (shouldn't overlap, but just in case)
        .filter((b, i, arr) => arr.findIndex(x => x.id === b.id) === i)
        .sort((a, z) => z.created_time.localeCompare(a.created_time));

      if (allReviews.length > 0) {
        const latest    = allReviews[0];
        latestReview.title = latest.child_page?.title ?? "";
        latestReview.date  = latest.created_time?.split("T")[0] ?? "";
        const rBlocks   = await getAllBlocks(latest.id);
        latestReview.summary = rBlocks
          .filter((b: any) => b[b.type]?.rich_text)
          .slice(0, 10)
          .map((b: any) => rt(b[b.type].rich_text))
          .filter(Boolean)
          .join(" ")
          .slice(0, 800);
      }
    } catch { /* non-fatal */ }

    return NextResponse.json({ trades: allTrades, overview, framework, latestReview });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err.message }, { status: 500 });
  }
}
