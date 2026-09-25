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

// Comp ticket confirmation: THE TICKET leads. A guest given a free
// ticket needs to know they are booked, where, when, their reference,
// and who to thank; the account is a nice-to-have that gets a quiet
// second section. Learned the hard way: leading with set-password
// meant people clicked it days later, hit "expired link", and thought
// their ticket was broken.

export interface CompTicketProps {
  firstName: string;
  bookingReference: string;
  // "Dan Ince has given you a delegate ticket." or the no-name fallback.
  givenByLine: string;
  setPasswordUrl: string;
  loginUrl: string;
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

const META = {
  fontSize: "15px",
  lineHeight: "1.7",
  margin: 0,
  color: "#111418",
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
  padding: "12px 20px",
  backgroundColor: "#E11D2E",
  color: "#ffffff",
  borderRadius: "999px",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "14px",
} as const;

export function CompTicketEmail(props: CompTicketProps) {
  const { firstName, bookingReference, givenByLine, setPasswordUrl, loginUrl } =
    props;
  return (
    <Html>
      <Head />
      <Preview>
        You&apos;re booked for IGNITE! 27, reference {bookingReference}.
      </Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>
            You&apos;re booked for IGNITE! 27.
          </Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, {givenByLine} Nothing to pay, nothing more to do:
            this email is your confirmation, and we will have your name at
            the door.
          </Text>

          <Section>
            <Text style={META}>
              <strong>Reference:</strong> {bookingReference}
            </Text>
            <Text style={META}>
              <strong>When:</strong> Thursday 21 January 2027, 09:30 to 16:30.
            </Text>
            <Text style={META}>
              <strong>Where:</strong> The Renaissance at Kelham Hall, Main
              Street, Newark, NG23 5QX.
            </Text>
          </Section>

          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />

          <Text style={PARAGRAPH}>
            Want to book workshops or manage your details? Set a password
            here:
          </Text>
          <Text style={{ ...PARAGRAPH, margin: "12px 0 16px 0" }}>
            <Link style={BUTTON} href={setPasswordUrl}>
              Set a password
            </Link>
          </Text>
          <Text style={SMALL}>
            If that link expires, no drama and nothing wrong with your
            ticket: use Forgot password on the{" "}
            <Link style={LINK} href={loginUrl}>
              login page
            </Link>{" "}
            with this email address. That route always works.
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

export function renderCompTicketPlainText(props: CompTicketProps): string {
  return [
    "IGNITE! 27, you're booked",
    "",
    `Hi ${props.firstName}, ${props.givenByLine} Nothing to pay, nothing more to do: this email is your confirmation, and we will have your name at the door.`,
    "",
    `Reference: ${props.bookingReference}`,
    "When: Thursday 21 January 2027, 09:30 to 16:30",
    "Where: The Renaissance at Kelham Hall, Main Street, Newark, NG23 5QX",
    "",
    "Want to book workshops or manage your details? Set a password here:",
    props.setPasswordUrl,
    "",
    `If that link expires, no drama and nothing wrong with your ticket: use Forgot password on the login page (${props.loginUrl}) with this email address. That route always works.`,
    "",
    "Questions? Just reply to this email.",
    "The IGNITE! team",
  ].join("\n");
}
