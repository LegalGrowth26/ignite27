import Link from "next/link";
import type { Metadata } from "next";
import { requireSuperAdmin } from "@/lib/admin/guard";
import {
  deleteAgendaItemAction,
  publishAgendaItemAction,
  unpublishAgendaItemAction,
} from "./actions";

export const metadata: Metadata = {
  title: "Admin agenda · IGNITE! 27",
  robots: { index: false, follow: false },
};

interface AgendaRow {
  id: string;
  title: string;
  speaker_name: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  published_at: string | null;
}

function ukTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/London",
  }).format(new Date(iso));
}

export default async function AdminAgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { client } = await requireSuperAdmin();
  const { status } = await searchParams;

  const { data, error } = await client
    .from("agenda_items")
    .select("id, title, speaker_name, location, starts_at, ends_at, published_at")
    .order("starts_at", { ascending: true });

  if (error) {
    return (
      <div>
        <h1 className="text-h1">Agenda</h1>
        <div className="mt-8 rounded-2xl border-2 border-ignite-red bg-ignite-red/5 p-6">
          <p className="text-body font-semibold text-ignite-red">
            Could not load agenda items.
          </p>
          <p className="mt-2 font-mono text-small text-ignite-ink">{error.message}</p>
          <p className="mt-3 text-small text-ignite-muted">
            If this mentions a missing table (agenda_items), the 20260507
            migration has not been applied to this environment yet.
          </p>
        </div>
      </div>
    );
  }

  const rows = (data ?? []) as unknown as AgendaRow[];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-h1">Agenda</h1>
        <Link
          href="/admin/agenda/new"
          className="rounded-full bg-ignite-red px-5 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
        >
          New agenda item
        </Link>
      </div>

      <p className="mt-3 max-w-3xl text-small text-ignite-muted">
        The main-stage running order for the day. Published items appear on
        every attendee&apos;s /my-day plan alongside their booked workshops,
        and workshops that overlap a talk are flagged automatically.
      </p>

      {status === "created" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Agenda item created as a draft. Publish it when the time is fixed.
        </p>
      ) : null}
      {status === "saved" ? (
        <p className="mt-4 rounded-xl border border-ignite-line bg-ignite-white p-3 text-small">
          Agenda item saved.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-ignite-line bg-ignite-white p-6 text-body text-ignite-muted">
          No agenda items yet. Add the running order here as it firms up.
        </p>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map((item) => (
            <div key={item.id} className="rounded-2xl border border-ignite-line bg-ignite-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-h3">{item.title}</p>
                  <p className="mt-1 text-small text-ignite-muted">
                    {ukTime(item.starts_at)} to {ukTime(item.ends_at)}
                    {item.location ? ` · ${item.location}` : ""}
                    {item.speaker_name ? ` · ${item.speaker_name}` : ""} ·{" "}
                    {item.published_at ? "Published" : "Draft"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={`/admin/agenda/${item.id}/edit`}
                    className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                  >
                    Edit
                  </Link>
                  {item.published_at ? (
                    <form action={unpublishAgendaItemAction.bind(null, item.id)}>
                      <button
                        type="submit"
                        className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-ink hover:border-ignite-red"
                      >
                        Unpublish
                      </button>
                    </form>
                  ) : (
                    <>
                      <form action={publishAgendaItemAction.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="rounded-full bg-ignite-red px-4 py-2 text-small font-semibold text-ignite-white hover:bg-ignite-red/90"
                        >
                          Publish
                        </button>
                      </form>
                      <form action={deleteAgendaItemAction.bind(null, item.id)}>
                        <button
                          type="submit"
                          className="rounded-full border border-ignite-line px-4 py-2 text-small font-semibold text-ignite-muted hover:border-ignite-red hover:text-ignite-red"
                        >
                          Delete draft
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
