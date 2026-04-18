function required(name: string, value: string | undefined): string {
  if (!value || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  supabaseServiceRoleKey: () => required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY),
  stripeSecretKey: () => required("STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY),
  stripeWebhookSecret: () => required("STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET),
  stripePublishableKey: () => required("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY),
  resendApiKey: () => required("RESEND_API_KEY", process.env.RESEND_API_KEY),
  resendFromEmail: () => required("RESEND_FROM_EMAIL", process.env.RESEND_FROM_EMAIL),
  resendReplyToEmail: () => required("RESEND_REPLY_TO_EMAIL", process.env.RESEND_REPLY_TO_EMAIL),
  emailAllowlistEnabled: () => process.env.EMAIL_ALLOWLIST_ENABLED === "true",
  siteUrl: () => required("NEXT_PUBLIC_SITE_URL", process.env.NEXT_PUBLIC_SITE_URL),
  environment: () => required("NEXT_PUBLIC_ENVIRONMENT", process.env.NEXT_PUBLIC_ENVIRONMENT),
};

export type Environment = "local" | "prod";
