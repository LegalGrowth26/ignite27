import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface DelegateConfirmationProps {
  firstName: string;
  bookingReference: string;
  ticketTypeLabel: string;
  lunchLine: string;
  dietaryLabel: string;
  pricePaid: string;
  vatLine: string;
  accountUrl: string;
  setPasswordUrl: string;
  refundPolicyUrl: string;
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

const META = {
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 6px 0",
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

const LINK = {
  color: "#E11D2E",
  textDecoration: "underline",
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

export function DelegateConfirmationEmail(props: DelegateConfirmationProps) {
  const {
    firstName,
    bookingReference,
    ticketTypeLabel,
    lunchLine,
    dietaryLabel,
    pricePaid,
    vatLine,
    accountUrl,
    setPasswordUrl,
    refundPolicyUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Preview>Your Ignite 27 ticket, reference {bookingReference}.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>Ignite 27</Text>
          <Heading style={HEADING}>Booked. See you on Thursday 21 January.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, your Ignite 27 ticket is confirmed. Details below.
          </Text>

          <Section>
            <Text style={META}>
              <strong>Reference:</strong> {bookingReference}
            </Text>
            <Text style={META}>
              <strong>Ticket:</strong> {ticketTypeLabel}
            </Text>
            <Text style={META}>
              <strong>Lunch:</strong> {lunchLine}
            </Text>
            <Text style={META}>
              <strong>Dietary:</strong> {dietaryLabel}
            </Text>
            <Text style={META}>
              <strong>Paid:</strong> {pricePaid} {vatLine}
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={PARAGRAPH}>
            <strong>Where:</strong> The Renaissance at Kelham Hall, Main Street, Newark, NG23 5QX.
          </Text>
          <Text style={PARAGRAPH}>
            <strong>When:</strong> Thursday 21 January 2027, 09:30 to 16:30.
          </Text>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={PARAGRAPH}>
            <strong>Set up your account.</strong> We have created an account for your booking.
            Set a password to view and manage your booking:
          </Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={setPasswordUrl}>
              Set your password
            </Link>
          </Text>
          <Text style={SMALL}>
            The set-password link is good for 24 hours. If it expires, request a new one from
            the login page.
          </Text>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={SMALL}>
            Need to change something? Once you have set your password, head to{" "}
            <Link style={LINK} href={accountUrl}>
              your account
            </Link>{" "}
            to request a correction, ask to cancel, or resend this email.
          </Text>
          <Text style={SMALL}>
            Cancellations follow the{" "}
            <Link style={LINK} href={refundPolicyUrl}>
              refund policy
            </Link>
            . Refunds are minus Stripe&apos;s processing fee, which we cannot recover.
          </Text>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={{ ...SMALL, margin: 0 }}>The Ignite team</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderDelegateConfirmationPlainText(props: DelegateConfirmationProps): string {
  const lines = [
    "Ignite 27 — booking confirmed",
    "",
    `Hi ${props.firstName}, your Ignite 27 ticket is confirmed.`,
    "",
    `Reference: ${props.bookingReference}`,
    `Ticket: ${props.ticketTypeLabel}`,
    `Lunch: ${props.lunchLine}`,
    `Dietary: ${props.dietaryLabel}`,
    `Paid: ${props.pricePaid} ${props.vatLine}`.trim(),
    "",
    "Where: The Renaissance at Kelham Hall, Main Street, Newark, NG23 5QX.",
    "When: Thursday 21 January 2027, 09:30 to 16:30.",
    "",
    "Set up your account",
    "We have created an account for your booking. Set a password to manage it:",
    props.setPasswordUrl,
    "",
    `Manage your booking later at ${props.accountUrl}`,
    `Refund policy: ${props.refundPolicyUrl}`,
    "",
    "The Ignite team",
  ];
  return lines.join("\n");
}
