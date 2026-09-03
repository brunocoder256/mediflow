import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const publicRoutes = ["/", "/auth/*", "/features", "/pricing", "/about", "/contact"];

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
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
