"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { createCheckoutSessionAction } from "@/app/attend/book/actions";
import {
  DIETARY_REQUIREMENTS,
  type DelegateTicketType,
  type DietaryRequirement,
  type IntentFieldError,
} from "@/lib/bookings/intent";
import { formatExVatWithGross, formatPoundsFromPence } from "@/lib/pricing";
import { Button } from "./Button";

interface BookingFormProps {
  ticketType: DelegateTicketType;
  ticketExVatPence: number;
  ticketIncVatPence: number;
  lunchAddOnExVatPence: number;
  lunchAddOnIncVatPence: number;
  periodLabel: string;
}

const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  none: "No requirement",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_allergy: "Nut allergy",
  other: "Other",
};

function fieldErrorFor(
  errors: IntentFieldError[],
  field: IntentFieldError["field"],
): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink placeholder:text-ignite-muted/70 focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";
const ERR = "mt-1 text-small text-ignite-red";
const REQ = "text-ignite-red";

export function BookingForm({
  ticketType,
  ticketExVatPence,
  ticketIncVatPence,
  lunchAddOnExVatPence,
  lunchAddOnIncVatPence,
  periodLabel,
}: BookingFormProps) {
  const [lunchIncluded, setLunchIncluded] = useState(false);
  const [dietary, setDietary] = useState<DietaryRequirement>("none");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<IntentFieldError[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const includeLunch = ticketType === "regular" && lunchIncluded;
  const lunchExVatPence = includeLunch ? lunchAddOnExVatPence : 0;
  const lunchIncVatPence = includeLunch ? lunchAddOnIncVatPence : 0;
  const totalExVatPence = ticketExVatPence + lunchExVatPence;
  const totalIncVatPence = ticketIncVatPence + lunchIncVatPence;

  const ticketLabel = ticketType === "vip" ? "VIP" : "Regular";
  const lunchLabel = formatPoundsFromPence(lunchAddOnIncVatPence);
  const lunchSummary = useMemo(() => {
    if (ticketType === "vip") return "Lunch included.";
    return lunchIncluded
      ? `Lunch added, ${lunchLabel}.`
      : `No lunch. Add for ${lunchLabel}.`;
  }, [ticketType, lunchIncluded, lunchLabel]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isPending) return;

    const form = event.currentTarget;
    const fd = new FormData(form);
    const input: Record<string, unknown> = {
      ticketType,
      lunchIncluded:
        ticketType === "vip" ? true : fd.get("lunchIncluded") === "on",
      firstName: fd.get("firstName"),
      surname: fd.get("surname"),
      email: fd.get("email"),
      mobile: fd.get("mobile"),
      company: fd.get("company"),
      jobTitle: fd.get("jobTitle"),
      dietaryRequirement: fd.get("dietaryRequirement"),
      dietaryOther: fd.get("dietaryOther") ?? "",
      badgeQrUrl: fd.get("badgeQrUrl") ?? "",
      marketingOptIn: fd.get("marketingOptIn") === "on",
      termsAccepted: fd.get("termsAccepted") === "on",
    };

    setIsSubmitting(true);
    setErrors([]);
    startTransition(async () => {
      const result = await createCheckoutSessionAction(input);
      if (result.ok) {
        window.location.href = result.url;
        // Leave isSubmitting true so the button stays disabled while
        // the browser navigates.
        return;
      }
      setErrors(result.errors);
      setIsSubmitting(false);
    });
  }

  const formError = fieldErrorFor(errors, "form");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <input type="hidden" name="ticketType" value={ticketType} />

      <div
        className={
          ticketType === "vip"
            ? "rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-5"
            : "rounded-2xl border border-ignite-line bg-ignite-cream p-5"
        }
      >
        <div className="flex items-center gap-2">
          <p className="text-eyebrow uppercase text-ignite-red">{periodLabel}</p>
          {ticketType === "vip" ? (
            <span className="rounded-full bg-ignite-red px-2 py-0.5 text-eyebrow uppercase text-ignite-white">
              VIP
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-h3">{ticketLabel} ticket</p>
        <p className="mt-1 text-small text-ignite-muted">{lunchSummary}</p>
        {ticketType === "vip" ? (
          <ul className="mt-3 space-y-1 text-small text-ignite-ink">
            <li>• Lunch included, with first access</li>
            <li>• Priority seating at the front</li>
            <li>• Special VIP lanyard</li>
          </ul>
        ) : null}
        <p className="mt-3 text-h2">{formatExVatWithGross(totalExVatPence, totalIncVatPence)}</p>
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="sr-only">Your details</legend>
        <div>
          <label htmlFor="firstName" className={LABEL}>
            First name <span className={REQ}>*</span>
          </label>
          <input id="firstName" name="firstName" className={INPUT} autoComplete="given-name" />
          {fieldErrorFor(errors, "firstName") ? (
            <p className={ERR}>{fieldErrorFor(errors, "firstName")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="surname" className={LABEL}>
            Surname <span className={REQ}>*</span>
          </label>
          <input id="surname" name="surname" className={INPUT} autoComplete="family-name" />
          {fieldErrorFor(errors, "surname") ? (
            <p className={ERR}>{fieldErrorFor(errors, "surname")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="email" className={LABEL}>
            Email <span className={REQ}>*</span>
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className={INPUT}
            autoComplete="email"
            inputMode="email"
          />
          <p className={HELP}>We send your ticket and receipt here.</p>
          {fieldErrorFor(errors, "email") ? (
            <p className={ERR}>{fieldErrorFor(errors, "email")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="mobile" className={LABEL}>
            Mobile <span className={REQ}>*</span>
          </label>
          <input
            id="mobile"
            name="mobile"
            type="tel"
            className={INPUT}
            autoComplete="tel"
            inputMode="tel"
          />
          {fieldErrorFor(errors, "mobile") ? (
            <p className={ERR}>{fieldErrorFor(errors, "mobile")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="company" className={LABEL}>
            Company <span className={REQ}>*</span>
          </label>
          <input
            id="company"
            name="company"
            className={INPUT}
            autoComplete="organization"
          />
          {fieldErrorFor(errors, "company") ? (
            <p className={ERR}>{fieldErrorFor(errors, "company")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="jobTitle" className={LABEL}>
            Job title <span className={REQ}>*</span>
          </label>
          <input
            id="jobTitle"
            name="jobTitle"
            className={INPUT}
            autoComplete="organization-title"
          />
          {fieldErrorFor(errors, "jobTitle") ? (
            <p className={ERR}>{fieldErrorFor(errors, "jobTitle")}</p>
          ) : null}
        </div>
      </fieldset>

      <div>
        <label htmlFor="dietaryRequirement" className={LABEL}>
          Dietary requirement <span className={REQ}>*</span>
        </label>
        <select
          id="dietaryRequirement"
          name="dietaryRequirement"
          value={dietary}
          onChange={(e) => setDietary(e.target.value as DietaryRequirement)}
          className={INPUT}
        >
          {DIETARY_REQUIREMENTS.map((d) => (
            <option key={d} value={d}>
              {DIETARY_LABELS[d]}
            </option>
          ))}
        </select>
        {fieldErrorFor(errors, "dietaryRequirement") ? (
          <p className={ERR}>{fieldErrorFor(errors, "dietaryRequirement")}</p>
        ) : null}
        {dietary === "other" ? (
          <div className="mt-3">
            <label htmlFor="dietaryOther" className={LABEL}>
              What should we cater for? <span className={REQ}>*</span>
            </label>
            <input id="dietaryOther" name="dietaryOther" className={INPUT} />
            {fieldErrorFor(errors, "dietaryOther") ? (
              <p className={ERR}>{fieldErrorFor(errors, "dietaryOther")}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div>
        <label htmlFor="badgeQrUrl" className={LABEL}>
          LinkedIn or website for your badge QR (optional)
        </label>
        <input
          id="badgeQrUrl"
          name="badgeQrUrl"
          className={INPUT}
          inputMode="url"
          placeholder="https://"
        />
        <p className={HELP}>
          If you want a QR on your badge, paste a link. Leave blank and your badge has no QR.
        </p>
        {fieldErrorFor(errors, "badgeQrUrl") ? (
          <p className={ERR}>{fieldErrorFor(errors, "badgeQrUrl")}</p>
        ) : null}
      </div>

      {ticketType === "regular" ? (
        <label className="flex items-start gap-3 rounded-2xl border border-ignite-line p-4 cursor-pointer">
          <input
            type="checkbox"
            name="lunchIncluded"
            checked={lunchIncluded}
            onChange={(e) => setLunchIncluded(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span>
            <span className="block text-body font-semibold text-ignite-ink">
              Add lunch for {lunchLabel}
            </span>
            <span className="block text-small text-ignite-muted">
              Hot lunch on the day, dietary options catered for.
            </span>
          </span>
        </label>
      ) : (
        <div className="rounded-2xl border border-ignite-line bg-ignite-cream p-4">
          <p className="text-body font-semibold text-ignite-ink">Lunch included</p>
          <p className="text-small text-ignite-muted">
            VIP tickets always include lunch.
          </p>
        </div>
      )}

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="marketingOptIn"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-muted">
          Send me occasional updates about Ignite. We do not share your email.
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="termsAccepted"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-ink">
          I accept the{" "}
          <Link
            href="/refund-policy"
            className="underline underline-offset-4 hover:text-ignite-red"
          >
            Refund policy
          </Link>
          . <span className={REQ}>*</span>
        </span>
      </label>
      {fieldErrorFor(errors, "termsAccepted") ? (
        <p className={ERR}>{fieldErrorFor(errors, "termsAccepted")}</p>
      ) : null}

      {formError ? (
        <div className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-4 text-small text-ignite-red">
          {formError}
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button
          variant="primary"
          size="lg"
          type="submit"
          disabled={isSubmitting || isPending}
          aria-label={`Continue to payment, total ${formatExVatWithGross(totalExVatPence, totalIncVatPence)}`}
        >
          {isSubmitting || isPending
            ? "Redirecting to payment..."
            : `Continue to payment (${formatExVatWithGross(totalExVatPence, totalIncVatPence)})`}
        </Button>
        <span className="text-small text-ignite-muted">
          Secure card payment via Stripe. VAT is added at checkout.
        </span>
      </div>
    </form>
  );
}
