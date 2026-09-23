import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

// Our confirmation on a successful partner payment. Stripe's own
// receipt arrives separately; this one is the human thank-you with
// the running position when the deal is part-paid.

export interface PartnerPaymentConfirmationProps {
  contactFirstName: string;
  companyName: string;
  tierLabel: string;
  paidLabel: string; // "£3,000 (including £500 VAT)"
  // Null when the agreed price is now fully covered.
  remainingLabel: string | null;
}

const WRAPPER = {
  backgroundColor: "#F7F5F0",
  fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif",
  padding: "32px 0",
  margin: 0,
} as const;

const CONTAINER = {
  backgroundColor: "#ffffff",
  maxWidth: "560px",
  margin: "0 auto",
  padding: "32px",
  borderRadius: "16px",
} as const;

const HEADING = {
  fontSize: "22px",
  lineHeight: "1.2",
  margin: "0 0 16px 0",
  color: "#0A0A0A",
} as const;

const PARAGRAPH = {
  fontSize: "15px",
  lineHeight: "1.6",
  margin: "0 0 16px 0",
  color: "#111418",
} as const;

const EYEBROW = {
  fontSize: "11px",
  lineHeight: "1.2",
  letterSpacing: "0.12em",
  textTransform: "uppercase" as const,
  margin: "0 0 8px 0",
  color: "#E11D2E",
  fontWeight: 600,
} as const;

const SMALL = {
  fontSize: "13px",
  lineHeight: "1.5",
  color: "#5B6169",
  margin: "0 0 6px 0",
} as const;

export function PartnerPaymentConfirmationEmail(
  props: PartnerPaymentConfirmationProps,
) {
  const { contactFirstName, companyName, tierLabel, paidLabel, remainingLabel } =
    props;
  return (
    <Html>
      <Head />
      <Preview>Payment received: thank you from IGNITE! 27.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>Payment received. Thank you.</Heading>
          <Text style={PARAGRAPH}>
            Hi {contactFirstName}, we have received {paidLabel} for{" "}
            {companyName}&apos;s place as {tierLabel} at IGNITE! 27. Stripe&apos;s
            receipt lands in your inbox separately.
          </Text>
          {remainingLabel ? (
            <Text style={PARAGRAPH}>{remainingLabel}</Text>
          ) : (
            <Text style={PARAGRAPH}>
              That settles the partnership in full. Brilliant to have you with
              us; we will be in touch about the practical bits nearer the day.
            </Text>
          )}
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={{ ...SMALL, margin: 0 }}>
            Questions? Just reply to this email. The IGNITE! team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderPartnerPaymentConfirmationPlainText(
  props: PartnerPaymentConfirmationProps,
): string {
  return [
    "IGNITE! 27, payment received. Thank you.",
    "",
    `Hi ${props.contactFirstName}, we have received ${props.paidLabel} for ${props.companyName}'s place as ${props.tierLabel} at IGNITE! 27. Stripe's receipt lands in your inbox separately.`,
    "",
    props.remainingLabel ??
      "That settles the partnership in full. Brilliant to have you with us; we will be in touch about the practical bits nearer the day.",
    "",
    "The IGNITE! team",
  ].join("\n");
}
