-- 012_creation_likes.sql
-- Public creation likes + hot sorting

alter table creations
  add column if not exists like_count int not null default 0;

create table if not exists creation_likes (
  id uuid primary key default uuid_generate_v4(),
  creation_id uuid not null references creations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (creation_id, user_id)
);

create index if not exists idx_creation_likes_creation_created
  on creation_likes (creation_id, created_at desc);

create index if not exists idx_creation_likes_user_created
  on creation_likes (user_id, created_at desc);

create index if not exists idx_creations_public_hot
  on creations (is_public, like_count desc, published_at desc, created_at desc);

alter table creation_likes enable row level security;

drop policy if exists creation_likes_select_policy on creation_likes;
create policy creation_likes_select_policy on creation_likes
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from creations c
      where c.id = creation_likes.creation_id
        and c.is_public = true
    )
  );

drop policy if exists creation_likes_insert_policy on creation_likes;
create policy creation_likes_insert_policy on creation_likes
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from creations c
      where c.id = creation_likes.creation_id
        and c.is_public = true
    )
  );

drop policy if exists creation_likes_delete_policy on creation_likes;
create policy creation_likes_delete_policy on creation_likes
  for delete
  using (auth.uid() = user_id);
