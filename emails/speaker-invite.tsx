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

export interface SpeakerInviteProps {
  firstName: string;
  pageUrl: string;
  editorUrl: string;
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

export function SpeakerInviteEmail(props: SpeakerInviteProps) {
  const { firstName, pageUrl, editorUrl, setPasswordUrl } = props;
  return (
    <Html>
      <Head />
      <Preview>Your IGNITE! 27 speaker page is live. Make it yours.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>Your speaker page is live.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, you now have your own page on the IGNITE! 27 site:
          </Text>
          <Text style={PARAGRAPH}>
            <Link style={LINK} href={pageUrl}>
              {pageUrl}
            </Link>
          </Text>
          <Text style={PARAGRAPH}>
            Delegates browse these before the day, so it is worth a few minutes:
            add your photo, bio, what your session covers and what people will
            walk away with, plus your website, socials, and a button to wherever
            you want people sent. There is also a contact form that forwards
            straight to your inbox without showing your email address.
          </Text>
          <Text style={PARAGRAPH}>Set a password first, then edit your page:</Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={setPasswordUrl}>
              Set your password
            </Link>
          </Text>
          <Text style={SMALL}>
            The set-password link is good for 24 hours; if it expires, request a
            new one from the login page. Your editor lives at{" "}
            <Link style={LINK} href={editorUrl}>
              {editorUrl}
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

export function renderSpeakerInvitePlainText(props: SpeakerInviteProps): string {
  return [
    "IGNITE! 27, your speaker page is live",
    "",
    `Hi ${props.firstName}, you now have your own page on the IGNITE! 27 site:`,
    "",
    props.pageUrl,
    "",
    "Add your photo, bio, what your session covers, your links, and a button. The contact form forwards to your inbox without showing your email address.",
    "",
    `Set your password: ${props.setPasswordUrl}`,
    `Your editor: ${props.editorUrl}`,
    "",
    "The IGNITE! team",
  ].join("\n");
}
