-- 009_wrongbook_subjective_fields.sql
-- Add wrongbook fields for subjective专项复习: question_kind + keyword_tags

alter table if exists wrong_questions
  add column if not exists question_kind text,
  add column if not exists keyword_tags text[] not null default '{}';

update wrong_questions
set question_kind = case
  when lower(coalesce(error_type, '')) = 'subjective' then 'subjective'
  else 'objective'
end
where coalesce(question_kind, '') = '';

create index if not exists idx_wrong_questions_user_question_kind
  on wrong_questions (user_id, question_kind);

create index if not exists idx_wrong_questions_keyword_tags_gin
  on wrong_questions using gin (keyword_tags);
