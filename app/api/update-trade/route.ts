import { NextRequest, NextResponse } from "next/server";

const STATUS_MAP: Record<string, string> = {
  "APPROVE":  "✅ APPROVED",
  "REJECT":   "❌ REJECTED",
  "EXECUTE":  "🔵 EXECUTED",
  "CLOSE":    "⚫ CLOSED",
};

export async function POST(req: NextRequest) {
  const { pageId, action } = await req.json();

  if (!pageId || !action) {
    return NextResponse.json({ error: "Missing pageId or action" }, { status: 400 });
  }

  const newStatus = STATUS_MAP[action];
  if (!newStatus) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 500 });
  }

  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: {
        Status: {
          select: { name: newStatus },
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: "Notion update failed", details: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true, newStatus });
}
