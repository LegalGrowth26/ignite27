"use server";

import { revalidatePath } from "next/cache";
import { requireAmbassador } from "@/lib/ambassadors/guard";
import {
  issueCompTicket,
  validateCompRecipient,
} from "@/lib/ambassadors/issue-comp";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export interface GiveTicketState {
  error: string | null;
  warning: string | null;
  created: string | null;
}

// "Give a ticket": gated to the signed-in ambassador, who can only
// ever spend their OWN allowance (the id comes from the guard, never
// the form). Duplicate emails warn without creating; the allowance
// check is enforced atomically inside the database function.
export async function giveTicketAction(
  _prev: GiveTicketState,
  formData: FormData,
): Promise<GiveTicketState> {
  const ctx = await requireAmbassador();

  const validation = validateCompRecipient({
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    email: formData.get("email"),
  });
  if (!validation.ok) {
    return { error: validation.error, warning: null, created: null };
  }

  try {
    const result = await issueCompTicket({
      service: createSupabaseServiceClient(),
      ambassadorId: ctx.ambassador.id,
      actorAppUserId: ctx.appUserId,
      recipient: validation.recipient,
    });
    if (!result.ok) {
      return {
        error: result.error ?? null,
        warning: result.warning ?? null,
        created: null,
      };
    }
    revalidatePath("/ambassador");
    return { error: null, warning: null, created: result.bookingReference };
  } catch (err) {
    console.error("[ambassador] give ticket failed:", err);
    return {
      error: "Could not create the ticket. Try again in a moment.",
      warning: null,
      created: null,
    };
  }
}
