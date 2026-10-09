import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const uid = request.cookies.get("khatm_uid")?.value;
  
  const { pathname } = request.nextUrl;
  
  const isLoginPage = pathname === "/";
  
  // Allow all static files and internal Next.js/API calls
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. If not logged in and not on the login page -> Redirect to login (/)
  if (!uid && !isLoginPage) {
    const url = new URL("/", request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  // 2. If logged in and accessing login page (/) -> Redirect to dashboard (/dashboard)
  if (uid && isLoginPage) {
    const url = new URL("/dashboard", request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

  // Admin pages check group ownership themselves; a role cookie could be set by anyone.

  return NextResponse.next();
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
