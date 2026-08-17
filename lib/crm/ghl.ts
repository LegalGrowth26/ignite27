// TomCRM (white-label GoHighLevel) sync. Every completed booking pushes
// its contact into the CRM with ONE marketing tag by booking type.
//
// Design rules (mirror the email hardening):
//   - A CRM failure is a LOG LINE, never a customer problem. The safe
//     wrapper below cannot throw; the booking and confirmation email
//     always proceed regardless of CRM state.
//   - Idempotent under Stripe webhook re-delivery: GHL's contacts
//     /upsert dedupes contacts by email per the location's "Allow
//     Duplicate Contact" setting, and tags are applied via the ADDITIVE
//     tags endpoint (POST /contacts/{id}/tags), which no-ops on a tag
//     the contact already has. We deliberately do NOT send tags in the
//     upsert body: contact-update tag arrays can REPLACE the contact's
//     existing tags, which would wipe whatever else Tom has tagged them
//     with in the CRM.
//   - Config via env vars (see .env.local.example): GHL_API_KEY is a
//     Private Integration token (sub-account level), GHL_LOCATION_ID is
//     the sub-account's Location ID. When either is missing the sync is
//     OFF: pushes log a skip and return, nothing breaks. This keeps
//     local dev and staging working without CRM credentials.

export const GHL_API_BASE = "https://services.leadconnectorhq.com";
// GHL API 2.0 requires this exact date-versioned header.
export const GHL_API_VERSION = "2021-07-28";

// One tag per booking type. Partner27 is RESERVED for partner bookings
// when that booking type exists; nothing applies it yet.
export type CrmTag = "Delegate27" | "VIP27" | "Exhibitor27";

export function crmTagForBooking(
  bookingType: "delegate" | "exhibitor",
  ticketType: string,
): CrmTag {
  if (bookingType === "exhibitor") return "Exhibitor27";
  return ticketType === "vip" ? "VIP27" : "Delegate27";
}

export interface CrmContactInput {
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  tag: CrmTag;
}

export function isCrmConfigured(): boolean {
  return Boolean(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

// Security convention: never log full email addresses. a***@domain is
// enough to correlate with the CRM by hand.
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}

function ghlHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    Version: GHL_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

// 10s ceiling per call so a slow CRM can never hang the Stripe webhook
// long enough to matter (Stripe times out webhook responses).
const GHL_TIMEOUT_MS = 10_000;

async function ghlPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${GHL_API_BASE}${path}`, {
    method: "POST",
    headers: ghlHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(GHL_TIMEOUT_MS),
  });
}

// Throwing core: upsert the contact, then add the tag additively.
export async function pushContactToCrm(input: CrmContactInput): Promise<void> {
  const upsertRes = await ghlPost("/contacts/upsert", {
    locationId: process.env.GHL_LOCATION_ID,
    email: input.email.toLowerCase(),
    firstName: input.firstName,
    lastName: input.lastName,
    ...(input.phone ? { phone: input.phone } : {}),
  });
  if (!upsertRes.ok) {
    throw new Error(`GHL upsert failed: ${upsertRes.status} ${await upsertRes.text()}`);
  }
  const upsertJson = (await upsertRes.json()) as { contact?: { id?: string } };
  const contactId = upsertJson.contact?.id;
  if (!contactId) {
    throw new Error("GHL upsert returned no contact id");
  }

  const tagRes = await ghlPost(`/contacts/${contactId}/tags`, {
    tags: [input.tag],
  });
  if (!tagRes.ok) {
    throw new Error(`GHL tag apply failed: ${tagRes.status} ${await tagRes.text()}`);
  }
}

// The only entry point callers should use. Never throws; returns
// whether the push happened, purely for logging/backfill counts.
export async function pushContactToCrmSafe(
  input: CrmContactInput,
  context: string,
): Promise<boolean> {
  if (!isCrmConfigured()) {
    console.info(`[crm] skipped (GHL_API_KEY / GHL_LOCATION_ID not set): ${context}`);
    return false;
  }
  try {
    await pushContactToCrm(input);
    console.info(`[crm] pushed ${maskEmail(input.email)} tag=${input.tag}: ${context}`);
    return true;
  } catch (err) {
    // LOUD but contained: the booking and confirmation email must
    // proceed exactly as if the CRM did not exist.
    console.error(
      `[crm] push FAILED (continuing, booking unaffected) ${maskEmail(input.email)} tag=${input.tag}: ${context}`,
      err,
    );
    return false;
  }
}
