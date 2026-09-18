"use client";

import { useActionState } from "react";
import { giveTicketAction, type GiveTicketState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

const IDLE: GiveTicketState = { error: null, warning: null, created: null };

export function GiveTicketForm({ disabled }: { disabled: boolean }) {
  const [state, formAction, isPending] = useActionState(giveTicketAction, IDLE);

  if (disabled) {
    return (
      <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-muted">
        You have used all your guest tickets. Ask the organisers if you
        need more.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="give-first" className={LABEL}>
            First name <span className="text-ignite-red">*</span>
          </label>
          <input id="give-first" name="firstName" required className={INPUT} />
        </div>
        <div>
          <label htmlFor="give-surname" className={LABEL}>
            Surname <span className="text-ignite-red">*</span>
          </label>
          <input id="give-surname" name="surname" required className={INPUT} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="give-email" className={LABEL}>
            Email <span className="text-ignite-red">*</span>
          </label>
          <input id="give-email" name="email" type="email" required className={INPUT} />
          <p className="mt-1 text-small text-ignite-muted">
            Their ticket and booking confirmation go straight to this address.
          </p>
        </div>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}
      {state.warning ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          {state.warning}
        </p>
      ) : null}
      {state.created ? (
        <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
          Done. Ticket <span className="font-mono font-semibold">{state.created}</span>{" "}
          is booked and their confirmation email is on its way.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white disabled:opacity-50"
      >
        {isPending ? "Creating ticket..." : "Give this ticket"}
      </button>
    </form>
  );
}
