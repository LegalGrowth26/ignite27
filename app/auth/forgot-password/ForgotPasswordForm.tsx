"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/set-password`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });
      if (err) {
        setError("We could not send a link. Try again in a moment.");
        return;
      }
      setStatus("sent");
    });
  }

  if (status === "sent") {
    return (
      <div className="rounded-2xl border border-ignite-line bg-ignite-cream p-5 text-body text-ignite-ink">
        <p className="font-semibold">Link sent.</p>
        <p className="mt-2 text-small text-ignite-muted">
          Check your inbox for a link to set your password. If you do not see it in a minute or
          two, check spam.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="forgot-email" className={LABEL}>
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          className={INPUT}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? (
        <div className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {error}
        </div>
      ) : null}
      <Button variant="primary" size="md" type="submit" disabled={isPending}>
        {isPending ? "Sending..." : "Send me a link"}
      </Button>
    </form>
  );
}
