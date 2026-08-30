-- Release A operational booking fields.
-- Applied to the dedicated Waffle Release A R&D Supabase project only.
-- The foundation already provides stays_business_dates_idx for tenant/date queries.

alter table public.stays
  add column if not exists arrival_time time,
  add column if not exists departure_time time;

create index if not exists stays_business_status_idx
  on public.stays (business_id, status, start_date);
