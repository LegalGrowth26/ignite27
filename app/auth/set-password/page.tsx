import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { SetPasswordForm } from "./SetPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Set your password — Ignite 27",
};

export default function SetPasswordPage() {
  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-lg">
          <p className="text-eyebrow uppercase text-ignite-red">Account</p>
          <h1 className="mt-4 text-h1">Set your password.</h1>
          <p className="mt-4 text-body text-ignite-muted">
            Pick a password. At least 8 characters. You will be logged in straight after.
          </p>
          <div className="mt-8">
            <SetPasswordForm />
          </div>
        </div>
      </Container>
    </Section>
  );
}
