// Runs before every request: keeps logged-out visitors on the login page.
// Role and company checks happen server-side in src/lib/auth.ts.
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/session-token";

const PUBLIC_PATHS = ["/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Customer portal and shared offers: private links (a secret token in the URL), no login.
  if (pathname.startsWith("/p/")) return NextResponse.next();
  const loggedIn = Boolean(await verifySession(request.cookies.get(SESSION_COOKIE)?.value));
  const isPublic = PUBLIC_PATHS.includes(pathname);

  if (!loggedIn && !isPublic) {
    const url = new URL("/login", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }

  if (loggedIn && isPublic) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static files (logos, favicon).
  matcher: ["/((?!_next/static|_next/image|logos/|icons/|fonts/|favicon.ico|manifest.webmanifest|sw.js).*)"],
};
