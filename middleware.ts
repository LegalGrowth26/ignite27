import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

// Session refresh on every matched request. Server Components cannot
// write cookies, so lib/supabase/server-client.ts swallows setAll and
// relies on this middleware to persist rotated tokens (its comment has
// always said so; the middleware itself was never added). Without it,
// once the access token expires (about an hour), every server render
// re-refreshes with the browser's stale refresh token until Supabase's
// reuse detection revokes the whole session. That surfaces as a
// signed-in user suddenly failing auth-gated pages: /account bouncing
// to login, or /admin 404ing via the super-admin gate.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl(), env.supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() validates the token and, when expired, refreshes it; the
  // rotated tokens flow back to the browser via setAll above. No session
  // means a fast no-network error, so anonymous traffic stays cheap.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Everything except static assets and the Stripe webhook (signed
  // server-to-server calls carry no session and must not be touched).
  matcher: [
    "/((?!_next/static|_next/image|api/stripe/webhook|favicon|images/|fonts/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|txt|xml)$).*)",
  ],
};
