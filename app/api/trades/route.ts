import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_DB_ID!;

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: DB_ID,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      page_size: 50,
    });

    const trades = response.results.map((page: any) => {
      const p = page.properties;
      return {
        id: page.id,
        createdTime: page.created_time,
        tradeName:   p["Trade Name"]?.title?.[0]?.plain_text ?? "—",
        stock:       p["Stock"]?.rich_text?.[0]?.plain_text ?? "—",
        status:      p["Status"]?.select?.name ?? "—",
        entryPrice:  p["Entry Price"]?.number ?? null,
        stopLoss:    p["Stop Loss"]?.number ?? null,
        target:      p["Target"]?.number ?? null,
        finalPnL:    p["Final P&L"]?.number ?? null,
        quantity:    p["Quantity"]?.number ?? null,
        date:        p["Date"]?.date?.start ?? null,
        mode:        p["Mode"]?.select?.name ?? "—",
      };
    });

    return NextResponse.json({ trades });
  } catch (err) {
    return NextResponse.json({ error: "Failed to fetch trades" }, { status: 500 });
  }
}
