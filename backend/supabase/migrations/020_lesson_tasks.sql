-- 020_lesson_tasks.sql
-- persisted teacher-assigned lesson tasks

create table if not exists lesson_tasks (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_by uuid references auth.users(id) on delete cascade,
  target_user_id uuid references auth.users(id) on delete cascade,
  session_id uuid references class_sessions(id) on delete set null,
  poem_id uuid references poems(id) on delete set null,
  poem_title text,
  title text not null,
  detail text,
  task_config jsonb not null default '{}'::jsonb,
  task_type text not null default 'practice',
  status text not null default 'pending',
  "to" text,
  due_at timestamptz,
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lesson_tasks_task_type_allowed check (task_type in ('practice', 'memory', 'exam', 'review')),
  constraint lesson_tasks_status_allowed check (status in ('pending', 'in_progress', 'completed'))
);

alter table lesson_tasks
  add column if not exists created_by uuid references auth.users(id) on delete cascade,
  add column if not exists session_id uuid references class_sessions(id) on delete set null,
  add column if not exists poem_title text,
  add column if not exists task_config jsonb not null default '{}'::jsonb,
  add column if not exists due_at timestamptz;

update lesson_tasks
set created_by = teacher_id
where created_by is null;

update lesson_tasks
set status = 'pending'
where status = 'assigned';

update lesson_tasks
set task_type = 'practice'
where task_type in ('learn', 'custom');

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'lesson_tasks_task_type_allowed'
  ) then
    alter table lesson_tasks drop constraint lesson_tasks_task_type_allowed;
  end if;
  alter table lesson_tasks
    add constraint lesson_tasks_task_type_allowed
    check (task_type in ('practice', 'memory', 'exam', 'review'));
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'lesson_tasks_status_allowed'
  ) then
    alter table lesson_tasks drop constraint lesson_tasks_status_allowed;
  end if;
  alter table lesson_tasks
    add constraint lesson_tasks_status_allowed
    check (status in ('pending', 'in_progress', 'completed'));
end $$;

create index if not exists idx_lesson_tasks_target_status_due
  on lesson_tasks (target_user_id, status, due_date);

create index if not exists idx_lesson_tasks_target
  on lesson_tasks (target_user_id, status)
  where target_user_id is not null;

create index if not exists idx_lesson_tasks_teacher_created_at
  on lesson_tasks (teacher_id, created_at desc);

create index if not exists idx_lesson_tasks_created_by_created_at
  on lesson_tasks (created_by, created_at desc);

create index if not exists idx_lesson_tasks_created_by
  on lesson_tasks (created_by, created_at desc);

create index if not exists idx_lesson_tasks_poem_id
  on lesson_tasks (poem_id);

alter table lesson_tasks enable row level security;

drop policy if exists lesson_tasks_teacher_all on lesson_tasks;
drop policy if exists lesson_tasks_creator_all on lesson_tasks;
create policy lesson_tasks_creator_all on lesson_tasks
  for all
  using (auth.uid() = coalesce(created_by, teacher_id))
  with check (auth.uid() = coalesce(created_by, teacher_id));

drop policy if exists lesson_tasks_target_read on lesson_tasks;
create policy lesson_tasks_target_read on lesson_tasks
  for select
  using (auth.uid() = target_user_id);

drop policy if exists lesson_tasks_target_update on lesson_tasks;
create policy lesson_tasks_target_update on lesson_tasks
  for update
  using (auth.uid() = target_user_id)
  with check (auth.uid() = target_user_id);
