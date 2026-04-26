-- 026_poem_study_states.sql
-- 用户诗词学习进度表
-- 为每个用户的每首诗记录学习阶段进度

CREATE TABLE IF NOT EXISTS poem_study_states (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poem_id uuid NOT NULL REFERENCES poems(id) ON DELETE CASCADE,
  current_stage text NOT NULL DEFAULT 'not_started',
  stage1_completed_at timestamptz,
  stage2_completed_at timestamptz,
  stage3_completed_at timestamptz,
  stage4_completed_at timestamptz,
  fully_completed_at timestamptz,
  last_accessed_at timestamptz NOT NULL DEFAULT now(),
  session_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, poem_id)
);

CREATE INDEX IF NOT EXISTS idx_pss_user_stage ON poem_study_states(user_id, current_stage);
CREATE INDEX IF NOT EXISTS idx_pss_user_accessed ON poem_study_states(user_id, last_accessed_at DESC);

-- 从 user_answers 推算已有用户的历史诗词学习进度
INSERT INTO poem_study_states (user_id, poem_id, current_stage, stage1_completed_at, last_accessed_at)
SELECT
  ua.user_id,
  ua.poem_id,
  CASE
    WHEN COUNT(*) >= 8 THEN 'stage4'
    WHEN COUNT(*) >= 5 THEN 'stage3'
    WHEN COUNT(*) >= 2 THEN 'stage2'
    ELSE 'stage1'
  END AS current_stage,
  MIN(ua.created_at) AS stage1_completed_at,
  MAX(ua.created_at) AS last_accessed_at
FROM user_answers ua
WHERE ua.poem_id IS NOT NULL
GROUP BY ua.user_id, ua.poem_id
ON CONFLICT (user_id, poem_id) DO NOTHING;
