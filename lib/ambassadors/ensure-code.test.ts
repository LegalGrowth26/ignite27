import { describe, expect, it } from "vitest";
import { percentCodeFromSlug } from "./ensure-code";
import { hostDiscountCode } from "@/lib/speakers/host-invite";

describe("percentCodeFromSlug", () => {
  it("builds the code from the slug letters and the ambassador's own percentage", () => {
    expect(percentCodeFromSlug("stephine", 15)).toBe("STEPHINE15");
    expect(percentCodeFromSlug("dan-ince", 20)).toBe("DANINCE20");
  });

  it("caps long slugs and strips non-alphanumerics", () => {
    expect(percentCodeFromSlug("a-very-long-company-name-indeed", 10)).toBe(
      "AVERYLONGCOMPANYNA10",
    );
  });

  it("falls back when the slug has no usable characters", () => {
    expect(percentCodeFromSlug("---", 20)).toBe("CODE20");
  });

  it("host codes are unchanged by the delegation (incl. their fallback)", () => {
    expect(hostDiscountCode("dan-ince")).toBe("DANINCE20");
    expect(hostDiscountCode("---")).toBe("HOST20");
    // A slug that merely STARTS with "code" keeps its real code.
    expect(hostDiscountCode("code-academy")).toBe("CODEACADEMY20");
  });
});
