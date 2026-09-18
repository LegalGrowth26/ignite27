import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { buildDayPlan, type PlanSourceItem } from "@/lib/agenda/plan";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My day · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AgendaItemRow {
  id: string;
  title: string;
  speaker_name: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
}

interface MyWorkshopRow {
  workshops: {
    id: string;
    title: string;
    speaker_name: string | null;
    room: string | null;
    starts_at: string;
    ends_at: string;
  } | null;
}

const LONDON = "Europe/London";

function ukTime(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LONDON,
  }).format(d);
}

// Mobile-first personal plan for the day: the main-stage running order
// everyone gets, with the caller's booked workshops slotted in, and an
// honest flag on every workshop that overlaps a talk.
export default async function MyDayPage() {
  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) {
    redirect(`/login?return_to=${encodeURIComponent("/my-day")}`);
  }

  // Published agenda items (public data; service client for consistency
  // with the other public reads).
  let agendaItems: PlanSourceItem[] = [];
  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("agenda_items")
      .select("id, title, speaker_name, location, starts_at, ends_at")
      .not("published_at", "is", null);
    if (error) throw new Error(error.message);
    agendaItems = ((data ?? []) as unknown as AgendaItemRow[]).map((r) => ({
      id: r.id,
      title: r.title,
      speakerName: r.speaker_name,
      location: r.location,
      startsAt: new Date(r.starts_at),
      endsAt: new Date(r.ends_at),
    }));
  } catch (err) {
    console.error("[my-day] agenda fetch failed:", err);
  }

  // The caller's booked workshops (RLS: own rows; the workshop embed
  // returns null for a workshop an admin has unpublished, which then
  // simply drops off the plan).
  let myWorkshops: PlanSourceItem[] = [];
  const { data: bookingRows, error: bookingsErr } = await supabase
    .from("workshop_bookings")
    .select("workshops ( id, title, speaker_name, room, starts_at, ends_at )");
  if (bookingsErr) {
    console.error("[my-day] bookings fetch failed:", bookingsErr.message);
  } else {
    myWorkshops = ((bookingRows ?? []) as unknown as MyWorkshopRow[])
      .map((r) => r.workshops)
      .filter((w): w is NonNullable<MyWorkshopRow["workshops"]> => w !== null)
      .map((w) => ({
        id: w.id,
        title: w.title,
        speakerName: w.speaker_name,
        location: w.room,
        startsAt: new Date(w.starts_at),
        endsAt: new Date(w.ends_at),
      }));
  }

  const plan = buildDayPlan(agendaItems, myWorkshops);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-ignite-black text-ignite-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 600px at 18% 10%, rgba(225,29,46,0.38), transparent 60%), radial-gradient(700px 500px at 88% 90%, rgba(225,29,46,0.24), transparent 65%)",
          }}
        />
        <Container className="relative py-14 sm:py-16">
          <p className="text-eyebrow uppercase text-ignite-red">Thursday 21 January 2027</p>
          <h1 className="mt-4 text-h1">Your day at IGNITE! 27.</h1>
          <p className="mt-4 max-w-2xl text-body text-white/80">
            The main stage runs all day; your booked workshops slot in around
            it. All times UK.
          </p>
        </Container>
      </section>

      <Section tone="light">
        <Container>
          <div className="mx-auto max-w-2xl">
            {plan.length === 0 ? (
              <div className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
                <p className="text-body font-semibold text-ignite-ink">
                  Nothing here yet.
                </p>
                <p className="mt-2 text-body text-ignite-muted">
                  The running order lands here as it is confirmed, and any
                  workshops you book appear alongside it.
                </p>
                <p className="mt-4">
                  <Link
                    href="/workshops"
                    className="inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                  >
                    Browse workshops
                  </Link>
                </p>
              </div>
            ) : (
              <>
                <ol className="grid gap-3">
                  {plan.map((entry) => (
                    <li
                      key={`${entry.kind}-${entry.id}`}
                      className={
                        entry.kind === "workshop"
                          ? "rounded-2xl border-2 border-ignite-red bg-ignite-white p-5"
                          : "rounded-2xl border border-ignite-line bg-ignite-white p-5"
                      }
                    >
                      <p className="text-small font-semibold text-ignite-red">
                        {ukTime(entry.startsAt)} to {ukTime(entry.endsAt)}
                        {entry.location ? ` · ${entry.location}` : ""}
                      </p>
                      <p className="mt-1 text-h3">
                        {entry.kind === "workshop" ? (
                          <Link
                            href={`/workshops/${entry.id}`}
                            className="hover:text-ignite-red"
                          >
                            {entry.title}
                          </Link>
                        ) : (
                          entry.title
                        )}
                      </p>
                      {entry.speakerName ? (
                        <p className="mt-1 text-small text-ignite-muted">
                          with {entry.speakerName}
                        </p>
                      ) : null}
                      {entry.kind === "workshop" ? (
                        <p className="mt-2 inline-flex rounded-full bg-ignite-red/10 px-3 py-1 text-small font-semibold text-ignite-red">
                          Your workshop
                        </p>
                      ) : null}
                      {entry.missedTalks.map((title) => (
                        <p key={title} className="mt-2 text-small text-ignite-muted">
                          Heads up: you&apos;ll miss part of {title}.
                        </p>
                      ))}
                    </li>
                  ))}
                </ol>
                <p className="mt-8 text-body">
                  <Link
                    href="/workshops"
                    className="font-semibold text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                  >
                    Add a workshop to your day
                  </Link>
                </p>
              </>
            )}
          </div>
        </Container>
      </Section>
    </>
  );
}
