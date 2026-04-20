"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

type FormError =
  | { kind: "expired" }
  | { kind: "generic"; message: string };

export function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<FormError | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError({ kind: "generic", message: "Use at least 8 characters." });
      return;
    }
    if (password !== confirm) {
      setError({ kind: "generic", message: "The two passwords do not match." });
      return;
    }
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.updateUser({ password });
      if (err) {
        if (/session|recovery|auth/i.test(err.message)) {
          setError({ kind: "expired" });
        } else {
          setError({
            kind: "generic",
            message: "Could not set your password. Try again.",
          });
        }
        return;
      }
      window.location.href = "/account";
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="new-password" className={LABEL}>
          New password
        </label>
        <input
          id="new-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className={INPUT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="confirm-password" className={LABEL}>
          Confirm password
        </label>
        <input
          id="confirm-password"
          type="password"
          required
          autoComplete="new-password"
          minLength={8}
          className={INPUT}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </div>

      {error?.kind === "generic" ? (
        <div className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {error.message}
        </div>
      ) : null}

      {error?.kind === "expired" ? (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-ignite-red bg-ignite-red/5 p-5">
          <p className="text-body font-semibold text-ignite-red">
            Your link has expired.
          </p>
          <p className="text-small text-ignite-ink">
            Set-password links are single-use and time-limited. Request a new one and try
            again.
          </p>
          <div>
            <Button href="/auth/forgot-password" variant="primary" size="md">
              Get a new link
            </Button>
          </div>
          <p className="text-small text-ignite-muted">
            Still having trouble?{" "}
            <a
              href="mailto:tom@lincolnshiremarketing.co.uk"
              className="underline underline-offset-4 hover:text-ignite-red"
            >
              Contact us
            </a>{" "}
            and we will sort it.
          </p>
        </div>
      ) : null}

      <Button variant="primary" size="md" type="submit" disabled={isPending}>
        {isPending ? "Saving..." : "Set password and log in"}
      </Button>
    </form>
  );
}
