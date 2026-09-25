import { describe, expect, it } from "vitest";
import { compGivenByLine } from "./send-comp-confirmation";

describe("compGivenByLine", () => {
  it("names the ambassador when known", () => {
    expect(compGivenByLine("Dan Ince")).toBe(
      "Dan Ince has given you a full delegate ticket to IGNITE! 27, with their compliments.",
    );
  });

  it("falls back warmly when the name is missing or blank", () => {
    for (const value of [null, "", "   "]) {
      const line = compGivenByLine(value as string | null);
      expect(line).toContain("with our compliments");
      expect(line).not.toContain("undefined");
    }
  });
});
