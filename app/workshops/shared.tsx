import Link from "next/link";
import { workshopAccess, canCancelWorkshopBooking } from "@/lib/workshops/access";
import type { PublicWorkshop, WorkshopEligibility } from "@/lib/workshops/queries";
import { bookWorkshopAction, cancelWorkshopBookingAction } from "./actions";

// Shared server-side pieces for the /workshops pages: UK time
// formatting and the booking controls. The controls only decide what
// to SHOW; every rule is re-enforced by the database functions.

const LONDON = "Europe/London";

export function formatWorkshopTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LONDON,
  });
  return `${time.format(start)} to ${time.format(end)}`;
}

export function formatWorkshopDate(startsAt: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: LONDON,
  }).format(new Date(startsAt));
}

export interface BookingViewer {
  signedIn: boolean;
  eligibility: WorkshopEligibility;
  bookedIds: ReadonlySet<string>;
}

export function BookingControls({
  workshop,
  viewer,
  returnTo,
}: {
  workshop: PublicWorkshop;
  viewer: BookingViewer;
  returnTo: string;
}) {
  const now = new Date();
  const isBooked = viewer.bookedIds.has(workshop.id);

  if (isBooked) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center rounded-full bg-ignite-red/10 px-4 py-2 text-small font-semibold text-ignite-red">
          You&apos;re booked on this
        </span>
        {canCancelWorkshopBooking(now) ? (
          <form action={cancelWorkshopBookingAction.bind(null, workshop.id, returnTo)}>
            <button
              type="submit"
              className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
            >
              Un-book
            </button>
          </form>
        ) : (
          <span className="text-small text-ignite-muted">
            Changes closed. Speak to the team on the day.
          </span>
        )}
      </div>
    );
  }

  if (!viewer.signedIn) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/login?return_to=${encodeURIComponent(returnTo)}`}
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
        >
          Sign in to book
        </Link>
        <span className="text-small text-ignite-muted">
          Workshop places are free for ticket holders.
        </span>
      </div>
    );
  }

  if (!viewer.eligibility.hasBooking) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/attend"
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
        >
          Book your IGNITE! 27 place
        </Link>
        <span className="text-small text-ignite-muted">
          Workshops are free once you have a ticket.
        </span>
      </div>
    );
  }

  const access = workshopAccess(now, viewer.eligibility.isVip);
  if (!access.open) {
    return (
      <span className="inline-flex items-center rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-muted">
        {viewer.eligibility.isVip
          ? "VIP booking opens 1 January"
          : "Booking opens 4 January"}
      </span>
    );
  }

  if (workshop.spacesLeft <= 0) {
    return (
      <span className="inline-flex items-center rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-muted">
        Full
      </span>
    );
  }

  return (
    <form action={bookWorkshopAction.bind(null, workshop.id, returnTo)}>
      <button
        type="submit"
        className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
      >
        Book your place
      </button>
    </form>
  );
}

export function StatusBanner({
  status,
  error,
}: {
  status?: string;
  error?: string;
}) {
  if (error) {
    return (
      <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-4 text-body text-ignite-red">
        {error}
      </p>
    );
  }
  const text =
    status === "booked"
      ? "You're booked. We'll remind you nearer the day."
      : status === "already_booked"
        ? "You were already booked on that one. No changes made."
        : status === "cancelled"
          ? "Booking cancelled. The place has been freed up for someone else."
          : null;
  if (!text) return null;
  return (
    <p className="rounded-xl border border-ignite-line bg-ignite-white p-4 text-body text-ignite-ink">
      {text}
    </p>
  );
}
