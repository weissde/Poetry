-- 019_user_role.sql
-- add lightweight role flag for teacher/student mode

alter table user_profiles
  add column if not exists role text not null default 'student',
  add column if not exists school_name text,
  add column if not exists class_name text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_profiles_role_allowed'
  ) then
    alter table user_profiles
      add constraint user_profiles_role_allowed
      check (role in ('student', 'teacher'));
  end if;
end $$;

create index if not exists idx_user_profiles_role on user_profiles (role);
