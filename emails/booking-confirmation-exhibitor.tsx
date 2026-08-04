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

export interface ExhibitorConfirmationProps {
  contactFirstName: string;
  company: string;
  bookingReference: string;
  attendeeLines: [string, string]; // "Ada Lovelace, Mathematician. Dietary: Vegan"
  pricePaid: string;
  vatLine: string;
  requirementsUrl: string;
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

export function ExhibitorConfirmationEmail(props: ExhibitorConfirmationProps) {
  const {
    contactFirstName,
    company,
    bookingReference,
    attendeeLines,
    pricePaid,
    vatLine,
    requirementsUrl,
    accountUrl,
    setPasswordUrl,
    refundPolicyUrl,
  } = props;

  return (
    <Html>
      <Head />
      <Preview>Your IGNITE! 27 stand is booked, reference {bookingReference}.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>Your stand is booked.</Heading>
          <Text style={PARAGRAPH}>
            Hi {contactFirstName}, the {company} stand at IGNITE! 27 is confirmed.
            Details below.
          </Text>

          <Section>
            <Text style={META}>
              <strong>Reference:</strong> {bookingReference}
            </Text>
            <Text style={META}>
              <strong>Package:</strong> Exhibitor stand. Includes 2 attendee places and 2 lunches.
            </Text>
            <Text style={META}>
              <strong>Attendee 1:</strong> {attendeeLines[0]}
            </Text>
            <Text style={META}>
              <strong>Attendee 2:</strong> {attendeeLines[1]}
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
            <strong>When:</strong> Thursday 21 January 2027, 09:30 to 16:30. Exhibitor
            setup details follow nearer the day.
          </Text>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={PARAGRAPH}>
            <strong>Set up your account.</strong> We have created an account for your booking.
            Set a password first, then tell us what your stand needs:
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

          <Text style={PARAGRAPH}>
            <strong>Next step: your stand requirements.</strong> Once you are signed in,
            fill in the{" "}
            <Link style={LINK} href={requirementsUrl}>
              stand requirements form
            </Link>{" "}
            (power, table, signage name, logo). Your logo appears on the site once we
            approve it.
          </Text>

          <Text style={SMALL}>
            Need to change something? Head to{" "}
            <Link style={LINK} href={accountUrl}>
              your account
            </Link>{" "}
            to request a correction, ask to cancel, or resend this email.
          </Text>
          <Text style={SMALL}>
            Full refund on request until 31 December 2026. From 1 January 2027 bookings
            are non-refundable but the attendee places are transferable to colleagues,
            email us to arrange. See the{" "}
            <Link style={LINK} href={refundPolicyUrl}>
              refund policy
            </Link>
            .
          </Text>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={{ ...SMALL, margin: 0 }}>The IGNITE! team</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderExhibitorConfirmationPlainText(
  props: ExhibitorConfirmationProps,
): string {
  const lines = [
    "IGNITE! 27, stand confirmed",
    "",
    `Hi ${props.contactFirstName}, the ${props.company} stand at IGNITE! 27 is confirmed.`,
    "",
    `Reference: ${props.bookingReference}`,
    "Package: Exhibitor stand. Includes 2 attendee places and 2 lunches.",
    `Attendee 1: ${props.attendeeLines[0]}`,
    `Attendee 2: ${props.attendeeLines[1]}`,
    `Paid: ${props.pricePaid} ${props.vatLine}`.trim(),
    "",
    "Where: The Renaissance at Kelham Hall, Main Street, Newark, NG23 5QX.",
    "When: Thursday 21 January 2027, 09:30 to 16:30.",
    "",
    "Set up your account",
    "We have created an account for your booking. Set a password to manage it:",
    props.setPasswordUrl,
    "",
    "Next step: fill in your stand requirements (power, table, signage, logo):",
    props.requirementsUrl,
    "",
    `Manage your booking later at ${props.accountUrl}`,
    `Refund policy: ${props.refundPolicyUrl}`,
    "",
    "The IGNITE! team",
  ];
  return lines.join("\n");
}
