import { NextResponse, type NextRequest } from "next/server";

/**
 * This proxy (formerly middleware) runs before the database is reachable, so all it can do is check
 * whether a session cookie is present and bounce obvious anonymous traffic.
 * The real check — is this session live, and does this person hold the right
 * role — happens in requireUser/requireStaff/requireAdmin on every page and
 * action. Treat this purely as a redirect nicety, never as the security layer.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") return NextResponse.next();

    if (!request.cookies.has("mip_admin_session")) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
    return NextResponse.next();
  }

  if (!request.cookies.has("mip_session")) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/account/:path*", "/staff/:path*", "/admin/:path*"],
};
