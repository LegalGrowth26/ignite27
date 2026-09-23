"use client";

import { useActionState } from "react";
import {
  addHostInviteeAction,
  inviteHostAction,
  type HostFormState,
} from "./host-actions";

const INPUT =
  "rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";

export function AddHostInviteeForm() {
  const [state, formAction, isPending] = useActionState<HostFormState, FormData>(
    addHostInviteeAction,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor="host-name" className="block text-small font-medium text-ignite-ink">
          Name <span className="text-ignite-red">*</span>
        </label>
        <input id="host-name" name="name" required maxLength={120} className={`${INPUT} w-56`} />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-50"
      >
        {isPending ? "Adding..." : "Add draft invitee"}
      </button>
      {state.error ? (
        <span className="text-small text-ignite-red">{state.error}</span>
      ) : null}
    </form>
  );
}

export function InviteHostForm({ profileId }: { profileId: string }) {
  const [state, formAction, isPending] = useActionState<HostFormState, FormData>(
    inviteHostAction.bind(null, profileId),
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input
        name="email"
        inputMode="email"
        maxLength={200}
        placeholder="host@email.com"
        aria-label="Host email"
        className={`${INPUT} w-56`}
      />
      <input
        name="personalLine"
        maxLength={300}
        placeholder="Personal line for the invite (optional)"
        aria-label="Personal line for the invite (optional)"
        className={`${INPUT} w-72`}
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
      >
        {isPending ? "Inviting..." : "Invite host"}
      </button>
      {state.error ? (
        <span className="text-small text-ignite-red">{state.error}</span>
      ) : null}
    </form>
  );
}
