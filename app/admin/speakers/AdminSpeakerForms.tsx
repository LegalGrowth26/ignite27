"use client";

import { useActionState } from "react";
import type { EchoedValues } from "@/lib/admin/form-echo";
import {
  SPEAKER_PROFILE_TYPES,
  SPEAKER_PROFILE_TYPE_LABELS,
} from "@/lib/speakers/profile";
import {
  addSpeakerAction,
  attachSpeakerEmailAction,
  type SpeakerAdminFormState,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

export function AddSpeakerForm() {
  const [state, formAction, isPending] = useActionState<SpeakerAdminFormState, FormData>(
    addSpeakerAction,
    { error: null, values: null },
  );
  // Failed validation echoes typed values back (React 19 resets forms).
  const echoed: EchoedValues | null = state.values;

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="name" className={LABEL}>
          Name <span className="text-ignite-red">*</span>
        </label>
        <input id="name" name="name" required maxLength={120} defaultValue={echoed?.name ?? ""} className={INPUT} />
      </div>
      <div>
        <label htmlFor="email" className={LABEL}>
          Email (optional)
        </label>
        <input id="email" name="email" inputMode="email" maxLength={200} defaultValue={echoed?.email ?? ""} className={INPUT} />
        <p className="mt-1 text-small text-ignite-muted">
          With an email: account + invite go out now. Blank: attach one later.
        </p>
      </div>
      <div>
        <label htmlFor="talkTitle" className={LABEL}>
          Talk title (optional)
        </label>
        <input id="talkTitle" name="talkTitle" maxLength={200} defaultValue={echoed?.talkTitle ?? ""} className={INPUT} />
        <input id="talkTitle" name="talkTitle" maxLength={200} className={INPUT} />
        <p className="mt-1 text-small text-ignite-muted">
          Main-stage only; a host&apos;s workshop title comes from the workshops admin.
        </p>
      </div>
      <div>
        <label htmlFor="profileType" className={LABEL}>
          Type
        </label>
        <select id="profileType" name="profileType" defaultValue="main_stage" className={INPUT}>
          {SPEAKER_PROFILE_TYPES.map((t) => (
            <option key={t} value={t}>
              {SPEAKER_PROFILE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      {state.error ? (
        <p className="sm:col-span-3 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      <div className="sm:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
        >
          {isPending ? "Adding..." : "Add speaker (page goes live now)"}
        </button>
      </div>
    </form>
  );
}

export function AttachEmailForm({ profileId }: { profileId: string }) {
  const [state, formAction, isPending] = useActionState<SpeakerAdminFormState, FormData>(
    attachSpeakerEmailAction.bind(null, profileId),
    { error: null, values: null },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="email"
        defaultValue={state.values?.email ?? ""}
        inputMode="email"
        maxLength={200}
        placeholder="speaker@email.com"
        aria-label="Speaker email"
        className="w-56 rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-50"
      >
        {isPending ? "Linking..." : "Attach email + invite"}
      </button>
      {state.error ? (
        <span className="text-small text-ignite-red">{state.error}</span>
      ) : null}
    </form>
  );
}
