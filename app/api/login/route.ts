import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const correct = process.env.DASHBOARD_PASSWORD || "trading2026";

  if (password === correct) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("dash_auth", correct, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });
    return res;
  }

  return NextResponse.json({ error: "Wrong password" }, { status: 401 });
}
