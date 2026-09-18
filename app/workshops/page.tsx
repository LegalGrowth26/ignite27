import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import {
  fetchMyWorkshopIds,
  fetchPublishedWorkshops,
  fetchWorkshopEligibility,
  type PublicWorkshop,
} from "@/lib/workshops/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import {
  BookingControls,
  StatusBanner,
  formatWorkshopDate,
  formatWorkshopTime,
  type BookingViewer,
} from "./shared";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Workshops · IGNITE! 27",
  description:
    "Free hands-on workshops at IGNITE! 27, Thursday 21 January 2027 at Kelham Hall, Newark. Places are limited; booking opens in January.",
};

export default async function WorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const { status, error } = await searchParams;

  let workshops: PublicWorkshop[] = [];
  let loadFailed = false;
  try {
    workshops = await fetchPublishedWorkshops(createSupabaseServiceClient());
  } catch (err) {
    console.error("[workshops] listing failed:", err);
    loadFailed = true;
  }

  const supabase = await createSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const signedIn = Boolean(userData?.user);
  const viewer: BookingViewer = {
    signedIn,
    eligibility: signedIn
      ? await fetchWorkshopEligibility(supabase)
      : { hasBooking: false, isVip: false },
    bookedIds: signedIn ? await fetchMyWorkshopIds(supabase) : new Set(),
  };

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
        <Container className="relative py-16 sm:py-20">
          <div className="max-w-3xl">
            <p className="text-eyebrow uppercase text-ignite-red">IGNITE! 27 workshops</p>
            <h1 className="mt-5 text-h1">Small rooms. Big takeaways.</h1>
            <p className="mt-5 max-w-2xl text-lead text-white/80">
              Free hands-on sessions running alongside the main stage. Places are
              limited, so pick the ones that move your business and book early.
            </p>
            <p className="mt-4 text-body text-white/70">
              Booking opens 1 January for VIP ticket holders and 4 January for
              everyone else.
            </p>
          </div>
        </Container>
      </section>

      <Section tone="light">
        <Container>
          <div className="grid gap-4">
            <StatusBanner status={status} error={error} />
          </div>

          {loadFailed ? (
            <p className="text-body text-ignite-muted">
              The workshop list is having a moment. Try again shortly.
            </p>
          ) : workshops.length === 0 ? (
            <div>
              <SectionHeader
                eyebrow="Coming soon"
                heading="The workshop line-up is being finalised."
                lede="Eight workshops are planned for the day. They will appear here as each one is confirmed, and booking opens in January."
              />
              <p className="mt-8">
                <Link
                  href="/attend"
                  className="inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                >
                  Book your IGNITE! 27 place
                </Link>
              </p>
            </div>
          ) : (
            <>
              <SectionHeader
                eyebrow={formatWorkshopDate(workshops[0]!.starts_at)}
                heading="Pick your workshops."
                lede="All times UK. Workshops are free for ticket holders; one place per person per workshop, and you cannot book two that overlap."
              />
              <ul className="mt-10 grid gap-4">
                {workshops.map((w) => (
                  <li
                    key={w.id}
                    className="rounded-2xl border border-ignite-line bg-ignite-white p-6"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 max-w-2xl">
                        <p className="text-small font-semibold text-ignite-red">
                          {formatWorkshopTime(w.starts_at, w.ends_at)}
                          {w.room ? ` · ${w.room}` : ""}
                        </p>
                        <h2 className="mt-2 text-h3">
                          <Link
                            href={`/workshops/${w.id}`}
                            className="hover:text-ignite-red"
                          >
                            {w.title}
                          </Link>
                        </h2>
                        {w.speaker_name ? (
                          <p className="mt-1 text-body text-ignite-muted">
                            with {w.speaker_name}
                          </p>
                        ) : null}
                        <p className="mt-2 text-small text-ignite-muted">
                          {w.spacesLeft > 0
                            ? `${w.spacesLeft} of ${w.capacity} places left`
                            : "Full"}
                          {" · "}
                          <Link
                            href={`/workshops/${w.id}`}
                            className="underline underline-offset-4 hover:text-ignite-red"
                          >
                            Details
                          </Link>
                        </p>
                      </div>
                      <BookingControls workshop={w} viewer={viewer} returnTo="/workshops" />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Container>
      </Section>
    </>
  );
}
