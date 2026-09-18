"use server";

import { cookies, headers } from "next/headers";
import {
  createDelegateCheckoutSession,
  BookingsNotOpenForCheckoutError,
  BookingsClosedForCheckoutError,
} from "@/lib/stripe/checkout";
import {
  validateDelegateBookingIntent,
  type IntentFieldError,
} from "@/lib/bookings/intent";
import { resolveBookingNow } from "@/lib/bookings/test-override";
import { normaliseRefSlug, REF_COOKIE_NAME } from "@/lib/ambassadors/attribution";

export type CreateCheckoutSessionActionResult =
  | { ok: true; url: string }
  | { ok: false; errors: IntentFieldError[] };

function deriveClientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp;
  return "0.0.0.0";
}

// Server action called by the BookingForm. Accepts raw form values, validates,
// anchors pricing to now, creates a Stripe Checkout session, and returns the
// Checkout URL. The client redirects to that URL.
export async function createCheckoutSessionAction(
  rawInput: Record<string, unknown>,
): Promise<CreateCheckoutSessionActionResult> {
  const validation = validateDelegateBookingIntent(rawInput);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const headerList = await headers();
  const ip = deriveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );
  // Ambassador attribution: last-touch ref cookie, set by the
  // middleware, re-validated here before it rides into metadata.
  const cookieStore = await cookies();
  const refSlug = normaliseRefSlug(cookieStore.get(REF_COOKIE_NAME)?.value);

  try {
    const result = await createDelegateCheckoutSession({
      intent: validation.intent,
      termsAcceptedIp: ip,
      pricingNow: resolveBookingNow(),
      refSlug,
    });
    return { ok: true, url: result.url };
  } catch (err) {
    if (err instanceof BookingsNotOpenForCheckoutError) {
      return {
        ok: false,
        errors: [
          {
            field: "form",
            message: "Bookings open 09:00, Saturday 1 August 2026. Try again then.",
          },
        ],
      };
    }
    if (err instanceof BookingsClosedForCheckoutError) {
      return {
        ok: false,
        errors: [
          { field: "form", message: "Bookings for IGNITE! 27 are closed." },
        ],
      };
    }
    console.error("[attend/book] createCheckoutSessionAction failed:", err);
    return {
      ok: false,
      errors: [
        {
          field: "form",
          message: "We could not start payment. Try again in a moment.",
        },
      ],
    };
  }
}
