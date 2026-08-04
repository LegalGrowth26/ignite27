"use server";

import { headers } from "next/headers";
import {
  BookingsClosedForCheckoutError,
  BookingsNotOpenForCheckoutError,
} from "@/lib/stripe/checkout";
import {
  createExhibitorCheckoutSession,
  StandsSoldOutError,
} from "@/lib/stripe/exhibitor-checkout";
import {
  validateExhibitorBookingIntent,
  type ExhibitorIntentFieldError,
} from "@/lib/bookings/exhibitor-intent";
import { countCompletedExhibitorBookings } from "@/lib/bookings/exhibitor-count";
import { resolveBookingNow } from "@/lib/bookings/test-override";
import { isExhibitorAvailable } from "@/lib/pricing";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export type CreateExhibitorCheckoutActionResult =
  | { ok: true; url: string }
  | { ok: false; errors: ExhibitorIntentFieldError[] };

function deriveClientIp(forwardedFor: string | null, realIp: string | null): string {
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  if (realIp) return realIp;
  return "0.0.0.0";
}

// Server action called by the ExhibitorBookingForm. Validates, re-checks
// the stand cap server-side (SPEC: the server refuses further exhibitor
// checkouts once the cap is reached; the page's sold-out state is only
// cosmetic), creates the Stripe Checkout session, and returns its URL.
export async function createExhibitorCheckoutSessionAction(
  rawInput: Record<string, unknown>,
): Promise<CreateExhibitorCheckoutActionResult> {
  const validation = validateExhibitorBookingIntent(rawInput);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors };
  }

  const headerList = await headers();
  const ip = deriveClientIp(
    headerList.get("x-forwarded-for"),
    headerList.get("x-real-ip"),
  );

  try {
    const sold = await countCompletedExhibitorBookings(createSupabaseServiceClient());
    if (!isExhibitorAvailable(sold)) {
      throw new StandsSoldOutError();
    }

    const result = await createExhibitorCheckoutSession({
      intent: validation.intent,
      termsAcceptedIp: ip,
      pricingNow: resolveBookingNow(),
    });
    return { ok: true, url: result.url };
  } catch (err) {
    if (err instanceof StandsSoldOutError) {
      return {
        ok: false,
        errors: [
          {
            field: "form",
            message:
              "All 50 stands are now taken. Email tom@lincolnshiremarketing.co.uk to join the waiting list.",
          },
        ],
      };
    }
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
        errors: [{ field: "form", message: "Exhibitor bookings for IGNITE! 27 are closed." }],
      };
    }
    console.error("[exhibit/book] createExhibitorCheckoutSessionAction failed:", err);
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
