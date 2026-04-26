-- 008_wrongbook_search_indexes.sql
-- Speed up wrongbook keyword filtering (ILIKE) using trigram indexes

create extension if not exists pg_trgm;

create index if not exists idx_wrong_questions_poem_title_trgm
  on wrong_questions using gin (poem_title gin_trgm_ops);

create index if not exists idx_wrong_questions_question_content_trgm
  on wrong_questions using gin (question_content gin_trgm_ops);

create index if not exists idx_wrong_questions_explanation_trgm
  on wrong_questions using gin (explanation gin_trgm_ops);
