import { describe, expect, it } from "vitest";
import { formatExVatWithGross, formatPoundsFromPence } from "./format";

describe("formatPoundsFromPence", () => {
  it("drops decimals for whole pounds", () => {
    expect(formatPoundsFromPence(2500)).toBe("£25");
    expect(formatPoundsFromPence(0)).toBe("£0");
  });

  it("keeps two decimals when there are pence", () => {
    expect(formatPoundsFromPence(8280)).toBe("£82.80");
    expect(formatPoundsFromPence(1050)).toBe("£10.50");
  });
});

describe("formatExVatWithGross", () => {
  it("renders '£25 + VAT (£30)' for launch delegate", () => {
    expect(formatExVatWithGross(2500, 3000)).toBe("£25 + VAT (£30)");
  });

  it("renders VIP with pence in the gross", () => {
    expect(formatExVatWithGross(6900, 8280)).toBe("£69 + VAT (£82.80)");
  });

  it("renders exhibitor launch", () => {
    expect(formatExVatWithGross(18900, 22680)).toBe("£189 + VAT (£226.80)");
  });
});
