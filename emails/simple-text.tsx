import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";
import * as React from "react";

export interface SimpleTextEmailProps {
  previewText: string;
  heading: string;
  paragraphs: readonly string[];
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
  margin: "0 0 12px 0",
  color: "#111418",
  whiteSpace: "pre-wrap" as const,
} as const;

// A minimal transactional template used for short administrative notices
// (cancellation received, correction received, admin notifications).
export function SimpleTextEmail({ previewText, heading, paragraphs }: SimpleTextEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={WRAPPER}>
        <Container style={CONTAINER}>
          <Heading style={HEADING}>{heading}</Heading>
          {paragraphs.map((p, i) => (
            <Text key={i} style={PARAGRAPH}>
              {p}
            </Text>
          ))}
          <Text style={{ ...PARAGRAPH, color: "#5B6169", marginTop: "16px" }}>
            The Ignite team
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export function renderSimpleTextPlain(props: SimpleTextEmailProps): string {
  return [props.heading, "", ...props.paragraphs, "", "The Ignite team"].join("\n");
}
