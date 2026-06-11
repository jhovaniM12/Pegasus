import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const STAFF_ROLES = new Set(["JUDGE", "TECHNICAL_DIRECTOR", "VETERINARIAN"]);

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");

  return atob(paddedBase64);
}

function readSessionRole(sessionToken: string | undefined): string | null {
  if (!sessionToken) {
    return null;
  }

  const [encodedPayload] = sessionToken.split(".");

  if (!encodedPayload) {
    return null;
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as {
      role?: unknown;
      exp?: unknown;
    };

    if (typeof payload.exp === "number" && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  if (/\.[^/]+$/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Verificamos si existe la cookie de sesión de pegasus
  const sessionToken = request.cookies.get("pegasus_session")?.value;
  const sessionRole = readSessionRole(sessionToken);
  const isRootSession = sessionRole === "ROOT";
  const isStaffSession = sessionRole ? STAFF_ROLES.has(sessionRole) : false;
  const isLoginPage = request.nextUrl.pathname === "/login";
  const isStaffLoginPage = request.nextUrl.pathname === "/login/staff";
  const isPublicPage = isLoginPage || isStaffLoginPage;
  const isStaffArea = request.nextUrl.pathname === "/staff" || request.nextUrl.pathname.startsWith("/staff/");

  // Si no hay sesión válida y no es una página pública, redirigir según el área solicitada.
  if (!sessionRole && !isPublicPage) {
    if (isStaffArea) {
      const staffLoginUrl = new URL("/login/staff", request.url);
      return NextResponse.redirect(staffLoginUrl);
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isStaffSession && isPublicPage) {
    const staffUrl = new URL("/staff", request.url);
    return NextResponse.redirect(staffUrl);
  }

  if (isStaffSession && !isStaffArea) {
    const staffUrl = new URL("/staff", request.url);
    return NextResponse.redirect(staffUrl);
  }

  if (isRootSession && isStaffArea) {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // Si hay sesión ROOT y estamos en una página de login, redirigir al dashboard administrativo.
  if (isRootSession && isPublicPage) {
    const dashboardUrl = new URL("/", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

// Configurar sobre qué rutas se ejecuta el middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files with extensions
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
