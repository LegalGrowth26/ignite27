export function formatPoundsFromPence(pence: number): string {
  return `£${(pence / 100).toFixed(pence % 100 === 0 ? 0 : 2)}`;
}

// Public-facing "£X + VAT (£Y)" display used on every ticket / exhibitor
// price on the marketing pages. Lunch is defined inc-VAT so it is shown
// flat via formatPoundsFromPence, not through this helper.
export function formatExVatWithGross(
  exVatPence: number,
  incVatPence: number,
): string {
  return `${formatPoundsFromPence(exVatPence)} + VAT (${formatPoundsFromPence(incVatPence)})`;
}
