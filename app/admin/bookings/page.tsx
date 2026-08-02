import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  fetchAdminBookings,
  normaliseQuery,
  primaryAttendee,
  type SortKey,
} from "@/lib/admin/bookings";
import { formatPoundsFromPence } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Admin bookings · IGNITE! 27",
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const HEADERS: ReadonlyArray<{ label: string; sort?: SortKey }> = [
  { label: "Reference", sort: "reference" },
  { label: "Name" },
  { label: "Email" },
  { label: "Type" },
  { label: "Period" },
  { label: "Paid", sort: "price" },
  { label: "Promo" },
  { label: "Status", sort: "status" },
  { label: "Date", sort: "created_at" },
];

export default async function AdminBookingsPage(props: { searchParams: SearchParams }) {
  const { client } = await requireSuperAdmin();
  const params = await props.searchParams;
  const query = normaliseQuery(params);
  const { rows, error } = await fetchAdminBookings(client, query);

  const exportQs = new URLSearchParams();
  if (query.search) exportQs.set("q", query.search);
  if (query.sort) exportQs.set("sort", query.sort);
  if (query.dir) exportQs.set("dir", query.dir);

  const sortHref = (sort: SortKey) => {
    const qs = new URLSearchParams();
    if (query.search) qs.set("q", query.search);
    qs.set("sort", sort);
    qs.set("dir", query.sort === sort && query.dir === "desc" ? "asc" : "desc");
    return `/admin/bookings?${qs.toString()}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Bookings</h1>
        <a
          href={`/admin/bookings/export?${exportQs.toString()}`}
          className="rounded-full border border-ignite-line bg-ignite-white px-5 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
        >
          Export CSV (current view)
        </a>
      </div>

      <form method="get" action="/admin/bookings" className="mt-6 flex gap-3">
        <input
          type="search"
          name="q"
          defaultValue={query.search ?? ""}
          placeholder="Search reference, name, email, promo code"
          className="w-full max-w-md rounded-xl border border-ignite-line bg-ignite-white px-4 py-2 text-small"
        />
        <button
          type="submit"
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white"
        >
          Search
        </button>
      </form>

      {error ? (
        <p className="mt-6 rounded-xl border border-ignite-red/50 bg-ignite-red/5 p-3 text-small text-ignite-red">
          Query failed: {error}
        </p>
      ) : null}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-ignite-line bg-ignite-white">
        <table className="w-full text-left text-small">
          <thead className="border-b border-ignite-line text-eyebrow uppercase text-ignite-muted">
            <tr>
              {HEADERS.map((h) => (
                <th key={h.label} className="px-4 py-3 font-medium">
                  {h.sort ? (
                    <Link href={sortHref(h.sort)} className="hover:text-ignite-red">
                      {h.label}
                      {query.sort === h.sort ? (query.dir === "asc" ? " ↑" : " ↓") : ""}
                    </Link>
                  ) : (
                    h.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => {
              const attendee = primaryAttendee(b);
              return (
                <tr key={b.id} className="border-b border-ignite-line/60 last:border-0 hover:bg-ignite-cream/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="font-semibold text-ignite-red underline-offset-4 hover:underline"
                    >
                      {b.booking_reference ?? "PENDING"}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {attendee ? `${attendee.first_name} ${attendee.surname}` : "?"}
                  </td>
                  <td className="px-4 py-3">{attendee?.email ?? "?"}</td>
                  <td className="px-4 py-3">
                    {b.booking_type === "exhibitor" ? "Exhibitor" : b.ticket_type === "vip" ? "VIP" : "Delegate"}
                  </td>
                  <td className="px-4 py-3 capitalize">{b.pricing_period}</td>
                  <td className="px-4 py-3">{formatPoundsFromPence(b.gross_amount_pence)}</td>
                  <td className="px-4 py-3">
                    {b.promo_code
                      ? `${b.promo_code}${b.discount_pence ? ` (-${formatPoundsFromPence(b.discount_pence)})` : ""}`
                      : ""}
                  </td>
                  <td className="px-4 py-3">{b.payment_status}</td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {new Date(b.created_at).toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !error ? (
              <tr>
                <td colSpan={HEADERS.length} className="px-4 py-8 text-center text-ignite-muted">
                  No bookings match.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-small text-ignite-muted">
        Showing up to 1,000 rows. Refine the search to narrow the view; the
        CSV export matches whatever is shown here.
      </p>
    </div>
  );
}
