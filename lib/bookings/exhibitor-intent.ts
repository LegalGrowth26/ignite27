// Exhibitor booking intent: the validated input collected on
// /exhibit/book, forwarded through Stripe Checkout metadata, and written
// to the database when the payment succeeds. Mirrors the delegate intent
// module (lib/bookings/intent.ts) so the two flows stay structurally
// identical.
//
// Exhibitor packages always include 2 lunches, so dietary is collected
// and validated unconditionally for both attendees (the exhibitor
// equivalent of the delegate VIP branch of bookingIncludesLunch).
//
// No badge QR field: the badge QR is a VIP-only perk by decision (the
// delegate flow strips it for non-VIP submissions). SPEC.md's exhibitor
// field list predates that decision; flagged in the PR rather than
// silently followed.

import { DIETARY_REQUIREMENTS, type DietaryRequirement } from "./intent";

export interface ExhibitorAttendeeIntent {
  // Exhibitors may not know who is coming at booking time. A TBC
  // attendee carries tbc: true and empty identity fields; the booking
  // stores the literal name "TBC" (no schema change) and no dietary is
  // collected until the name is confirmed.
  tbc: boolean;
  firstName: string;
  surname: string;
  email: string;
  mobile: string; // optional; "" when not given
  jobTitle: string;
  dietaryRequirement: DietaryRequirement;
  dietaryOther: string;
}

export const TBC_FIRST_NAME = "TBC";

// A TBC attendee as stored: first_name literally "TBC" with an empty
// surname. Shared by the email builder, the account page, the admin
// view, and the CSV export so "to be confirmed" renders consistently.
export function isTbcAttendeeName(firstName: string, surname: string): boolean {
  return firstName === TBC_FIRST_NAME && surname.trim() === "";
}

export function tbcAttendeeIntent(): ExhibitorAttendeeIntent {
  return {
    tbc: true,
    firstName: TBC_FIRST_NAME,
    surname: "",
    email: "",
    mobile: "",
    jobTitle: "",
    dietaryRequirement: "none",
    dietaryOther: "",
  };
}

export interface ExhibitorBookingIntent {
  company: string;
  website: string; // optional; "" when not given
  contactFirstName: string;
  contactSurname: string;
  contactEmail: string;
  contactMobile: string;
  attendees: [ExhibitorAttendeeIntent, ExhibitorAttendeeIntent];
  marketingOptIn: boolean;
  termsAccepted: boolean;
}

// Field keys are flat strings so attendee fields can be addressed as
// "attendee1.firstName" / "attendee2.dietaryRequirement" etc.
export interface ExhibitorIntentFieldError {
  field: string;
  message: string;
}

export type ExhibitorIntentValidationResult =
  | { ok: true; intent: ExhibitorBookingIntent }
  | { ok: false; errors: ExhibitorIntentFieldError[] };

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

function validateAttendee(
  raw: Record<string, unknown>,
  prefix: "attendee1" | "attendee2",
  label: string,
  errors: ExhibitorIntentFieldError[],
): ExhibitorAttendeeIntent {
  // "Name TBC, we'll confirm later": every field for this slot is
  // skipped, whatever was posted (the fields do not render when the box
  // is ticked, so values arriving anyway are tampering and are
  // dropped, same pattern as the delegate flow's hidden-field guards).
  if (toBoolean(raw.tbc)) {
    return tbcAttendeeIntent();
  }

  const firstName = trimString(raw.firstName);
  if (firstName.length === 0 || firstName.length > MAX_NAME) {
    errors.push({ field: `${prefix}.firstName`, message: `We need ${label}'s first name.` });
  }

  const surname = trimString(raw.surname);
  if (surname.length === 0 || surname.length > MAX_NAME) {
    errors.push({ field: `${prefix}.surname`, message: `We need ${label}'s surname.` });
  }

  const email = trimString(raw.email).toLowerCase();
  if (!isValidEmail(email)) {
    errors.push({
      field: `${prefix}.email`,
      message: `We need an email for ${label}, for their badge and day-of details.`,
    });
  }

  const mobile = trimString(raw.mobile);
  if (mobile.length > MAX_MOBILE) {
    errors.push({ field: `${prefix}.mobile`, message: "That mobile number looks too long." });
  }

  const jobTitle = trimString(raw.jobTitle);
  if (jobTitle.length === 0 || jobTitle.length > MAX_JOB_TITLE) {
    errors.push({
      field: `${prefix}.jobTitle`,
      message: `${label}'s job title helps us print their badge.`,
    });
  }

  // Lunch is always part of an exhibitor booking, so dietary is always
  // validated; there is no hidden-field strip branch here.
  const dietaryRequirement = trimString(raw.dietaryRequirement) as DietaryRequirement;
  if (!DIETARY_REQUIREMENTS.includes(dietaryRequirement)) {
    errors.push({
      field: `${prefix}.dietaryRequirement`,
      message: `Pick a dietary option for ${label}.`,
    });
  }

  let dietaryOther = trimString(raw.dietaryOther);
  if (dietaryRequirement === "other") {
    if (dietaryOther.length === 0 || dietaryOther.length > MAX_DIETARY_OTHER) {
      errors.push({
        field: `${prefix}.dietaryOther`,
        message: `Tell us briefly what to cater for ${label}.`,
      });
    }
  } else {
    dietaryOther = "";
  }

  return {
    tbc: false,
    firstName,
    surname,
    email,
    mobile,
    jobTitle,
    dietaryRequirement,
    dietaryOther,
  };
}

function attendeeRaw(input: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = input[key];
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export function validateExhibitorBookingIntent(
  input: unknown,
): ExhibitorIntentValidationResult {
  if (typeof input !== "object" || input === null) {
    return {
      ok: false,
      errors: [{ field: "form", message: "Submission could not be read." }],
    };
  }
  const raw = input as Record<string, unknown>;
  const errors: ExhibitorIntentFieldError[] = [];

  const company = trimString(raw.company);
  if (company.length === 0 || company.length > MAX_COMPANY) {
    errors.push({ field: "company", message: "We need your company name." });
  }

  const website = trimString(raw.website);
  if (website.length > 0 && (website.length > MAX_URL || !isValidUrl(website))) {
    errors.push({
      field: "website",
      message: "That website does not look right. Use a full https URL or leave blank.",
    });
  }

  const contactFirstName = trimString(raw.contactFirstName);
  if (contactFirstName.length === 0 || contactFirstName.length > MAX_NAME) {
    errors.push({ field: "contactFirstName", message: "We need the main contact's first name." });
  }

  const contactSurname = trimString(raw.contactSurname);
  if (contactSurname.length === 0 || contactSurname.length > MAX_NAME) {
    errors.push({ field: "contactSurname", message: "We need the main contact's surname." });
  }

  const contactEmail = trimString(raw.contactEmail).toLowerCase();
  if (!isValidEmail(contactEmail)) {
    errors.push({
      field: "contactEmail",
      message: "We need a contact email for the receipt and your account.",
    });
  }

  const contactMobile = trimString(raw.contactMobile);
  if (contactMobile.length === 0 || contactMobile.length > MAX_MOBILE) {
    errors.push({
      field: "contactMobile",
      message: "Add a mobile so we can reach you about your stand.",
    });
  }

  const attendee1 = validateAttendee(
    attendeeRaw(raw, "attendee1"),
    "attendee1",
    "attendee 1",
    errors,
  );
  const attendee2 = validateAttendee(
    attendeeRaw(raw, "attendee2"),
    "attendee2",
    "attendee 2",
    errors,
  );

  const marketingOptIn = toBoolean(raw.marketingOptIn);
  const termsAccepted = toBoolean(raw.termsAccepted);
  if (!termsAccepted) {
    errors.push({
      field: "termsAccepted",
      message: "Tick the box to accept the Terms and Refund Policy.",
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    intent: {
      company,
      website,
      contactFirstName,
      contactSurname,
      contactEmail,
      contactMobile,
      attendees: [attendee1, attendee2],
      marketingOptIn,
      termsAccepted,
    },
  };
}

// -----------------------------------------------------------------------------
// Stripe metadata encoding. Same constraints as the delegate flow: 50
// keys max, values <= 500 chars, everything flat strings. This shape
// uses 32 keys.
// -----------------------------------------------------------------------------

export interface ExhibitorPricingSnapshot {
  period: string;
  standExVatPence: number;
  standVatPence: number;
  standIncVatPence: number;
  grossExVatPence: number;
  grossVatPence: number;
  grossIncVatPence: number;
}

export function exhibitorIntentToMetadata(
  intent: ExhibitorBookingIntent,
  pricing: ExhibitorPricingSnapshot,
  bookingReference: string,
  termsAcceptedAt: string,
  termsAcceptedIp: string,
): Record<string, string> {
  const [a1, a2] = intent.attendees;
  return {
    booking_ref: bookingReference,
    booking_type: "exhibitor",
    pricing_period: pricing.period,
    stand_ex_vat_pence: String(pricing.standExVatPence),
    stand_vat_pence: String(pricing.standVatPence),
    stand_inc_vat_pence: String(pricing.standIncVatPence),
    gross_ex_vat_pence: String(pricing.grossExVatPence),
    gross_vat_pence: String(pricing.grossVatPence),
    gross_inc_vat_pence: String(pricing.grossIncVatPence),
    company: intent.company,
    website: intent.website,
    contact_first_name: intent.contactFirstName,
    contact_surname: intent.contactSurname,
    contact_email: intent.contactEmail,
    contact_mobile: intent.contactMobile,
    a1_tbc: String(a1.tbc),
    a1_first_name: a1.firstName,
    a1_surname: a1.surname,
    a1_email: a1.email,
    a1_mobile: a1.mobile,
    a1_job_title: a1.jobTitle,
    a1_dietary: a1.dietaryRequirement,
    a1_dietary_other: a1.dietaryOther,
    a2_tbc: String(a2.tbc),
    a2_first_name: a2.firstName,
    a2_surname: a2.surname,
    a2_email: a2.email,
    a2_mobile: a2.mobile,
    a2_job_title: a2.jobTitle,
    a2_dietary: a2.dietaryRequirement,
    a2_dietary_other: a2.dietaryOther,
    marketing_opt_in: String(intent.marketingOptIn),
    terms_accepted_at: termsAcceptedAt,
    terms_accepted_ip: termsAcceptedIp,
  };
}

export interface ParsedExhibitorMetadata {
  bookingReference: string;
  intent: ExhibitorBookingIntent;
  pricing: ExhibitorPricingSnapshot;
  termsAcceptedAt: string;
  termsAcceptedIp: string;
}

export class ExhibitorMetadataParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExhibitorMetadataParseError";
  }
}

function requireField(metadata: Record<string, string | null>, key: string): string {
  const value = metadata[key];
  if (typeof value !== "string") {
    throw new ExhibitorMetadataParseError(`metadata missing field: ${key}`);
  }
  return value;
}

function parseIntField(metadata: Record<string, string | null>, key: string): number {
  const raw = requireField(metadata, key);
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) {
    throw new ExhibitorMetadataParseError(`metadata field ${key} is not an integer`);
  }
  return n;
}

function parseDietary(
  metadata: Record<string, string | null>,
  key: string,
): DietaryRequirement {
  const value = requireField(metadata, key) as DietaryRequirement;
  if (!DIETARY_REQUIREMENTS.includes(value)) {
    throw new ExhibitorMetadataParseError(`metadata ${key} invalid: ${value}`);
  }
  return value;
}

function parseAttendee(
  metadata: Record<string, string | null>,
  prefix: "a1" | "a2",
): ExhibitorAttendeeIntent {
  // The tbc key defaults to false when ABSENT, not just when "false":
  // Checkout sessions created before the TBC feature deployed are still
  // completing (sessions live 30 minutes; webhook retries longer), and
  // a required-field throw here would permanently skip those bookings.
  const tbc = metadata[`${prefix}_tbc`] === "true";
  if (tbc) {
    return tbcAttendeeIntent();
  }
  return {
    tbc: false,
    firstName: requireField(metadata, `${prefix}_first_name`),
    surname: requireField(metadata, `${prefix}_surname`),
    email: requireField(metadata, `${prefix}_email`),
    mobile: requireField(metadata, `${prefix}_mobile`),
    jobTitle: requireField(metadata, `${prefix}_job_title`),
    dietaryRequirement: parseDietary(metadata, `${prefix}_dietary`),
    dietaryOther: requireField(metadata, `${prefix}_dietary_other`),
  };
}

export function metadataToParsedExhibitor(
  metadata: Record<string, string | null>,
): ParsedExhibitorMetadata {
  if (requireField(metadata, "booking_type") !== "exhibitor") {
    throw new ExhibitorMetadataParseError("metadata booking_type is not 'exhibitor'");
  }

  return {
    bookingReference: requireField(metadata, "booking_ref"),
    termsAcceptedAt: requireField(metadata, "terms_accepted_at"),
    termsAcceptedIp: requireField(metadata, "terms_accepted_ip"),
    intent: {
      company: requireField(metadata, "company"),
      website: requireField(metadata, "website"),
      contactFirstName: requireField(metadata, "contact_first_name"),
      contactSurname: requireField(metadata, "contact_surname"),
      contactEmail: requireField(metadata, "contact_email"),
      contactMobile: requireField(metadata, "contact_mobile"),
      attendees: [parseAttendee(metadata, "a1"), parseAttendee(metadata, "a2")],
      marketingOptIn: requireField(metadata, "marketing_opt_in") === "true",
      termsAccepted: true,
    },
    pricing: {
      period: requireField(metadata, "pricing_period"),
      standExVatPence: parseIntField(metadata, "stand_ex_vat_pence"),
      standVatPence: parseIntField(metadata, "stand_vat_pence"),
      standIncVatPence: parseIntField(metadata, "stand_inc_vat_pence"),
      grossExVatPence: parseIntField(metadata, "gross_ex_vat_pence"),
      grossVatPence: parseIntField(metadata, "gross_vat_pence"),
      grossIncVatPence: parseIntField(metadata, "gross_inc_vat_pence"),
    },
  };
}
