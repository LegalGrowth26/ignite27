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

// Partner package welcome: ONE email that is also the confirmation of
// the package booking (approved: no second £0 confirmation email).
// The perk blocks are conditional, same regime as the ambassador and
// host welcomes; copy lines come from the shared tested builders.

export interface PartnerWelcomeProps {
  firstName: string;
  companyName: string;
  tierLabel: string;
  // The 2-places block: reference + how to name people. Null only if
  // the booking could not be created (partial provisioning).
  placesReference: string | null;
  accountUrl: string;
  shareUrl: string | null;
  compLine: string | null;
  claimUrl: string | null;
  claimLine: string | null;
  discountLines: string[] | null;
  // Access block from lib/speakers/invite-access.ts.
  accessIntro: string;
  accessLabel: string;
  accessUrl: string;
  accessNote: string;
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

export function PartnerWelcomeEmail(props: PartnerWelcomeProps) {
  const {
    firstName,
    companyName,
    tierLabel,
    placesReference,
    accountUrl,
    shareUrl,
    compLine,
    claimUrl,
    claimLine,
    discountLines,
    accessIntro,
    accessLabel,
    accessUrl,
    accessNote,
  } = props;
  return (
    <Html>
      <Head />
      <Preview>
        Welcome aboard: {companyName}&apos;s IGNITE! 27 partner package.
      </Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>Welcome aboard, {companyName}.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, brilliant to have {companyName} with us as{" "}
            {tierLabel} at IGNITE! 27, Thursday 21 January 2027 at Kelham
            Hall, Newark. Everything your package includes is below, and this
            email doubles as your booking confirmation.
          </Text>

          {placesReference ? (
            <div style={PERK_BOX}>
              <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>
                <strong>Two delegate places for your own people, lunch
                included.</strong> Reference {placesReference}.
              </Text>
              <Text style={{ ...SMALL, margin: 0 }}>
                We have put you down for one and left the other open. Name
                your second person (and dietary needs for both) any time from{" "}
                <Link style={LINK} href={accountUrl}>
                  your account
                </Link>
                : no rush, it can say &quot;to be confirmed&quot; until you
                know.
              </Text>
            </div>
          ) : null}

          {compLine ? (
            <div style={PERK_BOX}>
              <Text style={{ ...PARAGRAPH, margin: claimUrl ? "0 0 8px 0" : 0 }}>
                {compLine}
              </Text>
              {claimUrl && claimLine ? (
                <>
                  <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>{claimLine}</Text>
                  <Text style={{ ...PARAGRAPH, margin: 0 }}>
                    <strong>Your guest ticket link:</strong>{" "}
                    <Link style={LINK} href={claimUrl}>
                      {claimUrl}
                    </Link>
                  </Text>
                </>
              ) : null}
            </div>
          ) : null}

          {shareUrl ? (
            <div style={PERK_BOX}>
              <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>
                <strong>Your share link:</strong>{" "}
                <Link style={LINK} href={shareUrl}>
                  {shareUrl}
                </Link>
              </Text>
              <Text style={{ ...SMALL, margin: 0 }}>
                Share it anywhere. Bookings through it count as yours, and
                your discount applies automatically at checkout.
              </Text>
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

          <Text style={PARAGRAPH}>{accessIntro}</Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={accessUrl}>
              {accessLabel}
            </Link>
          </Text>
          <Text style={SMALL}>{accessNote}</Text>
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={{ ...SMALL, margin: 0 }}>
            Questions? Just reply to this email. The IGNITE! team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderPartnerWelcomePlainText(props: PartnerWelcomeProps): string {
  return [
    "IGNITE! 27, welcome aboard",
    "",
    `Hi ${props.firstName}, brilliant to have ${props.companyName} with us as ${props.tierLabel} at IGNITE! 27, Thursday 21 January 2027 at Kelham Hall, Newark. Everything your package includes is below, and this email doubles as your booking confirmation.`,
    ...(props.placesReference
      ? [
          "",
          `Two delegate places for your own people, lunch included. Reference ${props.placesReference}.`,
          `We have put you down for one and left the other open. Name your second person (and dietary needs for both) any time from your account (${props.accountUrl}): no rush, it can say "to be confirmed" until you know.`,
        ]
      : []),
    ...(props.compLine ? ["", props.compLine] : []),
    ...(props.compLine && props.claimUrl && props.claimLine
      ? [props.claimLine, `Your guest ticket link: ${props.claimUrl}`]
      : []),
    ...(props.shareUrl
      ? [
          "",
          `Your share link: ${props.shareUrl}`,
          "Share it anywhere. Bookings through it count as yours, and your discount applies automatically at checkout.",
        ]
      : []),
    ...(props.discountLines ? ["", ...props.discountLines] : []),
    "",
    props.accessIntro,
    `${props.accessLabel}: ${props.accessUrl}`,
    props.accessNote,
    "",
    "Questions? Just reply to this email.",
    "The IGNITE! team",
  ].join("\n");
}
