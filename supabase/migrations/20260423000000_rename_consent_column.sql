-- Rename public.email_signups.wants_agenda_alert to wants_topic_alert.
--
-- Rationale: the column was introduced when /agenda was the only capture
-- surface. /speakers now writes to the same table and future pages will
-- too, so the "agenda" prefix is misleading. The column semantically means
-- "did the user opt in to alerts about whatever topic this row represents";
-- the source column remains the authoritative "which topic". Pure rename,
-- no behavioural change.

alter table public.email_signups
  rename column wants_agenda_alert to wants_topic_alert;

comment on column public.email_signups.wants_topic_alert is
  'Did the user opt in to alerts about the topic represented by the source column? The source column is the authoritative subject (e.g. agenda_page, speakers_page); this boolean just says whether they consented to receive those alerts at all. True for every opted-in signup.';
