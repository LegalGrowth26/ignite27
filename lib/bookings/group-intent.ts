// Group delegate bookings: one checkout, 2-10 tickets. The full intent
// (lead contact + every ticket's attendee) is far too big for Stripe's
// 50-key metadata limit, so it is stored server-side in
// pending_group_intents and the session metadata carries only the
// intent id plus totals. The webhook loads the row back and creates
// one booking per ticket.

import {
  DIETARY_REQUIREMENTS,
  type DietaryRequirement,
} from "./intent";
import { TBC_FIRST_NAME } from "./exhibitor-intent";
import {
  GROUP_MAX_TICKETS,
  GROUP_MIN_TICKETS,
  type GroupPricingSnapshot,
} from "@/lib/pricing/group";

export interface GroupTicketIntent {
  ticketType: "regular" | "vip";
  lunchIncluded: boolean; // regular add-on; forced true for VIP
  tbc: boolean;
  // Named attendees only (empty strings for TBC tickets):
  firstName: string;
  surname: string;
  email: string;
  jobTitle: string;
  dietaryRequirement: DietaryRequirement;
  dietaryOther: string;
}

export interface GroupBookingIntent {
  // Lead booker: pays, gets the confirmation email and the account.
  // The lead is ALWAYS ticket 1 and always named.
  leadMobile: string;
  company: string;
  marketingOptIn: boolean;
  tickets: GroupTicketIntent[];
  // Raw code typed on our form ("" = none). Resolved against Stripe at
  // checkout-creation time; never trusted from here.
  discountCode: string;
}

export interface GroupFieldError {
  field: string; // "tickets.2.email", "company", "form", ...
  message: string;
}

export type GroupIntentValidation =
  | { ok: true; intent: GroupBookingIntent }
  | { ok: false; errors: GroupFieldError[] };

const MAX_NAME = 100;
const MAX_COMPANY = 200;
const MAX_JOB_TITLE = 200;
const MAX_MOBILE = 30;
const MAX_EMAIL = 200;
const MAX_DIETARY_OTHER = 200;
const MAX_CODE = 60;

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function bool(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === "1";
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= MAX_EMAIL;
}

export function validateGroupBookingIntent(input: {
  leadMobile?: unknown;
  company?: unknown;
  marketingOptIn?: unknown;
  termsAccepted?: unknown;
  discountCode?: unknown;
  tickets?: unknown;
}): GroupIntentValidation {
  const errors: GroupFieldError[] = [];

  const leadMobile = str(input.leadMobile);
  if (!leadMobile || leadMobile.length > MAX_MOBILE) {
    errors.push({ field: "leadMobile", message: "Add a mobile number so we can reach you on the day." });
  }

  const company = str(input.company);
  if (!company || company.length > MAX_COMPANY) {
    errors.push({ field: "company", message: "Which company is this booking for?" });
  }

  if (!bool(input.termsAccepted)) {
    errors.push({
      field: "termsAccepted",
      message: "Tick the box to accept the Terms and Refund Policy.",
    });
  }

  const discountCode = str(input.discountCode).toUpperCase();
  if (discountCode.length > MAX_CODE) {
    errors.push({ field: "discountCode", message: "That code is too long to be real." });
  }

  const rawTickets = Array.isArray(input.tickets) ? input.tickets : null;
  if (
    !rawTickets ||
    rawTickets.length < GROUP_MIN_TICKETS ||
    rawTickets.length > GROUP_MAX_TICKETS
  ) {
    errors.push({
      field: "form",
      message: `Group bookings are for ${GROUP_MIN_TICKETS} to ${GROUP_MAX_TICKETS} tickets. For one ticket, use the standard booking form.`,
    });
    return { ok: false, errors };
  }

  const tickets: GroupTicketIntent[] = [];
  const seenEmails = new Set<string>();
  rawTickets.forEach((rawUnknown, index) => {
    const raw = (rawUnknown ?? {}) as Record<string, unknown>;
    const label = index === 0 ? "Ticket 1 (you)" : `Ticket ${index + 1}`;
    const at = (f: string) => `tickets.${index}.${f}`;

    const ticketType = str(raw.ticketType) as "regular" | "vip";
    if (ticketType !== "regular" && ticketType !== "vip") {
      errors.push({ field: at("ticketType"), message: `${label}: pick Regular or VIP.` });
      return;
    }
    const lunchIncluded = ticketType === "vip" ? true : bool(raw.lunchIncluded);

    // Ticket 1 is the lead booker and can never be TBC: someone real is
    // paying and receiving the confirmation.
    const tbc = index === 0 ? false : bool(raw.tbc);

    let firstName = "";
    let surname = "";
    let email = "";
    let jobTitle = "";
    let dietaryRequirement: DietaryRequirement = "none";
    let dietaryOther = "";

    if (!tbc) {
      firstName = str(raw.firstName);
      if (!firstName || firstName.length > MAX_NAME) {
        errors.push({ field: at("firstName"), message: `${label}: we need a first name.` });
      }
      surname = str(raw.surname);
      if (!surname || surname.length > MAX_NAME) {
        errors.push({ field: at("surname"), message: `${label}: we need a surname.` });
      }
      email = str(raw.email).toLowerCase();
      if (!isValidEmail(email)) {
        errors.push({ field: at("email"), message: `${label}: we need a valid email for their ticket.` });
      } else if (seenEmails.has(email)) {
        errors.push({ field: at("email"), message: `${label}: that email is already on another ticket.` });
      } else {
        seenEmails.add(email);
      }
      jobTitle = str(raw.jobTitle);
      if (jobTitle.length > MAX_JOB_TITLE) {
        errors.push({ field: at("jobTitle"), message: `${label}: that job title is too long.` });
      }

      // Dietary only matters when this ticket eats: VIP always, regular
      // only with the lunch add-on. Values on no-lunch tickets are
      // stripped silently (same tampering stance as the single form).
      if (ticketType === "vip" || lunchIncluded) {
        dietaryRequirement = str(raw.dietaryRequirement) as DietaryRequirement;
        if (!DIETARY_REQUIREMENTS.includes(dietaryRequirement)) {
          errors.push({ field: at("dietaryRequirement"), message: `${label}: pick a dietary option.` });
        }
        dietaryOther = str(raw.dietaryOther);
        if (dietaryRequirement === "other") {
          if (!dietaryOther || dietaryOther.length > MAX_DIETARY_OTHER) {
            errors.push({ field: at("dietaryOther"), message: `${label}: tell us briefly what to cater for.` });
          }
        } else {
          dietaryOther = "";
        }
      }
    }

    tickets.push({
      ticketType,
      lunchIncluded,
      tbc,
      firstName,
      surname,
      email,
      jobTitle,
      dietaryRequirement,
      dietaryOther,
    });
  });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    intent: {
      leadMobile,
      company,
      marketingOptIn: bool(input.marketingOptIn),
      tickets,
      discountCode,
    },
  };
}

// The lead booker (ticket 1) as attendee fields. Validation guarantees
// ticket 1 is named.
export function groupLead(intent: GroupBookingIntent): GroupTicketIntent {
  return intent.tickets[0]!;
}

// What a TBC ticket stores as its attendee: the literal placeholder
// name and the LEAD's email (booking_attendees.email is NOT NULL and
// the lead is the reachable human until the seat is named).
export function tbcAttendeeFields(leadEmail: string): {
  firstName: string;
  surname: string;
  email: string;
} {
  return { firstName: TBC_FIRST_NAME, surname: "", email: leadEmail };
}

// -----------------------------------------------------------------------------
// The pending_group_intents payload: everything the webhook needs to
// build the bookings, snapshotted at checkout-creation time so a price
// period rolling over mid-checkout cannot change what was charged.
// -----------------------------------------------------------------------------

export interface AppliedDiscountRecord {
  kind: "group" | "code" | "none";
  percent: number; // group tier percent (informational for 'code'/'none')
  discountPence: number; // value of what was APPLIED (0 for 'none')
  code: string | null;
  promotionCodeId: string | null;
}

export interface GroupIntentPayload {
  version: 1;
  intent: GroupBookingIntent;
  pricing: GroupPricingSnapshot;
  applied: AppliedDiscountRecord;
  termsAcceptedAt: string;
  termsAcceptedIp: string;
  marketingOptIn: boolean;
}

export class GroupPayloadParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GroupPayloadParseError";
  }
}

// Defensive re-validation when the webhook loads the payload back:
// the row was written by our own action, but a malformed row must fail
// loudly, not half-create bookings.
export function parseGroupIntentPayload(raw: unknown): GroupIntentPayload {
  const p = raw as GroupIntentPayload | null;
  if (!p || p.version !== 1) {
    throw new GroupPayloadParseError("unknown group intent payload version");
  }
  if (!p.intent || !Array.isArray(p.intent.tickets) || p.intent.tickets.length < GROUP_MIN_TICKETS) {
    throw new GroupPayloadParseError("group intent payload has no tickets");
  }
  if (!p.pricing || !Array.isArray(p.pricing.tickets) || p.pricing.tickets.length !== p.intent.tickets.length) {
    throw new GroupPayloadParseError("group intent payload pricing mismatch");
  }
  if (!p.applied || !["group", "code", "none"].includes(p.applied.kind)) {
    throw new GroupPayloadParseError("group intent payload applied-discount invalid");
  }
  if (typeof p.termsAcceptedAt !== "string" || typeof p.termsAcceptedIp !== "string") {
    throw new GroupPayloadParseError("group intent payload terms fields missing");
  }
  const lead = p.intent.tickets[0]!;
  if (lead.tbc || !lead.email) {
    throw new GroupPayloadParseError("group intent payload lead must be named");
  }
  return p;
}
