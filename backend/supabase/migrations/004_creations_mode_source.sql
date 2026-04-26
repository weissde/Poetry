-- 004_creations_mode_source.sql
-- Add mode/source_text for creation workshop extended flow (idempotent)

alter table creations
  add column if not exists mode text not null default 'review';

alter table creations
  add column if not exists source_text text;

