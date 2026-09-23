import { describe, expect, it } from "vitest";
import { inviteAccessBlock, loginUrl } from "./invite-access";

describe("inviteAccessBlock", () => {
  it("existing accounts are told to log in, never to set a password", () => {
    const block = inviteAccessBlock(true);
    expect(block.useSetPasswordLink).toBe(false);
    expect(block.buttonLabel).toBe("Log in");
    expect(block.intro).toContain("already have an IGNITE! account");
    expect(block.note).toContain("Reset it from the login page");
  });

  it("new accounts get the set-password flow", () => {
    const block = inviteAccessBlock(false);
    expect(block.useSetPasswordLink).toBe(true);
    expect(block.buttonLabel).toBe("Set your password");
    expect(block.note).toContain("24 hours");
  });
});

describe("loginUrl", () => {
  it("builds the login URL without a double slash", () => {
    expect(loginUrl("https://ignite27.co.uk/")).toBe("https://ignite27.co.uk/login");
  });
});
