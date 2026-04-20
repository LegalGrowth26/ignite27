// Delegate booking intent: the validated input collected on /attend/book,
// forwarded through Stripe Checkout metadata, and written to the database
// when the payment succeeds.

export const DELEGATE_TICKET_TYPES = ["regular", "vip"] as const;
export type DelegateTicketType = (typeof DELEGATE_TICKET_TYPES)[number];

export const DIETARY_REQUIREMENTS = [
  "none",
  "vegetarian",
  "vegan",
  "gluten_free",
  "dairy_free",
  "nut_allergy",
  "other",
] as const;
export type DietaryRequirement = (typeof DIETARY_REQUIREMENTS)[number];

export interface DelegateBookingIntent {
  ticketType: DelegateTicketType;
  lunchIncluded: boolean;
  firstName: string;
  surname: string;
  email: string;
  mobile: string;
  company: string;
  jobTitle: string;
  dietaryRequirement: DietaryRequirement;
  dietaryOther: string;
  badgeQrUrl: string;
  marketingOptIn: boolean;
  termsAccepted: boolean;
}

export type IntentField = keyof DelegateBookingIntent | "form";

export interface IntentFieldError {
  field: IntentField;
  message: string;
}

export type IntentValidationResult =
  | { ok: true; intent: DelegateBookingIntent }
  | { ok: false; errors: IntentFieldError[] };

const MAX_NAME = 100;
const MAX_COMPANY = 200;
const MAX_JOB_TITLE = 200;
const MAX_MOBILE = 30;
const MAX_EMAIL = 200;
const MAX_DIETARY_OTHER = 200;
const MAX_URL = 400;

function trimString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toBoolean(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "on" || value === "1") return true;
  return false;
}

function isValidEmail(value: string): boolean {
  // Intentionally loose. Real validation happens when Stripe/Supabase accept it.
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= MAX_EMAIL;
}

function isValidUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export function validateDelegateBookingIntent(input: unknown): IntentValidationResult {
  if (typeof input !== "object" || input === null) {
    return { ok: false, errors: [{ field: "form", message: "Submission could not be read." }] };
  }
  const raw = input as Record<string, unknown>;
  const errors: IntentFieldError[] = [];

  const ticketType = trimString(raw.ticketType) as DelegateTicketType;
  if (!DELEGATE_TICKET_TYPES.includes(ticketType)) {
    errors.push({
      field: "ticketType",
      message: "Pick Regular or VIP.",
    });
  }

  const firstName = trimString(raw.firstName);
  if (firstName.length === 0 || firstName.length > MAX_NAME) {
    errors.push({ field: "firstName", message: "We need a first name." });
  }

  const surname = trimString(raw.surname);
  if (surname.length === 0 || surname.length > MAX_NAME) {
    errors.push({ field: "surname", message: "We need a surname." });
  }

  const email = trimString(raw.email).toLowerCase();
  if (!isValidEmail(email)) {
    errors.push({
      field: "email",
      message: "We need an email so we can send your ticket.",
    });
  }

  const mobile = trimString(raw.mobile);
  if (mobile.length === 0 || mobile.length > MAX_MOBILE) {
    errors.push({
      field: "mobile",
      message: "Add a mobile number so we can reach you on the day.",
    });
  }

  const company = trimString(raw.company);
  if (company.length === 0 || company.length > MAX_COMPANY) {
    errors.push({ field: "company", message: "Which company are you with?" });
  }

  const jobTitle = trimString(raw.jobTitle);
  if (jobTitle.length === 0 || jobTitle.length > MAX_JOB_TITLE) {
    errors.push({ field: "jobTitle", message: "Your job title helps us print your badge." });
  }

  const dietaryRequirement = trimString(raw.dietaryRequirement) as DietaryRequirement;
  if (!DIETARY_REQUIREMENTS.includes(dietaryRequirement)) {
    errors.push({ field: "dietaryRequirement", message: "Pick a dietary option." });
  }

  let dietaryOther = trimString(raw.dietaryOther);
  if (dietaryRequirement === "other") {
    if (dietaryOther.length === 0 || dietaryOther.length > MAX_DIETARY_OTHER) {
      errors.push({
        field: "dietaryOther",
        message: "Tell us briefly what to cater for.",
      });
    }
  } else {
    dietaryOther = "";
  }

  const badgeQrUrl = trimString(raw.badgeQrUrl);
  if (badgeQrUrl.length > 0) {
    if (badgeQrUrl.length > MAX_URL || !isValidUrl(badgeQrUrl)) {
      errors.push({
        field: "badgeQrUrl",
        message: "That link does not look right. Use a full https URL or leave blank.",
      });
    }
  }

  const marketingOptIn = toBoolean(raw.marketingOptIn);
  const termsAccepted = toBoolean(raw.termsAccepted);
  if (!termsAccepted) {
    errors.push({
      field: "termsAccepted",
      message: "Tick the box to accept the Terms and Refund Policy.",
    });
  }

  const lunchFlag = toBoolean(raw.lunchIncluded);
  // VIP always includes lunch regardless of what the form posted.
  const lunchIncluded = ticketType === "vip" ? true : lunchFlag;

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    intent: {
      ticketType,
      lunchIncluded,
      firstName,
      surname,
      email,
      mobile,
      company,
      jobTitle,
      dietaryRequirement,
      dietaryOther,
      badgeQrUrl,
      marketingOptIn,
      termsAccepted,
    },
  };
}

// -----------------------------------------------------------------------------
// Stripe metadata encoding.
// Stripe limits: 50 keys per object, each value <= 500 chars, each key <= 40
// chars. We store everything flat as strings.
// -----------------------------------------------------------------------------

export interface DelegatePricingSnapshot {
  window: string;
  ticketPricePence: number;
  lunchPricePence: number;
  charityUpliftPence: number;
  grossAmountPence: number;
}

export interface DelegateIntentMetadata {
  booking_ref: string;
  booking_type: "delegate";
  ticket_type: DelegateTicketType;
  lunch_included: string;
  pricing_window: string;
  ticket_price_pence: string;
  lunch_price_pence: string;
  charity_uplift_pence: string;
  gross_amount_pence: string;
  first_name: string;
  surname: string;
  email: string;
  mobile: string;
  company: string;
  job_title: string;
  dietary_requirement: DietaryRequirement;
  dietary_other: string;
  badge_qr_url: string;
  marketing_opt_in: string;
  terms_accepted_at: string;
  terms_accepted_ip: string;
}

export function intentToMetadata(
  intent: DelegateBookingIntent,
  pricing: DelegatePricingSnapshot,
  bookingReference: string,
  termsAcceptedAt: string,
  termsAcceptedIp: string,
): DelegateIntentMetadata {
  return {
    booking_ref: bookingReference,
    booking_type: "delegate",
    ticket_type: intent.ticketType,
    lunch_included: String(intent.lunchIncluded),
    pricing_window: pricing.window,
    ticket_price_pence: String(pricing.ticketPricePence),
    lunch_price_pence: String(pricing.lunchPricePence),
    charity_uplift_pence: String(pricing.charityUpliftPence),
    gross_amount_pence: String(pricing.grossAmountPence),
    first_name: intent.firstName,
    surname: intent.surname,
    email: intent.email,
    mobile: intent.mobile,
    company: intent.company,
    job_title: intent.jobTitle,
    dietary_requirement: intent.dietaryRequirement,
    dietary_other: intent.dietaryOther,
    badge_qr_url: intent.badgeQrUrl,
    marketing_opt_in: String(intent.marketingOptIn),
    terms_accepted_at: termsAcceptedAt,
    terms_accepted_ip: termsAcceptedIp,
  };
}

export interface ParsedDelegateMetadata {
  bookingReference: string;
  intent: DelegateBookingIntent;
  pricing: DelegatePricingSnapshot;
  termsAcceptedAt: string;
  termsAcceptedIp: string;
}

export class MetadataParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetadataParseError";
  }
}

function requireMetadataField(metadata: Record<string, string | null>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string") {
    throw new MetadataParseError(`metadata missing field: ${key}`);
  }
  return value;
}

function parseIntMetadata(metadata: Record<string, string | null>, key: string): number {
  const raw = requireMetadataField(metadata, key);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    throw new MetadataParseError(`metadata field ${key} is not an integer`);
  }
  return n;
}

function parseBoolMetadata(metadata: Record<string, string | null>, key: string): boolean {
  return requireMetadataField(metadata, key) === "true";
}

export function metadataToParsed(metadata: Record<string, string | null>): ParsedDelegateMetadata {
  if (requireMetadataField(metadata, "booking_type") !== "delegate") {
    throw new MetadataParseError("metadata booking_type is not 'delegate'");
  }

  const ticketType = requireMetadataField(metadata, "ticket_type") as DelegateTicketType;
  if (!DELEGATE_TICKET_TYPES.includes(ticketType)) {
    throw new MetadataParseError(`metadata ticket_type invalid: ${ticketType}`);
  }

  const dietaryRequirement = requireMetadataField(
    metadata,
    "dietary_requirement",
  ) as DietaryRequirement;
  if (!DIETARY_REQUIREMENTS.includes(dietaryRequirement)) {
    throw new MetadataParseError(`metadata dietary_requirement invalid: ${dietaryRequirement}`);
  }

  return {
    bookingReference: requireMetadataField(metadata, "booking_ref"),
    termsAcceptedAt: requireMetadataField(metadata, "terms_accepted_at"),
    termsAcceptedIp: requireMetadataField(metadata, "terms_accepted_ip"),
    intent: {
      ticketType,
      lunchIncluded: parseBoolMetadata(metadata, "lunch_included"),
      firstName: requireMetadataField(metadata, "first_name"),
      surname: requireMetadataField(metadata, "surname"),
      email: requireMetadataField(metadata, "email"),
      mobile: requireMetadataField(metadata, "mobile"),
      company: requireMetadataField(metadata, "company"),
      jobTitle: requireMetadataField(metadata, "job_title"),
      dietaryRequirement,
      dietaryOther: requireMetadataField(metadata, "dietary_other"),
      badgeQrUrl: requireMetadataField(metadata, "badge_qr_url"),
      marketingOptIn: parseBoolMetadata(metadata, "marketing_opt_in"),
      termsAccepted: true,
    },
    pricing: {
      window: requireMetadataField(metadata, "pricing_window"),
      ticketPricePence: parseIntMetadata(metadata, "ticket_price_pence"),
      lunchPricePence: parseIntMetadata(metadata, "lunch_price_pence"),
      charityUpliftPence: parseIntMetadata(metadata, "charity_uplift_pence"),
      grossAmountPence: parseIntMetadata(metadata, "gross_amount_pence"),
    },
  };
}
