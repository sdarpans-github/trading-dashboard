import { NextResponse } from "next/server";

const TOKEN = process.env.NOTION_TOKEN!;
const DB_ID = process.env.NOTION_DB_ID!;
const FRAMEWORK_PAGE_ID = "32547d7feabb8143b5f6c5a2599f1f28";
const INDIA_DESK_ID = "32847d7feabb814aa091e66134618f70";

async function notionFetch(url: string, options: RequestInit = {}) {
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

// Extract plain text from Notion rich text array
function richText(arr: any[]): string {
  return arr?.map((t: any) => t.plain_text).join("") ?? "";
}

// Parse framework page blocks into structured data
function parseFrameworkBlocks(blocks: any[]) {
  const rules: { id: string; text: string; status: string }[] = [];
  const learnings: { id: string; text: string }[] = [];
  const hypotheses: { id: string; text: string; status: string }[] = [];
  let currentSection = "";
  let cumPnL = 0;
  let dayCount = 0;

  for (const block of blocks) {
    const text = block[block.type]?.rich_text
      ? richText(block[block.type].rich_text)
      : block[block.type]?.text
        ? richText(block[block.type].text)
        : "";

    if (!text) continue;

    // Detect sections
    if (text.includes("ADAPTIVE LEARNINGS")) currentSection = "learnings";
    if (text.includes("Active Rules")) currentSection = "rules";
    if (text.includes("Hypothesis Tracker")) currentSection = "hypotheses";

    // Parse rules from table rows
    if (currentSection === "rules" && block.type === "table_row") {
      const cells = block.table_row?.cells ?? [];
      if (cells.length >= 3) {
        const id = richText(cells[0]);
        const rule = richText(cells[1]);
        const status = richText(cells[3] || cells[2]);
        if (id.match(/^R\d+/) && rule.length > 5) {
          rules.push({ id, text: rule, status });
        }
      }
    }

    // Parse learnings
    if (currentSection === "learnings" && block.type === "heading_3") {
      const match = text.match(/^(L\d+)\s*[—–-]\s*(.+)/);
      if (match) {
        learnings.push({ id: match[1], text: match[2] });
      }
    }

    // Parse hypotheses from table rows
    if (currentSection === "hypotheses" && block.type === "table_row") {
      const cells = block.table_row?.cells ?? [];
      if (cells.length >= 4) {
        const id = richText(cells[0]);
        const hyp = richText(cells[1]);
        const status = richText(cells[3]);
        if (id.match(/^H\d+/) && hyp.length > 5) {
          hypotheses.push({ id, text: hyp, status });
        }
      }
    }

    // Parse cumulative P&L from summary table
    if (text.includes("Cumulative P&L") && text.includes("₹")) {
      const match = text.match(/\+?₹([\d,]+)/g);
      if (match) {
        const last = match[match.length - 1].replace(/[₹,+]/g, "");
        cumPnL = parseFloat(last) || 0;
      }
    }

    // Count trading days
    if (text.match(/Day \d+ — March/)) dayCount++;
  }

  return { rules, learnings: learnings.slice(-10), hypotheses, cumPnL, dayCount };
}

export async function GET() {
  try {
    // 1. Fetch trades
    const tradesRes = await notionFetch(
      `https://api.notion.com/v1/databases/${DB_ID}/query`,
      {
        method: "POST",
        body: JSON.stringify({
          sorts: [{ timestamp: "created_time", direction: "descending" }],
          page_size: 50,
        }),
      }
    );

    if (!tradesRes.ok) {
      const err = await tradesRes.json();
      return NextResponse.json({ error: "Trades fetch failed", details: err }, { status: 500 });
    }

    const tradesData = await tradesRes.json();
    const trades = tradesData.results.map((page: any) => {
      const p = page.properties;
      return {
        id: page.id,
        createdTime: page.created_time,
        tradeName: richText(p["Trade Name"]?.title ?? []) || "—",
        stock: richText(p["Stock"]?.rich_text ?? []) || "—",
        status: p["Status"]?.select?.name ?? "—",
        entryPrice: p["Entry Price"]?.number ?? null,
        stopLoss: p["Stop Loss"]?.number ?? null,
        target: p["Target"]?.number ?? null,
        finalPnL: p["Final P&L"]?.number ?? null,
        quantity: p["Quantity"]?.number ?? null,
        date: p["Date"]?.date?.start ?? null,
        mode: p["Mode"]?.select?.name ?? "—",
      };
    });

    // 2. Fetch framework page blocks
    let framework = { rules: [], learnings: [], hypotheses: [], cumPnL: 0, dayCount: 0 };
    try {
      const fwRes = await notionFetch(
        `https://api.notion.com/v1/blocks/${FRAMEWORK_PAGE_ID}/children?page_size=200`
      );
      if (fwRes.ok) {
        const fwData = await fwRes.json();
        framework = parseFrameworkBlocks(fwData.results ?? []);
      }
    } catch { /* framework optional */ }

    // 3. Fetch latest daily review
    let latestReview = { title: "", date: "", summary: "" };
    try {
      const deskRes = await notionFetch(
        `https://api.notion.com/v1/blocks/${INDIA_DESK_ID}/children?page_size=20`
      );
      if (deskRes.ok) {
        const deskData = await deskRes.json();
        const reviewPages = deskData.results
          .filter((b: any) => b.type === "child_page" &&
            b.child_page?.title?.includes("Daily Review"))
          .sort((a: any, b: any) =>
            b.created_time.localeCompare(a.created_time));

        if (reviewPages.length > 0) {
          const latest = reviewPages[0];
          latestReview.title = latest.child_page?.title ?? "";
          latestReview.date = latest.created_time?.split("T")[0] ?? "";

          // Fetch first few blocks of the review
          const reviewRes = await notionFetch(
            `https://api.notion.com/v1/blocks/${latest.id}/children?page_size=10`
          );
          if (reviewRes.ok) {
            const reviewData = await reviewRes.json();
            const summaryBlocks = reviewData.results
              .filter((b: any) => b[b.type]?.rich_text)
              .slice(0, 3)
              .map((b: any) => richText(b[b.type].rich_text))
              .filter(Boolean)
              .join(" ");
            latestReview.summary = summaryBlocks.slice(0, 300);
          }
        }
      }
    } catch { /* review optional */ }

    return NextResponse.json({ trades, framework, latestReview });

  } catch (err: any) {
    return NextResponse.json({ error: "Failed", message: err.message }, { status: 500 });
  }
}
