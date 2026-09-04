import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicRoutes = ["/", "/auth/*", "/features", "/pricing", "/about", "/contact", "/manifest.json", "/sw.js", "/offline.html", "/offline/*", "/icon-*.png"];

function isPublicRoute(pathname: string): boolean {
  return publicRoutes.some((route) => {
    if (route.endsWith("/*")) {
      return pathname.startsWith(route.slice(0, -2));
    }
    return pathname === route;
  });
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options as never)
          );
        },
      },
    }
  );

  // IMPORTANT: Do NOT run logic between createServerClient and getUser
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Don't redirect API or asset requests — let them return JSON 401/404 instead of HTML redirect (fixes manifest Syntax error & api 404 loops)
  if (pathname.startsWith("/api/") || pathname === "/manifest.json" || pathname === "/sw.js" || pathname === "/offline.html" || pathname.match(/\.(?:json|png|jpg|jpeg|svg|ico|webp)$/)) {
    return supabaseResponse;
  }

  if (!isPublicRoute(pathname) && !user) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Optional: redirect authenticated users away from auth pages
  // if (isPublicRoute(pathname) && pathname.startsWith("/auth") && user) {
  //   return NextResponse.redirect(new URL("/dashboard", request.url));
  // }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
