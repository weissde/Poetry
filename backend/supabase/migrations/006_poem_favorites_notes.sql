-- 006_poem_favorites_notes.sql
-- M1 collection + note tables (idempotent)

create table if not exists poem_favorites (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poem_id uuid not null references poems(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, poem_id)
);

create index if not exists idx_poem_favorites_user_created on poem_favorites (user_id, created_at desc);
create index if not exists idx_poem_favorites_user_poem on poem_favorites (user_id, poem_id);

create table if not exists poem_notes (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poem_id uuid not null references poems(id) on delete cascade,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, poem_id)
);

create index if not exists idx_poem_notes_user_poem on poem_notes (user_id, poem_id);
create index if not exists idx_poem_notes_updated on poem_notes (user_id, updated_at desc);

alter table poem_favorites enable row level security;
alter table poem_notes enable row level security;

drop policy if exists poem_favorites_owner_all on poem_favorites;
create policy poem_favorites_owner_all on poem_favorites
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists poem_notes_owner_all on poem_notes;
create policy poem_notes_owner_all on poem_notes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
