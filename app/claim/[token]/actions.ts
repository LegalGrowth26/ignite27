"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { CLAIM_TOKEN_PATTERN } from "@/lib/ambassadors/claim";
import {
  issueCompTicket,
  validateCompRecipient,
} from "@/lib/ambassadors/issue-comp";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Public claim action: the token IS the authorisation, so everything
// else is re-checked server-side here and (for the allowance) inside
// the row-locked database function. Two people racing for the last
// ticket: exactly one wins; the other gets the friendly exhausted
// message.

export interface ClaimFormState {
  error: string | null;
  // Echoed on error so React 19's form reset never wipes typed work.
  values: Record<string, string> | null;
}

const MAX_OPTIONAL = 200;

function echo(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export async function claimCompAction(
  token: string,
  _prev: ClaimFormState,
  formData: FormData,
): Promise<ClaimFormState> {
  if (!CLAIM_TOKEN_PATTERN.test(token)) {
    return { error: "This link is not valid.", values: null };
  }

  // Honeypot: bots fill every field; humans never see this one. A
  // filled honeypot pretends success without creating anything.
  if (String(formData.get("website") ?? "").length > 0) {
    redirect(`/claim/${token}?status=claimed`);
  }

  const validation = validateCompRecipient({
    firstName: formData.get("firstName"),
    surname: formData.get("surname"),
    email: formData.get("email"),
  });
  if (!validation.ok) return { error: validation.error, values: echo(formData) };

  const mobile = String(formData.get("mobile") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const jobTitle = String(formData.get("jobTitle") ?? "").trim();
  if (mobile.length > 50 || company.length > MAX_OPTIONAL || jobTitle.length > MAX_OPTIONAL) {
    return { error: "One of the optional fields is too long.", values: echo(formData) };
  }
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  const service = createSupabaseServiceClient();
  const { data } = await service
    .from("ambassadors")
    .select("id, user_id, display_name, comp_allowance, deactivated_at")
    .eq("comp_claim_token", token)
    .maybeSingle();
  const ambassador = data as {
    id: string;
    user_id: string;
    display_name: string;
    comp_allowance: number;
    deactivated_at: string | null;
  } | null;
  if (!ambassador || ambassador.deactivated_at) {
    return { error: "This link is no longer active.", values: echo(formData) };
  }

  try {
    const result = await issueCompTicket({
      service,
      ambassadorId: ambassador.id,
      // The allowance being spent is the ambassador's, so the audit
      // row carries them as the actor (there is no signed-in claimant).
      actorAppUserId: ambassador.user_id,
      recipient: validation.recipient,
      details: { mobile, company, jobTitle, marketingOptIn },
      source: "claim_link",
      auditAction: "ambassador.comp_claim",
    });
    if (!result.ok) {
      if (result.error === "No comp tickets left in your allowance.") {
        // Lost the race for the last ticket: show the same friendly
        // exhausted state the page shows, not an error box.
        revalidatePath(`/claim/${token}`);
        redirect(`/claim/${token}`);
      }
      return {
        error: result.warning ?? result.error ?? "Something went wrong. Try again.",
        values: echo(formData),
      };
    }
    revalidatePath(`/claim/${token}`);
    redirect(`/claim/${token}?status=claimed`);
  } catch (err) {
    // redirect() throws internally; let Next handle it.
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    if ((err as { digest?: string })?.digest?.toString().startsWith("NEXT_REDIRECT")) {
      throw err;
    }
    console.error("[claim] failed:", err);
    return {
      error: "Could not book your ticket. Try again in a moment.",
      values: echo(formData),
    };
  }
}
