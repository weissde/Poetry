-- 024_classes.sql
-- 教师班级主表

create table if not exists classes (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  invite_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_classes_teacher_created
  on classes (teacher_id, created_at desc);

create index if not exists idx_classes_invite_code
  on classes (invite_code);

alter table classes enable row level security;

drop policy if exists classes_teacher_all on classes;
create policy classes_teacher_all on classes
  for all
  using (auth.uid() = teacher_id)
  with check (auth.uid() = teacher_id);

