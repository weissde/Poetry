-- 016_teaching_units.sql
-- 课程教学单元表：替代前端 mocks/teachingData.ts 中的 teachingLessonUnitSections

create table if not exists teaching_units (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  subtitle text,
  category text not null default 'theme',
  grade_level text[] not null default '{}',
  poem_ids uuid[] not null default '{}',
  poem_count int not null default 0,
  curriculum_ref text,
  mastery_target int not null default 80,
  display_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_teaching_units_grade
  on teaching_units using gin(grade_level);
create index if not exists idx_teaching_units_order
  on teaching_units (display_order asc);
create index if not exists idx_teaching_units_active
  on teaching_units (is_active) where is_active = true;

alter table teaching_units enable row level security;

drop policy if exists teaching_units_authenticated_read on teaching_units;
create policy teaching_units_authenticated_read on teaching_units
  for select
  using (auth.role() = 'authenticated');

-- 暂不开放写权限（通过 seed / migration 管理数据）
