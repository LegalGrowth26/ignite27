import { describe, expect, it } from "vitest";
import { stripeKeyMode } from "./mode";

describe("stripeKeyMode", () => {
  it("detects live secret keys", () => {
    expect(stripeKeyMode("sk_live_abc123")).toBe("live");
  });

  it("detects test secret keys", () => {
    expect(stripeKeyMode("sk_test_abc123")).toBe("test");
  });

  it("detects restricted keys in both modes", () => {
    expect(stripeKeyMode("rk_live_abc123")).toBe("live");
    expect(stripeKeyMode("rk_test_abc123")).toBe("test");
  });

  it("returns unknown for anything else, rather than guessing", () => {
    expect(stripeKeyMode("pk_live_abc123")).toBe("unknown"); // publishable, not secret
    expect(stripeKeyMode("whsec_abc")).toBe("unknown");
    expect(stripeKeyMode("")).toBe("unknown");
    expect(stripeKeyMode("sk_liveabc")).toBe("unknown"); // missing underscore
  });
});
