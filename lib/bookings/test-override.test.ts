import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ALLOW_PROD_ENV_VAR,
  BookingOverrideConfigError,
  OVERRIDE_ENV_VAR,
  getBookingOverrideDate,
  getBookingOverrideRaw,
  resolveBookingNow,
} from "./test-override";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getBookingOverrideDate", () => {
  it("returns null when the env var is not set", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    expect(getBookingOverrideDate()).toBeNull();
  });

  it("returns null when the env var is absent entirely", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    expect(getBookingOverrideDate()).toBeNull();
  });

  it("returns a parsed Date when the env var is a valid ISO string", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    const d = getBookingOverrideDate();
    expect(d).toBeInstanceOf(Date);
    expect(d?.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("throws when the env var is set but not a valid date", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "not-a-date");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    expect(() => getBookingOverrideDate()).toThrow(BookingOverrideConfigError);
  });

  it("refuses to activate in production without the allow flag", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "production");
    vi.stubEnv(ALLOW_PROD_ENV_VAR, "");
    expect(() => getBookingOverrideDate()).toThrow(BookingOverrideConfigError);
  });

  it("refuses to activate when NEXT_PUBLIC_ENVIRONMENT=prod without the allow flag", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "prod");
    vi.stubEnv(ALLOW_PROD_ENV_VAR, "");
    expect(() => getBookingOverrideDate()).toThrow(BookingOverrideConfigError);
  });

  it("activates in production when ALLOW_OVERRIDE_IN_PRODUCTION=true", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "production");
    vi.stubEnv(ALLOW_PROD_ENV_VAR, "true");
    const d = getBookingOverrideDate();
    expect(d?.toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });

  it("treats non-'true' allow-flag values as not permitted", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "production");
    vi.stubEnv(ALLOW_PROD_ENV_VAR, "1");
    expect(() => getBookingOverrideDate()).toThrow(BookingOverrideConfigError);
  });
});

describe("resolveBookingNow", () => {
  it("returns real 'now' when the override is not set", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    const before = Date.now();
    const now = resolveBookingNow();
    const after = Date.now();
    expect(now.getTime()).toBeGreaterThanOrEqual(before);
    expect(now.getTime()).toBeLessThanOrEqual(after);
  });

  it("returns the override date when set", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    expect(resolveBookingNow().toISOString()).toBe("2026-07-15T10:00:00.000Z");
  });
});

describe("getBookingOverrideRaw", () => {
  it("returns the raw string when set and valid", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "2026-07-15T10:00:00Z");
    vi.stubEnv("NEXT_PUBLIC_ENVIRONMENT", "local");
    expect(getBookingOverrideRaw()).toBe("2026-07-15T10:00:00Z");
  });

  it("returns null when unset", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "");
    expect(getBookingOverrideRaw()).toBeNull();
  });

  it("returns null when set to an invalid date (banner hidden, error surfaces elsewhere)", () => {
    vi.stubEnv(OVERRIDE_ENV_VAR, "garbage");
    expect(getBookingOverrideRaw()).toBeNull();
  });
});
