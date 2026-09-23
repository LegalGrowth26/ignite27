import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

// Partner payment request: what it's for (their tier), the amount as
// £X + VAT with the inc-VAT total, and a Pay button to OUR /pay page
// (never a raw Stripe URL, which dies in 24 hours). House tone, from
// Tom's address via the choke point.

export interface PartnerPaymentRequestProps {
  contactFirstName: string;
  companyName: string;
  tierLabel: string;
  amountLabel: string; // "£2,500 + VAT (£3,000 total)"
  payUrl: string;
  expiresOn: string; // "23 October 2026"
  isResend: boolean;
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

const BUTTON = {
  display: "inline-block",
  padding: "14px 22px",
  backgroundColor: "#E11D2E",
  color: "#ffffff",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "15px",
} as const;

const AMOUNT_BOX = {
  backgroundColor: "#F7F5F0",
  borderRadius: "12px",
  padding: "16px",
  margin: "0 0 16px 0",
} as const;

export function PartnerPaymentRequestEmail(props: PartnerPaymentRequestProps) {
  const {
    contactFirstName,
    companyName,
    tierLabel,
    amountLabel,
    payUrl,
    expiresOn,
    isResend,
  } = props;
  return (
    <Html>
      <Head />
      <Preview>
        Your IGNITE! 27 partnership payment: {amountLabel}. Pay securely online.
      </Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>
            {isResend
              ? "A fresh payment link for your IGNITE! 27 partnership."
              : "Your IGNITE! 27 partnership payment."}
          </Heading>
          <Text style={PARAGRAPH}>
            Hi {contactFirstName}, thanks again for backing IGNITE! 27. This is
            the payment for {companyName}&apos;s place as {tierLabel}: the
            secure card payment below takes a minute, and Stripe sends you a
            receipt the moment it goes through.
          </Text>

          <div style={AMOUNT_BOX}>
            <Text style={{ ...PARAGRAPH, margin: 0 }}>
              <strong>{amountLabel}</strong>
            </Text>
          </div>

          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={payUrl}>
              Pay securely
            </Link>
          </Text>
          <Text style={SMALL}>
            The link is good until {expiresOn}; if it lapses, just ask and we
            will send a fresh one. Prefer a different arrangement? Reply to
            this email and we will sort it.
          </Text>
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={{ ...SMALL, margin: 0 }}>
            Questions? Just reply to this email. The IGNITE! team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderPartnerPaymentRequestPlainText(
  props: PartnerPaymentRequestProps,
): string {
  return [
    "IGNITE! 27, your partnership payment",
    "",
    `Hi ${props.contactFirstName}, thanks again for backing IGNITE! 27. This is the payment for ${props.companyName}'s place as ${props.tierLabel}.`,
    "",
    `Amount: ${props.amountLabel}`,
    `Pay securely: ${props.payUrl}`,
    "",
    `The link is good until ${props.expiresOn}; if it lapses, just ask and we will send a fresh one. Prefer a different arrangement? Reply to this email and we will sort it.`,
    "",
    "The IGNITE! team",
  ].join("\n");
}
