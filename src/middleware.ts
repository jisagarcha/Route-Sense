import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    const role = token?.role;

    if (
      (path.startsWith("/admin/patterns") || path.startsWith("/admin/history")) &&
      role !== "ADMIN" &&
      role !== "ANALYST"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    if (
      path.startsWith("/admin") &&
      !path.startsWith("/admin/patterns") &&
      !path.startsWith("/admin/history") &&
      role !== "ADMIN"
    ) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        // Public paths that don't require authentication
        const publicPaths = ["/", "/results", "/auth/signin", "/auth/signup", "/auth/error"];
        const path = req.nextUrl.pathname;
        
        if (publicPaths.includes(path)) {
          return true;
        }

        if (req.method === "GET" && path === "/api/locations") {
          return true;
        }

        if (req.method === "POST" && path === "/api/shortest-path") {
          return true;
        }

        // All other paths require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (NextAuth routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
