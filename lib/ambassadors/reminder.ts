// The one-off ambassador reminder (October 2026): each ACTIVE
// ambassador gets their own code, share link, and guest-ticket
// position in one short, hand-written email from Tom. Pure copy
// builder, unit-tested; the admin route feeds it live rows and the
// preview mode shows exactly these words before anything sends.

export interface ReminderSource {
  firstName: string;
  promoCode: string | null;
  discountPercent: number | null;
  shareUrl: string;
  compAllowance: number;
  compsUsed: number;
}

export const REMINDER_SUBJECT = "Your IGNITE! 27 code and link";

export function reminderParagraphs(a: ReminderSource): string[] {
  const paragraphs: string[] = [
    `Hi ${a.firstName}, quick one from me. January is creeping up and tickets are moving, so here is your ambassador kit again, all in one place.`,
  ];

  if (a.promoCode && a.discountPercent) {
    paragraphs.push(
      `Your code: ${a.promoCode}. It takes ${a.discountPercent}% off delegate and VIP tickets for anyone who uses it at checkout.`,
    );
  }

  paragraphs.push(
    `Your share link: ${a.shareUrl}. Share it anywhere; the discount applies automatically for anyone who books through it, and every booking counts to you.`,
  );

  const remaining = Math.max(0, a.compAllowance - a.compsUsed);
  if (a.compAllowance > 0 && remaining > 0) {
    paragraphs.push(
      remaining === 1
        ? `You also still have 1 of your ${a.compAllowance} guest tickets to give away. Your dashboard or your guest link does it in a minute.`
        : `You also still have ${remaining} of your ${a.compAllowance} guest tickets to give away. Your dashboard or your guest link does it in a minute.`,
    );
  } else if (a.compAllowance > 0 && remaining === 0) {
    paragraphs.push(
      `All ${a.compAllowance} of your guest tickets have been claimed. Nice work.`,
    );
  }

  paragraphs.push(
    "If you do one thing this week, drop your link into a post or your email signature. It genuinely moves the needle, and I see every booking it brings in.",
  );
  paragraphs.push("Thanks as ever,\nTom");

  return paragraphs;
}
