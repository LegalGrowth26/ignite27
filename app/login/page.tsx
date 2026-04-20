import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Container } from "@/components/Container";
import { Section } from "@/components/Section";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login — Ignite 27",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function parseString(value: string | string[] | undefined, fallback: string): string {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

export default async function LoginPage(props: { searchParams: SearchParams }) {
  const searchParams = await props.searchParams;
  const returnTo = parseString(searchParams.return_to, "/account");
  const noticeParam = parseString(searchParams.notice, "");
  const errorParam = parseString(searchParams.error, "");

  const supabase = await createSupabaseServerClient();
  const { data: sessionData } = await supabase.auth.getUser();
  if (sessionData.user) {
    redirect(returnTo.startsWith("/") ? returnTo : "/account");
  }

  const notice =
    noticeParam === "check_email"
      ? "Check your inbox for a link to set or reset your password."
      : noticeParam === "password_set"
        ? "Password set. Signing you in."
        : "";

  return (
    <Section tone="light">
      <Container>
        <div className="mx-auto max-w-lg">
          <p className="text-eyebrow uppercase text-ignite-red">Account</p>
          <h1 className="mt-4 text-h1">Log in.</h1>
          <p className="mt-4 text-body text-ignite-muted">
            Enter the email and password for your Ignite 27 account.
          </p>

          <div className="mt-6 rounded-2xl border border-ignite-red/30 bg-ignite-red/5 p-4 text-small text-ignite-ink">
            <p className="font-semibold">Just booked and need to set your password?</p>
            <p className="mt-1">
              Your account was created with your booking. Click the set-password link in your
              confirmation email, or{" "}
              <Link
                href="/auth/forgot-password"
                className="font-semibold text-ignite-red underline underline-offset-4"
              >
                get a new set-password link
              </Link>
              .
            </p>
          </div>

          {notice ? (
            <div className="mt-6 rounded-xl border border-ignite-line bg-ignite-cream p-3 text-small text-ignite-ink">
              {notice}
            </div>
          ) : null}
          {errorParam ? (
            <div className="mt-6 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
              {decodeURIComponent(errorParam)}
            </div>
          ) : null}

          <div className="mt-8">
            <LoginForm returnTo={returnTo} />
          </div>

          <p className="mt-6 text-small text-ignite-muted">
            Forgotten your password?{" "}
            <Link
              href="/auth/forgot-password"
              className="underline underline-offset-4 hover:text-ignite-red"
            >
              Request a reset link
            </Link>
            .
          </p>
        </div>
      </Container>
    </Section>
  );
}
