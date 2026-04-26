-- 015_practice_question_feedback.sql
-- 练习题“题目有误”反馈表

create table if not exists public.practice_question_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text,
  question_type text,
  question_content text not null,
  options_json jsonb not null default '[]'::jsonb,
  selected_index int,
  correct_index int,
  comment text not null,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_practice_question_feedback_user_created
  on public.practice_question_feedback(user_id, created_at desc);

alter table public.practice_question_feedback enable row level security;

drop policy if exists "practice_question_feedback_select_own" on public.practice_question_feedback;
create policy "practice_question_feedback_select_own"
  on public.practice_question_feedback
  for select
  using (auth.uid() = user_id);

drop policy if exists "practice_question_feedback_insert_own" on public.practice_question_feedback;
create policy "practice_question_feedback_insert_own"
  on public.practice_question_feedback
  for insert
  with check (auth.uid() = user_id);
