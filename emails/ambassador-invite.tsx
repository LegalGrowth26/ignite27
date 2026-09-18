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

export interface AmbassadorInviteProps {
  firstName: string;
  shareUrl: string;
  compAllowance: number;
  dashboardUrl: string;
  setPasswordUrl: string;
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

export function AmbassadorInviteEmail(props: AmbassadorInviteProps) {
  const { firstName, shareUrl, compAllowance, dashboardUrl, setPasswordUrl } = props;
  return (
    <Html>
      <Head />
      <Preview>Your IGNITE! 27 ambassador dashboard is ready.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>You&apos;re an IGNITE! 27 ambassador.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, thanks for helping us pack the room. Your private
            dashboard is ready: your personal share link, live numbers for the
            clicks and bookings it brings in
            {compAllowance > 0
              ? `, and ${compAllowance} guest ticket${compAllowance === 1 ? "" : "s"} to give away`
              : ""}
            .
          </Text>
          <Text style={PARAGRAPH}>
            <strong>Your share link:</strong>{" "}
            <Link style={LINK} href={shareUrl}>
              {shareUrl}
            </Link>
          </Text>
          <Text style={PARAGRAPH}>Set a password first, then have a look around:</Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={setPasswordUrl}>
              Set your password
            </Link>
          </Text>
          <Text style={SMALL}>
            The set-password link is good for 24 hours. If it expires, request a
            new one from the login page. Your dashboard lives at{" "}
            <Link style={LINK} href={dashboardUrl}>
              {dashboardUrl}
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

export function renderAmbassadorInvitePlainText(props: AmbassadorInviteProps): string {
  return [
    "IGNITE! 27, you're an ambassador",
    "",
    `Hi ${props.firstName}, thanks for helping us pack the room.`,
    "",
    `Your share link: ${props.shareUrl}`,
    props.compAllowance > 0
      ? `Guest tickets to give away: ${props.compAllowance}`
      : "",
    "",
    "Set a password to get into your dashboard:",
    props.setPasswordUrl,
    "",
    `Your dashboard: ${props.dashboardUrl}`,
    "",
    "The IGNITE! team",
  ]
    .filter((line) => line !== "")
    .join("\n");
}
