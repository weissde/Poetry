-- 014_practice_session_summaries.sql
-- Practice session summary logs (graph compare and other sources)

create table if not exists practice_session_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'practice',
  topic text,
  summary text not null,
  attempts int not null default 0,
  correct int not null default 0,
  accuracy int not null default 0,
  weak_type text,
  type_stats jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_practice_session_summaries_user_created
  on practice_session_summaries (user_id, created_at desc);

create index if not exists idx_practice_session_summaries_user_source_created
  on practice_session_summaries (user_id, source, created_at desc);

alter table practice_session_summaries enable row level security;

drop policy if exists practice_session_summaries_owner_all on practice_session_summaries;
create policy practice_session_summaries_owner_all on practice_session_summaries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
