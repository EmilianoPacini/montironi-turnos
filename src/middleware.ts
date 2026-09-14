import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  requiresSessionCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/auth/access";

/**
 * B5 Edge gate — cookie **presence** only (no DB / iron-session unseal).
 * Node handlers revalidate via `requireSession` / `requireAdmin` and
 * `assertPanelAccess` for role matrix enforcement.
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function applySecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  if (!requiresSessionCookie(pathname)) {
    return applySecurityHeaders(
      NextResponse.next({ request: { headers: requestHeaders } })
    );
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (!hasSessionCookie) {
    if (pathname.startsWith("/api/")) {
      return applySecurityHeaders(
        NextResponse.json(
          { error: "No autorizado", code: "UNAUTHORIZED" },
          { status: 401 }
        )
      );
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("from", pathname);
    return applySecurityHeaders(NextResponse.redirect(loginUrl));
  }

  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } })
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
