"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { logAdminAction } from "@/lib/admin/audit";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { echoFormValues, type EchoedValues } from "@/lib/admin/form-echo";
import {
  amountWithVatLabel,
  nextExpiry,
  validateRequestAmountPounds,
} from "@/lib/partners/payments";
import { sendPartnerPaymentRequestEmail } from "@/lib/partners/send-payment";
import { validatePartner, type PartnerTier } from "@/lib/partners/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Partner CRUD: offline deals recorded here, no checkout anywhere.
// Category exclusivity was REMOVED (September 2026 decision): the
// column stays in the database untouched, but nothing collects,
// checks, or displays it any more. Everything audit-logged; no
// deletes, "ended" keeps the record and drops the partner off the
// site.

export interface PartnerFormState {
  error: string | null;
  // Echoed on error: the failed resubmit
  // must carry everything the admin typed (React 19 resets the form).
  values: EchoedValues | null;
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function revalidatePartnerSurfaces(): void {
  revalidatePath("/admin/partners");
  revalidatePath("/");
  revalidatePath("/exhibit");
}

// Shared by add and edit. partnerId null = create.
export async function savePartnerAction(
  partnerId: string | null,
  _prev: PartnerFormState,
  formData: FormData,
): Promise<PartnerFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const validated = validatePartner({
    companyName: formData.get("companyName"),
    contactName: formData.get("contactName"),
    contactEmail: formData.get("contactEmail"),
    tier: formData.get("tier"),
    agreedPricePounds: formData.get("agreedPricePounds"),
    notes: formData.get("notes"),
    websiteUrl: formData.get("websiteUrl"),
  });
  if (!validated.ok) return { error: validated.error, values: echoFormValues(formData) };
  const v = validated.value;

  const row = {
    company_name: v.companyName,
    contact_name: v.contactName,
    contact_email: v.contactEmail,
    tier: v.tier,
    agreed_price_pence: v.agreedPricePence,
    notes: v.notes,
    website_url: v.websiteUrl,
  };

  let id = partnerId;
  if (id) {
    const { error } = await service.from("partners").update(row).eq("id", id);
    if (error) {
      console.error("[admin/partners] update failed:", error.message);
      return { error: "Could not save the partner. Try again.", values: echoFormValues(formData) };
    }
  } else {
    // category is NOT NULL in the database and the column is kept (no
    // destructive migration), so creates write the neutral catch-all;
    // updates leave whatever an older record already has.
    const { data, error } = await service
      .from("partners")
      .insert({ ...row, category: "other" })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[admin/partners] insert failed:", error?.message);
      return { error: "Could not add the partner. Try again.", values: echoFormValues(formData) };
    }
    id = (data as { id: string }).id;
  }

  // Optional logo straight into the PUBLIC bucket (admin-only uploads,
  // service role; no private/public dance needed here).
  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    const ext = ALLOWED_LOGO_TYPES[logo.type];
    if (!ext) return { error: "Logo must be a PNG, JPG, WebP, or SVG file.", values: echoFormValues(formData) };
    if (logo.size > MAX_LOGO_BYTES) return { error: "Logo must be 2MB or smaller.", values: echoFormValues(formData) };
    const logoPath = `${id}/logo.${ext}`;
    const { error: uploadErr } = await service.storage
      .from("partner-logos")
      .upload(logoPath, logo, { upsert: true, contentType: logo.type });
    if (uploadErr) {
      console.error("[admin/partners] logo upload failed:", uploadErr.message);
      return { error: "Partner saved, but the logo upload failed. Try the logo again.", values: echoFormValues(formData) };
    }
    const { error: linkErr } = await service
      .from("partners")
      .update({ logo_path: logoPath })
      .eq("id", id);
    if (linkErr) {
      console.error("[admin/partners] logo link failed:", linkErr.message);
    }
  }

  await logAdminAction(ctx.appUserId, partnerId ? "partner.update" : "partner.add", {
    partner_id: id,
    company_name: v.companyName,
    tier: v.tier,
    agreed_price_pence: v.agreedPricePence,
  });

  revalidatePartnerSurfaces();
  redirect(`/admin/partners?status=${partnerId ? "saved" : "added"}`);
}

export async function togglePartnerVisibilityAction(partnerId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("partners")
    .select("visible, company_name")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = data as { visible: boolean; company_name: string } | null;
  if (!partner) throw new Error("partner not found");

  const { error } = await service
    .from("partners")
    .update({ visible: !partner.visible })
    .eq("id", partnerId);
  if (error) throw new Error(`visibility toggle failed: ${error.message}`);

  await logAdminAction(
    ctx.appUserId,
    partner.visible ? "partner.hide" : "partner.show",
    { partner_id: partnerId, company_name: partner.company_name },
  );
  revalidatePartnerSurfaces();
}

export async function endPartnershipAction(partnerId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("partners")
    .select("company_name")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = data as { company_name: string } | null;
  if (!partner) throw new Error("partner not found");

  const { error } = await service
    .from("partners")
    .update({ status: "ended" })
    .eq("id", partnerId);
  if (error) throw new Error(`end partnership failed: ${error.message}`);

  // Ending the deal kills every live payment link instantly (our row
  // is the gate; no Stripe call needed since sessions are minted on
  // demand from /pay).
  const { error: cancelErr } = await service
    .from("partner_payment_requests")
    .update({ status: "cancelled" })
    .eq("partner_id", partnerId)
    .eq("status", "pending");
  if (cancelErr) {
    console.error("[admin/partners] cancel-on-end failed:", cancelErr.message);
  }

  await logAdminAction(ctx.appUserId, "partner.end", {
    partner_id: partnerId,
    company_name: partner.company_name,
  });
  revalidatePartnerSurfaces();
}


// ---------------------------------------------------------------------------
// Payment requests (part-payments supported; status derives from the
// money, so nothing here ever flips partners.status).
// ---------------------------------------------------------------------------

export interface PaymentRequestFormState {
  error: string | null;
  ok: string | null;
  values: EchoedValues | null;
}

export async function sendPaymentRequestAction(
  partnerId: string,
  _prev: PaymentRequestFormState,
  formData: FormData,
): Promise<PaymentRequestFormState> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const amount = validateRequestAmountPounds(formData.get("amountPounds"));
  if (!amount.ok) return { error: amount.error, ok: null, values: echoFormValues(formData) };

  const { data: partnerData } = await service
    .from("partners")
    .select("id, company_name, contact_name, contact_email, tier, status")
    .eq("id", partnerId)
    .maybeSingle();
  const partner = partnerData as {
    id: string;
    company_name: string;
    contact_name: string;
    contact_email: string;
    tier: PartnerTier;
    status: string;
  } | null;
  if (!partner) return { error: "Partner not found.", ok: null, values: null };
  if (partner.status === "ended") {
    return { error: "This partnership has ended; no payment requests.", ok: null, values: null };
  }

  const expiresAt = nextExpiry(new Date());
  const { data: inserted, error: insertErr } = await service
    .from("partner_payment_requests")
    .insert({
      partner_id: partnerId,
      amount_ex_vat_pence: amount.pence,
      expires_at: expiresAt.toISOString(),
      created_by: ctx.appUserId,
    })
    .select("id, token")
    .single();
  if (insertErr || !inserted) {
    console.error("[admin/partners] payment request insert failed:", insertErr?.message);
    return { error: `Could not create the request: ${insertErr?.message ?? "unknown"}`, ok: null, values: echoFormValues(formData) };
  }
  const request = inserted as { id: string; token: string };

  let emailSent = true;
  try {
    await sendPartnerPaymentRequestEmail({
      partner,
      amountExVatPence: amount.pence,
      token: request.token,
      expiresAt,
      isResend: false,
    });
  } catch (err) {
    emailSent = false;
    console.error("[admin/partners] payment request email failed:", err);
  }
  if (emailSent) {
    await service
      .from("partner_payment_requests")
      .update({ sent_at: new Date().toISOString(), send_count: 1 })
      .eq("id", request.id);
  }

  await logAdminAction(ctx.appUserId, "partner.payment_request", {
    partner_id: partnerId,
    request_id: request.id,
    amount_ex_vat_pence: amount.pence,
    email_sent: emailSent,
  });
  revalidatePath(`/admin/partners/${partnerId}/edit`);
  return emailSent
    ? { error: null, ok: `Payment request for ${amountWithVatLabel(amount.pence)} sent to ${partner.contact_email}.`, values: null }
    : { error: "Request created but the email failed to send. Use Resend.", ok: null, values: null };
}

export async function resendPaymentRequestAction(requestId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data } = await service
    .from("partner_payment_requests")
    .select(
      `id, token, amount_ex_vat_pence, status, send_count, partner_id,
       partners ( id, company_name, contact_name, contact_email, tier, status )`,
    )
    .eq("id", requestId)
    .maybeSingle();
  const request = data as unknown as {
    id: string;
    token: string;
    amount_ex_vat_pence: number;
    status: string;
    send_count: number;
    partner_id: string;
    partners: {
      id: string;
      company_name: string;
      contact_name: string;
      contact_email: string;
      tier: PartnerTier;
      status: string;
    } | null;
  } | null;
  if (!request || !request.partners) throw new Error("payment request not found");
  if (request.status === "paid" || request.status === "cancelled") {
    throw new Error("only pending requests can be resent");
  }
  if (request.partners.status === "ended") {
    throw new Error("partnership has ended");
  }

  // Same link, clock restarted (decision: 30 days from the resend).
  const expiresAt = nextExpiry(new Date());
  await sendPartnerPaymentRequestEmail({
    partner: request.partners,
    amountExVatPence: request.amount_ex_vat_pence,
    token: request.token,
    expiresAt,
    isResend: true,
  });
  const { error } = await service
    .from("partner_payment_requests")
    .update({
      expires_at: expiresAt.toISOString(),
      sent_at: new Date().toISOString(),
      send_count: request.send_count + 1,
    })
    .eq("id", requestId);
  if (error) throw new Error(`resend update failed: ${error.message}`);

  await logAdminAction(ctx.appUserId, "partner.payment_request_resend", {
    partner_id: request.partner_id,
    request_id: requestId,
  });
  revalidatePath(`/admin/partners/${request.partner_id}/edit`);
}

export async function cancelPaymentRequestAction(requestId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const service = createSupabaseServiceClient();

  const { data, error } = await service
    .from("partner_payment_requests")
    .update({ status: "cancelled" })
    .eq("id", requestId)
    .eq("status", "pending")
    .select("partner_id");
  if (error) throw new Error(`cancel failed: ${error.message}`);
  const partnerId = (data as Array<{ partner_id: string }> | null)?.[0]?.partner_id;
  if (!partnerId) throw new Error("only pending requests can be cancelled");

  await logAdminAction(ctx.appUserId, "partner.payment_request_cancel", {
    partner_id: partnerId,
    request_id: requestId,
  });
  revalidatePath(`/admin/partners/${partnerId}/edit`);
}
