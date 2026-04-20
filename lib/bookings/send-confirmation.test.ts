import { beforeEach, describe, expect, it, vi } from "vitest";

// Shared mocks declared via vi.hoisted so vi.mock factories below can
// reference them (factories hoist above `import` statements).
const { generateLinkMock } = vi.hoisted(() => ({
  generateLinkMock: vi.fn(),
}));

vi.mock("@/lib/supabase/service-client", () => ({
  createSupabaseServiceClient: () => ({
    auth: {
      admin: {
        generateLink: generateLinkMock,
      },
    },
  }),
}));

vi.mock("@/lib/env", () => ({
  env: {
    siteUrl: () => "https://example.test",
  },
}));

import { generateSetPasswordLink } from "./send-confirmation";

describe("generateSetPasswordLink", () => {
  beforeEach(() => {
    generateLinkMock.mockReset();
  });

  it("routes the recovery redirect through /auth/callback with next=/auth/set-password", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: { action_link: "https://supabase.test/verify?token=abc" } },
      error: null,
    });

    await generateSetPasswordLink("ada@example.com");

    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    const args = generateLinkMock.mock.calls[0]?.[0] as {
      type: string;
      email: string;
      options: { redirectTo: string };
    };
    expect(args.type).toBe("recovery");
    expect(args.email).toBe("ada@example.com");
    expect(args.options.redirectTo).toBe(
      "https://example.test/auth/callback?next=/auth/set-password",
    );
  });

  it("trims a trailing slash from the site URL before composing redirectTo", async () => {
    // Re-mock env just for this case with a trailing slash.
    const envModule = await import("@/lib/env");
    const spy = vi.spyOn(envModule.env, "siteUrl").mockReturnValue("https://example.test/");
    generateLinkMock.mockResolvedValue({
      data: { properties: { action_link: "https://supabase.test/verify?token=abc" } },
      error: null,
    });

    await generateSetPasswordLink("ada@example.com");
    const args = generateLinkMock.mock.calls[0]?.[0] as {
      options: { redirectTo: string };
    };
    expect(args.options.redirectTo).toBe(
      "https://example.test/auth/callback?next=/auth/set-password",
    );
    spy.mockRestore();
  });

  it("throws when Supabase returns no action_link", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: null },
      error: null,
    });
    await expect(generateSetPasswordLink("ada@example.com")).rejects.toThrow(
      /failed to generate set-password link/,
    );
  });

  it("throws and surfaces the Supabase error message when generateLink fails", async () => {
    generateLinkMock.mockResolvedValue({
      data: { properties: null },
      error: { message: "user not found" },
    });
    await expect(generateSetPasswordLink("missing@example.com")).rejects.toThrow(
      /user not found/,
    );
  });
});
