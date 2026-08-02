import { BOOKINGS_OPEN_AT } from "@/lib/pricing";

// Slim site-wide banner rendered above the header, visible only before
// bookings open at 09:00 UK on 1 August 2026. Copy per Tom.
// Server-rendered: uses Date.now() at request time; every page mounting
// this component is either dynamic or opts into per-request rendering
// via the root layout.
export function SneakPeekBanner() {
  if (Date.now() >= BOOKINGS_OPEN_AT.getTime()) return null;

  return (
    <div className="w-full bg-ignite-red text-ignite-white">
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 py-2 text-small font-semibold">
        <span aria-hidden>✦</span>
        <span>
          You are getting a sneak peek. Bookings open 1 August, 9am.
        </span>
      </div>
    </div>
  );
}
