// Pure helpers for the password-recovery flow. Kept free of Next/Supabase
// imports so every branch is unit-testable.

// ---------------------------------------------------------------------------
// Callback URL classification. Supabase can land on /auth/callback with any
// of these shapes depending on how the link was generated and which email
// template variable was used:
//   - ?code=...                        (PKCE / flow-state exchange)
//   - ?token_hash=...&type=recovery    ({{ .TokenHash }} template links)
//   - ?error=...&error_code=...        (expired/invalid links)
// Fragments (#access_token / #error) never reach the server; the client
// pages handle those separately.
// ---------------------------------------------------------------------------

export type CallbackAction =
  | { kind: "code"; code: string }
  | { kind: "token_hash"; tokenHash: string; otpType: string }
  | { kind: "error"; errorCode: string; description: string }
  | { kind: "none" };

export function resolveCallbackAction(params: URLSearchParams): CallbackAction {
  const errorCode = params.get("error_code") ?? params.get("error");
  if (errorCode) {
    return {
      kind: "error",
      errorCode,
      description: params.get("error_description") ?? "",
    };
  }
  const tokenHash = params.get("token_hash");
  if (tokenHash) {
    return {
      kind: "token_hash",
      tokenHash,
      otpType: params.get("type") ?? "recovery",
    };
  }
  const code = params.get("code");
  if (code) return { kind: "code", code };
  return { kind: "none" };
}

// Only allow same-site relative paths for the post-callback redirect.
export function safeNextPath(raw: string | null): string {
  if (raw && raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/account";
}

// ---------------------------------------------------------------------------
// updateUser({ password }) error mapping. The old form collapsed everything
// into two buckets with a regex, which swallowed the real reason (notably
// Supabase's "New password should be different from the old password.",
// which matched neither bucket keyword and surfaced as a useless generic).
// ---------------------------------------------------------------------------

export type UpdatePasswordErrorKind =
  | "same_password"
  | "weak_password"
  | "no_session"
  | "rate_limited"
  | "generic";

export interface MappedUpdatePasswordError {
  kind: UpdatePasswordErrorKind;
  message: string;
}

export function mapUpdatePasswordError(rawMessage: string): MappedUpdatePasswordError {
  const m = rawMessage.toLowerCase();

  if (m.includes("different from the old")) {
    return {
      kind: "same_password",
      message:
        "That is already your current password. Pick a different one, or just log in with it.",
    };
  }
  if (m.includes("password should") || m.includes("at least") || m.includes("weak")) {
    return {
      kind: "weak_password",
      message: "That password is too weak. Use at least 8 characters.",
    };
  }
  if (m.includes("session") || m.includes("not logged in") || m.includes("missing")) {
    return {
      kind: "no_session",
      message:
        "Your reset link has expired or was already used. Request a fresh link and open it straight away.",
    };
  }
  if (m.includes("rate") || m.includes("too many")) {
    return {
      kind: "rate_limited",
      message: "Too many attempts. Wait a minute and try again.",
    };
  }
  return {
    kind: "generic",
    message: "Could not set your password. Request a fresh reset link and try again.",
  };
}

// Hash-fragment error detection for pages that receive implicit-flow
// errors (e.g. #error=access_denied&error_code=otp_expired). Fragments
// never reach the server, so the client parses window.location.hash.
export function parseHashError(hash: string): { errorCode: string; description: string } | null {
  const trimmed = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!trimmed) return null;
  const params = new URLSearchParams(trimmed);
  const errorCode = params.get("error_code") ?? params.get("error");
  if (!errorCode) return null;
  return {
    errorCode,
    description: params.get("error_description")?.replace(/\+/g, " ") ?? "",
  };
}
