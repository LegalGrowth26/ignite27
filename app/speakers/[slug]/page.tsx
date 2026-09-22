/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SOCIAL_PLATFORM_LABELS } from "@/lib/exhibitors/profile";
import { fetchPublishedSpeakerBySlug } from "@/lib/speakers/queries";
import { createSupabaseServiceClient } from "@/lib/supabase/service-client";
import { sendSpeakerMessageAction } from "./actions";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ contact?: string; contact_error?: string }>;
}

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";

async function loadSpeaker(slug: string) {
  if (!/^[a-z0-9][a-z0-9-]{1,49}$/.test(slug)) return null;
  try {
    return await fetchPublishedSpeakerBySlug(createSupabaseServiceClient(), slug);
  } catch (err) {
    console.error("[speaker-page] fetch failed:", err);
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const speaker = await loadSpeaker(slug);
  if (!speaker) return { title: "Speaker not found · IGNITE! 27" };
  return {
    title: `${speaker.displayName} at IGNITE! 27`,
    description:
      speaker.talkTitle
        ? `${speaker.displayName} is speaking at IGNITE! 27: ${speaker.talkTitle}. Thursday 21 January 2027 at Kelham Hall, Newark.`
        : `${speaker.displayName} is speaking at IGNITE! 27 on Thursday 21 January 2027 at Kelham Hall, Newark.`,
  };
}

export default async function SpeakerPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { contact, contact_error: contactError } = await searchParams;
  const speaker = await loadSpeaker(slug);
  if (!speaker) notFound();

  const bioParagraphs = speaker.bio
    .split(/\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const talkParagraphs = speaker.talkDescription
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
          <p className="text-eyebrow uppercase text-ignite-red">Speaking at IGNITE! 27</p>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            {speaker.photoUrl ? (
              <img
                src={speaker.photoUrl}
                alt={`Portrait of ${speaker.displayName}`}
                className="h-28 w-28 rounded-2xl object-cover sm:h-36 sm:w-36"
              />
            ) : null}
            <div>
              <h1 className="text-h1">{speaker.displayName}</h1>
              {speaker.talkTitle ? (
                <p className="mt-2 max-w-2xl text-lead text-white/80">{speaker.talkTitle}</p>
              ) : null}
            </div>
          </div>
        </Container>
      </section>

      <Section tone="light">
        <Container>
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              {talkParagraphs.length > 0 || speaker.talkTakeaways.length > 0 ? (
                <div>
                  <h2 className="text-h2">The session.</h2>
                  {talkParagraphs.map((p, i) => (
                    <p key={i} className="mt-4 text-body text-ignite-ink">
                      {p}
                    </p>
                  ))}
                  {speaker.talkTakeaways.length > 0 ? (
                    <>
                      <h3 className="mt-6 text-h3">What you&apos;ll learn</h3>
                      <ul className="mt-3 grid gap-2">
                        {speaker.talkTakeaways.map((t) => (
                          <li key={t} className="flex gap-3 text-body text-ignite-ink">
                            <span aria-hidden className="mt-1 text-ignite-red">
                              →
                            </span>
                            {t}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </div>
              ) : null}

              {bioParagraphs.length > 0 ? (
                <div className="mt-10">
                  <h2 className="text-h2">About {speaker.displayName.split(" ")[0]}.</h2>
                  {bioParagraphs.map((p, i) => (
                    <p key={i} className="mt-4 text-body text-ignite-ink">
                      {p}
                    </p>
                  ))}
                </div>
              ) : null}

              {talkParagraphs.length === 0 &&
              bioParagraphs.length === 0 &&
              speaker.talkTakeaways.length === 0 ? (
                <p className="text-body text-ignite-muted">
                  Full session details are on their way. Watch this space.
                </p>
              ) : null}

              {speaker.cta ? (
                <p className="mt-8">
                  <a
                    href={speaker.cta.url}
                    target="_blank"
                    rel="noopener"
                    className="inline-flex items-center justify-center rounded-xl bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white transition-colors hover:bg-ignite-red/90"
                  >
                    {speaker.cta.label}
                  </a>
                </p>
              ) : null}
            </div>

            <aside className="md:col-span-5">
              <div className="rounded-2xl border border-ignite-line bg-ignite-white p-6">
                <h2 className="text-h3">Find {speaker.displayName.split(" ")[0]} online</h2>
                <dl className="mt-4 grid gap-4 text-body">
                  {speaker.websiteUrl ? (
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Website</dt>
                      <dd className="mt-1 break-all">
                        <a
                          href={speaker.websiteUrl}
                          className="text-ignite-ink underline underline-offset-4 hover:text-ignite-red"
                        >
                          {speaker.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                        </a>
                      </dd>
                    </div>
                  ) : null}
                  {speaker.socialLinks.length > 0 ? (
                    <div>
                      <dt className="text-eyebrow uppercase text-ignite-muted">Social</dt>
                      <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                        {speaker.socialLinks.map((link) => (
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
                  {!speaker.websiteUrl && speaker.socialLinks.length === 0 ? (
                    <p className="text-body text-ignite-muted">
                      Links coming soon. Catch them at the event.
                    </p>
                  ) : null}
                </dl>
              </div>

              <div
                id="contact"
                className="mt-6 scroll-mt-24 rounded-2xl border border-ignite-line bg-ignite-white p-6"
              >
                <h2 className="text-h3">Get in touch with {speaker.displayName.split(" ")[0]}</h2>
                <p className="mt-2 text-small text-ignite-muted">
                  Goes straight to their inbox; they reply to you directly.
                </p>

                {contact === "sent" ? (
                  <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
                    Sent. If they want to talk, the reply lands in your inbox.
                  </p>
                ) : (
                  <form
                    action={sendSpeakerMessageAction.bind(null, speaker.slug)}
                    className="mt-4 flex flex-col gap-3"
                  >
                    {contactError ? (
                      <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
                        {contactError}
                      </p>
                    ) : null}
                    <div>
                      <label htmlFor="senderName" className={LABEL}>
                        Your name <span className="text-ignite-red">*</span>
                      </label>
                      <input id="senderName" name="senderName" required maxLength={100} className={INPUT} />
                    </div>
                    <div>
                      <label htmlFor="senderEmail" className={LABEL}>
                        Your email <span className="text-ignite-red">*</span>
                      </label>
                      <input
                        id="senderEmail"
                        name="senderEmail"
                        type="email"
                        required
                        maxLength={200}
                        className={INPUT}
                      />
                    </div>
                    {/* Honeypot: hidden from people, irresistible to bots. */}
                    <div className="hidden" aria-hidden="true">
                      <label htmlFor="company">Company</label>
                      <input id="company" name="company" tabIndex={-1} autoComplete="off" />
                    </div>
                    <div>
                      <label htmlFor="message" className={LABEL}>
                        Message <span className="text-ignite-red">*</span>
                      </label>
                      <textarea
                        id="message"
                        name="message"
                        required
                        minLength={10}
                        maxLength={2000}
                        rows={5}
                        className={INPUT}
                      />
                    </div>
                    <div>
                      <button
                        type="submit"
                        className="rounded-full bg-ignite-red px-6 py-3 text-body font-semibold text-ignite-white hover:bg-ignite-red/90"
                      >
                        Send message
                      </button>
                    </div>
                  </form>
                )}
              </div>

              <p className="mt-6 text-small text-ignite-muted">
                <Link
                  href="/speakers"
                  className="underline underline-offset-4 hover:text-ignite-red"
                >
                  See all IGNITE! 27 speakers
                </Link>
              </p>
            </aside>
          </div>
        </Container>
      </Section>
    </>
  );
}
