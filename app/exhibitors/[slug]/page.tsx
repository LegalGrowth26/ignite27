/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/exhibitors/profile";
import { fetchPublishedProfileBySlug } from "@/lib/exhibitors/profiles";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
}

// SEO is a headline feature of these pages: indexed, and the website
// link below is a plain followable anchor (no nofollow), which is part
// of what an exhibitor gets for their stand.
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) return { title: "Exhibitor not found · IGNITE! 27" };
  return {
    title: `${profile.displayName} at IGNITE! 27`,
    description:
      profile.description?.slice(0, 160) ??
      `${profile.displayName} is exhibiting at IGNITE! 27 on Thursday 21 January 2027 at Kelham Hall, Newark.`,
  };
}

async function loadProfile(slug: string) {
  // Slugs are validated at mint time; refuse anything shaped wrong
  // before it reaches a query.
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(slug)) return null;
  try {
    return await fetchPublishedProfileBySlug(createSupabaseServiceClient(), slug);
  } catch (err) {
    console.error("[exhibitor-page] fetch failed:", err);
    return null;
  }
}

export default async function ExhibitorProfilePage({ params }: PageProps) {
  const { slug } = await params;
  const profile = await loadProfile(slug);
  if (!profile) notFound();

  const paragraphs = (profile.description ?? "")
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

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
          <p className="text-eyebrow uppercase text-ignite-red">Exhibiting at IGNITE! 27</p>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            {profile.logoUrl ? (
              <span className="inline-flex rounded-2xl bg-ignite-white p-4">
                <img
                  src={profile.logoUrl}
                  alt={`${profile.displayName} logo`}
                  className="max-h-20 max-w-[200px] object-contain"
                />
              </span>
            ) : null}
            <h1 className="text-h1">{profile.displayName}</h1>
          </div>
          <p className="mt-5 max-w-2xl text-lead text-white/80">
            Find {profile.displayName} at IGNITE! 27 on Thursday 21 January 2027 at Kelham
            Hall, Newark.
          </p>
        </Container>
      </section>

      <Section tone="light">
        <Container>
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              {paragraphs.length > 0 ? (
                paragraphs.map((p, i) => (
                  <p key={i} className={`text-body text-ignite-ink ${i > 0 ? "mt-4" : ""}`}>
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-body text-ignite-muted">
                  {profile.displayName} will share more about what they do here soon. In the
                  meantime, come and say hello at their stand on the day.
                </p>
              )}

              {profile.ctas.length > 0 ? (
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:gap-4">
                  {profile.ctas.map((cta, i) => (
                    <a
                      key={cta.url}
                      href={cta.url}
                      target="_blank"
                      rel="noopener"
                      className={
                        i === 0
                          ? "inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                          : "inline-flex items-center justify-center rounded-xl border border-ignite-line bg-ignite-white px-6 py-3 text-body font-semibold text-ignite-ink transition-colors hover:border-ignite-red"
                      }
                    >
                      {cta.label}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <aside className="md:col-span-5">
              <div className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
                <h2 className="text-h3">Get in touch</h2>
                <dl className="mt-4 grid gap-4 text-body">
                  {profile.websiteUrl ? (
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Website</dt>
                      <dd className="mt-1 break-all">
                        {/* Followable backlink, on purpose. */}
                        <a
                          href={profile.websiteUrl}
                          className="text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                        >
                          {profile.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {profile.contactEmail ? (
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Email</dt>
                      <dd className="mt-1 break-all">
                        <a
                          href={`mailto:${profile.contactEmail}`}
                          className="text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                        >
                          {profile.contactEmail}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {profile.socialLinks.length > 0 ? (
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Social</dt>
                      <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                        {profile.socialLinks.map((link) => (
                          <a
                            key={link.platform}
                            href={link.url}
                            target="_blank"
                            rel="noopener"
                            className="text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                          >
                            {SOCIAL_PLATFORM_LABELS[link.platform]}
                          </a>
                        ))}
                      </dd>
                    </div>
                  ) : null}
                  {!profile.websiteUrl && !profile.contactEmail && profile.socialLinks.length === 0 ? (
                    <p className="text-body text-ignite-muted">
                      Contact details coming soon. Find them at their stand on the day.
                    </p>
                  ) : null}
                </dl>
              </div>

              <p className="mt-6 text-small text-ignite-muted">
                <Link
                  href="/exhibitors"
                  className="underline underline-offset-4 hover:text-ignite-red"
                >
                  See all IGNITE! 27 exhibitors
                </Link>
              </p>
            </aside>
          </div>
        </Container>
      </Section>

      <Section tone="cream">
        <Container>
          <div className="rounded-3xl border border-ignite-line bg-ignite-white p-8 md:p-12">
            <div className="grid gap-6 md:grid-cols-12 md:items-center">
              <div className="md:col-span-8">
                <p className="text-eyebrow uppercase text-ignite-red">Join them</p>
                <p className="mt-3 text-h2">Want your business on this list?</p>
                <p className="mt-3 text-body text-ignite-muted">
                  Every exhibitor stand comes with a page like this one, two attendee places,
                  and two lunches.
                </p>
              </div>
              <div className="md:col-span-4 md:justify-self-end">
                <Link
                  href="/exhibit"
                  className="inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                >
                  Exhibit at IGNITE! 27
                </Link>
              </div>
            </div>
          </div>
        </Container>
      </Section>
    </>
  );
}
