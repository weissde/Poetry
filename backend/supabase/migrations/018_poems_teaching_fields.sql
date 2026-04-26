-- 018_poems_teaching_fields.sql
-- teaching metadata cached on poems for fast MVP delivery

alter table poems
  add column if not exists curriculum_unit text,
  add column if not exists teaching_objectives jsonb not null default '[]'::jsonb,
  add column if not exists inquiry_tasks jsonb not null default '[]'::jsonb,
  add column if not exists exam_points jsonb not null default '[]'::jsonb,
  add column if not exists difficulty_level text not null default 'medium',
  add column if not exists period_estimate_minutes int not null default 40;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'poems_difficulty_level_allowed'
  ) then
    alter table poems
      add constraint poems_difficulty_level_allowed
      check (difficulty_level in ('easy', 'medium', 'hard'));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'poems_period_estimate_minutes_positive'
  ) then
    alter table poems
      add constraint poems_period_estimate_minutes_positive
      check (period_estimate_minutes > 0);
  end if;
end $$;

create index if not exists idx_poems_curriculum_unit on poems (curriculum_unit);
create index if not exists idx_poems_difficulty_level on poems (difficulty_level);
