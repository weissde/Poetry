-- 007_performance_indexes.sql
-- Indexes for high-frequency page switching queries (idempotent)

create index if not exists idx_exam_records_user_created
  on exam_records (user_id, created_at desc);

create index if not exists idx_review_plans_user_created
  on review_plans (user_id, created_at desc);

create index if not exists idx_creations_user_created
  on creations (user_id, created_at desc);

create index if not exists idx_wrong_questions_user_status_created
  on wrong_questions (user_id, status, created_at desc);

create index if not exists idx_wrong_questions_user_error_type_created
  on wrong_questions (user_id, error_type, created_at desc);

create index if not exists idx_memory_review_logs_user_poem_created
  on memory_review_logs (user_id, poem_id, created_at desc);
