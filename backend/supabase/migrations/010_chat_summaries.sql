-- 010_chat_summaries.sql
-- Chat summary persistence for M2 dialogue module

create table if not exists chat_summaries (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'qa',
  poet text,
  poem_title text,
  poem_author text,
  poem_context text,
  summary text not null,
  key_points jsonb not null default '[]'::jsonb,
  last_question text,
  message_count int not null default 0,
  source text not null default 'heuristic',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_summaries_user_created
  on chat_summaries (user_id, created_at desc);

alter table chat_summaries enable row level security;

drop policy if exists chat_summaries_owner_all on chat_summaries;
create policy chat_summaries_owner_all on chat_summaries
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
