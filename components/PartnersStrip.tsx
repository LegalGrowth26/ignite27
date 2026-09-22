/* eslint-disable @next/next/no-img-element */
import { Button } from "./Button";
import { Container } from "./Container";
import { Section } from "./Section";
import { env } from "@/lib/env";
import {
  buildPartnersStrip,
  PARTNER_TIER_META,
  type StripSourceRow,
} from "@/lib/partners/validate";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

// Public partners strip (home + /exhibit): agreed AND paid partners
// while admin-visible, ended never. Headline Partners get their own
// row with bigger tiles (approved); everyone links straight to their
// own website (followable) — no partner pages in v1.
//
// Service client because partners has no anon read (the row carries
// contact details and the agreed price); only name/tier/logo/website
// are selected here. With zero partners the strip renders the
// become-a-partner callout on home, and nothing on /exhibit (the
// PartnerPackage block is right there).

function logoUrl(logoPath: string): string {
  return `${env.supabaseUrl()}/storage/v1/object/public/partner-logos/${logoPath}`;
}

function PartnerTile({
  partner,
  large,
}: {
  partner: StripSourceRow;
  large: boolean;
}) {
  const tile = (
    <span
      className={`flex h-full flex-col items-center justify-center gap-2 text-center ${
        large ? "p-8" : "p-4"
      }`}
    >
      {partner.logo_path ? (
        <img
          src={logoUrl(partner.logo_path)}
          alt={`${partner.company_name} logo`}
          loading="lazy"
          className={`${large ? "max-h-20" : "max-h-12"} max-w-full object-contain`}
        />
      ) : null}
      <span
        className={`font-semibold text-ignite-ink ${large ? "text-h3" : "text-small"}`}
      >
        {partner.company_name}
      </span>
      <span className="text-eyebrow uppercase text-ignite-red">
        {PARTNER_TIER_META[partner.tier].label}
      </span>
    </span>
  );

  return (
    <li
      className={`rounded-2xl border bg-ignite-white transition-colors hover:border-ignite-red/40 ${
        large ? "border-2 border-ignite-red/60" : "border-ignite-line"
      }`}
    >
      {partner.website_url ? (
        <a href={partner.website_url} target="_blank" className="block h-full">
          {tile}
        </a>
      ) : (
        tile
      )}
    </li>
  );
}

export async function PartnersStrip({
  emptyFallback = "none",
}: {
  emptyFallback?: "callout" | "none";
}) {
  let partners: StripSourceRow[] = [];
  try {
    const { data, error } = await createSupabaseServiceClient()
      .from("partners")
      .select("id, company_name, tier, status, visible, website_url, logo_path");
    if (error) throw new Error(error.message);
    partners = buildPartnersStrip((data ?? []) as unknown as StripSourceRow[]);
  } catch (err) {
    // A partners failure must never take the page down.
    console.error("[partners-strip] fetch failed:", err);
  }

  if (partners.length === 0) {
    if (emptyFallback === "none") return null;
    return (
      <Section tone="cream">
        <Container>
          <p className="text-eyebrow uppercase text-ignite-red">Partners</p>
          <h2 className="mt-3 text-h2">Partner IGNITE! 27.</h2>
          <p className="mt-3 max-w-2xl text-body text-ignite-muted">
            Your logo on everything, plus your own stand. Partner line-up
            announced once confirmed.
          </p>
          <div className="mt-8">
            <Button href="/exhibit#partner" variant="secondary" size="md">
              Become a partner
            </Button>
          </div>
        </Container>
      </Section>
    );
  }

  const headline = partners.filter((p) => p.tier === "headline");
  const rest = partners.filter((p) => p.tier !== "headline");

  return (
    <Section tone="cream">
      <Container>
        <p className="text-eyebrow uppercase text-ignite-red">Partners</p>
        <h2 className="mt-3 text-h2">The businesses behind the day.</h2>
        {headline.length > 0 ? (
          <ul
            className={`mt-8 grid gap-4 ${
              headline.length === 1 ? "sm:max-w-md" : "sm:grid-cols-2"
            }`}
          >
            {headline.map((p) => (
              <PartnerTile key={p.id} partner={p} large />
            ))}
          </ul>
        ) : null}
        {rest.length > 0 ? (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {rest.map((p) => (
              <PartnerTile key={p.id} partner={p} large={false} />
            ))}
          </ul>
        ) : null}
        <p className="mt-8 text-small text-ignite-muted">
          Want your business here?{" "}
          <a
            href="/exhibit#partner"
            className="font-semibold text-ignite-red underline underline-offset-4"
          >
            Partner IGNITE! 27
          </a>
        </p>
      </Container>
    </Section>
  );
}
