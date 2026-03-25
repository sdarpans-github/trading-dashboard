import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN   = process.env.NOTION_TOKEN!;
const DB_ID   = process.env.NOTION_DB_ID!;
const FW_ID   = "32547d7feabb8143b5f6c5a2599f1f28";
const ROOT_ID = "32447d7feabb817b829be6b6ddcc0474";
// FIX 1: Daily reviews live under India Desk, not ROOT_ID
const INDIA_DESK_ID = "32847d7feabb814aa091e66134618f70";

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

function rt(arr: any[]): string {
  if (!Array.isArray(arr)) return "";
  return arr.map((t: any) => t.plain_text ?? "").join("");
}

async function getAllPages<T>(
  url: string,
  method: "GET" | "POST",
  body?: object
): Promise<T[]> {
  const results: T[] = [];
  let cursor: string | undefined;
  do {
    const pageBody = method === "POST"
      ? JSON.stringify({ ...body, page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) })
      : undefined;
    const pageUrl = method === "GET"
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

// FIX 2: Notion tables are two-level — table_row blocks are children of table blocks.
// Without this, type === "table_row" is never seen → rules/hypotheses always empty.
async function getAllBlocks(pageId: string): Promise<any[]> {
  const blocks = await getAllPages<any>(
    `https://api.notion.com/v1/blocks/${pageId}/children`, "GET"
  );
  const expanded: any[] = [];
  for (const b of blocks) {
    expanded.push(b);
    if (b.type === "table" && b.has_children) {
      const rows = await getAllPages<any>(
        `https://api.notion.com/v1/blocks/${b.id}/children`, "GET"
      );
      expanded.push(...rows);
    }
  }
  return expanded;
}

const getAllTradePages = () =>
  getAllPages<any>(
    `https://api.notion.com/v1/databases/${DB_ID}/query`,
    "POST",
    { sorts: [{ timestamp: "created_time", direction: "descending" }] }
  );

function normalise(s: string): string {
  return s.replace(/\p{Emoji}/gu, "").replace(/\s+/g, " ").trim().toLowerCase();
}

function parseFramework(blocks: any[]) {
  const rules:      { id: string; text: string; status: string }[] = [];
  const learnings:  { id: string; text: string }[] = [];
  const hypotheses: { id: string; text: string; status: string }[] = [];

  let section      = "";
  let inRulesTable = false;
  let inHypoTable  = false;
  let dayCount     = 0;

  for (const b of blocks) {
    const type = b.type as string;
    const text = b[type]?.rich_text
      ? rt(b[type].rich_text)
      : b[type]?.text
        ? rt(b[type].text)
        : b[type]?.title
          ? rt(b[type].title)
          : "";
    const t = normalise(text);

    if (type === "heading_1" || type === "heading_2") {
      if (t.includes("adaptive learning") || t.includes("learnings log") || t.includes("knowledge base")) {
        section = "learnings"; inRulesTable = false; inHypoTable = false;
      }
      // FIX 3: Only "active rules" — avoids false triggers on "Position Sizing Rules", "Desk Rules"
      if (t.includes("active rules")) {
        section = "rules"; inRulesTable = true; inHypoTable = false;
      }
      if (t.includes("hypothesis tracker") || (t.includes("hypothes") && !t.includes("framework"))) {
        section = "hypo"; inHypoTable = true; inRulesTable = false;
      }
    }

    if (type === "heading_3") {
      if (t.match(/day \d+/)) {
        dayCount++;
        section = "learnings"; inRulesTable = false; inHypoTable = false;
      }
      if (t.includes("active rules")) { section = "rules"; inRulesTable = true; inHypoTable = false; }
      if (t.includes("hypothes")) { section = "hypo"; inHypoTable = true; inRulesTable = false; }
      if (section === "learnings") {
        const m = text.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
        if (m && !learnings.some(l => l.id === m[1]))
          learnings.push({ id: m[1], text: m[2].replace(/\*\*/g, "").trim() });
      }
    }

    // FIX 4: L17+ are bold paragraphs — strip ** before regex match
    if (type === "paragraph" && section === "learnings") {
      const cleaned = text.replace(/\*\*/g, "").trim();
      const m = cleaned.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
      if (m && !learnings.some(l => l.id === m[1]))
        learnings.push({ id: m[1], text: m[2].trim() });
    }

    if (type === "table_row") {
      const cells = b.table_row?.cells ?? [];
      if (cells.length < 2) continue;
      const c0 = rt(cells[0] ?? []).trim();
      const c1 = rt(cells[1] ?? []).trim();
      if (!c0 || c1.length <= 3) continue;

      if ((inRulesTable || section === "rules") && /^R\d+$/.test(c0)) {
        const status = cells.length > 3 ? rt(cells[cells.length - 1] ?? []).trim() : "";
        if (!rules.some(r => r.id === c0))
          rules.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }

      if ((inHypoTable || section === "hypo") && /^H\d+$/.test(c0)) {
        const status = cells.length > 2 ? rt(cells[cells.length - 1] ?? []).trim() : "";
        if (!hypotheses.some(h => h.id === c0))
          hypotheses.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }
    }
  }

  const byNum = (a: { id: string }, b: { id: string }) =>
    parseInt(a.id.replace(/\D/g, ""), 10) - parseInt(b.id.replace(/\D/g, ""), 10);

  return {
    rules:      rules.filter(r => !r.status.toLowerCase().includes("terminat")).sort(byNum),
    learnings:  learnings.sort(byNum),
    hypotheses: hypotheses.sort(byNum),
    dayCount,
  };
}

function computeDailyPnL(trades: any[]) {
  const byDay: Record<string, { date: string; pnl: number; wins: number; losses: number; flat: number }> = {};
  for (const t of trades) {
    if (!t.date) continue;
    if (["❌ REJECTED", "🟡 PENDING", "✅ APPROVED"].includes(t.status)) continue;
    if (!byDay[t.date]) byDay[t.date] = { date: t.date, pnl: 0, wins: 0, losses: 0, flat: 0 };
    const pnl = t.finalPnL ?? 0;
    byDay[t.date].pnl = Math.round((byDay[t.date].pnl + pnl) * 100) / 100;
    if (pnl > 0) byDay[t.date].wins++;
    else if (pnl < 0) byDay[t.date].losses++;
    else byDay[t.date].flat++;
  }
  return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET() {
  try {
    const rawPages = await getAllTradePages();
    const allTrades = rawPages.map((p: any) => {
      const pr = p.properties;
      return {
        id:          p.id,
        createdTime: p.created_time,
        tradeName:   rt(pr["Trade Name"]?.title ?? []) || "—",
        stock:       rt(pr["Stock"]?.rich_text ?? []) || "—",
        status:      pr["Status"]?.select?.name ?? "—",
        entryPrice:  pr["Entry Price"]?.number ?? null,
        actualEntry: pr["Actual Entry"]?.number ?? null,
        actualExit:  pr["Actual Exit"]?.number ?? null,
        stopLoss:    pr["Stop Loss"]?.number ?? null,
        target:      pr["Target"]?.number ?? null,
        finalPnL:    pr["Final P&L"]?.number ?? null,
        quantity:    pr["Quantity"]?.number ?? null,
        date:        pr["Date"]?.date?.start ?? null,
        mode:        pr["Mode"]?.select?.name ?? "—",
        // New structured fields
        strategy:    pr["Strategy"]?.select?.name ?? null,
        regime:      pr["Regime"]?.select?.name ?? null,
        exitType:    pr["Exit Type"]?.select?.name ?? null,
        notes:       rt(pr["Notes"]?.rich_text ?? []) || "",
        reason:      rt(pr["Reason"]?.rich_text ?? []) || "",
      };
    });

    const closedTrades = allTrades.filter((t: any) => t.status === "⚫ CLOSED");
    const totalPnL     = closedTrades.reduce((s: number, t: any) => s + (t.finalPnL ?? 0), 0);
    const winners      = closedTrades.filter((t: any) => (t.finalPnL ?? 0) > 0);
    const losers       = closedTrades.filter((t: any) => (t.finalPnL ?? 0) < 0);
    const flat         = closedTrades.filter((t: any) => (t.finalPnL ?? 0) === 0);
    const winRate      = closedTrades.length > 0 ? Math.round((winners.length / closedTrades.length) * 100) : 0;
    const bestTrade    = closedTrades.reduce((best: any, t: any) => (t.finalPnL ?? 0) > (best?.finalPnL ?? -Infinity) ? t : best, null);
    const worstTrade   = closedTrades.reduce((worst: any, t: any) => (t.finalPnL ?? 0) < (worst?.finalPnL ?? Infinity) ? t : worst, null);
    const avgWin       = winners.length > 0 ? winners.reduce((s: number, t: any) => s + (t.finalPnL ?? 0), 0) / winners.length : 0;
    const avgLoss      = losers.length > 0  ? losers.reduce((s: number, t: any)  => s + (t.finalPnL ?? 0), 0) / losers.length  : 0;
    const uniqueTradingDays = new Set(closedTrades.filter((t: any) => t.date).map((t: any) => t.date)).size;

    const overview = {
      totalTrades:   closedTrades.length,
      totalPnL:      Math.round(totalPnL * 100) / 100,
      winRate, winners: winners.length, losers: losers.length, flat: flat.length,
      avgWin: Math.round(avgWin * 100) / 100, avgLoss: Math.round(avgLoss * 100) / 100,
      bestTrade:     bestTrade  ? { name: bestTrade.tradeName,  pnl: bestTrade.finalPnL  } : null,
      worstTrade:    worstTrade ? { name: worstTrade.tradeName, pnl: worstTrade.finalPnL } : null,
      activeTrades:  allTrades.filter((t: any) => t.status === "🔵 EXECUTED").length,
      pendingTrades: allTrades.filter((t: any) => t.status === "🟡 PENDING").length,
      tradingDays:   uniqueTradingDays,
      dailyPnL:      computeDailyPnL(allTrades),
    };

    let framework = { rules: [] as any[], learnings: [] as any[], hypotheses: [] as any[], dayCount: uniqueTradingDays };
    try {
      const blocks = await getAllBlocks(FW_ID);
      const parsed = parseFramework(blocks);
      framework = { ...parsed, dayCount: parsed.dayCount || uniqueTradingDays };
    } catch { /* non-fatal */ }

    // FIX 5: Look for daily reviews under India Desk, not ROOT_ID
    let latestReview = { title: "", date: "", summary: "" };
    try {
      const indiaBlocks = await getAllBlocks(INDIA_DESK_ID);
      const reviews = indiaBlocks
        .filter((b: any) =>
          b.type === "child_page" &&
          (b.child_page?.title?.includes("Daily Review") ||
           b.child_page?.title?.includes("📅"))
        )
        .sort((a: any, z: any) => z.created_time.localeCompare(a.created_time));

      if (reviews.length > 0) {
        const latest = reviews[0];
        latestReview.title = latest.child_page?.title ?? "";
        latestReview.date  = latest.created_time?.split("T")[0] ?? "";
        const rBlocks = await getAllBlocks(latest.id);
        latestReview.summary = rBlocks
          .filter((b: any) => b[b.type]?.rich_text)
          .slice(0, 12)
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
