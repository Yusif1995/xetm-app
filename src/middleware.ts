import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const uid = request.cookies.get("khatm_uid")?.value;
  const role = request.cookies.get("khatm_role")?.value;
  
  const { pathname } = request.nextUrl;
  
  // `/progress` is public and visible to everyone.
  const isLoginPage = pathname === "/";
  const isProgressPage = pathname === "/progress";
  
  // Allow all static files and internal Next.js/API calls
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // 1. If not logged in and not accessing a public page (/ or /progress) -> Redirect to login (/)
  if (!uid && !isLoginPage && !isProgressPage) {
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

  // 3. If accessing admin page (/admin*) and role is not admin -> Redirect to dashboard (/dashboard)
  if (pathname.startsWith("/admin") && role !== "admin") {
    const url = new URL("/dashboard", request.url);
    url.search = request.nextUrl.search;
    return NextResponse.redirect(url);
  }

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
