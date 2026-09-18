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

export interface GroupTicketLine {
  reference: string;
  ticketLabel: string; // "Regular" | "VIP"
  attendeeName: string; // "Name TBC (let us know nearer the event)" for TBC
  lunchLine: string;
}

export interface GroupConfirmationProps {
  leadFirstName: string;
  companyName: string;
  tickets: GroupTicketLine[];
  discountLine: string | null; // "Group discount (10% off tickets): -£10.50" or code line
  totalPaidLine: string; // "£226.80 (includes VAT of £37.80)"
  setPasswordUrl: string;
  accountUrl: string;
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

const TICKET = {
  fontSize: "14px",
  lineHeight: "1.5",
  margin: "0 0 10px 0",
  color: "#111418",
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

export function GroupConfirmationEmail(props: GroupConfirmationProps) {
  const {
    leadFirstName,
    companyName,
    tickets,
    discountLine,
    totalPaidLine,
    setPasswordUrl,
    accountUrl,
  } = props;
  return (
    <Html>
      <Head />
      <Preview>
        {`Your ${String(tickets.length)} IGNITE! 27 tickets are confirmed.`}
      </Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27 · Thursday 21 January 2027</Text>
          <Heading style={HEADING}>
            {companyName} is coming to IGNITE! 27. All {tickets.length} tickets confirmed.
          </Heading>
          <Text style={PARAGRAPH}>
            Hi {leadFirstName}, payment received. Here is your group:
          </Text>
          {tickets.map((t) => (
            <Text key={t.reference} style={TICKET}>
              <strong>{t.reference}</strong> · {t.ticketLabel} · {t.attendeeName} ·{" "}
              {t.lunchLine}
            </Text>
          ))}
          <Hr style={{ borderColor: "#E6E7EA", margin: "16px 0" }} />
          {discountLine ? <Text style={PARAGRAPH}>{discountLine}</Text> : null}
          <Text style={PARAGRAPH}>
            <strong>Total paid:</strong> {totalPaidLine}
          </Text>
          <Text style={PARAGRAPH}>
            Any &quot;Name TBC&quot; tickets can be named later from your account, or just
            reply to this email when you know who is coming. We will chase
            before badges are printed.
          </Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={setPasswordUrl}>
              Set your password
            </Link>
          </Text>
          <Text style={SMALL}>
            The set-password link is good for 24 hours. If it expires, request a
            new one from the login page. All the bookings live in your account
            at <Link style={LINK} href={accountUrl}>{accountUrl}</Link>.
          </Text>
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={{ ...SMALL, margin: 0 }}>
            The IGNITE! team · The Renaissance at Kelham Hall, Newark
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderGroupConfirmationPlainText(props: GroupConfirmationProps): string {
  return [
    `IGNITE! 27, your ${props.tickets.length} tickets are confirmed`,
    "",
    `Hi ${props.leadFirstName}, payment received. Here is your group for ${props.companyName}:`,
    "",
    ...props.tickets.map(
      (t) => `${t.reference} - ${t.ticketLabel} - ${t.attendeeName} - ${t.lunchLine}`,
    ),
    "",
    ...(props.discountLine ? [props.discountLine, ""] : []),
    `Total paid: ${props.totalPaidLine}`,
    "",
    "Any 'Name TBC' tickets can be named later; reply to this email when you know who is coming.",
    "",
    `Set your password: ${props.setPasswordUrl}`,
    `Your account: ${props.accountUrl}`,
    "",
    "The IGNITE! team",
  ].join("\n");
}
