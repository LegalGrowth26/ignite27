"use client";

import { useActionState } from "react";
import type { EchoedValues } from "@/lib/admin/form-echo";
import type { WorkshopFormState } from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

export interface WorkshopDefaults {
  title: string;
  description: string;
  speakerName: string;
  hostProfileId: string; // "" = no linked host
  room: string;
  startsAt: string; // datetime-local value (UK time)
  endsAt: string;
  capacity: string;
}

export interface HostOption {
  id: string;
  name: string;
}

export function WorkshopForm({
  action,
  defaults,
  submitLabel,
  hostOptions,
}: {
  action: (prev: WorkshopFormState, formData: FormData) => Promise<WorkshopFormState>;
  defaults: WorkshopDefaults;
  submitLabel: string;
  // Speaker profiles typed workshop_host or both. Linking one puts
  // the host's name and page on the workshop; the free-text field
  // below stays as the fallback for unlinked hosts.
  hostOptions: HostOption[];
}) {
  const [state, formAction, isPending] = useActionState<WorkshopFormState, FormData>(
    action,
    { error: null, values: null },
  );
  // Failed validation echoes typed values back; they win over defaults
  // so nothing the admin entered is lost to React 19's form reset.
  const echoed: EchoedValues | null = state.values;
  const v = (key: keyof WorkshopDefaults) => echoed?.[key] ?? defaults[key];

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label htmlFor="title" className={LABEL}>
          Title <span className="text-ignite-red">*</span>
        </label>
        <input
          id="title"
          name="title"
          defaultValue={v("title")}
          maxLength={200}
          required
          className={INPUT}
        />
      </div>

      <div>
        <label htmlFor="description" className={LABEL}>
          Description
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={v("description")}
          maxLength={5000}
          rows={6}
          className={INPUT}
        />
        <p className={HELP}>Blank lines start a new paragraph on the public page.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="hostProfileId" className={LABEL}>
            Host (linked profile)
          </label>
          <select
            id="hostProfileId"
            name="hostProfileId"
            defaultValue={defaults.hostProfileId}
            className={INPUT}
          >
            <option value="">No linked host</option>
            {hostOptions.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <p className={HELP}>
            Workshop-host and both-type profiles only. Add hosts in
            /admin/speakers; the workshop then shows and links their page.
          </p>
        </div>
        <div>
          <label htmlFor="speakerName" className={LABEL}>
            Host name (fallback)
          </label>
          <input
            id="speakerName"
            name="speakerName"
            defaultValue={v("speakerName")}
            maxLength={120}
            className={INPUT}
          />
          <p className={HELP}>Shown only when no linked host is set.</p>
        </div>
        <div>
          <label htmlFor="room" className={LABEL}>
            Room (optional)
          </label>
          <input
            id="room"
            name="room"
            defaultValue={v("room")}
            maxLength={120}
            className={INPUT}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="startsAt" className={LABEL}>
            Starts (UK time) <span className="text-ignite-red">*</span>
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            defaultValue={v("startsAt")}
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
            defaultValue={v("endsAt")}
            required
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor="capacity" className={LABEL}>
            Capacity <span className="text-ignite-red">*</span>
          </label>
          <input
            id="capacity"
            name="capacity"
            type="number"
            min={1}
            max={1000}
            defaultValue={v("capacity")}
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
