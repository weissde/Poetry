-- 005_memory_reviews.sql
-- memory module tables + policies (idempotent)

create table if not exists memory_reviews (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poem_id uuid not null references poems(id) on delete cascade,
  status text not null default 'learning',
  review_count int not null default 0,
  success_count int not null default 0,
  interval_days int not null default 1,
  ease_factor numeric(4,2) not null default 2.50,
  due_date date not null default current_date,
  last_reviewed_at timestamptz,
  last_quality int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, poem_id)
);

create index if not exists idx_memory_reviews_user_due on memory_reviews (user_id, due_date asc, updated_at desc);
create index if not exists idx_memory_reviews_user_status on memory_reviews (user_id, status);

create table if not exists memory_review_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  memory_review_id uuid not null references memory_reviews(id) on delete cascade,
  poem_id uuid not null references poems(id) on delete cascade,
  quality int not null,
  is_correct boolean not null default false,
  mode text not null default 'self_check',
  time_spent int,
  created_at timestamptz not null default now()
);

create index if not exists idx_memory_review_logs_user_created on memory_review_logs (user_id, created_at desc);

alter table memory_reviews enable row level security;
alter table memory_review_logs enable row level security;

drop policy if exists memory_reviews_owner_all on memory_reviews;
create policy memory_reviews_owner_all on memory_reviews
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists memory_review_logs_owner_all on memory_review_logs;
create policy memory_review_logs_owner_all on memory_review_logs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
