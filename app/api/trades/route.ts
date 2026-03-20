import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.NOTION_TOKEN;
  const dbId = process.env.NOTION_DB_ID;

  // Debug: check if env vars are present
  if (!token) {
    return NextResponse.json({ error: "NOTION_TOKEN is missing", debug: "no token" }, { status: 500 });
  }
  if (!dbId) {
    return NextResponse.json({ error: "NOTION_DB_ID is missing", debug: "no db id" }, { status: 500 });
  }

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "descending" }],
        page_size: 50,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ 
        error: "Notion API error", 
        status: response.status,
        details: data 
      }, { status: 500 });
    }

    const trades = data.results.map((page: any) => {
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

  } catch (err: any) {
    return NextResponse.json({ 
      error: "Fetch failed", 
      message: err.message 
    }, { status: 500 });
  }
}
