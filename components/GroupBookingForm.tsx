"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "./Button";
import {
  createGroupCheckoutAction,
  type CreateGroupCheckoutActionResult,
} from "@/app/attend/book/group/actions";
import { DIETARY_REQUIREMENTS, type DietaryRequirement } from "@/lib/bookings/intent";
import { formatPoundsFromPence } from "@/lib/pricing";
import {
  GROUP_MAX_TICKETS,
  GROUP_MIN_TICKETS,
  groupDiscountPercent,
} from "@/lib/pricing/group";

const INPUT =
  "w-full rounded-xl border border-ignite-line bg-ignite-white px-4 py-3 text-body text-ignite-ink focus:border-ignite-red focus:outline-none focus:ring-2 focus:ring-ignite-red/20";
const LABEL = "block text-small font-medium text-ignite-ink";
const HELP = "mt-1 text-small text-ignite-muted";

const DIETARY_LABELS: Record<DietaryRequirement, string> = {
  none: "No requirement",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  gluten_free: "Gluten-free",
  dairy_free: "Dairy-free",
  nut_allergy: "Nut allergy",
  other: "Other",
};

interface TicketState {
  ticketType: "regular" | "vip";
  lunchIncluded: boolean;
  tbc: boolean;
  firstName: string;
  surname: string;
  email: string;
  jobTitle: string;
  dietaryRequirement: DietaryRequirement;
  dietaryOther: string;
}

function blankTicket(tbc: boolean): TicketState {
  return {
    ticketType: "regular",
    lunchIncluded: false,
    tbc,
    firstName: "",
    surname: "",
    email: "",
    jobTitle: "",
    dietaryRequirement: "none",
    dietaryOther: "",
  };
}

export interface GroupBookingFormProps {
  regularExVatPence: number;
  vipExVatPence: number;
  lunchIncVatPence: number; // "£15 flat" figure
  periodLabel: string;
}

export function GroupBookingForm(props: GroupBookingFormProps) {
  const [tickets, setTickets] = useState<TicketState[]>([
    blankTicket(false),
    blankTicket(false),
  ]);
  const [company, setCompany] = useState("");
  const [leadMobile, setLeadMobile] = useState("");
  const [discountCode, setDiscountCode] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Array<{ field: string; message: string }>>([]);
  const [isPending, startTransition] = useTransition();

  const update = (index: number, patch: Partial<TicketState>) => {
    setTickets((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  };

  const summary = useMemo(() => {
    const ticketsExVat = tickets.reduce(
      (s, t) => s + (t.ticketType === "vip" ? props.vipExVatPence : props.regularExVatPence),
      0,
    );
    const lunches = tickets.filter(
      (t) => t.ticketType === "regular" && t.lunchIncluded,
    ).length;
    const percent = groupDiscountPercent(tickets.length);
    const discount = Math.round((ticketsExVat * percent) / 100);
    const netEx = ticketsExVat - discount + lunches * Math.round((props.lunchIncVatPence / 120) * 100);
    return {
      count: tickets.length,
      percent,
      discount,
      lunches,
      // Indicative inc-VAT total: ex-VAT net at 20%; Stripe shows the
      // authoritative breakdown at checkout.
      totalIncVat: Math.round(netEx * 1.2),
    };
  }, [tickets, props]);

  const fieldError = (field: string) => errors.find((e) => e.field === field)?.message;

  const submit = () => {
    setErrors([]);
    startTransition(async () => {
      const result: CreateGroupCheckoutActionResult = await createGroupCheckoutAction({
        company,
        leadMobile,
        discountCode,
        marketingOptIn,
        termsAccepted,
        tickets: tickets.map((t) => ({ ...t })),
      });
      if (result.ok) {
        window.location.assign(result.url);
        return;
      }
      setErrors(result.errors);
    });
  };

  return (
    <form
      className="flex flex-col gap-8"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="company" className={LABEL}>
            Company <span className="text-ignite-red">*</span>
          </label>
          <input
            id="company"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            maxLength={200}
            required
            className={INPUT}
          />
          {fieldError("company") ? (
            <p className="mt-1 text-small text-ignite-red">{fieldError("company")}</p>
          ) : null}
        </div>
        <div>
          <label htmlFor="leadMobile" className={LABEL}>
            Your mobile <span className="text-ignite-red">*</span>
          </label>
          <input
            id="leadMobile"
            value={leadMobile}
            onChange={(e) => setLeadMobile(e.target.value)}
            maxLength={30}
            inputMode="tel"
            required
            className={INPUT}
          />
          {fieldError("leadMobile") ? (
            <p className="mt-1 text-small text-ignite-red">{fieldError("leadMobile")}</p>
          ) : null}
        </div>
      </div>

      {tickets.map((t, index) => {
        const eats = t.ticketType === "vip" || t.lunchIncluded;
        const at = (f: string) => fieldError(`tickets.${index}.${f}`);
        return (
          <fieldset
            key={index}
            className="rounded-2xl border border-ignite-line bg-ignite-white p-5"
          >
            <legend className="px-2 text-body font-semibold text-ignite-ink">
              {index === 0 ? "Ticket 1: you (lead booker)" : `Ticket ${index + 1}`}
            </legend>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`type-${index}`} className={LABEL}>
                  Ticket type
                </label>
                <select
                  id={`type-${index}`}
                  value={t.ticketType}
                  onChange={(e) =>
                    update(index, {
                      ticketType: e.target.value as "regular" | "vip",
                      lunchIncluded:
                        e.target.value === "vip" ? true : t.lunchIncluded,
                    })
                  }
                  className={INPUT}
                >
                  <option value="regular">
                    Regular ({formatPoundsFromPence(props.regularExVatPence)} + VAT)
                  </option>
                  <option value="vip">
                    VIP ({formatPoundsFromPence(props.vipExVatPence)} + VAT, lunch included)
                  </option>
                </select>
              </div>
              {t.ticketType === "regular" ? (
                <label className="flex items-center gap-3 sm:mt-7">
                  <input
                    type="checkbox"
                    checked={t.lunchIncluded}
                    onChange={(e) => update(index, { lunchIncluded: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-body text-ignite-ink">
                    Add lunch ({formatPoundsFromPence(props.lunchIncVatPence)} flat)
                  </span>
                </label>
              ) : null}
            </div>

            {index > 0 ? (
              <label className="mt-4 flex items-start gap-3 rounded-xl border border-ignite-line p-3">
                <input
                  type="checkbox"
                  checked={t.tbc}
                  onChange={(e) => update(index, { tbc: e.target.checked })}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  <span className="block text-body font-semibold text-ignite-ink">
                    Name TBC, we&apos;ll confirm later
                  </span>
                  <span className="block text-small text-ignite-muted">
                    Book the place now, tell us who is coming nearer the event.
                  </span>
                </span>
              </label>
            ) : null}

            {!t.tbc ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor={`first-${index}`} className={LABEL}>
                    First name <span className="text-ignite-red">*</span>
                  </label>
                  <input
                    id={`first-${index}`}
                    value={t.firstName}
                    onChange={(e) => update(index, { firstName: e.target.value })}
                    maxLength={100}
                    className={INPUT}
                  />
                  {at("firstName") ? (
                    <p className="mt-1 text-small text-ignite-red">{at("firstName")}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor={`surname-${index}`} className={LABEL}>
                    Surname <span className="text-ignite-red">*</span>
                  </label>
                  <input
                    id={`surname-${index}`}
                    value={t.surname}
                    onChange={(e) => update(index, { surname: e.target.value })}
                    maxLength={100}
                    className={INPUT}
                  />
                  {at("surname") ? (
                    <p className="mt-1 text-small text-ignite-red">{at("surname")}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor={`email-${index}`} className={LABEL}>
                    Email <span className="text-ignite-red">*</span>
                  </label>
                  <input
                    id={`email-${index}`}
                    value={t.email}
                    onChange={(e) => update(index, { email: e.target.value })}
                    inputMode="email"
                    maxLength={200}
                    className={INPUT}
                  />
                  {at("email") ? (
                    <p className="mt-1 text-small text-ignite-red">{at("email")}</p>
                  ) : null}
                </div>
                <div>
                  <label htmlFor={`job-${index}`} className={LABEL}>
                    Job title
                  </label>
                  <input
                    id={`job-${index}`}
                    value={t.jobTitle}
                    onChange={(e) => update(index, { jobTitle: e.target.value })}
                    maxLength={200}
                    className={INPUT}
                  />
                </div>
                {eats ? (
                  <>
                    <div>
                      <label htmlFor={`diet-${index}`} className={LABEL}>
                        Dietary requirement
                      </label>
                      <select
                        id={`diet-${index}`}
                        value={t.dietaryRequirement}
                        onChange={(e) =>
                          update(index, {
                            dietaryRequirement: e.target.value as DietaryRequirement,
                          })
                        }
                        className={INPUT}
                      >
                        {DIETARY_REQUIREMENTS.map((d) => (
                          <option key={d} value={d}>
                            {DIETARY_LABELS[d]}
                          </option>
                        ))}
                      </select>
                    </div>
                    {t.dietaryRequirement === "other" ? (
                      <div>
                        <label htmlFor={`dietOther-${index}`} className={LABEL}>
                          Tell us what to cater for
                        </label>
                        <input
                          id={`dietOther-${index}`}
                          value={t.dietaryOther}
                          onChange={(e) => update(index, { dietaryOther: e.target.value })}
                          maxLength={200}
                          className={INPUT}
                        />
                        {at("dietaryOther") ? (
                          <p className="mt-1 text-small text-ignite-red">
                            {at("dietaryOther")}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            ) : null}

            {index >= GROUP_MIN_TICKETS ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setTickets((prev) => prev.filter((_, i) => i !== index))}
                  className="text-small font-semibold text-ignite-muted underline underline-offset-4 hover:text-ignite-red"
                >
                  Remove this ticket
                </button>
              </div>
            ) : null}
          </fieldset>
        );
      })}

      {tickets.length < GROUP_MAX_TICKETS ? (
        <div>
          <button
            type="button"
            onClick={() => setTickets((prev) => [...prev, blankTicket(true)])}
            className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
          >
            Add another ticket ({tickets.length}/{GROUP_MAX_TICKETS})
          </button>
        </div>
      ) : null}

      <div className="rounded-2xl border-2 border-ignite-red bg-ignite-white p-5">
        <p className="text-body font-semibold text-ignite-ink">
          {summary.count} tickets
          {summary.lunches > 0 ? ` · ${summary.lunches} lunches` : ""} ·{" "}
          {props.periodLabel}
        </p>
        {summary.percent > 0 ? (
          <p className="mt-1 text-body text-ignite-red">
            Group discount: {summary.percent}% off {summary.count} tickets (
            {formatPoundsFromPence(summary.discount)} ex VAT).
          </p>
        ) : (
          <p className="mt-1 text-small text-ignite-muted">
            3 or more tickets save 10%. 5 or more save 25%.
          </p>
        )}
        <p className="mt-2 text-h3 text-ignite-ink">
          About {formatPoundsFromPence(summary.totalIncVat)} inc VAT
        </p>
        <p className="mt-1 text-small text-ignite-muted">
          Stripe shows the exact VAT breakdown before you pay.
        </p>
      </div>

      <div>
        <label htmlFor="discountCode" className={LABEL}>
          Discount code (optional)
        </label>
        <input
          id="discountCode"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value)}
          maxLength={60}
          className={`${INPUT} sm:max-w-xs`}
        />
        <p className={HELP}>
          Discounts do not stack: we compare your code against the group
          discount and apply whichever saves you more.
        </p>
        {fieldError("discountCode") ? (
          <p className="mt-1 text-small text-ignite-red">{fieldError("discountCode")}</p>
        ) : null}
      </div>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={marketingOptIn}
          onChange={(e) => setMarketingOptIn(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-body text-ignite-ink">
          Keep me posted about IGNITE! news and next year&apos;s event.
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(e) => setTermsAccepted(e.target.checked)}
          className="mt-1 h-4 w-4"
        />
        <span className="text-body text-ignite-ink">
          I accept the Terms and the{" "}
          <a
            href="/refund-policy"
            className="underline underline-offset-4 hover:text-ignite-red"
            target="_blank"
          >
            Refund Policy
          </a>{" "}
          on behalf of the group. <span className="text-ignite-red">*</span>
        </span>
      </label>
      {fieldError("termsAccepted") ? (
        <p className="text-small text-ignite-red">{fieldError("termsAccepted")}</p>
      ) : null}

      {fieldError("form") ? (
        <p className="rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          {fieldError("form")}
        </p>
      ) : null}

      <div>
        <Button variant="primary" size="lg" type="submit" disabled={isPending}>
          {isPending ? "Preparing payment..." : "Continue to payment"}
        </Button>
      </div>
    </form>
  );
}
