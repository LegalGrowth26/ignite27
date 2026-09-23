// Copy builders for the ambassador welcome email, kept pure so every
// conditional branch is unit-tested without touching Stripe or the
// database. House rules apply to every string here: IGNITE! with the
// mark, no em dashes, reads hand-written.

export interface AmbassadorPromoDetails {
  code: string;
  percentOff: number;
  // null = we asked Stripe and could not confirm the limits, so we say
  // nothing about them rather than guessing. When present, null fields
  // inside mean "genuinely unlimited / no expiry".
  limits: {
    maxRedemptions: number | null;
    expiresAt: Date | null;
  } | null;
}

export function formatUkDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  }).format(date);
}

// Comp tickets block, omitted entirely at 0 (the email never mentions
// comps an ambassador does not have).
export function compTicketsLine(allowance: number): string | null {
  if (allowance <= 0) return null;
  if (allowance === 1) {
    return "You also have 1 complimentary ticket to give away. Send it from your dashboard: pop in a name and email, and they get a real ticket in their inbox straight away.";
  }
  return `You also have ${allowance} complimentary tickets to give away. Send them from your dashboard: pop in a name and email, and each person gets a real ticket in their inbox straight away.`;
}

// Discount code lines, omitted entirely when there is no code.
export function discountLines(promo: AmbassadorPromoDetails | null): string[] | null {
  if (!promo) return null;
  const lines = [
    `Your discount code is ${promo.code}. It takes ${promo.percentOff}% off for anyone who uses it at checkout.`,
  ];
  if (promo.limits) {
    const { maxRedemptions, expiresAt } = promo.limits;
    if (maxRedemptions !== null && expiresAt !== null) {
      lines.push(
        `It can be used up to ${maxRedemptions} times and is valid until ${formatUkDate(expiresAt)}.`,
      );
    } else if (maxRedemptions !== null) {
      lines.push(`It can be used up to ${maxRedemptions} times.`);
    } else if (expiresAt !== null) {
      lines.push(`It is valid until ${formatUkDate(expiresAt)}.`);
    } else {
      lines.push("There is no limit on how many people can use it.");
    }
  }
  return lines;
}
