import { NextResponse, type NextRequest } from "next/server";

/**
 * middleware.ts
 * - Resuelve el tenant por subdominio (miempresa.app.enterarme.me) o por query param (?tenant=miempresa).
 * - Inyecta el slug en una cookie/header `x-tenant-slug` para uso server-side.
 * - Protege rutas del panel (todo lo que no sea /login ni assets estáticos).
 *   Si no hay sesión (cookie `next-auth.session-token`), redirige a /login?tenant=<slug>.
 */

const PUBLIC_PATHS = ["/login", "/api/auth"];
const STATIC_EXT = [".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".css", ".js", ".woff", ".woff2", ".map"];

function extractTenantFromHost(host: string | null): string | null {
  if (!host) return null;
  // Quita puerto
  const hostname = host.split(":")[0];
  // Aceptamos: <slug>.app.enterarme.me  ó  <slug>.enterarme.me
  // Si es el apex o el www, no hay tenant.
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const slug = parts[0];
    if (slug && !["www", "admin", "api", "ai", "app"].includes(slug)) {
      return slug;
    }
  }
  return null;
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("host");

  // 1. Resolver tenant
  let tenantSlug =
    req.nextUrl.searchParams.get("tenant") ||
    extractTenantFromHost(host) ||
    req.cookies.get("x-tenant-slug")?.value ||
    null;

  // 2. Rutas estáticas: pasar
  if (STATIC_EXT.some((ext) => pathname.endsWith(ext))) {
    return NextResponse.next();
  }

  // 3. Inyectar el tenant en headers para server components
  const res = NextResponse.next();
  if (tenantSlug) {
    res.headers.set("x-tenant-slug", tenantSlug);
    // Cookie de 1 año para que persista entre navegaciones
    res.cookies.set("x-tenant-slug", tenantSlug, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  // 4. Rutas públicas: dejar pasar
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return res;
  }

  // 5. Proteger panel: si no hay sesión → /login?tenant=<slug>
  const sessionToken =
    req.cookies.get("next-auth.session-token")?.value ||
    req.cookies.get("__Secure-next-auth.session-token")?.value;

  if (!sessionToken) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    if (tenantSlug) loginUrl.searchParams.set("tenant", tenantSlug);
    return NextResponse.redirect(loginUrl);
  }

  return res;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos y api/auth
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
