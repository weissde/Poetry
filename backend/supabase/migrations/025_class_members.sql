-- 025_class_members.sql
-- 班级成员表（学生加入班级）

create table if not exists class_members (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid not null references classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'student',
  joined_at timestamptz not null default now(),
  unique (class_id, user_id),
  constraint class_members_role_allowed check (role in ('student', 'teacher'))
);

create index if not exists idx_class_members_class
  on class_members (class_id);

create index if not exists idx_class_members_user
  on class_members (user_id);

alter table class_members enable row level security;

drop policy if exists class_members_member_read on class_members;
create policy class_members_member_read on class_members
  for select
  using (
    auth.uid() = user_id
    or auth.uid() in (select teacher_id from classes where classes.id = class_members.class_id)
  );

drop policy if exists class_members_teacher_manage on class_members;
create policy class_members_teacher_manage on class_members
  for all
  using (
    auth.uid() in (select teacher_id from classes where classes.id = class_members.class_id)
  )
  with check (
    auth.uid() in (select teacher_id from classes where classes.id = class_members.class_id)
  );

