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

// Ambassador welcome (September 2026 rewrite): a proper welcome built
// from the ambassador's actual record. The comps and discount blocks
// are CONDITIONAL: the caller passes null to omit them entirely, so
// nobody reads about perks they do not have. Copy lines come from
// lib/ambassadors/welcome.ts, where every branch is unit-tested.

export interface AmbassadorInviteProps {
  firstName: string;
  shareUrl: string;
  dashboardUrl: string;
  setPasswordUrl: string;
  compLine: string | null; // null = no allowance, omit the block
  discountLines: string[] | null; // null = no code, omit the block
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

const PERK_BOX = {
  backgroundColor: "#F7F5F0",
  borderRadius: "12px",
  padding: "16px",
  margin: "0 0 16px 0",
} as const;

export function AmbassadorInviteEmail(props: AmbassadorInviteProps) {
  const { firstName, shareUrl, dashboardUrl, setPasswordUrl, compLine, discountLines } =
    props;
  return (
    <Html>
      <Head />
      <Preview>Welcome aboard. Your IGNITE! 27 ambassador dashboard is ready.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>You&apos;re an IGNITE! 27 ambassador.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, thank you for helping us fill the room. Ambassadors
            are the reason IGNITE! feels like a room full of friends rather
            than a room full of name badges, and we are glad you are one of
            them.
          </Text>
          <Text style={PARAGRAPH}>
            You now have your own private dashboard. It shows the clicks your
            link gets and every ticket you have driven, as it happens. No
            spreadsheets, no chasing us for numbers.
          </Text>

          <div style={PERK_BOX}>
            <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>
              <strong>Your share link:</strong>{" "}
              <Link style={LINK} href={shareUrl}>
                {shareUrl}
              </Link>
            </Text>
            <Text style={{ ...SMALL, margin: 0 }}>
              Share it anywhere: email signature, socials, that WhatsApp group
              you are in. When someone follows it and books, the booking counts
              as yours (we remember their click for 90 days).
            </Text>
          </div>

          {compLine ? (
            <div style={PERK_BOX}>
              <Text style={{ ...PARAGRAPH, margin: 0 }}>{compLine}</Text>
            </div>
          ) : null}

          {discountLines ? (
            <div style={PERK_BOX}>
              {discountLines.map((line, i) => (
                <Text
                  key={i}
                  style={{
                    ...PARAGRAPH,
                    margin: i === discountLines.length - 1 ? 0 : "0 0 8px 0",
                  }}
                >
                  {line}
                </Text>
              ))}
            </div>
          ) : null}

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
          <Text style={{ ...SMALL, margin: 0 }}>
            Questions? Just reply to this email. The IGNITE! team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderAmbassadorInvitePlainText(props: AmbassadorInviteProps): string {
  return [
    "IGNITE! 27, you're an ambassador",
    "",
    `Hi ${props.firstName}, thank you for helping us fill the room. Ambassadors are the reason IGNITE! feels like a room full of friends rather than a room full of name badges, and we are glad you are one of them.`,
    "",
    "You now have your own private dashboard. It shows the clicks your link gets and every ticket you have driven, as it happens.",
    "",
    `Your share link: ${props.shareUrl}`,
    "Share it anywhere. When someone follows it and books, the booking counts as yours (we remember their click for 90 days).",
    ...(props.compLine ? ["", props.compLine] : []),
    ...(props.discountLines ? ["", ...props.discountLines] : []),
    "",
    `Set your password: ${props.setPasswordUrl}`,
    `Your dashboard: ${props.dashboardUrl}`,
    "",
    "Questions? Just reply to this email.",
    "The IGNITE! team",
  ].join("\n");
}
