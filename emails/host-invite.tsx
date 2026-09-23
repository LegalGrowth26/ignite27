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

// Workshop host welcome: ONE email covering everything a host gets
// when invited from the workshops admin: their page + editor, their
// share link, their comp tickets, and their discount code. The comps
// and discount blocks are conditional (null omits them), and the copy
// lines come from lib/ambassadors/welcome.ts, unit-tested per branch.

export interface HostInviteProps {
  firstName: string;
  pageUrl: string;
  editorUrl: string;
  shareUrl: string;
  dashboardUrl: string;
  setPasswordUrl: string;
  compLine: string | null;
  discountLines: string[] | null;
  // A line from Tom or Paul, written per invite; null omits the block.
  personalLine: string | null;
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

export function HostInviteEmail(props: HostInviteProps) {
  const {
    firstName,
    pageUrl,
    editorUrl,
    shareUrl,
    dashboardUrl,
    setPasswordUrl,
    compLine,
    discountLines,
    personalLine,
  } = props;
  return (
    <Html>
      <Head />
      <Preview>You&apos;re hosting a workshop at IGNITE! 27. Here is your kit.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>You&apos;re hosting a workshop at IGNITE! 27.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, brilliant to have you on board. The workshops are
            where IGNITE! gets properly practical, and yours is one of the
            reasons people will book. Here is everything that comes with
            hosting.
          </Text>

          {personalLine ? (
            <Text style={{ ...PARAGRAPH, fontStyle: "italic" }}>
              &ldquo;{personalLine}&rdquo;
            </Text>
          ) : null}

          <div style={PERK_BOX}>
            <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>
              <strong>Your page:</strong>{" "}
              <Link style={LINK} href={pageUrl}>
                {pageUrl}
              </Link>
            </Text>
            <Text style={{ ...SMALL, margin: 0 }}>
              Your workshop is yours to sell: add the title, what it covers,
              what people will leave with, your headshot and your logo from
              your editor at{" "}
              <Link style={LINK} href={editorUrl}>
                {editorUrl}
              </Link>
              . It appears on the workshops page as soon as you save it. The
              room and time are on us; we&apos;ll confirm those with you.
              There is also a contact form that forwards to your inbox
              without showing your email address.
            </Text>
          </div>

          <div style={PERK_BOX}>
            <Text style={{ ...PARAGRAPH, margin: "0 0 8px 0" }}>
              <strong>Your share link:</strong>{" "}
              <Link style={LINK} href={shareUrl}>
                {shareUrl}
              </Link>
            </Text>
            <Text style={{ ...SMALL, margin: 0 }}>
              Share it anywhere. When someone follows it and books, the booking
              counts as yours (we remember their click for 90 days), and your
              dashboard shows every ticket you have driven.
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
            The set-password link is good for 24 hours; if it expires, request a
            new one from the login page. Your page editor lives at{" "}
            <Link style={LINK} href={editorUrl}>
              {editorUrl}
            </Link>{" "}
            and your numbers at{" "}
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

export function renderHostInvitePlainText(props: HostInviteProps): string {
  return [
    "IGNITE! 27, you're hosting a workshop",
    "",
    `Hi ${props.firstName}, brilliant to have you on board. The workshops are where IGNITE! gets properly practical, and yours is one of the reasons people will book. Here is everything that comes with hosting.`,
    ...(props.personalLine ? ["", `"${props.personalLine}"`] : []),
    "",
    `Your page: ${props.pageUrl}`,
    `Your workshop is yours to sell: add the title, what it covers, what people will leave with, your headshot and your logo at ${props.editorUrl}. It appears on the workshops page as soon as you save it. The room and time are on us; we'll confirm those with you. The contact form forwards to your inbox without showing your email address.`,
    "",
    `Your share link: ${props.shareUrl}`,
    "Share it anywhere. When someone follows it and books, the booking counts as yours (we remember their click for 90 days).",
    ...(props.compLine ? ["", props.compLine] : []),
    ...(props.discountLines ? ["", ...props.discountLines] : []),
    "",
    `Set your password: ${props.setPasswordUrl}`,
    `Your editor: ${props.editorUrl}`,
    `Your dashboard: ${props.dashboardUrl}`,
    "",
    "Questions? Just reply to this email.",
    "The IGNITE! team",
  ].join("\n");
}
