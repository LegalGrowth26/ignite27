// Last "Resend invite" per ambassador, read from admin_audit rather
// than a new column: the resend action has audit-logged
// 'ambassador.resend_invite' with detail.ambassador_id since it
// shipped, so the history is already there and stays queryable even if
// the list UI changes.

export interface ResendAuditRow {
  created_at: string;
  detail: unknown;
}

// Rows arrive newest-first (the page orders by created_at desc), so the
// first sighting of an ambassador_id wins; out-of-order input still
// resolves to the latest timestamp.
export function latestResendByAmbassador(rows: ResendAuditRow[]): Map<string, string> {
  const latest = new Map<string, string>();
  for (const row of rows) {
    const detail = row.detail as { ambassador_id?: unknown } | null;
    const id = typeof detail?.ambassador_id === "string" ? detail.ambassador_id : null;
    if (!id || !row.created_at) continue;
    const existing = latest.get(id);
    if (!existing || row.created_at > existing) latest.set(id, row.created_at);
  }
  return latest;
}

// "22 Oct", with the year added only when it is not the current one
// ("22 Oct 2026" read from 2027). UK dates, event timezone.
export function formatResendDate(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const sameYear =
    date.toLocaleDateString("en-GB", { year: "numeric", timeZone: "Europe/London" }) ===
    now.toLocaleDateString("en-GB", { year: "numeric", timeZone: "Europe/London" });
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "Europe/London",
  });
}
