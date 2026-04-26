-- 001_init_tables.sql
-- poetry-ai schema bootstrap

create extension if not exists "uuid-ossp";

create table if not exists poems (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  author text not null,
  dynasty text not null,
  content text not null,
  tags text[] default '{}',
  grade_level text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_poems_title on poems using gin (to_tsvector('simple', title));
create index if not exists idx_poems_author on poems (author);

create table if not exists analysis_cache (
  id uuid primary key default uuid_generate_v4(),
  poem_hash text unique not null,
  poem_id uuid references poems(id) on delete set null,
  model text not null,
  analysis_json jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questions (
  id uuid primary key default uuid_generate_v4(),
  poem_id uuid references poems(id) on delete set null,
  type text not null,
  difficulty int default 3,
  content text not null,
  options jsonb,
  answer text not null,
  explanation text,
  source text default 'ai',
  created_at timestamptz not null default now()
);

create table if not exists user_answers (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid references questions(id) on delete set null,
  poem_id uuid references poems(id) on delete set null,
  question_type text,
  user_answer text,
  is_correct boolean,
  time_spent int,
  context text default 'practice',
  created_at timestamptz not null default now()
);

create table if not exists wrong_questions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  poem_title text,
  question_content text not null,
  user_answer text,
  correct_answer text,
  explanation text,
  error_type text,
  status text default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_wrong_questions_user on wrong_questions (user_id, created_at desc);

create table if not exists weakness_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  profile_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists exam_records (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_type text not null,
  total_score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 0,
  answer_detail jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists review_plans (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exam_date date,
  plan_json jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists creations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  style text,
  reference_poem text,
  content text not null,
  feedback_json jsonb,
  created_at timestamptz not null default now()
);

create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text,
  grade_level text,
  streak_days int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
