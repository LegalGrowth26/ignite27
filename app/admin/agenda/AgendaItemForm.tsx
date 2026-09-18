"use client";

import { useActionState } from "react";
import type { AgendaItemFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface AgendaItemDefaults {
  title: string;
  description: string;
  speakerName: string;
  location: string;
  startsAt: string; // datetime-local value (UK time)
  endsAt: string;
}

export function AgendaItemForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: AgendaItemFormState, formData: FormData) => Promise<AgendaItemFormState>;
  defaults: AgendaItemDefaults;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState<AgendaItemFormState, FormData>(
    action,
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="title" className={LABEL}>
          Title <span className="text-ignite-red">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={defaults.title}
          maxLength={200}
          required
          className={INPUT}
        />
        <p className={HELP}>
          For example: Opening keynote, Lunch, Panel: growing without burning out.
        </p>
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          Description (optional)
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={defaults.description}
          maxLength={2000}
          rows={4}
          className={INPUT}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="speakerName" className={LABEL}>
            Speaker (optional)
          </label>
          <input
            id="speakerName"
            name="speakerName"
            defaultValue={defaults.speakerName}
            maxLength={120}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="location" className={LABEL}>
            Location (optional)
          </label>
          <input
            id="location"
            name="location"
            defaultValue={defaults.location}
            maxLength={120}
            className={INPUT}
          />
          <p className={HELP}>Defaults to the main stage in people&apos;s heads; set it when it isn&apos;t.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="startsAt" className={LABEL}>
            Starts (UK time) <span className="text-ignite-red">*</span>
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={defaults.startsAt}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="endsAt" className={LABEL}>
            Ends (UK time) <span className="text-ignite-red">*</span>
          </label>
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            defaultValue={defaults.endsAt}
            required
            className={INPUT}
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-full bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white hover:bg-ignite-red/90 disabled:opacity-50"
        >
          {isPending ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
