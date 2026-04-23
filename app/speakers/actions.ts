"use server";

import {
  subscribeToEmailList,
  type SubscribeToEmailListResult,
} from "@/lib/email-signups/subscribe";

export type SubscribeSpeakersUpdatesResult = SubscribeToEmailListResult;

const SPEAKERS_SOURCE = "speakers_page";

export async function subscribeSpeakersUpdatesAction(
  rawInput: unknown,
): Promise<SubscribeSpeakersUpdatesResult> {
  const raw = (typeof rawInput === "object" && rawInput !== null
    ? rawInput
    : {}) as Record<string, unknown>;
  return subscribeToEmailList({
    source: SPEAKERS_SOURCE,
    email: raw.email,
    wantsAlert: raw.wantsSpeakersAlert,
    wantsMarketing: raw.wantsMarketing,
  });
}
