"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { createExhibitorCheckoutSessionAction } from "@/app/exhibit/book/actions";
import {
  DIETARY_REQUIREMENTS,
  type DietaryRequirement,
} from "@/lib/bookings/intent";
import type { ExhibitorIntentFieldError } from "@/lib/bookings/exhibitor-intent";
import { formatExVatWithGross } from "@/lib/pricing";
import { Button } from "./Button";

interface ExhibitorBookingFormProps {
  standExVatPence: number;
  standIncVatPence: number;
  periodLabel: string;
  standsRemaining: number;
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

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink placeholder:text-ignite-muted/70 focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";
const ERR = "mt-1 text-small text-ignite-red";
const REQ = "text-ignite-red";

function errorFor(errors: ExhibitorIntentFieldError[], field: string): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}

// One attendee's dietary controls. Exhibitor bookings always include 2
// lunches, so dietary always renders for both attendees (the exhibitor
// equivalent of the delegate VIP branch of the lunch rule).
function DietaryFields({
  prefix,
  errors,
}: {
  prefix: "attendee1" | "attendee2";
  errors: ExhibitorIntentFieldError[];
}) {
  const [dietary, setDietary] = useState<DietaryRequirement>("none");
  return (
    <div>
      <label htmlFor={`${prefix}-dietary`} className={LABEL}>
        Dietary requirement <span className={REQ}>*</span>
      </label>
      <select
        id={`${prefix}-dietary`}
        name={`${prefix}.dietaryRequirement`}
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
      {errorFor(errors, `${prefix}.dietaryRequirement`) ? (
        <p className={ERR}>{errorFor(errors, `${prefix}.dietaryRequirement`)}</p>
      ) : null}
      {dietary === "other" ? (
        <div className="mt-3">
          <label htmlFor={`${prefix}-dietary-other`} className={LABEL}>
            What should we cater for? <span className={REQ}>*</span>
          </label>
          <input
            id={`${prefix}-dietary-other`}
            name={`${prefix}.dietaryOther`}
            className={INPUT}
          />
          {errorFor(errors, `${prefix}.dietaryOther`) ? (
            <p className={ERR}>{errorFor(errors, `${prefix}.dietaryOther`)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TextField({
  id,
  name,
  label,
  errors,
  required = true,
  help,
  type = "text",
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  errors: ExhibitorIntentFieldError[];
  required?: boolean;
  help?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label} {required ? <span className={REQ}>*</span> : <span className="text-ignite-muted">(optional)</span>}
      </label>
      <input id={id} name={name} type={type} className={INPUT} autoComplete={autoComplete} />
      {help ? <p className={HELP}>{help}</p> : null}
      {errorFor(errors, name) ? <p className={ERR}>{errorFor(errors, name)}</p> : null}
    </div>
  );
}

export function ExhibitorBookingForm({
  standExVatPence,
  standIncVatPence,
  periodLabel,
  standsRemaining,
}: ExhibitorBookingFormProps) {
  const [sameAsContact, setSameAsContact] = useState(true);
  // "Name TBC": exhibitors often don't know who is coming at booking
  // time. A ticked slot books the place with the name to be confirmed
  // later; no identity or dietary fields render for it.
  const [a1Tbc, setA1Tbc] = useState(false);
  const [a2Tbc, setA2Tbc] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [errors, setErrors] = useState<ExhibitorIntentFieldError[]>([]);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const priceLabel = formatExVatWithGross(standExVatPence, standIncVatPence);

  function attendeeFromForm(fd: FormData, prefix: "attendee1" | "attendee2", tbc: boolean) {
    if (tbc) return { tbc: true };
    return {
      tbc: false,
      firstName: fd.get(`${prefix}.firstName`),
      surname: fd.get(`${prefix}.surname`),
      email: fd.get(`${prefix}.email`),
      mobile: fd.get(`${prefix}.mobile`) ?? "",
      jobTitle: fd.get(`${prefix}.jobTitle`),
      dietaryRequirement: fd.get(`${prefix}.dietaryRequirement`) ?? "none",
      dietaryOther: fd.get(`${prefix}.dietaryOther`) ?? "",
    };
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || isPending) return;

    const fd = new FormData(event.currentTarget);
    const attendee1 = attendeeFromForm(fd, "attendee1", a1Tbc);
    if (!a1Tbc && sameAsContact) {
      // Attendee 1's identity fields mirror the main contact; their job
      // title and dietary are still their own (collected above).
      attendee1.firstName = fd.get("contactFirstName");
      attendee1.surname = fd.get("contactSurname");
      attendee1.email = fd.get("contactEmail");
      attendee1.mobile = fd.get("contactMobile") ?? "";
    }

    const input: Record<string, unknown> = {
      company: fd.get("company"),
      website: fd.get("website") ?? "",
      contactFirstName: fd.get("contactFirstName"),
      contactSurname: fd.get("contactSurname"),
      contactEmail: fd.get("contactEmail"),
      contactMobile: fd.get("contactMobile"),
      attendee1,
      attendee2: attendeeFromForm(fd, "attendee2", a2Tbc),
      marketingOptIn: fd.get("marketingOptIn") === "on",
      termsAccepted: fd.get("termsAccepted") === "on",
    };

    setIsSubmitting(true);
    setErrors([]);
    startTransition(async () => {
      const result = await createExhibitorCheckoutSessionAction(input);
      if (result.ok) {
        window.location.href = result.url;
        return;
      }
      setErrors(result.errors);
      setIsSubmitting(false);
    });
  }

  const formError = errorFor(errors, "form");
  // When attendee-1 identity fields are hidden (same as contact), their
  // validation errors land on fields that are not rendered; surface them
  // against the contact block instead so nothing fails invisibly.
  const hiddenAttendee1Error = !a1Tbc && sameAsContact
    ? ["attendee1.firstName", "attendee1.surname", "attendee1.email", "attendee1.mobile"]
        .map((f) => errorFor(errors, f))
        .find(Boolean)
    : undefined;

  const tbcNote =
    "Their place is booked and lunch is included. Tell us who is coming nearer the event and we'll add their name and dietary needs.";

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <div className="rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-5">
        <p className="text-eyebrow uppercase text-ignite-red">{periodLabel}</p>
        <p className="mt-2 text-h3">Exhibitor stand</p>
        <ul className="mt-3 space-y-1 text-small text-ignite-ink">
          <li>• 1 exhibitor space, for one business, for the whole day</li>
          <li>• 2 attendee places</li>
          <li>• 2 lunches</li>
        </ul>
        <p className="mt-3 text-h2">{priceLabel}</p>
        <p className="mt-1 text-small text-ignite-muted">
          {standsRemaining} of 50 stands remaining.
        </p>
      </div>

      <fieldset className="grid gap-4">
        <legend className="text-h3 mb-2">Your company</legend>
        <TextField
          id="company"
          name="company"
          label="Company name"
          errors={errors}
          autoComplete="organization"
        />
        <TextField
          id="website"
          name="website"
          label="Company website"
          errors={errors}
          required={false}
          type="url"
          help="Linked from your public exhibitor listing."
        />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="text-h3 mb-2">Main contact</legend>
        <TextField id="contactFirstName" name="contactFirstName" label="First name" errors={errors} autoComplete="given-name" />
        <TextField id="contactSurname" name="contactSurname" label="Surname" errors={errors} autoComplete="family-name" />
        <TextField
          id="contactEmail"
          name="contactEmail"
          label="Email"
          errors={errors}
          type="email"
          autoComplete="email"
          help="Receipt, booking confirmation, and your account land here."
        />
        <TextField id="contactMobile" name="contactMobile" label="Mobile" errors={errors} type="tel" autoComplete="tel" />
        {hiddenAttendee1Error ? (
          <p className={`${ERR} sm:col-span-2`}>{hiddenAttendee1Error}</p>
        ) : null}
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-ignite-line bg-ignite-cream p-5">
        <legend className="text-h3 px-1">Attendee 1</legend>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={a1Tbc}
            onChange={(e) => setA1Tbc(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span className="text-small text-ignite-ink">
            Name TBC, we&apos;ll confirm later.
          </span>
        </label>
        {a1Tbc ? (
          <p className="text-small text-ignite-muted">{tbcNote}</p>
        ) : (
          <>
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsContact}
                onChange={(e) => setSameAsContact(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <span className="text-small text-ignite-ink">
                The main contact is attendee 1.
              </span>
            </label>
            {!sameAsContact ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField id="a1-first" name="attendee1.firstName" label="First name" errors={errors} />
                <TextField id="a1-surname" name="attendee1.surname" label="Surname" errors={errors} />
                <TextField id="a1-email" name="attendee1.email" label="Email" errors={errors} type="email" />
                <TextField id="a1-mobile" name="attendee1.mobile" label="Mobile" errors={errors} required={false} type="tel" />
              </div>
            ) : null}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="a1-job"
                name="attendee1.jobTitle"
                label="Job title"
                errors={errors}
                help="Goes on their badge."
              />
              <DietaryFields prefix="attendee1" errors={errors} />
            </div>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-4 rounded-2xl border border-ignite-line bg-ignite-cream p-5">
        <legend className="text-h3 px-1">Attendee 2</legend>
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={a2Tbc}
            onChange={(e) => setA2Tbc(e.target.checked)}
            className="mt-1 h-4 w-4"
          />
          <span className="text-small text-ignite-ink">
            Name TBC, we&apos;ll confirm later.
          </span>
        </label>
        {a2Tbc ? (
          <p className="text-small text-ignite-muted">{tbcNote}</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField id="a2-first" name="attendee2.firstName" label="First name" errors={errors} />
            <TextField id="a2-surname" name="attendee2.surname" label="Surname" errors={errors} />
            <TextField id="a2-email" name="attendee2.email" label="Email" errors={errors} type="email" />
            <TextField id="a2-mobile" name="attendee2.mobile" label="Mobile" errors={errors} required={false} type="tel" />
            <TextField
              id="a2-job"
              name="attendee2.jobTitle"
              label="Job title"
              errors={errors}
              help="Goes on their badge."
            />
            <DietaryFields prefix="attendee2" errors={errors} />
          </div>
        )}
      </fieldset>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          name="marketingOptIn"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-small text-ignite-muted">
          Send me occasional IGNITE! updates. We do not share your email.
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
      {errorFor(errors, "termsAccepted") ? (
        <p className={ERR}>{errorFor(errors, "termsAccepted")}</p>
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
          aria-label={`Continue to payment, total ${priceLabel}`}
        >
          {isSubmitting || isPending
            ? "Redirecting to payment..."
            : `Continue to payment (${priceLabel})`}
        </Button>
        <span className="text-small text-ignite-muted">
          Secure card payment via Stripe. VAT is added at checkout.
        </span>
      </div>
    </form>
  );
}
