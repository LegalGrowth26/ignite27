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

export interface ExhibitorPageInviteProps {
  firstName: string; // "there" when we only hold a company contact name we cannot split
  companyName: string;
  pageUrl: string;
  editUrl: string;
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

export function ExhibitorPageInviteEmail(props: ExhibitorPageInviteProps) {
  const { firstName, companyName, pageUrl, editUrl } = props;
  return (
    <Html>
      <Head />
      <Preview>Your IGNITE! 27 exhibitor page is live. Make it yours.</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Text style={EYEBROW}>IGNITE! 27</Text>
          <Heading style={HEADING}>{companyName} now has a page on the IGNITE! 27 site.</Heading>
          <Text style={PARAGRAPH}>
            Hi {firstName}, every exhibitor stand comes with its own public page,
            and yours is live now:
          </Text>
          <Text style={PARAGRAPH}>
            <Link style={LINK} href={pageUrl}>
              {pageUrl}
            </Link>
          </Text>
          <Text style={PARAGRAPH}>
            Right now it shows your company name. Two minutes in your account and
            it can show a lot more: what you do, your website (a proper link,
            good for your search rankings), your socials, and up to two buttons
            sending delegates wherever you want them.
          </Text>
          <Text style={{ ...PARAGRAPH, margin: "16px 0 24px 0" }}>
            <Link style={BUTTON} href={editUrl}>
              Edit your page
            </Link>
          </Text>
          <Text style={SMALL}>
            Delegates browse these pages before the day, so it is worth doing
            before January. Your logo comes from the stand requirements form in
            the same place.
          </Text>
          <Hr style={{ borderColor: "#E6E7EA", margin: "24px 0" }} />
          <Text style={{ ...SMALL, margin: 0 }}>The IGNITE! team</Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderExhibitorPageInvitePlainText(
  props: ExhibitorPageInviteProps,
): string {
  return [
    `IGNITE! 27, ${props.companyName} now has a page on our site`,
    "",
    `Hi ${props.firstName}, every exhibitor stand comes with its own public page, and yours is live now:`,
    "",
    props.pageUrl,
    "",
    "Right now it shows your company name. Two minutes in your account and it can show what you do, your website, your socials, and up to two buttons.",
    "",
    `Edit your page: ${props.editUrl}`,
    "",
    "Delegates browse these pages before the day, so it is worth doing before January.",
    "",
    "The IGNITE! team",
  ].join("\n");
}
