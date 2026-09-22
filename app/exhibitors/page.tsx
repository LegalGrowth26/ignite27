/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SectionHeader } from "@/components/SectionHeader";
import { fetchPublishedProfileCards } from "@/lib/exhibitors/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Exhibitors · IGNITE! 27",
  description:
    "Meet the businesses exhibiting at IGNITE! 27. Thursday 21 January 2027 at Kelham Hall, Newark.",
};

// Public index of every published exhibitor profile page. Fed by
// exhibitor_profiles only: a paid stand creates a page automatically,
// admin unpublish removes it from here and from /exhibitors/<slug> in
// one move.
export default async function ExhibitorsIndexPage() {
  let cards: Awaited<ReturnType<typeof fetchPublishedProfileCards>> = [];
  let failed = false;
  try {
    cards = await fetchPublishedProfileCards(createSupabaseServiceClient());
  } catch (err) {
    console.error("[exhibitors-index] fetch failed:", err);
    failed = true;
  }

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
            <p className="text-eyebrow uppercase text-ignite-red">IGNITE! 27 exhibitors</p>
            <h1 className="mt-5 text-h1">The businesses in the room.</h1>
            <p className="mt-5 max-w-2xl text-lead text-white/80">
              Every stand at IGNITE! 27, in one place. Have a look before the day and know
              exactly who you want to talk to.
            </p>
          </div>
        </Container>
      </section>

      <Section tone="light">
        <Container>
          {failed ? (
            <p className="text-body text-ignite-muted">
              The exhibitor list is having a moment. Try again shortly.
            </p>
          ) : cards.length === 0 ? (
            <div>
              <SectionHeader
                eyebrow="Coming soon"
                heading="Exhibitors are signing up now."
                lede="Stands are selling and pages appear here as each booking lands. Check back soon, or grab a stand and join them."
              />
              <p className="mt-8">
                <Link
                  href="/exhibit"
                  className="inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                >
                  Exhibit at IGNITE! 27
                </Link>
              </p>
            </div>
          ) : (
            <>
              <SectionHeader
                eyebrow="Confirmed"
                heading={`${cards.length} ${cards.length === 1 ? "exhibitor" : "exhibitors"} confirmed so far.`}
                lede="Tap any exhibitor to see what they do and how to find them on the day."
              />
              <ul className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {cards.map((c) => (
                  <li
                    key={c.slug}
                    className="rounded-2xl border border-ignite-line bg-ignite-white transition-colors hover:border-ignite-red/40"
                  >
                    <Link
                      href={`/exhibitors/${c.slug}`}
                      className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
                    >
                      {c.logoUrl ? (
                        <img
                          src={c.logoUrl}
                          alt={`${c.displayName} logo`}
                          loading="lazy"
                          className="max-h-16 max-w-full object-contain"
                        />
                      ) : null}
                      <span className="text-body font-semibold text-ignite-ink">
                        {c.displayName}
                      </span>
                    </Link>
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
