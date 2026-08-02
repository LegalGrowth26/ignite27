import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { resolveCallbackAction, safeNextPath } from "@/lib/auth/recovery";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

export const dynamic = "force-dynamic";

// Single entry point for every Supabase email link (recovery links from
// forgot-password AND from the booking confirmation email). Establishes
// the session server-side, sets the auth cookies, then forwards to
// `next`. Handles all three URL shapes Supabase can produce:
//   ?code=...                      -> exchangeCodeForSession (PKCE / flow state)
//   ?token_hash=...&type=recovery  -> verifyOtp (TokenHash template links)
//   ?error_code=...                -> friendly failure redirect
//
// Failures land on /auth/forgot-password (not /login) when the user was
// heading to set-password, so the fix is one click away.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"));
  const action = resolveCallbackAction(url.searchParams);

  const failureTarget = next.startsWith("/auth/set-password")
    ? "/auth/forgot-password"
    : "/login";
  const fail = (message: string) =>
    NextResponse.redirect(
      new URL(`${failureTarget}?error=${encodeURIComponent(message)}`, url.origin),
    );

  if (action.kind === "error") {
    console.warn("[auth/callback] provider error:", action.errorCode, action.description);
    return fail(
      action.errorCode === "otp_expired"
        ? "That link has expired. Request a fresh one and open it straight away."
        : "That link is not valid any more. Request a fresh one.",
    );
  }

  const supabase = await createSupabaseServerClient();

  if (action.kind === "token_hash") {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: action.tokenHash,
      type: action.otpType as EmailOtpType,
    });
    if (error) {
      console.warn("[auth/callback] verifyOtp failed:", error.message);
      return fail("That link has expired or was already used. Request a fresh one.");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (action.kind === "code") {
    const { error } = await supabase.auth.exchangeCodeForSession(action.code);
    if (error) {
      console.warn("[auth/callback] exchangeCodeForSession failed:", error.message);
      return fail("That link has expired or was already used. Request a fresh one.");
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  // No code, no token, no error: someone opened /auth/callback directly.
  return NextResponse.redirect(new URL(next, url.origin));
}
