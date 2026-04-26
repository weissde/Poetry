-- 021_wrongquestions_question_id.sql
-- Link wrongbook rows back to source questions when a stable question id exists.

alter table if exists public.wrong_questions
  add column if not exists question_id uuid references public.questions(id) on delete set null;

create index if not exists idx_wrong_questions_question_id
  on public.wrong_questions (question_id);

create index if not exists idx_wrong_questions_user_question_id
  on public.wrong_questions (user_id, question_id)
  where question_id is not null;
