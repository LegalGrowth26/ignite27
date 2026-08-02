import { describe, expect, it } from "vitest";
import {
  mapUpdatePasswordError,
  parseHashError,
  resolveCallbackAction,
  safeNextPath,
} from "./recovery";

describe("resolveCallbackAction", () => {
  it("classifies PKCE / flow-state code links", () => {
    expect(resolveCallbackAction(new URLSearchParams("code=abc123"))).toEqual({
      kind: "code",
      code: "abc123",
    });
  });

  it("classifies token_hash template links with their type", () => {
    expect(
      resolveCallbackAction(new URLSearchParams("token_hash=pkce_x&type=recovery")),
    ).toEqual({ kind: "token_hash", tokenHash: "pkce_x", otpType: "recovery" });
  });

  it("defaults token_hash type to recovery when absent", () => {
    const action = resolveCallbackAction(new URLSearchParams("token_hash=pkce_x"));
    expect(action).toEqual({ kind: "token_hash", tokenHash: "pkce_x", otpType: "recovery" });
  });

  it("classifies provider errors and prefers error_code", () => {
    expect(
      resolveCallbackAction(
        new URLSearchParams("error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"),
      ),
    ).toEqual({ kind: "error", errorCode: "otp_expired", description: "Email link is invalid" });
  });

  it("errors win even when a code is also present", () => {
    const action = resolveCallbackAction(new URLSearchParams("code=x&error_code=otp_expired"));
    expect(action.kind).toBe("error");
  });

  it("returns none for a bare URL", () => {
    expect(resolveCallbackAction(new URLSearchParams(""))).toEqual({ kind: "none" });
  });
});

describe("safeNextPath", () => {
  it("accepts same-site relative paths", () => {
    expect(safeNextPath("/auth/set-password")).toBe("/auth/set-password");
  });

  it("rejects absolute URLs, protocol-relative URLs, and null", () => {
    expect(safeNextPath("https://evil.example")).toBe("/account");
    expect(safeNextPath("//evil.example")).toBe("/account");
    expect(safeNextPath(null)).toBe("/account");
  });
});

describe("mapUpdatePasswordError", () => {
  it("maps Supabase's same-password rejection to an actionable message", () => {
    const mapped = mapUpdatePasswordError(
      "New password should be different from the old password.",
    );
    expect(mapped.kind).toBe("same_password");
    expect(mapped.message).toContain("already your current password");
  });

  it("maps weak-password policy errors", () => {
    expect(mapUpdatePasswordError("Password should be at least 6 characters.").kind).toBe(
      "weak_password",
    );
  });

  it("maps missing-session errors to the expired-link state", () => {
    expect(mapUpdatePasswordError("Auth session missing!").kind).toBe("no_session");
  });

  it("maps rate limiting", () => {
    expect(mapUpdatePasswordError("For security purposes, too many requests").kind).toBe(
      "rate_limited",
    );
  });

  it("falls back to generic with a request-a-fresh-link hint", () => {
    const mapped = mapUpdatePasswordError("something unexpected");
    expect(mapped.kind).toBe("generic");
    expect(mapped.message).toContain("fresh reset link");
  });
});

describe("parseHashError", () => {
  it("parses implicit-flow hash errors", () => {
    const parsed = parseHashError("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    expect(parsed?.errorCode).toBe("otp_expired");
    expect(parsed?.description).toContain("invalid or has expired");
  });

  it("returns null when the hash has no error", () => {
    expect(parseHashError("")).toBeNull();
    expect(parseHashError("#access_token=jwt&type=recovery")).toBeNull();
  });
});
