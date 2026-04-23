"use client";

import { useState, useTransition } from "react";
import { subscribeSpeakersUpdatesAction } from "@/app/speakers/actions";
import { Button } from "./Button";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink placeholder:text-ignite-muted/70 focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const REQ = "text-ignite-red";

export function SpeakersSignupForm() {
  const [email, setEmail] = useState("");
  const [wantsSpeakersAlert, setWantsSpeakersAlert] = useState(false);
  const [wantsMarketing, setWantsMarketing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);

    if (!wantsSpeakersAlert) {
      setError("Tick the box to confirm you want the speakers alert.");
      return;
    }

    startTransition(async () => {
      const result = await subscribeSpeakersUpdatesAction({
        email,
        wantsSpeakersAlert,
        wantsMarketing,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIsSuccess(true);
    });
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl border border-ignite-line bg-ignite-cream p-6">
        <p className="text-h3 text-ignite-ink">You&apos;re on the list.</p>
        <p className="mt-2 text-body text-ignite-muted">We&apos;ll be in touch.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <div>
        <label htmlFor="speakers-email" className={LABEL}>
          Email <span className={REQ}>*</span>
        </label>
        <input
          id="speakers-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          className={INPUT}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="wantsSpeakersAlert"
          checked={wantsSpeakersAlert}
          onChange={(e) => setWantsSpeakersAlert(e.target.checked)}
          required
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-ink">
          Notify me when speakers are announced. <span className={REQ}>*</span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="wantsMarketing"
          checked={wantsMarketing}
          onChange={(e) => setWantsMarketing(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-muted">
          Also send me occasional Ignite news and updates.
        </span>
      </label>

      {error ? (
        <div className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {error}
        </div>
      ) : null}

      <div>
        <Button variant="primary" size="md" type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Keep me posted"}
        </Button>
      </div>
    </form>
  );
}
