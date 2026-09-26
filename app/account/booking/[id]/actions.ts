"use server";

import { render } from "@react-email/render";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  SimpleTextEmail,
  renderSimpleTextPlain,
  type SimpleTextEmailProps,
} from "@/emails/simple-text";
import { ADMIN_EMAILS } from "@/lib/bookings/admin-notifications";
import { validateAttendeeEdit } from "@/lib/bookings/attendee-edit";
import { metadataToParsed } from "@/lib/bookings/intent";
import { sendDelegateConfirmationEmail } from "@/lib/bookings/send-confirmation";
import { sendTransactionalEmail } from "@/lib/resend/send";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { getStripe } from "@/lib/stripe/client";

type ActionResult = { ok: true } | { ok: false; message: string };

async function requireSessionUserBookingOwnership(bookingId: string): Promise<
  | {
      ok: true;
      appUserId: string;
      email: string;
      booking: {
        id: string;
        booking_reference: string | null;
        stripe_checkout_session_id: string | null;
        vat_amount_pence: number;
      };
    }
  | { ok: false; message: string }
> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { ok: false, message: "Please log in." };
  }

  const service = createSupabaseServiceClient();

  const { data: appUser, error: appErr } = await service
    .from("users")
    .select("id, email")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();
  if (appErr || !appUser) {
    return { ok: false, message: "We could not find your account." };
  }

  const { data: booking, error: bookErr } = await service
    .from("bookings")
    .select("id, user_id, booking_reference, stripe_checkout_session_id, vat_amount_pence")
    .eq("id", bookingId)
    .maybeSingle();
  if (bookErr || !booking) {
    return { ok: false, message: "Booking not found." };
  }
  if (booking.user_id !== appUser.id) {
    return { ok: false, message: "Booking not found." };
  }

  return {
    ok: true,
    appUserId: appUser.id,
    email: appUser.email as string,
    booking: {
      id: booking.id as string,
      booking_reference: (booking.booking_reference as string | null) ?? null,
      stripe_checkout_session_id:
        (booking.stripe_checkout_session_id as string | null) ?? null,
      vat_amount_pence: (booking.vat_amount_pence as number) ?? 0,
    },
  };
}

async function sendAdminEmail(subject: string, props: SimpleTextEmailProps): Promise<void> {
  const html = await render(SimpleTextEmail(props));
  const text = renderSimpleTextPlain(props);
  for (const to of ADMIN_EMAILS) {
    try {
      await sendTransactionalEmail({
        to,
        subject,
        html,
        text,
        tag: "admin-notification",
      });
    } catch (err) {
      console.error("[admin-notify] send failed", to, err);
    }
  }
}

async function sendBookerAck(
  to: string,
  subject: string,
  props: SimpleTextEmailProps,
  tag: string,
): Promise<void> {
  const html = await render(SimpleTextEmail(props));
  const text = renderSimpleTextPlain(props);
  try {
    await sendTransactionalEmail({ to, subject, html, text, tag });
  } catch (err) {
    console.error("[booker-ack] send failed", err);
  }
}

export async function requestCancellationAction(
  bookingId: string,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireSessionUserBookingOwnership(bookingId);
  if (!guard.ok) return guard;

  const reason = (formData.get("reason") ?? "").toString().trim();
  const notes = (formData.get("notes") ?? "").toString().trim();

  if (reason.length === 0 || reason.length > 500) {
    return { ok: false, message: "Tell us briefly why you need to cancel." };
  }
  if (notes.length > 2000) {
    return { ok: false, message: "Notes are too long." };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.from("cancellation_requests").insert({
    booking_id: bookingId,
    requested_by: guard.appUserId,
    reason,
    notes: notes.length > 0 ? notes : null,
    status: "pending",
  });
  if (error) {
    console.error("[cancel] insert failed", error);
    return { ok: false, message: "We could not submit your request. Try again." };
  }

  await service
    .from("bookings")
    .update({ booking_status: "cancellation_requested" })
    .eq("id", bookingId);

  const ref = guard.booking.booking_reference ?? bookingId;

  await sendBookerAck(
    guard.email,
    "We have your cancellation request",
    {
      previewText: `Cancellation request received for ${ref}.`,
      heading: "Cancellation request received.",
      paragraphs: [
        `We have received a cancellation request for booking ${ref}.`,
        "Tom or Paul will pick this up shortly. You will get a second email once the cancellation is actioned or declined.",
        "Refunds, where eligible, are processed manually in Stripe and can take a few working days to reach your bank.",
      ],
    },
    "cancellation-request-received",
  );

  await sendAdminEmail("Cancellation request received", {
    previewText: `Cancellation request for ${ref}.`,
    heading: `Cancellation request: ${ref}`,
    paragraphs: [
      `Booker: ${guard.email}`,
      `Reason: ${reason}`,
      notes.length > 0 ? `Notes: ${notes}` : "No additional notes.",
      `Admin link: /account-admin/bookings/${bookingId} (to be built)`,
    ],
  });

  revalidatePath(`/account/booking/${bookingId}`);
  revalidatePath("/account");
  return { ok: true };
}

export async function requestCorrectionAction(
  bookingId: string,
  formData: FormData,
): Promise<ActionResult> {
  const guard = await requireSessionUserBookingOwnership(bookingId);
  if (!guard.ok) return guard;

  const requestedChanges = (formData.get("requestedChanges") ?? "").toString().trim();

  if (requestedChanges.length === 0 || requestedChanges.length > 2000) {
    return { ok: false, message: "Tell us what to change." };
  }

  const service = createSupabaseServiceClient();
  const { error } = await service.from("correction_requests").insert({
    booking_id: bookingId,
    requested_by: guard.appUserId,
    requested_changes: requestedChanges,
    status: "pending",
  });
  if (error) {
    console.error("[correction] insert failed", error);
    return { ok: false, message: "We could not submit your request. Try again." };
  }

  const ref = guard.booking.booking_reference ?? bookingId;

  await sendBookerAck(
    guard.email,
    "We have your correction request",
    {
      previewText: `Correction request received for ${ref}.`,
      heading: "Correction request received.",
      paragraphs: [
        `We have your correction request for booking ${ref}.`,
        "Tom or Paul will action this shortly. You will get a second email once it is applied.",
      ],
    },
    "correction-request-received",
  );

  await sendAdminEmail("Correction request received", {
    previewText: `Correction request for ${ref}.`,
    heading: `Correction request: ${ref}`,
    paragraphs: [
      `Booker: ${guard.email}`,
      `Requested changes: ${requestedChanges}`,
      `Admin link: /account-admin/bookings/${bookingId} (to be built)`,
    ],
  });

  revalidatePath(`/account/booking/${bookingId}`);
  return { ok: true };
}

export async function resendConfirmationAction(bookingId: string): Promise<ActionResult> {
  const guard = await requireSessionUserBookingOwnership(bookingId);
  if (!guard.ok) return guard;

  if (!guard.booking.stripe_checkout_session_id) {
    return { ok: false, message: "This booking cannot be resent yet." };
  }

  // Re-hydrate the intent from Stripe's session metadata so we don't have to
  // re-persist it separately.
  let parsed;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(
      guard.booking.stripe_checkout_session_id,
    );
    parsed = metadataToParsed(session.metadata ?? {});
  } catch (err) {
    console.error("[resend] stripe fetch failed", err);
    return { ok: false, message: "We could not reload your booking." };
  }

  try {
    await sendDelegateConfirmationEmail({
      bookingId,
      bookingReference: guard.booking.booking_reference ?? parsed.bookingReference,
      parsed,
      vatAmountPence: guard.booking.vat_amount_pence,
    });
  } catch (err) {
    console.error("[resend] email failed", err);
    return { ok: false, message: "We could not resend the email. Try again later." };
  }

  revalidatePath(`/account/booking/${bookingId}`);
  return { ok: true };
}

// Server-action wrappers used by <form action={...}>. They redirect back to
// the booking page with a status flag, avoiding the need for client-side
// state on submit.
export async function submitCancellationForm(
  bookingId: string,
  formData: FormData,
): Promise<void> {
  const result = await requestCancellationAction(bookingId, formData);
  const status = result.ok ? "cancellation_submitted" : "error";
  const err = !result.ok ? `&message=${encodeURIComponent(result.message)}` : "";
  redirect(`/account/booking/${bookingId}?status=${status}${err}`);
}

export async function submitCorrectionForm(
  bookingId: string,
  formData: FormData,
): Promise<void> {
  const result = await requestCorrectionAction(bookingId, formData);
  const status = result.ok ? "correction_submitted" : "error";
  const err = !result.ok ? `&message=${encodeURIComponent(result.message)}` : "";
  redirect(`/account/booking/${bookingId}?status=${status}${err}`);
}

export async function submitResendConfirmation(bookingId: string): Promise<void> {
  const result = await resendConfirmationAction(bookingId);
  const status = result.ok ? "confirmation_resent" : "error";
  const err = !result.ok ? `&message=${encodeURIComponent(result.message)}` : "";
  redirect(`/account/booking/${bookingId}?status=${status}${err}`);
}


// ---------------------------------------------------------------------------
// Attendee self-edit on multi-place bookings (exhibitor + partner).
// RLS is the gate: booking_attendees_owner_update only matches slots
// on the caller's own active non-delegate booking, and zero matched
// rows is a LOUD failure, never silent success (learned from the
// speaker editor).
// ---------------------------------------------------------------------------

export interface AttendeeEditState {
  error: string | null;
  ok: string | null;
  values: Record<string, string> | null;
}

function echoAttendee(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export async function updateAttendeeAction(
  bookingId: string,
  attendeeIndex: number,
  _prev: AttendeeEditState,
  formData: FormData,
): Promise<AttendeeEditState> {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.email) {
    return { error: "Please log in.", ok: null, values: echoAttendee(formData) };
  }

  const validated = validateAttendeeEdit({
    tbc: formData.get("tbc"),
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    email: formData.get("email"),
    mobile: formData.get("mobile"),
    jobTitle: formData.get("jobTitle"),
    dietaryRequirement: formData.get("dietaryRequirement"),
    dietaryOther: formData.get("dietaryOther"),
    fallbackEmail: userData.user.email,
  });
  if (!validated.ok) {
    return { error: validated.error, ok: null, values: echoAttendee(formData) };
  }

  const { data: updated, error } = await supabase
    .from("booking_attendees")
    .update(validated.row)
    .eq("booking_id", bookingId)
    .eq("attendee_index", attendeeIndex)
    .select("attendee_index");
  if (error) {
    console.error("[account/attendee-edit] update failed:", error.message);
    return {
      error: `Could not save: ${error.message}`,
      ok: null,
      values: echoAttendee(formData),
    };
  }
  if (!updated || updated.length === 0) {
    console.error(
      "[account/attendee-edit] zero rows matched",
      JSON.stringify({ booking_id: bookingId, attendee_index: attendeeIndex }),
    );
    return {
      error:
        "Your changes did NOT save: this slot is not editable from your login. Nothing you typed is wrong; get in touch and we will sort it.",
      ok: null,
      values: echoAttendee(formData),
    };
  }

  revalidatePath(`/account/booking/${bookingId}`);
  return {
    error: null,
    ok:
      validated.row.first_name === "TBC"
        ? "Saved: this place is back to 'to be confirmed'."
        : `Saved: ${validated.row.first_name} ${validated.row.surname} is on this place.`,
    values: null,
  };
}
