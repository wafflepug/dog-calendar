-- Release A R&D — covering indexes for tenant foreign keys.

create index if not exists businesses_created_by_idx
  on public.businesses(created_by);

create index if not exists stays_dog_business_idx
  on public.stays(dog_id, business_id);
