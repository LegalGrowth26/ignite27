"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdmin } from "@/lib/admin/guard";
import { logAdminAction } from "@/lib/admin/audit";
import {
  buildCompInput,
  buildCouponParams,
  buildPromotionCodeParams,
  validateCreateCodeInput,
  type CreateCodeInput,
} from "@/lib/admin/stripe-codes";
import { getStripe } from "@/lib/stripe/client";

export interface CodeActionState {
  error: string | null;
  created: string | null;
}

// All Stripe calls run server-side with the secret key; nothing Stripe-
// related is exposed to the client beyond the rendered list. Every
// mutating action is gated by requireSuperAdmin and audit-logged.

async function createCode(
  input: CreateCodeInput,
  actorUserId: string,
  auditAction: string,
): Promise<CodeActionState> {
  const errors = validateCreateCodeInput(input);
  if (errors.length > 0) {
    return { error: errors.map((e) => e.message).join(" "), created: null };
  }

  const stripe = getStripe();
  try {
    const coupon = await stripe.coupons.create(buildCouponParams(input));
    const promo = await stripe.promotionCodes.create(
      buildPromotionCodeParams(coupon.id, input, actorUserId),
    );
    await logAdminAction(actorUserId, auditAction, {
      code: promo.code,
      promotion_code_id: promo.id,
      coupon_id: coupon.id,
      kind: input.kind,
      percent_off: input.percentOff ?? null,
      amount_off_pence: input.amountOffPence ?? null,
      expires_at: input.expiresAt?.toISOString() ?? null,
      max_redemptions: input.maxRedemptions ?? null,
      note: input.note ?? null,
    });
    revalidatePath("/admin/discounts");
    return { error: null, created: promo.code };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe call failed";
    // Most common cause: code already exists in Stripe.
    return { error: `Could not create the code: ${message}`, created: null };
  }
}

export async function createDiscountCodeAction(
  _prev: CodeActionState,
  formData: FormData,
): Promise<CodeActionState> {
  const ctx = await requireSuperAdmin();

  const kind = formData.get("kind") === "fixed" ? "fixed" : "percent";
  const expiresRaw = String(formData.get("expiresAt") ?? "").trim();
  const maxRaw = String(formData.get("maxRedemptions") ?? "").trim();
  const amountRaw = String(formData.get("amountOffPounds") ?? "").trim();

  const input: CreateCodeInput = {
    code: String(formData.get("code") ?? "").trim().toUpperCase(),
    kind,
    percentOff: kind === "percent" ? Number(formData.get("percentOff") ?? 0) : undefined,
    amountOffPence:
      kind === "fixed" && amountRaw ? Math.round(Number(amountRaw) * 100) : undefined,
    expiresAt: expiresRaw ? new Date(`${expiresRaw}T23:59:59`) : null,
    maxRedemptions: maxRaw ? Number(maxRaw) : null,
    note: String(formData.get("note") ?? "").trim() || null,
  };

  return createCode(input, ctx.appUserId, "discount_code.create");
}

export async function createCompCodeAction(
  _prev: CodeActionState,
  formData: FormData,
): Promise<CodeActionState> {
  const ctx = await requireSuperAdmin();

  const forWho = String(formData.get("compFor") ?? "").trim();
  // COMP-<slug>-<random4> keeps codes traceable and collision-free.
  const slug = forWho
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 12);
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  const code = slug ? `COMP-${slug}-${random}` : `COMP-${random}`;

  return createCode(
    buildCompInput(code, forWho || null),
    ctx.appUserId,
    "discount_code.create_comp",
  );
}

export async function deactivateCodeAction(promotionCodeId: string): Promise<void> {
  const ctx = await requireSuperAdmin();
  const stripe = getStripe();
  const updated = await stripe.promotionCodes.update(promotionCodeId, { active: false });
  await logAdminAction(ctx.appUserId, "discount_code.deactivate", {
    promotion_code_id: promotionCodeId,
    code: updated.code,
  });
  revalidatePath("/admin/discounts");
}
