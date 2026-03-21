import { NextResponse } from "next/server";

const TOKEN   = process.env.NOTION_TOKEN!;
const DB_ID   = process.env.NOTION_DB_ID!;
const FW_ID   = "32547d7feabb8143b5f6c5a2599f1f28";
const DESK_ID = "32847d7feabb814aa091e66134618f70";

async function nfetch(url: string, options: RequestInit = {}) {
  return fetch(url, {
    ...options,
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

async function getAllBlocks(pageId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;
  do {
    const url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`
      + (cursor ? `&start_cursor=${cursor}` : "");
    const res = await nfetch(url);
    if (!res.ok) break;
    const data = await res.json();
    blocks.push(...(data.results ?? []));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

function parseFramework(blocks: any[]) {
  const rules: { id: string; text: string; status: string }[] = [];
  const learnings: { id: string; text: string }[] = [];
  const hypotheses: { id: string; text: string; status: string }[] = [];
  let section = "";
  let inRulesTable = false;
  let inHypoTable  = false;
  let dayCount = 0;

  for (const b of blocks) {
    const type = b.type as string;
    const text = b[type]?.rich_text
      ? rt(b[type].rich_text)
      : b[type]?.text
        ? rt(b[type].text)
        : b[type]?.title
          ? rt(b[type].title)
          : "";

    // Section detection
    if (type === "heading_1" || type === "heading_2") {
      const t = text.toLowerCase();
      if (t.includes("adaptive learning") || t.includes("learning")) section = "learnings";
      if (t.includes("active rules") || t.includes("rules — version") || t.includes("rules for")) {
        section = "rules"; inRulesTable = true;
      }
      if (t.includes("hypothesis")) { section = "hypo"; inHypoTable = true; }
    }

    if (type === "heading_3") {
      const t = text.toLowerCase();
      // Day headers e.g. "Day 1 — March 16"
      if (t.match(/day \d+/)) {
        dayCount++;
        section = "learnings";
        inRulesTable = false;
        inHypoTable  = false;
      }
      if (t.includes("active rules")) { section = "rules"; inRulesTable = true; }
      if (t.includes("hypothesis"))   { section = "hypo";  inHypoTable  = true; }

      // Parse learnings from h3: "L1 — Some text"
      if (section === "learnings") {
        const m = text.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
        if (m) learnings.push({ id: m[1], text: m[2].replace(/\*\*/g, "").trim() });
      }
    }

    // Bold paragraphs can also be learnings: **L12 — ...**
    if (type === "paragraph" && section === "learnings") {
      const m = text.match(/^(L\d+)\s*[—–\-]\s*(.+)/);
      if (m) {
        const exists = learnings.some(l => l.id === m[1]);
        if (!exists) learnings.push({ id: m[1], text: m[2].replace(/\*\*/g, "").trim() });
      }
    }

    // Table rows
    if (type === "table_row") {
      const cells = b.table_row?.cells ?? [];
      if (cells.length === 0) continue;
      const c0 = rt(cells[0] ?? []).trim();
      const c1 = rt(cells[1] ?? []).trim();

      // Rules table: R1 | rule text | source | status
      if ((inRulesTable || section === "rules") && c0.match(/^R\d+/) && c1.length > 3) {
        const status = cells.length > 3 ? rt(cells[3] ?? []) : "";
        const exists = rules.some(r => r.id === c0);
        if (!exists) rules.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }

      // Hypothesis table: H1 | text | days | status
      if ((inHypoTable || section === "hypo") && c0.match(/^H\d+/) && c1.length > 3) {
        const status = cells.length > 3 ? rt(cells[3] ?? []) : "";
        const exists = hypotheses.some(h => h.id === c0);
        if (!exists) hypotheses.push({ id: c0, text: c1.replace(/\*\*/g, ""), status });
      }
    }
  }

  return {
    rules:       rules.filter(r => !r.status.toLowerCase().includes("terminat")),
    learnings:   learnings.slice(-12),
    hypotheses,
    dayCount:    dayCount || 5,
  };
}

export async function GET() {
  try {
    // ── Trades ──
    const tRes = await nfetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 50,
      }),
    });
    if (!tRes.ok) {
      const e = await tRes.json();
      return NextResponse.json({ error: "Trades fetch failed", details: e }, { status: 500 });
    }
    const tData = await tRes.json();
    const trades = tData.results.map((p: any) => {
      const pr = p.properties;
      return {
        id:         p.id,
        createdTime: p.created_time,
        tradeName:  rt(pr["Trade Name"]?.title ?? []) || "—",
        stock:      rt(pr["Stock"]?.rich_text ?? []) || "—",
        status:     pr["Status"]?.select?.name ?? "—",
        entryPrice: pr["Entry Price"]?.number ?? null,
        stopLoss:   pr["Stop Loss"]?.number ?? null,
        target:     pr["Target"]?.number ?? null,
        finalPnL:   pr["Final P&L"]?.number ?? null,
        quantity:   pr["Quantity"]?.number ?? null,
        date:       pr["Date"]?.date?.start ?? null,
        mode:       pr["Mode"]?.select?.name ?? "—",
        notes:      rt(pr["Notes"]?.rich_text ?? []) || "",
        reason:     rt(pr["Reason"]?.rich_text ?? []) || "",
      };
    });

    // ── Framework ──
    let framework = { rules: [], learnings: [], hypotheses: [], dayCount: 5 };
    try {
      const blocks = await getAllBlocks(FW_ID);
      framework = parseFramework(blocks) as any;
    } catch { /* optional */ }

    // ── Latest daily review ──
    let latestReview = { title: "", date: "", summary: "" };
    try {
      const deskBlocks = await getAllBlocks(DESK_ID);
      const reviews = deskBlocks
        .filter((b: any) => b.type === "child_page" &&
          b.child_page?.title?.includes("Daily Review"))
        .sort((a: any, z: any) => z.created_time.localeCompare(a.created_time));

      if (reviews.length > 0) {
        const latest = reviews[0];
        latestReview.title = latest.child_page?.title ?? "";
        latestReview.date  = latest.created_time?.split("T")[0] ?? "";
        const rBlocks = await getAllBlocks(latest.id);
        latestReview.summary = rBlocks
          .filter((b: any) => b[b.type]?.rich_text)
          .slice(0, 5)
          .map((b: any) => rt(b[b.type].rich_text))
          .filter(Boolean)
          .join(" ")
          .slice(0, 400);
      }
    } catch { /* optional */ }

    return NextResponse.json({ trades, framework, latestReview });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err.message }, { status: 500 });
  }
}
