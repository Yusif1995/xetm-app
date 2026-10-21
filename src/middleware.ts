import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const INVITE_COOKIE = "pending_invite";
const INVITE_ID = /^[A-Za-z0-9_-]{1,128}$/;

// Keeps the invite across tabs and, on Android, into the installed home-screen app:
// the link is often opened in WhatsApp's browser and sign-in continues somewhere else
function withInviteCookie(request: NextRequest, response: NextResponse): NextResponse {
  const invite = request.nextUrl.searchParams.get("invite");
  if (invite && INVITE_ID.test(invite)) {
    response.cookies.set(INVITE_COOKIE, invite, { path: "/", maxAge: 7 * 24 * 60 * 60, sameSite: "lax" });
  }
  return response;
}

export function middleware(request: NextRequest) {
  const uid = request.cookies.get("khatm_uid")?.value;
  
  const { pathname } = request.nextUrl;
  
  const isLoginPage = pathname === "/";
  // Public pages anyone can open (the add-to-home-screen guide is shared as a link)
  const isPublicPage = pathname === "/qurasdir";
  
  // Allow all static files and internal Next.js/API calls
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isPublicPage) {
    return withInviteCookie(request, NextResponse.next());
  }

  // 1. If not logged in and not on the login page -> Redirect to login (/)
  if (!uid && !isLoginPage) {
    const url = new URL("/", request.url);
    url.search = request.nextUrl.search;
    return withInviteCookie(request, NextResponse.redirect(url));
  }

  // 2. If logged in and accessing login page (/) -> Redirect to dashboard (/dashboard)
  if (uid && isLoginPage) {
    const url = new URL("/dashboard", request.url);
    url.search = request.nextUrl.search;
    return withInviteCookie(request, NextResponse.redirect(url));
  }

  // Admin pages check group ownership themselves; a role cookie could be set by anyone.

  return withInviteCookie(request, NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
