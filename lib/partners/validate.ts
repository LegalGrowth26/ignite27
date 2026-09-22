// Partner validation, tiers, and the category exclusivity check. Pure
// and unit-tested; the admin actions and the public strip both build
// on this.

export const PARTNER_TIERS = ["headline", "speakers_den", "partner"] as const;
export type PartnerTier = (typeof PARTNER_TIERS)[number];

// Public-facing labels (approved casing) and standard prices. The
// stored agreed_price_pence defaults from the tier but is overridable
// per deal (real deals vary).
export const PARTNER_TIER_META: Record<
  PartnerTier,
  { label: string; standardPricePence: number }
> = {
  headline: { label: "Headline Partner", standardPricePence: 350000 },
  speakers_den: { label: "Speakers' Den Partner", standardPricePence: 250000 },
  partner: { label: "Partner", standardPricePence: 100000 },
};

// Strip ordering: headline first, then Speakers' Den, then Partner.
export const PARTNER_TIER_ORDER: readonly PartnerTier[] = [
  "headline",
  "speakers_den",
  "partner",
];

// The exclusivity list (fixed dropdown, approved). Stored lowercase.
export const PARTNER_CATEGORIES = [
  "legal",
  "accountancy",
  "banking",
  "insurance",
  "hr",
  "recruitment",
  "tech and cyber",
  "creative and communications",
  "leadership and development",
  "growth",
  "funding and investment",
  "commercial property",
  "sustainability",
  "education",
  "wellbeing",
  "food and hospitality",
  "other",
] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export const PARTNER_STATUSES = ["agreed", "paid", "ended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface PartnerInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  tier: PartnerTier;
  agreedPricePence: number;
  category: PartnerCategory;
  status: PartnerStatus;
  notes: string;
  websiteUrl: string | null;
}

export type PartnerValidation =
  | { ok: true; value: PartnerInput }
  | { ok: false; error: string };

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validatePartner(input: {
  companyName?: unknown;
  contactName?: unknown;
  contactEmail?: unknown;
  tier?: unknown;
  agreedPricePounds?: unknown; // form field in whole pounds; "" = tier default
  category?: unknown;
  status?: unknown;
  notes?: unknown;
  websiteUrl?: unknown;
}): PartnerValidation {
  const companyName = str(input.companyName);
  if (!companyName || companyName.length > 200) {
    return { ok: false, error: "Company name is required (max 200 characters)." };
  }

  const contactName = str(input.contactName);
  if (!contactName || contactName.length > 120) {
    return { ok: false, error: "Contact name is required (max 120 characters)." };
  }

  const contactEmail = str(input.contactEmail).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail) || contactEmail.length > 200) {
    return { ok: false, error: "A valid contact email is required." };
  }

  const tier = str(input.tier) as PartnerTier;
  if (!PARTNER_TIERS.includes(tier)) {
    return { ok: false, error: "Pick a tier." };
  }

  const priceRaw = str(input.agreedPricePounds);
  let agreedPricePence = PARTNER_TIER_META[tier].standardPricePence;
  if (priceRaw) {
    const pounds = Number.parseFloat(priceRaw);
    if (!Number.isFinite(pounds) || pounds < 0 || pounds > 1_000_000) {
      return { ok: false, error: "Agreed price must be a number of pounds (or blank for the standard tier price)." };
    }
    agreedPricePence = Math.round(pounds * 100);
  }

  const category = str(input.category).toLowerCase() as PartnerCategory;
  if (!PARTNER_CATEGORIES.includes(category)) {
    return { ok: false, error: "Pick a category from the list." };
  }

  const status = str(input.status) as PartnerStatus;
  if (!PARTNER_STATUSES.includes(status)) {
    return { ok: false, error: "Pick a status." };
  }

  const notes = str(input.notes);
  if (notes.length > 2000) {
    return { ok: false, error: "Notes are too long (max 2000 characters)." };
  }

  const websiteUrl = str(input.websiteUrl);
  if (websiteUrl && (websiteUrl.length > 500 || !isHttpUrl(websiteUrl))) {
    return { ok: false, error: "Website must be a full http(s) URL, or leave it blank." };
  }

  return {
    ok: true,
    value: {
      companyName,
      contactName,
      contactEmail,
      tier,
      agreedPricePence,
      category,
      status,
      notes,
      websiteUrl: websiteUrl || null,
    },
  };
}

// Category exclusivity: WARN (never block) when another non-ended
// partner already holds the category. "other" is exempt: it is the
// catch-all, not a category anyone owns. Case handled by storing
// lowercase; compare defensively anyway.
export function findCategoryClash(
  existing: ReadonlyArray<{
    id: string;
    company_name: string;
    category: string;
    status: string;
  }>,
  category: string,
  excludeId?: string,
): { companyName: string } | null {
  const wanted = category.trim().toLowerCase();
  if (wanted === "other") return null;
  const clash = existing.find(
    (p) =>
      p.id !== excludeId &&
      p.status !== "ended" &&
      p.category.trim().toLowerCase() === wanted,
  );
  return clash ? { companyName: clash.company_name } : null;
}

// Strip rule + ordering: agreed or paid, visible, tier order then name.
export interface StripSourceRow {
  id: string;
  company_name: string;
  tier: PartnerTier;
  status: string;
  visible: boolean;
  website_url: string | null;
  logo_path: string | null;
}

export function buildPartnersStrip(
  rows: readonly StripSourceRow[],
): StripSourceRow[] {
  return rows
    .filter((r) => r.visible && (r.status === "agreed" || r.status === "paid"))
    .sort((a, b) => {
      const byTier =
        PARTNER_TIER_ORDER.indexOf(a.tier) - PARTNER_TIER_ORDER.indexOf(b.tier);
      if (byTier !== 0) return byTier;
      return a.company_name.localeCompare(b.company_name, "en-GB");
    });
}
