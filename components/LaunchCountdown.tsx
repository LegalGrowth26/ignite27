"use client";

import { useEffect, useState } from "react";

// Client-side countdown driven by the pricing-v2 period boundaries.
// Renders three states:
//   - "pre" (before launch opens):        "Launch pricing: one week only from 1 August, 9am. Opens in HH:MM:SS."
//   - "launch" (inside launch week):      "Launch pricing ends 8 August. Ends in HH:MM:SS."
//   - "post" (standard / late / closed):  render nothing.
//
// Boundaries are passed in from the server as unix millis so the component
// doesn't need to import the pricing engine (server-only date-fns-tz) or
// duplicate the source of truth. See callers on the home / attend pages.

export interface LaunchCountdownProps {
  launchOpensMs: number; // unix millis, UK-local 1 Aug 2026 09:00
  launchClosesMs: number; // unix millis, UK-local 9 Aug 2026 00:00 (end of launch week)
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

  // Both states render on an opaque panel so the digits never inherit
  // (or fight) the surrounding background. The pre state previously used
  // a 5% red tint with near-black text, which vanished on the black home
  // hero. Solid ignite-black + white digits reads on light and dark
  // placements alike; the live state stays solid brand red + white.
  if (now < launchOpensMs) {
    const c = diff(now, launchOpensMs);
    return (
      <div
        className={`inline-flex flex-col items-start gap-1.5 rounded-2xl border-2 border-ignite-red bg-ignite-black px-5 py-4 shadow-lg ${className}`}
      >
        <p className="text-eyebrow uppercase text-ignite-red">
          Launch pricing: one week only from 1 August, 9am
        </p>
        <p className="text-h3 font-semibold text-ignite-white">
          Opens in{" "}
          <span className="font-mono tabular-nums text-ignite-white">
            {formatCountdown(c)}
          </span>
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
        className={`inline-flex flex-col items-start gap-1.5 rounded-2xl bg-ignite-red px-5 py-4 shadow-lg ${className}`}
      >
        <p className="text-eyebrow uppercase text-ignite-white">
          Launch pricing ends 8 August
        </p>
        <p className="text-h3 font-semibold text-ignite-white">
          Ends in{" "}
          <span className="font-mono tabular-nums text-ignite-white">
            {formatCountdown(c)}
          </span>
        </p>
      </div>
    );
  }

  return null;
}
