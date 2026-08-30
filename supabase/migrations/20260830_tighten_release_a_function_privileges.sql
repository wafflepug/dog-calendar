-- Release A R&D — tighten SECURITY DEFINER function privileges.
-- Membership helpers are moved out of the exposed public API schema.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create or replace function private.is_business_member(target_business_id uuid)
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

create or replace function private.is_business_owner(target_business_id uuid)
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

revoke all on function private.is_business_member(uuid) from public, anon;
revoke all on function private.is_business_owner(uuid) from public, anon;
grant execute on function private.is_business_member(uuid) to authenticated;
grant execute on function private.is_business_owner(uuid) to authenticated;

alter policy businesses_select_member on public.businesses using (private.is_business_member(id));
alter policy businesses_update_owner on public.businesses using (private.is_business_owner(id)) with check (private.is_business_owner(id));
alter policy members_select_tenant on public.business_members using (private.is_business_member(business_id));
alter policy members_insert_owner on public.business_members with check (private.is_business_owner(business_id));
alter policy members_update_owner on public.business_members using (private.is_business_owner(business_id)) with check (private.is_business_owner(business_id));
alter policy members_delete_owner on public.business_members using (private.is_business_owner(business_id));
alter policy settings_select_member on public.business_settings using (private.is_business_member(business_id));
alter policy settings_update_owner on public.business_settings using (private.is_business_owner(business_id)) with check (private.is_business_owner(business_id));
alter policy dogs_select_member on public.dogs using (private.is_business_member(business_id));
alter policy dogs_insert_member on public.dogs with check (private.is_business_member(business_id));
alter policy dogs_update_member on public.dogs using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
alter policy dogs_delete_owner on public.dogs using (private.is_business_owner(business_id));
alter policy stays_select_member on public.stays using (private.is_business_member(business_id));
alter policy stays_insert_member on public.stays with check (private.is_business_member(business_id));
alter policy stays_update_member on public.stays using (private.is_business_member(business_id)) with check (private.is_business_member(business_id));
alter policy stays_delete_owner on public.stays using (private.is_business_owner(business_id));

revoke execute on function public.create_business(text,text,text,integer) from anon;
grant execute on function public.create_business(text,text,text,integer) to authenticated;

drop function public.is_business_member(uuid);
drop function public.is_business_owner(uuid);
