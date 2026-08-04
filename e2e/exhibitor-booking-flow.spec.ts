import { expect, test } from "@playwright/test";

// Exhibitor booking happy path, mirroring booking-flow.spec.ts: fills
// the form and asserts the browser is redirected to a Stripe Checkout
// URL. It does not complete payment (Stripe's hosted page). Requires
// the dev server plus real Stripe + Supabase credentials, so it is
// skip-by-default like the delegate spec. Remove the .skip to run
// locally once your .env.local is wired up.
//
// Run with: pnpm test:e2e

test.describe.skip("exhibitor booking happy path", () => {
  test("fills the form and redirects to Stripe Checkout", async ({ page }) => {
    await page.goto("/exhibit/book", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Company name").fill("Playwright Test Ltd");

    await page.getByLabel("First name").first().fill("Playwright");
    await page.getByLabel("Surname").first().fill("Contact");
    await page.getByLabel("Email").first().fill("playwright-exhibitor@example.com");
    await page.getByLabel("Mobile").first().fill("07700900000");

    // "The main contact is attendee 1" is pre-ticked, so attendee 1
    // only needs a job title and dietary choice.
    await page.locator("#a1-job").fill("Founder");
    await page.locator("#attendee1-dietary").selectOption("vegetarian");

    await page.locator("#a2-first").fill("Second");
    await page.locator("#a2-surname").fill("Attendee");
    await page.locator("#a2-email").fill("playwright-attendee2@example.com");
    await page.locator("#a2-job").fill("Engineer");
    await page.locator("#attendee2-dietary").selectOption("none");

    await page.getByLabel(/I accept the/).check();

    await page.getByRole("button", { name: /Continue to payment/ }).click();

    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 20_000 });
    expect(page.url()).toContain("checkout.stripe.com");
  });
});
