import { NextRequest, NextResponse } from "next/server";

// Proxies /api/* to the backend. Deliberately done in middleware rather than
// next.config.ts's rewrites() - that config is resolved once at build time, so
// process.env.BACKEND_URL would get frozen into the image at `docker build` and
// ignored at container startup. Middleware runs per-request and reads env vars live,
// so BACKEND_URL set via `docker run -e` / docker-compose actually takes effect.
export function middleware(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8000";
  const destination = new URL(
    request.nextUrl.pathname.replace(/^\/api/, ""),
    backendUrl
  );
  destination.search = request.nextUrl.search;
  return NextResponse.rewrite(destination);
}

export const config = {
  matcher: "/api/:path*",
};
