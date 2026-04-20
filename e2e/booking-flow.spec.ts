import { expect, test } from "@playwright/test";

// This end-to-end test verifies the form is usable and that submitting it
// redirects the browser to a Stripe Checkout URL. It does not attempt to
// complete payment (that requires Stripe's hosted page). The test requires
// the dev server to be running and real Stripe + Supabase credentials.
//
// Run with: pnpm test:e2e
//
// It is marked as skip by default so CI without those credentials passes.
// Remove the .skip to run locally once your .env.local is wired up.

test.describe.skip("delegate booking happy path", () => {
  test("fills the form and redirects to Stripe Checkout", async ({ page }) => {
    await page.goto("/attend/book?ticket=regular", { waitUntil: "domcontentloaded" });

    await page.getByLabel("First name").fill("Playwright");
    await page.getByLabel("Surname").fill("Test");
    await page.getByLabel("Email").fill("playwright-test@example.com");
    await page.getByLabel("Mobile").fill("07700900000");
    await page.getByLabel("Company").fill("Ignite Test Corp");
    await page.getByLabel("Job title").fill("QA");

    // Dietary defaults to "none"; leave it.
    // Skip lunch add-on; leave marketing unchecked.

    await page.getByLabel(/accept the/i).check();

    // Capture the redirect to checkout.stripe.com.
    const navigationPromise = page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });
    await page.getByRole("button", { name: /Continue to payment/i }).click();
    await navigationPromise;
    expect(page.url()).toContain("checkout.stripe.com");
  });
});
