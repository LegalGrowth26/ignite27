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
import { bodyToParagraphs, tokeniseParagraph } from "@/lib/event-emails/body";

export interface EventUpdateProps {
  subject: string;
  body: string; // plain paragraphs; bare URLs auto-linked
  accountUrl: string;
  contactUrl: string;
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

// The pre-event update shell: same branded frame as the booking
// confirmations. These are event-service emails to ticket holders, so
// the footer is "manage your booking", deliberately not a marketing
// unsubscribe.
export function EventUpdateEmail(props: EventUpdateProps) {
  const paragraphs = bodyToParagraphs(props.body);
  return (
    <Html>
      <Head />
      <Preview>{props.subject}</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>{props.subject}</Heading>
          {paragraphs.map((paragraph, i) => (
            <Text key={i} style={PARAGRAPH}>
              {tokeniseParagraph(paragraph).map((token, j) =>
                token.type === "link" ? (
                  <Link key={j} style={LINK} href={token.value}>
                    {token.value}
                  </Link>
                ) : (
                  <React.Fragment key={j}>{token.value}</React.Fragment>
                ),
              )}
            </Text>
          ))}
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={SMALL}>
            You are getting this because you have a ticket for IGNITE! 27,
            Thursday 21 January 2027 at Kelham Hall, Newark. Manage your
            booking at{" "}
            <Link style={LINK} href={props.accountUrl}>
              your account
            </Link>{" "}
            or{" "}
            <Link style={LINK} href={props.contactUrl}>
              contact the organisers
            </Link>
            .
          </Text>
          <Text style={{ ...SMALL, margin: 0 }}>The IGNITE! team</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderEventUpdatePlainText(props: EventUpdateProps): string {
  return [
    "IGNITE! 27",
    "",
    props.subject,
    "",
    ...bodyToParagraphs(props.body).flatMap((p) => [p, ""]),
    `You are getting this because you have a ticket for IGNITE! 27.`,
    `Manage your booking: ${props.accountUrl}`,
    `Contact the organisers: ${props.contactUrl}`,
    "",
    "The IGNITE! team",
  ].join("\n");
}
