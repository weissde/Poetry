-- 017_class_sessions.sql
-- persisted teaching sessions for teacher mode progress

create table if not exists class_sessions (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  poem_id uuid references poems(id) on delete set null,
  poem_title text,
  poem_author text,
  unit_id uuid references teaching_units(id) on delete set null,
  current_step int not null default 0,
  status text not null default 'active',
  notes text,
  duration_minutes int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint class_sessions_current_step_range check (current_step >= 0 and current_step <= 6),
  constraint class_sessions_status_allowed check (status in ('active', 'paused', 'completed'))
);

create index if not exists idx_class_sessions_teacher_created_at
  on class_sessions (teacher_id, created_at desc);

create index if not exists idx_class_sessions_teacher_status
  on class_sessions (teacher_id, status);

create index if not exists idx_class_sessions_poem_started_at
  on class_sessions (poem_id, started_at desc);

alter table class_sessions enable row level security;

drop policy if exists class_sessions_owner_all on class_sessions;
create policy class_sessions_owner_all on class_sessions
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);
