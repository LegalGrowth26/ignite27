// Partner validation and tiers. Pure and unit-tested; the admin
// actions and the public strip both build on this. (The category
// exclusivity check was removed September 2026; the database column
// remains but is no longer collected or displayed.)

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

// Lifecycle: the enum column keeps its three values, but since the
// payment-links work (September 2026) the app never writes 'agreed'
// or 'paid': payment position derives from the money ledger
// (lib/partners/payments.ts) and 'ended' is the only manual action.
export const PARTNER_STATUSES = ["agreed", "paid", "ended"] as const;
export type PartnerStatus = (typeof PARTNER_STATUSES)[number];

export interface PartnerInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  tier: PartnerTier;
  agreedPricePence: number;
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
      notes,
      websiteUrl: websiteUrl || null,
    },
  };
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
    // Visible and not ended: agreed and paid partners always showed the
    // same way, so deriving payment state changes nothing here.
    .filter((r) => r.visible && r.status !== "ended")
    .sort((a, b) => {
      const byTier =
        PARTNER_TIER_ORDER.indexOf(a.tier) - PARTNER_TIER_ORDER.indexOf(b.tier);
      if (byTier !== 0) return byTier;
      return a.company_name.localeCompare(b.company_name, "en-GB");
    });
}
