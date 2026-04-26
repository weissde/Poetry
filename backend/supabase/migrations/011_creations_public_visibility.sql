-- 011_creations_public_visibility.sql
-- Creation workshop public/private visibility and public feed support

alter table creations
  add column if not exists is_public boolean not null default false;

alter table creations
  add column if not exists published_at timestamptz;

create index if not exists idx_creations_public_published
  on creations (is_public, published_at desc, created_at desc);

drop policy if exists creations_public_read on creations;
create policy creations_public_read on creations
  for select
  using (is_public = true);
