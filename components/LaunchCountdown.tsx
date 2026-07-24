"use client";

import { useEffect, useState } from "react";

// Client-side countdown driven by the pricing-v2 period boundaries.
// Renders three states:
//   - "pre" (before launch opens):        "Launch pricing: 72 hours only from 1 August, 9am. Opens in HH:MM:SS."
//   - "launch" (inside the 72-hour launch window):  "Launch pricing ends in HH:MM:SS."
//   - "post" (standard / late / closed):  render nothing.
//
// Boundaries are passed in from the server as unix millis so the component
// doesn't need to import the pricing engine (server-only date-fns-tz) or
// duplicate the source of truth. See callers on the home / attend pages.

export interface LaunchCountdownProps {
  launchOpensMs: number; // unix millis, UK-local 1 Aug 2026 09:00
  launchClosesMs: number; // unix millis, UK-local 4 Aug 2026 09:00
  className?: string;
}

interface Countdown {
  d: number;
  h: number;
  m: number;
  s: number;
}

function diff(fromMs: number, toMs: number): Countdown {
  const total = Math.max(0, toMs - fromMs);
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60_000) % 60;
  const h = Math.floor(total / 3_600_000) % 24;
  const d = Math.floor(total / 86_400_000);
  return { d, h, m, s };
}

function formatCountdown({ d, h, m, s }: Countdown): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  if (d > 0) return `${d}d ${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function LaunchCountdown({
  launchOpensMs,
  launchClosesMs,
  className = "",
}: LaunchCountdownProps) {
  // Start with null so server-render and first client paint match; the
  // ticking value fills in on mount. Prevents hydration mismatch on the
  // Date.now()-derived reading.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (now === null) return null;

  if (now < launchOpensMs) {
    const c = diff(now, launchOpensMs);
    return (
      <div
        className={`inline-flex flex-col items-start gap-1 rounded-2xl border border-ignite-red bg-ignite-red/5 px-4 py-3 ${className}`}
      >
        <p className="text-eyebrow uppercase text-ignite-red">
          Launch pricing: 72 hours only from 1 August, 9am
        </p>
        <p className="text-body font-semibold text-ignite-ink">
          Opens in <span className="font-mono tabular-nums">{formatCountdown(c)}</span>
        </p>
      </div>
    );
  }

  if (now < launchClosesMs) {
    const c = diff(now, launchClosesMs);
    return (
      <div
        role="status"
        aria-live="polite"
        className={`inline-flex flex-col items-start gap-1 rounded-2xl border-2 border-ignite-red bg-ignite-red text-ignite-white px-4 py-3 ${className}`}
      >
        <p className="text-eyebrow uppercase text-ignite-white/90">
          Launch pricing — 72-hour window
        </p>
        <p className="text-body font-semibold">
          Ends in <span className="font-mono tabular-nums">{formatCountdown(c)}</span>
        </p>
      </div>
    );
  }

  return null;
}
