"use server";

import { cookies, headers } from "next/headers";
import { normaliseRefSlug, REF_COOKIE_NAME } from "@/lib/ambassadors/attribution";
import {
  validateGroupBookingIntent,
  type GroupFieldError,
} from "@/lib/bookings/group-intent";
import { resolveBookingNow } from "@/lib/bookings/test-override";
import {
  BookingsClosedForCheckoutError,
  BookingsNotOpenForCheckoutError,
} from "@/lib/stripe/checkout";
import {
  createGroupCheckoutSession,
  InvalidGroupDiscountCodeError,
} from "@/lib/stripe/group-checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export type CreateGroupCheckoutActionResult =
  | { ok: true; url: string }
  | { ok: false; errors: GroupFieldError[] };

function deriveClientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp;
  return "0.0.0.0";
}

export async function createGroupCheckoutAction(
  rawInput: Record<string, unknown>,
): Promise<CreateGroupCheckoutActionResult> {
  const validation = validateGroupBookingIntent(rawInput);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const headerList = await headers();
  const ip = deriveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );
  const cookieStore = await cookies();
  const refSlug = normaliseRefSlug(cookieStore.get(REF_COOKIE_NAME)?.value);

  try {
    const result = await createGroupCheckoutSession({
      intent: validation.intent,
      termsAcceptedIp: ip,
      pricingNow: resolveBookingNow(),
      refSlug,
      serviceClient: createSupabaseServiceClient(),
    });
    return { ok: true, url: result.url };
  } catch (err) {
    if (err instanceof InvalidGroupDiscountCodeError) {
      return {
        ok: false,
        errors: [
          {
            field: "discountCode",
            message:
              "That discount code is not valid. Check the spelling, or clear it: the group discount still applies automatically.",
          },
        ],
      };
    }
    if (err instanceof BookingsNotOpenForCheckoutError) {
      return {
        ok: false,
        errors: [
          { field: "form", message: "Bookings open 09:00, Saturday 1 August 2026. Try again then." },
        ],
      };
    }
    if (err instanceof BookingsClosedForCheckoutError) {
      return {
        ok: false,
        errors: [{ field: "form", message: "Bookings for IGNITE! 27 are closed." }],
      };
    }
    console.error("[attend/book/group] createGroupCheckoutAction failed:", err);
    return {
      ok: false,
      errors: [
        { field: "form", message: "We could not start payment. Try again in a moment." },
      ],
    };
  }
}
