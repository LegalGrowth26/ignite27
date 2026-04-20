import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Reset your password — Ignite 27",
};

export default function ForgotPasswordPage() {
  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-lg">
          <p className="text-eyebrow uppercase text-ignite-red">Account</p>
          <h1 className="mt-4 text-h1">Get a set-password link.</h1>
          <p className="mt-4 text-body text-ignite-muted">
            Enter the email you used to book. We will send you a link to set or reset your
            password.
          </p>
          <div className="mt-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </Container>
    </Section>
  );
}
