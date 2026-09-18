import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import {
  ensureStripeProduct,
  ensureStripeProducts,
  resetEnsuredProductsForTests,
  STRIPE_PRODUCT_IDS,
} from "./products";

function stubStripe(opts: {
  existing?: Set<string>;
  createConflict?: boolean;
}): { stripe: Stripe; retrieve: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> } {
  const retrieve = vi.fn(async (id: string) => {
    if (opts.existing?.has(id)) return { id };
    const err = new Error("No such product") as Error & { code: string };
    err.code = "resource_missing";
    throw err;
  });
  const create = vi.fn(async (params: { id: string }) => {
    if (opts.createConflict) {
      const err = new Error("Product already exists") as Error & { code: string };
      err.code = "resource_already_exists";
      throw err;
    }
    return { id: params.id };
  });
  return {
    stripe: { products: { retrieve, create } } as unknown as Stripe,
    retrieve,
    create,
  };
}

beforeEach(() => {
  resetEnsuredProductsForTests();
});

describe("ensureStripeProduct", () => {
  it("creates a missing product under its deterministic id with metadata", async () => {
    const { stripe, create } = stubStripe({});
    const id = await ensureStripeProduct(stripe, "delegate");
    expect(id).toBe("ignite27_delegate");
    expect(create).toHaveBeenCalledTimes(1);
    expect(create.mock.calls[0]![0]).toMatchObject({
      id: "ignite27_delegate",
      name: "IGNITE! 27 delegate ticket",
      metadata: { ignite27_product_key: "delegate" },
    });
  });

  it("does not create when the product already exists in this mode", async () => {
    const { stripe, create } = stubStripe({
      existing: new Set(["ignite27_vip"]),
    });
    const id = await ensureStripeProduct(stripe, "vip");
    expect(id).toBe("ignite27_vip");
    expect(create).not.toHaveBeenCalled();
  });

  it("treats a create race (already exists) as success", async () => {
    const { stripe } = stubStripe({ createConflict: true });
    await expect(ensureStripeProduct(stripe, "lunch")).resolves.toBe("ignite27_lunch");
  });

  it("is idempotent within a process: second call makes no API calls", async () => {
    const { stripe, retrieve, create } = stubStripe({});
    await ensureStripeProduct(stripe, "exhibitor");
    retrieve.mockClear();
    create.mockClear();
    await ensureStripeProduct(stripe, "exhibitor");
    expect(retrieve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("propagates real API errors instead of masking them", async () => {
    const retrieve = vi.fn(async () => {
      const err = new Error("rate limited") as Error & { code: string };
      err.code = "rate_limit";
      throw err;
    });
    const stripe = { products: { retrieve, create: vi.fn() } } as unknown as Stripe;
    await expect(ensureStripeProduct(stripe, "delegate")).rejects.toThrow("rate limited");
  });
});

describe("ensureStripeProducts", () => {
  it("provisions all four products by default", async () => {
    const { stripe, create } = stubStripe({});
    await ensureStripeProducts(stripe);
    const createdIds = create.mock.calls.map((c) => (c[0] as { id: string }).id).sort();
    expect(createdIds).toEqual(Object.values(STRIPE_PRODUCT_IDS).sort());
  });

  it("provisions only the requested subset", async () => {
    const { stripe, create } = stubStripe({});
    await ensureStripeProducts(stripe, ["exhibitor"]);
    expect(create).toHaveBeenCalledTimes(1);
    expect((create.mock.calls[0]![0] as { id: string }).id).toBe("ignite27_exhibitor");
  });
});
