/* eslint-disable @next/next/no-img-element */
import { Container } from "./Container";
import { Section } from "./Section";
import { env } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";

interface ConfirmedExhibitorRow {
  id: string;
  display_name: string;
  logo_path: string | null;
  website_url: string | null;
  sort_order: number;
}

// Public "confirmed exhibitors" strip for /exhibit. Reads ONLY the
// confirmed_exhibitors table, which is populated exclusively by the
// admin approve action; renders nothing until something is approved.
// Logos come from the PUBLIC bucket; plain <img> because the host is
// remote (Supabase) and these are small pre-sized assets.
export async function ConfirmedExhibitors() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("confirmed_exhibitors")
    .select("id, display_name, logo_path, website_url, sort_order")
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });
  if (error || !data || data.length === 0) return null;

  const rows = data as ConfirmedExhibitorRow[];
  const publicBase = `${env.supabaseUrl()}/storage/v1/object/public/exhibitor-logos-public`;

  return (
    <Section tone="cream">
      <Container>
        <p className="text-eyebrow uppercase text-ignite-red">Confirmed exhibitors</p>
        <h2 className="mt-3 text-h2">Already in the room.</h2>
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {rows.map((r) => {
            const tile = (
              <span className="flex h-full flex-col items-center justify-center gap-2 p-4 text-center">
                {r.logo_path ? (
                  <img
                    src={`${publicBase}/${r.logo_path}`}
                    alt={`${r.display_name} logo`}
                    loading="lazy"
                    className="max-h-14 max-w-full object-contain"
                  />
                ) : null}
                <span className="text-small font-semibold text-ignite-ink">
                  {r.display_name}
                </span>
              </span>
            );
            return (
              <li
                key={r.id}
                className="rounded-lg border border-ignite-line bg-ignite-white transition-colors hover:border-ignite-red/40"
              >
                {r.website_url ? (
                  <a href={r.website_url} target="_blank" rel="noreferrer" className="block h-full">
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
