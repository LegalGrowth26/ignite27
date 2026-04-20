// Test-mode date override for the booking flow.
//
// When BOOKING_TEST_OVERRIDE_DATE is set to a valid ISO 8601 date, the
// booking flow treats that instant as "now" when deciding the pricing
// window. This lets us exercise the full Stripe Checkout round-trip
// before Window 1 actually opens on 30 June 2026.
//
// The override MUST NOT affect live pricing displays on the home page,
// Attend page, or Exhibit page. Those call getCurrentPricing(new Date())
// directly. Only the booking form page and the checkout-session server
// action resolve their "now" through this module.
//
// Defence in depth: the override refuses to activate when
// NEXT_PUBLIC_ENVIRONMENT looks like production unless a second env var
// ALLOW_OVERRIDE_IN_PRODUCTION=true is also set.

export const OVERRIDE_ENV_VAR = "BOOKING_TEST_OVERRIDE_DATE";
export const ALLOW_PROD_ENV_VAR = "ALLOW_OVERRIDE_IN_PRODUCTION";

export class BookingOverrideConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BookingOverrideConfigError";
  }
}

function looksLikeProduction(): boolean {
  const raw = (process.env.NEXT_PUBLIC_ENVIRONMENT ?? "").toLowerCase().trim();
  return raw === "production" || raw === "prod";
}

function allowInProduction(): boolean {
  return (process.env[ALLOW_PROD_ENV_VAR] ?? "").toLowerCase().trim() === "true";
}

// Returns the parsed override Date if the env var is set and permitted.
// Returns null if the env var is absent. Throws on misconfiguration: a
// production environment without the allow flag, or an unparseable date.
export function getBookingOverrideDate(): Date | null {
  const raw = process.env[OVERRIDE_ENV_VAR];
  if (!raw || raw.trim().length === 0) return null;

  if (looksLikeProduction() && !allowInProduction()) {
    throw new BookingOverrideConfigError(
      `${OVERRIDE_ENV_VAR} is set in a production environment but ${ALLOW_PROD_ENV_VAR} is not 'true'. Refusing to activate the test-date override. Either unset ${OVERRIDE_ENV_VAR} or set ${ALLOW_PROD_ENV_VAR}=true (not recommended in real production).`,
    );
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new BookingOverrideConfigError(
      `${OVERRIDE_ENV_VAR} is not a valid ISO 8601 date: ${raw}`,
    );
  }
  return parsed;
}

// Returns the instant the booking flow should treat as "now". Prefers the
// configured override; otherwise returns the real current wall-clock time.
export function resolveBookingNow(): Date {
  return getBookingOverrideDate() ?? new Date();
}

// Returns the raw override string so the banner can show it verbatim. We
// return the raw string (not a reformatted date) so the operator sees
// exactly what they configured.
export function getBookingOverrideRaw(): string | null {
  const raw = process.env[OVERRIDE_ENV_VAR];
  if (!raw || raw.trim().length === 0) return null;
  // Validate parse; if invalid, let the page surface the error instead of
  // silently hiding the banner.
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return raw;
}
