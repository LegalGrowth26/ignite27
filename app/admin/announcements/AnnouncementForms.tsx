"use client";

import { useActionState } from "react";
import type { EchoedValues } from "@/lib/admin/form-echo";
import {
  createAnnouncementAction,
  updateAnnouncementAction,
  type AnnouncementActionState,
} from "./actions";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-3 py-2 text-small text-ignite-ink focus:border-ignite-red focus:outline-none";
const LABEL = "block text-small font-medium text-ignite-ink";

const IDLE: AnnouncementActionState = { error: null, ok: null, values: null };

// React 19 resets uncontrolled form fields after every action, so a
// failed validation used to wipe everything typed. Echoed values from
// the action state take precedence over the stored defaults, keeping
// the admin's work on screen.
function Fields({
  idSuffix,
  defaults,
  echoed,
}: {
  idSuffix: string;
  defaults?: { headline: string; body: string; linkUrl: string; imageUrl: string };
  echoed: EchoedValues | null;
}) {
  const value = (key: keyof NonNullable<typeof defaults>) =>
    echoed?.[key] ?? defaults?.[key] ?? "";
  return (
    <>
      <div>
        <label htmlFor={`headline-${idSuffix}`} className={LABEL}>
          Headline <span className="text-ignite-red">*</span>
        </label>
        <input
          id={`headline-${idSuffix}`}
          name="headline"
          required
          maxLength={120}
          defaultValue={value("headline")}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor={`body-${idSuffix}`} className={LABEL}>
          Body <span className="text-ignite-red">*</span>
        </label>
        <textarea
          id={`body-${idSuffix}`}
          name="body"
          required
          maxLength={500}
          rows={3}
          defaultValue={value("body")}
          className={INPUT}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`link-${idSuffix}`} className={LABEL}>
            Link (optional)
          </label>
          <input
            id={`link-${idSuffix}`}
            name="linkUrl"
            placeholder="https://"
            defaultValue={value("linkUrl")}
            className={INPUT}
          />
        </div>
        <div>
          <label htmlFor={`image-${idSuffix}`} className={LABEL}>
            Image URL (optional)
          </label>
          <input
            id={`image-${idSuffix}`}
            name="imageUrl"
            placeholder="/images/photos/photo-01.webp or https://"
            defaultValue={value("imageUrl")}
            className={INPUT}
          />
        </div>
      </div>
    </>
  );
}

function Feedback({ state }: { state: AnnouncementActionState }) {
  if (state.error) {
    return (
      <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
        {state.ok}
      </p>
    );
  }
  return null;
}

export function CreateAnnouncementForm() {
  const [state, formAction, isPending] = useActionState(createAnnouncementAction, IDLE);
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Fields idSuffix="new" echoed={state.values} />
      <Feedback state={state} />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create draft"}
      </button>
    </form>
  );
}

export function EditAnnouncementForm({
  announcementId,
  defaults,
}: {
  announcementId: string;
  defaults: { headline: string; body: string; linkUrl: string; imageUrl: string };
}) {
  const [state, formAction, isPending] = useActionState(
    updateAnnouncementAction.bind(null, announcementId),
    IDLE,
  );
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Fields idSuffix={announcementId} defaults={defaults} echoed={state.values} />
      <Feedback state={state} />
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
