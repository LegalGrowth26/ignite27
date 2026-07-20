# Supabase auth email templates

## Why this doc exists

Two of our auth flows send email:

- **Booking confirmation** — sent by our own code via Resend using a
  React Email template in `emails/`. Fully branded, fully in code, we
  control it.
- **Password reset** (`/auth/forgot-password`) — sent by
  **Supabase itself** from a template configured in the Supabase
  dashboard. When this template hasn't been customised it goes out
  looking like a generic "supabase.io" system email — no Ignite
  branding, no matching tone.

The forgot-password flow calls `supabase.auth.resetPasswordForEmail`
in the browser (`app/auth/forgot-password/ForgotPasswordForm.tsx`).
Supabase then dispatches the email through its own SMTP using the
"Reset Password" template. There is no code-side hook that touches
the message body; only the dashboard template controls what the
recipient sees.

This doc explains how to update that template so the reset email
matches the site tone.

## Who does this

Tom. It takes about 3 minutes and needs no code changes.

## Where to update it

**Environment:** the Supabase project for `ignite27` (both dev and
production projects — updates must be done in each project's
dashboard separately).

**Path in the dashboard:**

1. Sign in at <https://supabase.com/dashboard>.
2. Pick the correct project (dev or production — do dev first,
   verify, then repeat in production).
3. Left sidebar → **Authentication** (the person-with-key icon).
4. Sub-menu → **Emails**.
5. Tab bar at the top → **Reset Password**.

You will see two editable sections: **Subject heading** and
**Message body** (HTML).

## Suggested subject

```
Set or reset your Ignite 27 password
```

Short, name the event, describe the action. Matches how the booking
confirmation reads.

## Suggested message body

Paste this HTML into the message-body editor. It uses the Supabase
template variable `{{ .ConfirmationURL }}` for the one-time link —
Supabase substitutes the real URL when the email is sent. **Do not
change `{{ .ConfirmationURL }}`.**

```html
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
  <p style="font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #E11D2E; margin: 0 0 12px;">
    Ignite 27 · Account
  </p>
  <h1 style="font-size: 24px; line-height: 1.25; margin: 0 0 16px;">
    Set or reset your password
  </h1>
  <p style="font-size: 16px; line-height: 1.55; margin: 0 0 16px;">
    You (or someone with your email) asked for a link to set or reset
    the password on your Ignite 27 account. Click below to pick a new
    one. The link is single-use and expires in 60 minutes.
  </p>
  <p style="margin: 24px 0;">
    <a href="{{ .ConfirmationURL }}"
       style="display: inline-block; background: #E11D2E; color: #ffffff;
              text-decoration: none; font-weight: 600; padding: 12px 20px;
              border-radius: 12px;">
      Set my password
    </a>
  </p>
  <p style="font-size: 14px; line-height: 1.55; color: #5a5a5a; margin: 0 0 8px;">
    If the button does not work, paste this link into your browser:
  </p>
  <p style="font-size: 12px; word-break: break-all; color: #5a5a5a; margin: 0 0 24px;">
    {{ .ConfirmationURL }}
  </p>
  <p style="font-size: 14px; line-height: 1.55; color: #5a5a5a; margin: 0;">
    If you did not ask for this, ignore this email — nothing changes
    until the link is used. Reply to this message and it comes
    straight to Tom.
  </p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;">
  <p style="font-size: 12px; line-height: 1.5; color: #7a7a7a; margin: 0;">
    Ignite 27 · Thursday 21 January 2027 · Kelham Hall, Newark<br>
    Sent from noreply@ignite27.co.uk on behalf of Lincolnshire Marketing.
  </p>
</div>
```

Notes:

- The red hex `#E11D2E` is `--ignite-red` from the site.
- The 60-minute expiry claim matches Supabase's default recovery
  link lifetime. If you change the lifetime under
  **Authentication → Settings → JWT expiry / Email OTP** later, edit
  this template to match.
- `{{ .ConfirmationURL }}` is the one Supabase template variable we
  rely on. Do not add other Supabase template variables unless you
  have tested them in a Supabase preview send — some are gated by
  feature flag and silently render as empty.
- The link Supabase generates routes through our `/auth/callback`
  because we call `resetPasswordForEmail(email, { redirectTo })` in
  `app/auth/forgot-password/ForgotPasswordForm.tsx` with
  `${origin}/auth/set-password` as the redirect. The callback then
  exchanges the code for a session and forwards to /auth/set-password.
  You do not need to override anything URL-related in the dashboard.

## How to test

1. Save the template in the **dev** project.
2. On the dev site, use `/auth/forgot-password` with a test email
   allow-listed for dev sends.
3. Open the received email. Confirm branding, subject, and body all
   look right. Click the link and confirm you land on
   `/auth/set-password` and can set a password.
4. Repeat the template save in the **production** project.
5. Optionally: send yourself a real production reset from your own
   admin email to sanity-check.

## Other templates to consider

Supabase also has templates for **Confirm signup**, **Magic Link**,
**Invite user**, **Change Email Address**, and **Reauthentication**.
We do not currently use those flows on Ignite 27 (booking triggers
`admin.createUser` with `email_confirm: true`, and password recovery
covers the only real customer-facing case), so they can stay on the
Supabase defaults for now. If we start using them, revisit this doc.

## If we ever want to remove the dashboard dependency

`resetPasswordForEmail` is the only reason we depend on the Supabase
dashboard template at all. The booking confirmation flow already
demonstrates the pattern for owning the send end-to-end:
`lib/bookings/send-confirmation.ts` calls
`supabase.auth.admin.generateLink({ type: "recovery", email })` and
then sends the resulting link via Resend using a React Email
template. Migrating forgot-password to that same shape would
eliminate the dashboard-template dependency but adds a small server
action + Resend template + tests. Worth doing if we start needing
per-environment template variants or want the reset copy in git; not
worth doing while the dashboard template solves the problem cleanly.
