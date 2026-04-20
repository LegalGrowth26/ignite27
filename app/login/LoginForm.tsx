"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/Button";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser-client";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

export function LoginForm({ returnTo }: { returnTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting || isPending) return;
    setError(null);
    setIsSubmitting(true);
    startTransition(async () => {
      const supabase = createSupabaseBrowserClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError("That email and password do not match.");
        setIsSubmitting(false);
        return;
      }
      window.location.href = returnTo.startsWith("/") ? returnTo : "/account";
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div>
        <label htmlFor="login-email" className={LABEL}>
          Email
        </label>
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          className={INPUT}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="login-password" className={LABEL}>
          Password
        </label>
        <input
          id="login-password"
          type="password"
          required
          autoComplete="current-password"
          className={INPUT}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? (
        <div className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {error}
        </div>
      ) : null}
      <Button variant="primary" size="md" type="submit" disabled={isSubmitting || isPending}>
        {isSubmitting || isPending ? "Logging in..." : "Log in"}
      </Button>
    </form>
  );
}
