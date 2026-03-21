import { NextRequest, NextResponse } from "next/server";

const COOKIE = "dash_auth";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === "/login" || pathname.startsWith("/api/login")) {
    return NextResponse.next();
  }

  const password = process.env.DASHBOARD_PASSWORD || "trading2026";
  const auth = req.cookies.get(COOKIE)?.value;

  if (auth === password) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
