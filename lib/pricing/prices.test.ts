import { describe, expect, it } from "vitest";
import {
  LUNCH_ADDON_INC_VAT_PENCE,
  VAT_RATE,
  getDelegatePrice,
  getExhibitorPrice,
  getLunchAddOnPrice,
  getVipPrice,
  priceFromExVat,
  priceFromIncVat,
} from "./prices";

describe("VAT constants", () => {
  it("uses the UK standard rate of 20%", () => {
    expect(VAT_RATE).toBe(0.2);
  });
});

describe("priceFromExVat", () => {
  it("adds 20% VAT to an ex-VAT amount (2500 → 500 → 3000)", () => {
    const p = priceFromExVat(2500);
    expect(p.exVatPence).toBe(2500);
    expect(p.vatPence).toBe(500);
    expect(p.incVatPence).toBe(3000);
  });

  it("handles the VIP launch price (6900 → 1380 → 8280)", () => {
    const p = priceFromExVat(6900);
    expect(p.exVatPence).toBe(6900);
    expect(p.vatPence).toBe(1380);
    expect(p.incVatPence).toBe(8280);
  });

  it("handles the exhibitor launch price (18900 → 3780 → 22680)", () => {
    const p = priceFromExVat(18900);
    expect(p.exVatPence).toBe(18900);
    expect(p.vatPence).toBe(3780);
    expect(p.incVatPence).toBe(22680);
  });
});

describe("priceFromIncVat", () => {
  it("splits £15 inc-VAT into £12.50 + £2.50", () => {
    const p = priceFromIncVat(1500);
    expect(p.exVatPence).toBe(1250);
    expect(p.vatPence).toBe(250);
    expect(p.incVatPence).toBe(1500);
  });

  it("keeps ex + vat = inc for arbitrary integer pence", () => {
    const p = priceFromIncVat(1234);
    expect(p.exVatPence + p.vatPence).toBe(p.incVatPence);
  });
});

describe("getDelegatePrice", () => {
  it("launch = £25 + VAT", () => {
    const p = getDelegatePrice("launch");
    expect(p.exVatPence).toBe(2500);
    expect(p.vatPence).toBe(500);
    expect(p.incVatPence).toBe(3000);
  });

  it("standard = £35 + VAT", () => {
    const p = getDelegatePrice("standard");
    expect(p.exVatPence).toBe(3500);
    expect(p.vatPence).toBe(700);
    expect(p.incVatPence).toBe(4200);
  });

  it("late = £45 + VAT", () => {
    const p = getDelegatePrice("late");
    expect(p.exVatPence).toBe(4500);
    expect(p.vatPence).toBe(900);
    expect(p.incVatPence).toBe(5400);
  });
});

describe("getVipPrice", () => {
  it("launch = £69 + VAT", () => {
    const p = getVipPrice("launch");
    expect(p.exVatPence).toBe(6900);
    expect(p.vatPence).toBe(1380);
    expect(p.incVatPence).toBe(8280);
  });

  it("standard = £85 + VAT", () => {
    const p = getVipPrice("standard");
    expect(p.exVatPence).toBe(8500);
    expect(p.vatPence).toBe(1700);
    expect(p.incVatPence).toBe(10200);
  });

  it("late = £99 + VAT", () => {
    const p = getVipPrice("late");
    expect(p.exVatPence).toBe(9900);
    expect(p.vatPence).toBe(1980);
    expect(p.incVatPence).toBe(11880);
  });
});

describe("getExhibitorPrice", () => {
  it("launch = £189 + VAT", () => {
    const p = getExhibitorPrice("launch");
    expect(p.exVatPence).toBe(18900);
    expect(p.incVatPence).toBe(22680);
  });

  it("standard = £249 + VAT", () => {
    const p = getExhibitorPrice("standard");
    expect(p.exVatPence).toBe(24900);
    expect(p.incVatPence).toBe(29880);
  });

  it("late = £249 + VAT (no separate late uplift for exhibitors)", () => {
    const p = getExhibitorPrice("late");
    expect(p.exVatPence).toBe(24900);
    expect(p.incVatPence).toBe(29880);
    expect(p.exVatPence).toBe(getExhibitorPrice("standard").exVatPence);
  });
});

describe("getLunchAddOnPrice", () => {
  it("is defined flat at £15 inc-VAT (£12.50 + £2.50)", () => {
    expect(LUNCH_ADDON_INC_VAT_PENCE).toBe(1500);
    const p = getLunchAddOnPrice();
    expect(p.exVatPence).toBe(1250);
    expect(p.vatPence).toBe(250);
    expect(p.incVatPence).toBe(1500);
  });
});
