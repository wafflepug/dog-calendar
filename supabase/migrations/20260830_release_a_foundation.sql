-- Waffle Release A — multi-tenant R&D foundation
-- Designed for a dedicated Supabase R&D project, never the live Waffle House stack.

create extension if not exists pgcrypto;

create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$'),
  timezone text not null default 'Australia/Sydney',
  currency text not null default 'AUD' check (char_length(currency) = 3),
  normal_capacity integer not null default 4 check (normal_capacity between 1 and 100),
  plan text not null default 'rnd' check (plan in ('rnd','free','plus','pro','internal')),
  created_by uuid not null references auth.users(id),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.business_members (
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'sitter' check (role in ('owner','manager','sitter')),
  status text not null default 'active' check (status in ('active','invited','disabled')),
  created_at timestamptz not null default now(),
  primary key (business_id, user_id)
);

create table if not exists public.business_settings (
  business_id uuid primary key references public.businesses(id) on delete cascade,
  contact_name text,
  contact_email text,
  contact_phone text,
  address_text text,
  logo_path text,
  default_arrival_time time,
  default_departure_time time,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.dogs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dog_name text not null check (char_length(trim(dog_name)) between 1 and 120),
  breed text,
  owner_name text,
  owner_phone text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_id)
);

create table if not exists public.stays (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  dog_id uuid not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'confirmed' check (status in ('potential','meet_greet','confirmed','completed','cancelled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stays_date_order check (end_date >= start_date),
  constraint stays_dog_same_tenant foreign key (dog_id, business_id)
    references public.dogs(id, business_id) on delete cascade
);

create index if not exists business_members_user_idx on public.business_members(user_id, business_id);
create index if not exists dogs_business_idx on public.dogs(business_id, active);
create index if not exists stays_business_dates_idx on public.stays(business_id, start_date, end_date);

create or replace function public.is_business_member(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
  );
$$;

create or replace function public.is_business_owner(target_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.business_members bm
    where bm.business_id = target_business_id
      and bm.user_id = auth.uid()
      and bm.status = 'active'
      and bm.role = 'owner'
  );
$$;

revoke all on function public.is_business_member(uuid) from public;
revoke all on function public.is_business_owner(uuid) from public;
grant execute on function public.is_business_member(uuid) to authenticated;
grant execute on function public.is_business_owner(uuid) to authenticated;

create or replace function public.create_business(
  p_name text,
  p_slug text,
  p_timezone text default 'Australia/Sydney',
  p_capacity integer default 4
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_business uuid;
begin
  if v_user is null then
    raise exception 'Authentication required';
  end if;

  if char_length(trim(coalesce(p_name, ''))) < 2 then
    raise exception 'Business name is required';
  end if;

  if coalesce(p_slug, '') !~ '^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$' then
    raise exception 'Invalid business slug';
  end if;

  insert into public.businesses (name, slug, timezone, normal_capacity, created_by)
  values (trim(p_name), lower(trim(p_slug)), coalesce(nullif(trim(p_timezone), ''), 'Australia/Sydney'), greatest(1, least(coalesce(p_capacity, 4), 100)), v_user)
  returning id into v_business;

  insert into public.business_members (business_id, user_id, role, status)
  values (v_business, v_user, 'owner', 'active');

  insert into public.business_settings (business_id, contact_email)
  values (v_business, auth.jwt() ->> 'email');

  return v_business;
end;
$$;

revoke all on function public.create_business(text, text, text, integer) from public;
grant execute on function public.create_business(text, text, text, integer) to authenticated;

alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.business_settings enable row level security;
alter table public.dogs enable row level security;
alter table public.stays enable row level security;

-- Business visibility and owner-only business mutation.
drop policy if exists businesses_select_member on public.businesses;
create policy businesses_select_member on public.businesses
for select to authenticated
using (public.is_business_member(id));

drop policy if exists businesses_update_owner on public.businesses;
create policy businesses_update_owner on public.businesses
for update to authenticated
using (public.is_business_owner(id))
with check (public.is_business_owner(id));

-- Members can see their tenant roster; only owners may manage it.
drop policy if exists members_select_tenant on public.business_members;
create policy members_select_tenant on public.business_members
for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists members_insert_owner on public.business_members;
create policy members_insert_owner on public.business_members
for insert to authenticated
with check (public.is_business_owner(business_id));

drop policy if exists members_update_owner on public.business_members;
create policy members_update_owner on public.business_members
for update to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

drop policy if exists members_delete_owner on public.business_members;
create policy members_delete_owner on public.business_members
for delete to authenticated
using (public.is_business_owner(business_id));

-- Business settings are readable by the tenant and writable by its owner.
drop policy if exists settings_select_member on public.business_settings;
create policy settings_select_member on public.business_settings
for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists settings_update_owner on public.business_settings;
create policy settings_update_owner on public.business_settings
for update to authenticated
using (public.is_business_owner(business_id))
with check (public.is_business_owner(business_id));

-- Operational proof tables. Every read/write is tenant scoped in the database.
drop policy if exists dogs_select_member on public.dogs;
create policy dogs_select_member on public.dogs
for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists dogs_insert_member on public.dogs;
create policy dogs_insert_member on public.dogs
for insert to authenticated
with check (public.is_business_member(business_id));

drop policy if exists dogs_update_member on public.dogs;
create policy dogs_update_member on public.dogs
for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists dogs_delete_owner on public.dogs;
create policy dogs_delete_owner on public.dogs
for delete to authenticated
using (public.is_business_owner(business_id));

drop policy if exists stays_select_member on public.stays;
create policy stays_select_member on public.stays
for select to authenticated
using (public.is_business_member(business_id));

drop policy if exists stays_insert_member on public.stays;
create policy stays_insert_member on public.stays
for insert to authenticated
with check (public.is_business_member(business_id));

drop policy if exists stays_update_member on public.stays;
create policy stays_update_member on public.stays
for update to authenticated
using (public.is_business_member(business_id))
with check (public.is_business_member(business_id));

drop policy if exists stays_delete_owner on public.stays;
create policy stays_delete_owner on public.stays
for delete to authenticated
using (public.is_business_owner(business_id));

-- No anonymous tenant access is granted. Supabase's service role remains backend-only.
