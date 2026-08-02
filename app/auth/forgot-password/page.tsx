import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reset your password · IGNITE! 27",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ForgotPasswordPage(props: { searchParams: SearchParams }) {
  const params = await props.searchParams;
  const rawError = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-lg">
          <p className="text-eyebrow uppercase text-ignite-red">Account</p>
          <h1 className="mt-4 text-h1">Get a set-password link.</h1>
          {rawError ? (
            <p
              role="alert"
              className="mt-4 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red"
            >
              {rawError}
            </p>
          ) : null}
          <p className="mt-4 text-body text-ignite-muted">
            Enter the email you used to book. We will send you a link to set or reset your
            password. Open it straight away; links are single use and expire quickly.
          </p>
          <div className="mt-8">
            <ForgotPasswordForm />
          </div>
        </div>
      </Container>
    </Section>
  );
}
