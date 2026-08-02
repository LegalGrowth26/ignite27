import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchOwnBookingDetail, fetchOwnBookings } from "./queries";

// Regression test for the parked account-page RLS issue: the
// bookings_admin_all policy lets a super admin's session SELECT every
// booking, so the customer-facing /account queries MUST always carry an
// explicit user_id filter. This stub simulates that permissive backend
// (it would happily return all rows) and captures the filters actually
// applied, so the test fails if anyone removes the .eq("user_id", ...)
// scoping from the helpers.

interface CapturedFilter {
  column: string;
  value: unknown;
}

function stubBookingsClient() {
  const captured: CapturedFilter[] = [];
  const builder: Record<string, unknown> = {};
  const chain = (result?: unknown) => {
    builder.select = () => builder;
    builder.order = () => Promise.resolve({ data: [], error: null });
    builder.eq = (column: string, value: unknown) => {
      captured.push({ column, value });
      return builder;
    };
    builder.maybeSingle = () => Promise.resolve({ data: result ?? null, error: null });
    return builder;
  };
  const client = {
    from(table: string) {
      if (table !== "bookings") throw new Error(`unexpected table ${table}`);
      return chain();
    },
  } as unknown as SupabaseClient;
  return { client, captured };
}

describe("account query scoping (admin-leak regression)", () => {
  it("fetchOwnBookings always filters by the caller's user_id", async () => {
    const { client, captured } = stubBookingsClient();
    await fetchOwnBookings(client, "app-user-1");
    expect(captured).toContainEqual({ column: "user_id", value: "app-user-1" });
  });

  it("fetchOwnBookingDetail filters by BOTH booking id and user_id", async () => {
    const { client, captured } = stubBookingsClient();
    await fetchOwnBookingDetail(client, "app-user-1", "booking-9");
    expect(captured).toContainEqual({ column: "id", value: "booking-9" });
    expect(captured).toContainEqual({ column: "user_id", value: "app-user-1" });
  });
});
