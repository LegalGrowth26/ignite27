/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { Container } from "./Container";
import { Section } from "./Section";
import { fetchPublishedProfileCards } from "@/lib/exhibitors/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Public exhibitor strip for /exhibit, fed by exhibitor_profiles: one
// rule for the whole site, published profile = listed. Pages are
// created automatically when a stand is paid for (webhook/backfill),
// so this shows the same set as /exhibitors; tiles link to each
// exhibitor's own page. Renders NOTHING (no section at all) while
// there are zero published profiles.
export async function ExhibitorListing() {
  let cards: Awaited<ReturnType<typeof fetchPublishedProfileCards>>;
  try {
    cards = await fetchPublishedProfileCards(createSupabaseServiceClient());
  } catch (err) {
    // A listing failure must never take /exhibit down.
    console.error("[exhibitor-listing] fetch failed:", err);
    return null;
  }
  if (cards.length === 0) return null;

  return (
    <Section tone="cream">
      <Container>
        <p className="text-eyebrow uppercase text-ignite-red">Confirmed exhibitors</p>
        <h2 className="mt-3 text-h2">Already in the room.</h2>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {cards.map((c) => (
            <li
              key={c.slug}
              className="rounded-lg border border-ignite-line bg-ignite-white transition-colors hover:border-ignite-red/40"
            >
              <Link
                href={`/exhibitors/${c.slug}`}
                className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center"
              >
                {c.logoUrl ? (
                  <img
                    src={c.logoUrl}
                    alt={`${c.displayName} logo`}
                    loading="lazy"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : null}
                <span className="text-small font-semibold text-ignite-ink">
                  {c.displayName}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-body">
          <Link
            href="/exhibitors"
            className="font-semibold text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
          >
            Meet this year&apos;s exhibitors
          </Link>
        </p>
      </Container>
    </Section>
  );
}
