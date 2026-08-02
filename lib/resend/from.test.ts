import { describe, expect, it } from "vitest";
import { buildFromAddress } from "./from";

describe("buildFromAddress", () => {
  it("wraps a bare address in the IGNITE! 27 display name", () => {
    expect(buildFromAddress("tom@lincolnshiremarketing.co.uk")).toBe(
      "IGNITE! 27 <tom@lincolnshiremarketing.co.uk>",
    );
  });

  it("trims whitespace before wrapping", () => {
    expect(buildFromAddress("  tom@lincolnshiremarketing.co.uk ")).toBe(
      "IGNITE! 27 <tom@lincolnshiremarketing.co.uk>",
    );
  });

  it("passes through a value that already carries a display name", () => {
    expect(buildFromAddress("Staging <staging@lincolnshiremarketing.co.uk>")).toBe(
      "Staging <staging@lincolnshiremarketing.co.uk>",
    );
  });
});
