-- 002_rls_policies.sql

alter table user_answers enable row level security;
alter table wrong_questions enable row level security;
alter table weakness_profiles enable row level security;
alter table exam_records enable row level security;
alter table review_plans enable row level security;
alter table creations enable row level security;
alter table user_profiles enable row level security;

-- poems / analysis_cache / questions are public read in MVP
alter table poems enable row level security;
alter table analysis_cache enable row level security;
alter table questions enable row level security;

drop policy if exists poems_read_all on poems;
create policy poems_read_all on poems for select using (true);

drop policy if exists analysis_cache_read_all on analysis_cache;
create policy analysis_cache_read_all on analysis_cache for select using (true);

drop policy if exists questions_read_all on questions;
create policy questions_read_all on questions for select using (true);

-- user-owned tables

drop policy if exists user_answers_owner_all on user_answers;
create policy user_answers_owner_all on user_answers
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists wrong_questions_owner_all on wrong_questions;
create policy wrong_questions_owner_all on wrong_questions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists weakness_profiles_owner_all on weakness_profiles;
create policy weakness_profiles_owner_all on weakness_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists exam_records_owner_all on exam_records;
create policy exam_records_owner_all on exam_records
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists review_plans_owner_all on review_plans;
create policy review_plans_owner_all on review_plans
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists creations_owner_all on creations;
create policy creations_owner_all on creations
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_profiles_owner_all on user_profiles;
create policy user_profiles_owner_all on user_profiles
  for all
  using (auth.uid() = id)
  with check (auth.uid() = id);
