import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Webhook rewrite: If a POST request hits '/' or '/upload' with JSON from Nanonets
  if (
    request.method === "POST" &&
    (pathname === "/" || pathname === "/upload")
  ) {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return NextResponse.rewrite(new URL("/api/webhooks/nanonets", request.url));
    }
  }

  // 2. Identify session token from cookies (NextAuth v5 and legacy compatibility)
  const sessionToken =
    request.cookies.get("authjs.session-token")?.value ||
    request.cookies.get("__Secure-authjs.session-token")?.value ||
    request.cookies.get("next-auth.session-token")?.value ||
    request.cookies.get("__Secure-next-auth.session-token")?.value;

  const isAuthenticated = Boolean(sessionToken);

  // 3. Public paths that do not require authentication
  const isPublicPath =
    pathname.startsWith("/login") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/webhooks") ||
    pathname.startsWith("/api/test-files") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/cmaps") ||
    pathname.startsWith("/standard_fonts") ||
    pathname.startsWith("/uploads") ||
    pathname === "/favicon.ico" ||
    pathname.endsWith(".mjs") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".pdf");

  // 4. Redirect unauthenticated users trying to access protected web pages
  if (!isAuthenticated && !isPublicPath) {
    // If it's an API request, return 401 JSON
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname === "/" ? "/matching" : pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 5. If user is already authenticated and visits /login or /, redirect to /matching
  if (isAuthenticated && (pathname === "/login" || pathname === "/")) {
    return NextResponse.redirect(new URL("/matching", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
