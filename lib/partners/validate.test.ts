import { describe, expect, it } from "vitest";
import {
  buildPartnersStrip,
  validatePartner,
  type StripSourceRow,
} from "./validate";

const valid = {
  companyName: "Chattertons",
  contactName: "Jane Doe",
  contactEmail: "jane@chattertons.example.com",
  tier: "headline",
  agreedPricePounds: "",
  notes: "",
  websiteUrl: "https://chattertons.example.com",
};

describe("validatePartner", () => {
  it("defaults the agreed price from the tier when blank", () => {
    const result = validatePartner(valid);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agreedPricePence).toBe(350000);
  });

  it("accepts a bespoke price in pounds (the Allica case)", () => {
    const result = validatePartner({ ...valid, tier: "speakers_den", agreedPricePounds: "2500" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.agreedPricePence).toBe(250000);
  });

  it("rejects unknown tiers and bad URLs", () => {
    expect(validatePartner({ ...valid, tier: "platinum" }).ok).toBe(false);
    expect(validatePartner({ ...valid, websiteUrl: "javascript:alert(1)" }).ok).toBe(false);
    expect(validatePartner({ ...valid, agreedPricePounds: "lots" }).ok).toBe(false);
  });
});

describe("buildPartnersStrip", () => {
  const row = (overrides: Partial<StripSourceRow>): StripSourceRow => ({
    id: "p1",
    company_name: "Acme",
    tier: "partner",
    status: "paid",
    visible: true,
    website_url: null,
    logo_path: null,
    ...overrides,
  });

  it("shows agreed AND paid, hides ended and admin-hidden", () => {
    const rows = buildPartnersStrip([
      row({ id: "1", status: "agreed" }),
      row({ id: "2", status: "paid" }),
      row({ id: "3", status: "ended" }),
      row({ id: "4", status: "paid", visible: false }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("orders headline, then speakers den, then partner, then by name", () => {
    const rows = buildPartnersStrip([
      row({ id: "1", company_name: "Zeta", tier: "partner" }),
      row({ id: "2", company_name: "Allica", tier: "speakers_den" }),
      row({ id: "3", company_name: "Chattertons", tier: "headline" }),
      row({ id: "4", company_name: "Acme", tier: "partner" }),
    ]);
    expect(rows.map((r) => r.company_name)).toEqual([
      "Chattertons",
      "Allica",
      "Acme",
      "Zeta",
    ]);
  });
});
