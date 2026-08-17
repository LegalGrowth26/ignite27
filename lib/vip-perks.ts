// The VIP perks list, single source of truth. Rendered on the /attend
// VIP price card and the booking form's VIP summary; update HERE and
// both surfaces follow. Ordered for selling power per organiser
// decision (Aug 2026): the day-of experience perks lead, the badge
// extras close.
export const VIP_PERKS: readonly string[] = [
  "Lunch included, with first access",
  "Queue jump on arrival",
  "Priority seating at the front",
  "Priority booking on workshops",
  "A business book included (worth £15+)",
  "Special VIP lanyard",
  "QR code on your badge linking to your LinkedIn or website",
];

// Tight one-liner for the price-card summary strip.
export const VIP_SUMMARY_LINE =
  "Lunch included, queue jump, front-row seat, and more.";
