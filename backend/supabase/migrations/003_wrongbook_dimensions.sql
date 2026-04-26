-- 003_wrongbook_dimensions.sql
-- add dynasty/theme dimensions for wrongbook filtering

alter table if exists wrong_questions
  add column if not exists dynasty text,
  add column if not exists theme text;

create index if not exists idx_wrong_questions_user_dynasty
  on wrong_questions (user_id, dynasty);

create index if not exists idx_wrong_questions_user_theme
  on wrong_questions (user_id, theme);
