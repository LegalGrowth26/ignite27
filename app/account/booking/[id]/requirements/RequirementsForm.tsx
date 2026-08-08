"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  submitExhibitorRequirementsAction,
  type RequirementsFormState,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

interface Defaults {
  needsPower: boolean;
  needsTableChairs: boolean;
  signageName: string;
  websiteUrl: string;
  hasLogo: boolean;
}

export function RequirementsForm({
  bookingId,
  defaults,
}: {
  bookingId: string;
  defaults: Defaults;
}) {
  const [state, formAction, isPending] = useActionState<RequirementsFormState, FormData>(
    submitExhibitorRequirementsAction.bind(null, bookingId),
    { error: null },
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <label className="flex items-start gap-3 rounded-2xl border border-ignite-line p-4">
        <input
          type="checkbox"
          name="needsPower"
          defaultChecked={defaults.needsPower}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-body font-semibold text-ignite-ink">
            We need power at the stand
          </span>
          <span className="block text-small text-ignite-muted">
            A standard socket. Tell us at the door if you need more than one.
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-2xl border border-ignite-line p-4">
        <input
          type="checkbox"
          name="needsTableChairs"
          defaultChecked={defaults.needsTableChairs}
          className="mt-1 h-4 w-4"
        />
        <span>
          <span className="block text-body font-semibold text-ignite-ink">
            We need a table and two chairs
          </span>
          <span className="block text-small text-ignite-muted">
            Untick if you are bringing your own stand kit.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="signageName" className={LABEL}>
          Company name for signage <span className="text-ignite-red">*</span>
        </label>
        <input
          id="signageName"
          name="signageName"
          defaultValue={defaults.signageName}
          maxLength={120}
          required
          className={INPUT}
        />
        <p className={HELP}>Exactly as it should appear on your stand sign and badges.</p>
      </div>

      <div>
        <label htmlFor="logo" className={LABEL}>
          Company logo {defaults.hasLogo ? "(already uploaded, choose a file to replace it)" : "(optional)"}
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="mt-1 w-full text-small"
        />
        <p className={HELP}>
          PNG, JPG, WebP, or SVG, up to 2MB. Appears on your public listing
          shortly after you save.
        </p>
      </div>

      <div>
        <label htmlFor="websiteUrl" className={LABEL}>
          Website (optional)
        </label>
        <input
          id="websiteUrl"
          name="websiteUrl"
          defaultValue={defaults.websiteUrl}
          inputMode="url"
          placeholder="https://"
          className={INPUT}
        />
        <p className={HELP}>Linked from your public listing.</p>
      </div>

      {state.error ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {state.error}
        </p>
      ) : null}

      <div>
        <Button variant="primary" size="lg" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save stand requirements"}
        </Button>
      </div>
    </form>
  );
}
