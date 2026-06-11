import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  if (/\.[^/]+$/.test(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  // Verificamos si existe la cookie de sesión de pegasus
  const sessionToken = request.cookies.get("pegasus_session")?.value;
  const isLoginPage = request.nextUrl.pathname === "/login";

  // Si no hay token y no es la página de login, redirigir a /login
  if (!sessionToken && !isLoginPage) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Si hay token y estamos en la página de login, redirigir al dashboard
  if (sessionToken && isLoginPage) {
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
