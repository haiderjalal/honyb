import { NextResponse, type NextRequest } from "next/server";

import { refusesAdminRequest } from "@/lib/security/adminGate";

/**
 * Runs before every admin request. Admin pages are for signed-in admins only, so a visitor with no session is answered
 * here with a real 404, before any admin page starts to render.
 */
export function proxy(request: NextRequest): NextResponse {
  const cookieNames = request.cookies.getAll().map((cookie) => cookie.name);
  if (refusesAdminRequest(request.nextUrl.pathname, cookieNames)) {
    return NextResponse.rewrite(new URL("/not-found", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
