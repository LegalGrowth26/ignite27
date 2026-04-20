// Booking reference: human-readable, phone-friendly ticket reference.
// Alphabet excludes visually ambiguous characters (0, 1, I, L, O, U) so that
// someone reading a reference over the phone doesn't confuse O with 0 etc.
// Format: "I27-XXXXXXX" where X is one of 30 characters.
// Collision space: 30^7 ≈ 21.9 billion. The DB has a unique constraint, and
// the booking-creation path retries on collision.

export const BOOKING_REF_PREFIX = "I27-";
export const BOOKING_REF_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
export const BOOKING_REF_BODY_LENGTH = 7;

const ALPHABET_LENGTH = BOOKING_REF_ALPHABET.length;

export function generateBookingReference(): string {
  const bytes = new Uint32Array(BOOKING_REF_BODY_LENGTH);
  crypto.getRandomValues(bytes);

  let body = "";
  for (let i = 0; i < BOOKING_REF_BODY_LENGTH; i++) {
    const raw = bytes[i];
    if (raw === undefined) throw new Error("Unexpected undefined random byte");
    body += BOOKING_REF_ALPHABET[raw % ALPHABET_LENGTH];
  }
  return `${BOOKING_REF_PREFIX}${body}`;
}

export function isValidBookingReferenceFormat(value: string): boolean {
  if (!value.startsWith(BOOKING_REF_PREFIX)) return false;
  const body = value.slice(BOOKING_REF_PREFIX.length);
  if (body.length !== BOOKING_REF_BODY_LENGTH) return false;
  for (const ch of body) {
    if (!BOOKING_REF_ALPHABET.includes(ch)) return false;
  }
  return true;
}
