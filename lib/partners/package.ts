import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureAuthUserWithStatus, upsertAppUser } from "@/lib/bookings/create";
import { generateBookingReference } from "@/lib/bookings/reference";
import { crmTagsForBooking, pushContactToCrmSafe } from "@/lib/crm/ghl";

// The partner package's own places: a £0 booking of type 'partner'
// with 2 attendee slots, both WITH lunch, mirroring the exhibitor
// pattern (named attendees, dietary, TBC allowed, self-editable by
// the booking owner). Created when the partner is ADDED (decision:
// the record is the agreed deal; part-payments make "on first
// payment" ambiguous). Idempotent: partners.package_booking_id is
// the memo.

export const PARTNER_PACKAGE_PLACES = 2;
export const PARTNER_DISCOUNT_PERCENT = 20;

export interface PartnerPackageSource {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  package_booking_id: string | null;
}

// Pure and unit-tested: the two attendee rows. Slot 1 is the contact
// (primary, linked to their account); slot 2 starts TBC under the
// same conventions as exhibitor bookings (literal "TBC", contact's
// email carries the slot). Both slots ALWAYS have lunch.
export function buildPartnerAttendeeRows(input: {
  bookingId: string;
  appUserId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
}): Array<Record<string, unknown>> {
  const [firstName, ...rest] = input.contactName.trim().split(/\s+/);
  return [
    {
      booking_id: input.bookingId,
      user_id: input.appUserId,
      first_name: firstName ?? "",
      surname: rest.join(" "),
      email: input.contactEmail,
      mobile: null,
      company: input.companyName,
      job_title: null,
      dietary_requirement: "none",
      dietary_other: null,
      lunch_entitlement: true,
      badge_qr_url: null,
      is_primary_contact: true,
      attendee_index: 1,
    },
    {
      booking_id: input.bookingId,
      user_id: null,
      first_name: "TBC",
      surname: "",
      email: input.contactEmail,
      mobile: null,
      company: input.companyName,
      job_title: null,
      dietary_requirement: "none",
      dietary_other: null,
      lunch_entitlement: true,
      badge_qr_url: null,
      is_primary_contact: false,
      attendee_index: 2,
    },
  ];
}

export interface EnsurePackageResult {
  bookingId: string;
  bookingReference: string | null;
  appUserId: string;
  created: boolean;
  // True when the contact already had an IGNITE! account: the welcome
  // email then says to log in rather than set a password.
  accountExisted: boolean;
}

export async function ensurePartnerPackageBooking(
  service: SupabaseClient,
  partner: PartnerPackageSource,
): Promise<EnsurePackageResult> {
  // Contact account first: the booking is theirs to manage either way.
  const [firstName, ...rest] = partner.contact_name.trim().split(/\s+/);
  const { authUserId, accountExisted } = await ensureAuthUserWithStatus(
    service,
    partner.contact_email,
    {
      first_name: firstName ?? "",
      surname: rest.join(" "),
      company: partner.company_name,
    },
  );
  const appUserId = await upsertAppUser(service, partner.contact_email, authUserId, {
    firstName: firstName ?? "",
    surname: rest.join(" "),
    mobile: "",
    company: partner.company_name,
    jobTitle: "",
    marketingOptIn: false,
  });

  if (partner.package_booking_id) {
    const { data } = await service
      .from("bookings")
      .select("id, booking_reference")
      .eq("id", partner.package_booking_id)
      .maybeSingle();
    if (data) {
      return {
        bookingId: (data as { id: string }).id,
        bookingReference: (data as { booking_reference: string | null }).booking_reference,
        appUserId,
        created: false,
        accountExisted,
      };
    }
    // Dangling memo (should not happen): fall through and rebuild.
    console.error(
      "[partner-package] package_booking_id points at a missing booking; recreating",
      partner.id,
    );
  }

  const bookingReference = generateBookingReference();
  const { data: bookingRow, error: bookingErr } = await service
    .from("bookings")
    .insert({
      user_id: appUserId,
      booking_reference: bookingReference,
      booking_type: "partner",
      ticket_type: "regular",
      company_name: partner.company_name,
      company_contact_name: partner.contact_name,
      company_contact_email: partner.contact_email,
      pricing_period: null,
      gross_amount_pence: 0,
      vat_amount_pence: 0,
      currency: "gbp",
      // The package's own places always include lunch.
      lunch_included: true,
      payment_status: "comp",
      booking_status: "active",
    })
    .select("id")
    .single();
  if (bookingErr || !bookingRow) {
    throw new Error(`partner package booking insert failed: ${bookingErr?.message}`);
  }
  const bookingId = (bookingRow as { id: string }).id;

  const { error: attendeeErr } = await service.from("booking_attendees").insert(
    buildPartnerAttendeeRows({
      bookingId,
      appUserId,
      companyName: partner.company_name,
      contactName: partner.contact_name,
      contactEmail: partner.contact_email,
    }),
  );
  if (attendeeErr) {
    throw new Error(`partner package attendees insert failed: ${attendeeErr.message}`);
  }

  const { error: linkErr } = await service
    .from("partners")
    .update({ package_booking_id: bookingId })
    .eq("id", partner.id);
  if (linkErr) {
    console.error("[partner-package] booking link failed:", linkErr.message);
  }

  // TomCRM: the contact under the approved Partner27 tag. Idempotent
  // and failure-isolated like every other CRM push.
  await pushContactToCrmSafe(
    {
      email: partner.contact_email,
      firstName: firstName ?? "",
      lastName: rest.join(" "),
      phone: null,
      tags: crmTagsForBooking("partner", "regular"),
    },
    `partner package ${bookingReference}`,
  );

  return { bookingId, bookingReference, appUserId, created: true, accountExisted };
}
