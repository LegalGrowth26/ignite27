import { Container } from "./Container";
import { Section } from "./Section";
import { Button } from "./Button";
import { BOOKINGS_OPEN_AT, BOOKINGS_CLOSE_AT } from "@/lib/pricing";

// A pre-launch-aware "book your place" call-to-action card, used on
// pages where the surrounding copy suggests booking (agenda, speakers,
// venue). Reads the launch instant from PRICING_PERIODS so it flips
// automatically at 1 Aug 09:00 UK, and again at 18 Jan 17:00 UK when
// bookings close.
//
// Behaviour, driven purely by pricing period state:
//   - now < launch open:  "Get ready." + disabled informational chip.
//                         No live booking link.
//   - launch open ≤ now < close:  the standard "Book your place" CTA.
//   - now ≥ close:  render nothing.
//
// Server component. Uses new Date() on render; pages that mount it
// already export dynamic="force-dynamic" or are rendered per request.

export function BookingCta({ tone = "cream" }: { tone?: "cream" | "light" }) {
  const now = Date.now();
  const opensMs = BOOKINGS_OPEN_AT.getTime();
  const closesMs = BOOKINGS_CLOSE_AT.getTime();

  if (now >= closesMs) return null;

  const isPreLaunch = now < opensMs;

  return (
    <Section tone={tone}>
      <Container>
        <div className="mx-auto flex max-w-2xl flex-col items-start gap-4 rounded-2xl border border-ignite-line bg-ignite-white p-8 md:flex-row md:items-center md:justify-between">
          {isPreLaunch ? (
            <>
              <div>
                <p className="text-h3 text-ignite-ink">Get ready.</p>
                <p className="mt-2 text-body text-ignite-muted">
                  Bookings open 1 August at 9am. Launch pricing is the lowest
                  price of the year, one week only, until 8 August.
                </p>
              </div>
              <span
                aria-hidden
                className="self-start rounded-full border border-ignite-line bg-ignite-cream px-4 py-2 text-small font-semibold text-ignite-muted md:self-auto"
              >
                Opens 1 Aug, 9am
              </span>
            </>
          ) : (
            <>
              <div>
                <p className="text-h3 text-ignite-ink">Ready to book?</p>
                <p className="mt-2 text-body text-ignite-muted">
                  Lock in your place at today&apos;s price.
                </p>
              </div>
              <Button
                href="/attend"
                variant="primary"
                size="md"
                className="self-start md:self-auto"
              >
                Book your place
              </Button>
            </>
          )}
        </div>
      </Container>
    </Section>
  );
}
