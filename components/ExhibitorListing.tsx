/* eslint-disable @next/next/no-img-element */
import { Container } from "./Container";
import { Section } from "./Section";
import { fetchExhibitorListing } from "@/lib/exhibitors/listing";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Public exhibitor strip for /exhibit. Lists every exhibitor booking
// with a successful LIVE payment automatically (no admin approval):
// company name from the booking immediately, logo and website joining
// as the exhibitor submits them. Admin-hidden listings are excluded.
// Renders NOTHING (no section at all) while there are zero exhibitors,
// same as the approval-era component.
//
// The service client is required for the bookings read (no anon RLS on
// bookings) and exposes only name/logo/website. Logos are served from
// the PUBLIC bucket only; the private bucket is never read here.
export async function ExhibitorListing() {
  let rows: Awaited<ReturnType<typeof fetchExhibitorListing>>;
  try {
    rows = await fetchExhibitorListing(createSupabaseServiceClient());
  } catch (err) {
    // A listing failure must never take /exhibit down.
    console.error("[exhibitor-listing] fetch failed:", err);
    return null;
  }
  if (rows.length === 0) return null;

  return (
    <Section tone="cream">
      <Container>
        <p className="text-eyebrow uppercase text-ignite-red">Confirmed exhibitors</p>
        <h2 className="mt-3 text-h2">Already in the room.</h2>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map((r) => {
            const tile = (
              <span className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                {r.logoUrl ? (
                  <img
                    src={r.logoUrl}
                    alt={`${r.displayName} logo`}
                    loading="lazy"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : null}
                <span className="text-small font-semibold text-ignite-ink">
                  {r.displayName}
                </span>
              </span>
            );
            return (
              <li
                key={r.bookingId}
                className="rounded-lg border border-ignite-line bg-ignite-white transition-colors hover:border-ignite-red/40"
              >
                {r.websiteUrl ? (
                  <a href={r.websiteUrl} target="_blank" rel="noreferrer" className="block h-full">
                    {tile}
                  </a>
                ) : (
                  tile
                )}
              </li>
            );
          })}
        </ul>
      </Container>
    </Section>
  );
}
