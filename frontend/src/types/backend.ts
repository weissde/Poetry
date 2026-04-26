export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  traceId?: string;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export interface PoemRecord {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  tags?: string[];
  grade_level?: string[];
}

export interface PoemStudyState {
  poemId: string;
  isFavorited: boolean;
  note: string;
  noteUpdatedAt?: string | null;
  currentStage?: string | null;
  stage1CompletedAt?: string | null;
  stage2CompletedAt?: string | null;
  stage3CompletedAt?: string | null;
  stage4CompletedAt?: string | null;
  fullyCompletedAt?: string | null;
  lastAccessedAt?: string | null;
}

export interface FavoritePoemItem {
  poemId: string;
  favoritedAt: string;
  note?: string;
  noteUpdatedAt?: string | null;
  poem: PoemRecord;
}

export interface WeaknessMetric {
  attempts: number;
  correct: number;
  rate: number;
}

export interface WeaknessProfile {
  by_question_type: Record<string, WeaknessMetric>;
  by_dynasty: Record<string, WeaknessMetric>;
  by_theme: Record<string, WeaknessMetric>;
  by_keyword_tag?: Record<string, WeaknessMetric>;
  by_question_source?: Record<string, WeaknessMetric>;
  weak_dimensions: string[];
}

export type ReviewTaskPriority = "high" | "medium" | "low";

export interface ReviewPlanTask {
  day: string;
  focus: string;
  stageGoal?: string;
  tasks: string[];
  taskPriorities?: ReviewTaskPriority[];
}

export interface ReviewPlanKeywordFocus {
  keyword: string;
  goal: string;
  attempts: number;
  rate: number;
  pending: number;
}

export interface ReviewPlan {
  overview: string;
  phaseGoals?: string[];
  dailyTasks: ReviewPlanTask[];
  completedTaskKeys?: string[];
  keywordFocus?: ReviewPlanKeywordFocus[];
}

export interface ReviewPlanProgress {
  completed: number;
  total: number;
  rate: number;
}

export interface PracticeSessionTypeStat {
  type: string;
  attempts: number;
  correct: number;
  rate: number;
}

export interface PracticeSessionSummaryRecord {
  id: string;
  source: string;
  topic?: string | null;
  summary: string;
  attempts: number;
  correct: number;
  accuracy: number;
  weak_type?: string | null;
  type_stats?: PracticeSessionTypeStat[];
  created_at: string;
}

export interface CreationFeedback {
  scores: {
    imagery: number;
    rhythm: number;
    wording: number;
  };
  summary: string;
  suggestions: string[];
  highlights: string[];
  revisedContent?: string | null;
}

export interface CreationRecord {
  id: string;
  style: string | null;
  reference_poem: string | null;
  content: string;
  feedback_json: CreationFeedback | null;
  mode?: string | null;
  source_text?: string | null;
  is_public?: boolean | null;
  published_at?: string | null;
  like_count?: number;
  like_count_1d?: number;
  like_count_7d?: number;
  hot_score?: number;
  liked_by_me?: boolean;
  owned_by_me?: boolean;
  created_at: string;
}

export interface ChatSummaryRecord {
  id: string;
  mode: "qa" | "poet" | string;
  poet?: string | null;
  poem_title?: string | null;
  poem_author?: string | null;
  summary: string;
  key_points?: string[];
  last_question?: string | null;
  message_count: number;
  source?: string | null;
  created_at: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type?: string;
  count?: number;
  dynasty?: string;
  group?: string;
  kind?: string;
  value?: string;
  rate?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type?: string;
  dynasty?: string;
  tag?: string;
  weight?: number;
}

export interface KnowledgeGraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphTimelineItem {
  dynasty: string;
  count: number;
  topPoets: Array<{
    author: string;
    count: number;
  }>;
}

export interface GraphTimelinePayload {
  items: GraphTimelineItem[];
  totalPoems: number;
  dynastyCount: number;
}

export interface PersonalGraphInsightsPayload {
  summary: {
    favoritesCount: number;
    masteredCount: number;
    publicCreations: number;
    receivedLikes: number;
    weeklyPractice: number;
    weeklyWrongAdded: number;
    weeklyMemoryReview: number;
    weeklyCreations: number;
  };
  focus: {
    questionType: { key?: string | null; attempts?: number; rate?: number | null };
    dynasty: { key?: string | null; attempts?: number; rate?: number | null };
    theme: { key?: string | null; attempts?: number; rate?: number | null };
  };
  activity: {
    days: number;
    items: Array<{
      date: string;
      practice: number;
      wrongAdded: number;
      memoryReview: number;
      creation: number;
    }>;
  };
  recommendations: string[];
}

export interface ExamSession {
  mode: string;
  topic: string;
  durationMinutes: number;
  composition?: {
    total: number;
    subjectiveCount: number;
    objectiveCount: number;
    subjectiveRatio: number;
  };
  subjectiveRequired?: number;
  templateId?: string | null;
  questions: Array<{
    type: string;
    questionKind?: "objective" | "subjective" | string;
    content: string;
    options?: string[];
    answer: number | string;
    keywords?: string[];
    explanation: string;
    score?: number;
    dynasty?: string | null;
    theme?: string | null;
  }>;
  createdAt: string;
  owner: string;
}

export interface ExamResultItem {
  index: number;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  userAnswer: number | string | null;
  correctAnswer: number | string;
  questionType?: string;
  questionKind?: "objective" | "subjective" | string;
  dynasty?: string | null;
  theme?: string | null;
  content: string;
  explanation: string;
  rate?: number;
  feedback?: string;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  rubric?: Array<{
    key: string;
    label: string;
    score: number;
    maxScore: number;
    note?: string;
  }>;
  suggestions?: string[];
}

export interface ExamDiagnosticRow {
  key: string;
  label: string;
  attempts: number;
  correct: number;
  wrong: number;
  rate: number;
}

export interface ExamWeakItem extends ExamDiagnosticRow {
  dimension: "questionType" | "dynasty" | "theme";
}

export interface ExamDiagnostics {
  byQuestionType: ExamDiagnosticRow[];
  byDynasty: ExamDiagnosticRow[];
  byTheme: ExamDiagnosticRow[];
  weakest: ExamWeakItem[];
}

export interface ExamResult {
  score: number;
  maxScore: number;
  percent: number;
  detail: ExamResultItem[];
  feedback: string;
  diagnostics?: ExamDiagnostics;
}

export interface ExamHistoryItem {
  id: string;
  createdAt: string;
  examType: string;
  score: number;
  maxScore: number;
  percent: number;
  questionCount: number;
  composition?: {
    total: number;
    subjectiveCount: number;
    objectiveCount: number;
    subjectiveRatio: number;
  };
  diagnostics?: ExamDiagnostics;
  detail?: ExamResultItem[] | null;
}

export interface MemoryPoemBrief {
  id: string;
  title: string;
  author: string;
  dynasty: string;
  content: string;
  tags?: string[];
  grade_level?: string[];
}

export interface MemoryReviewItem {
  id: string;
  poemId: string;
  status: "learning" | "mastered" | string;
  reviewCount: number;
  successCount: number;
  successRate: number;
  intervalDays: number;
  easeFactor: number;
  dueDate: string;
  lastReviewedAt?: string | null;
  lastQuality?: number | null;
  createdAt?: string;
  updatedAt?: string;
  poem?: MemoryPoemBrief | null;
}

export interface MemoryTodayEnvelope {
  today: string;
  totalDue: number;
  items: MemoryReviewItem[];
  pagination?: PaginationMeta;
}

export interface MemoryStatsSummary {
  total: number;
  due: number;
  learning: number;
  mastered: number;
  reviewCount: number;
  successCount: number;
  successRate: number;
  reviewedToday: number;
  streakDays: number;
}

export interface MemoryReviewLog {
  createdAt: string;
  quality: number;
  isCorrect: boolean;
  mode: string;
  timeSpent?: number | null;
  poemId: string;
  poem?: MemoryPoemBrief | null;
}

export interface MemoryAchievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  tier: string;
  target: number;
  progress: number;
  unlocked: boolean;
  unlockedAt?: string | null;
}

export interface MemoryStatsEnvelope {
  today: string;
  summary: MemoryStatsSummary;
  recent: MemoryReviewLog[];
  achievements?: MemoryAchievement[];
}

export interface UserSummaryPayload {
  role?: "student" | "teacher" | string;
  streakDays: number;
  poemCount: number;
  accuracy30d: number;
  weeklyWrongCount: number;
  weeklyPracticeCount: number;
  dueMemoryCount: number;
  weakDimension: string;
}

export type UserRole = "student" | "teacher";

export interface UserRolePayload {
  role: UserRole | string;
}

export interface TodayTaskItem {
  id: string;
  title: string;
  status: "done" | "todo";
  detail: string;
  cta: string;
  to: string;
  source?: string;
  lessonTaskId?: string;
  dueDate?: string | null;
  taskType?: string;
}

export interface TodayTasksPayload {
  items: TodayTaskItem[];
  summary: {
    total: number;
    todo: number;
    done: number;
    dueMemoryCount: number;
    pendingWrongCount: number;
  };
}

export interface TeachingUnitItem {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  gradeLevel: string[];
  poemIds: string[];
  curriculumRef: string;
  masteryTarget: number;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TeachingSessionRecord {
  id: string;
  teacherId: string;
  poemId: string;
  poemTitle: string;
  unitId: string;
  currentStep: number;
  status: string;
  notes: string;
  durationMinutes?: number | null;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface TeachingUnitsPayload {
  items: TeachingUnitItem[];
}

export interface LatestTeachingSessionPayload {
  session: TeachingSessionRecord | null;
}

export interface TeachingSessionCreatePayload {
  poemId?: string;
  poemTitle?: string;
  unitId?: string;
  currentStep?: number;
  notes?: string;
}

export interface TeachingSessionStepUpdatePayload {
  currentStep: number;
  poemId?: string;
  poemTitle?: string;
  unitId?: string;
  notes?: string;
}

export interface TeachingSessionEndPayload {
  notes?: string;
}

export interface TeachingObjectiveItem {
  title: string;
  summary: string;
  goals: string[];
  teacherHint: string;
}

export interface InquiryTaskItem {
  title: string;
  prompt: string;
  presetQuestions: string[];
  completionCta: string;
}

export interface PoemTeachingContentPayload {
  poemId: string;
  poemTitle: string;
  curriculumUnit: string;
  teachingObjectives: TeachingObjectiveItem[];
  inquiryTasks: InquiryTaskItem[];
  difficultyLevel: string;
  periodEstimateMinutes: number;
  updatedAt?: string | null;
}

export interface PoemExamPointsPayload {
  poemId: string;
  poemTitle: string;
  summary: string;
  bulletPoints: string[];
  source: string;
  updatedAt?: string | null;
}

export interface LearningSummaryMetric {
  label: string;
  value: string;
  detail: string;
}

export interface LearningTrendPoint {
  label: string;
  value: number;
}

export interface LearningCoverageItem {
  label: string;
  mastery: number;
  description: string;
}

export interface LearningRateDimension {
  bucket: string;
  label: string;
  attempts: number;
  rate: number;
}

export interface LearningReportSeed {
  summaryTitle: string;
  summaryText: string;
  teacherAdviceTitle: string;
  teacherAdviceText: string;
}

export interface LearningSummaryPayload {
  overview: UserSummaryPayload;
  metrics: LearningSummaryMetric[];
  trend: {
    days: number;
    items: LearningTrendPoint[];
  };
  coverage: LearningCoverageItem[];
  weakest?: LearningRateDimension | null;
  strongest?: LearningRateDimension | null;
  narrative: string;
  reportSeed: LearningReportSeed;
}

export type LessonTaskStatus = "assigned" | "in_progress" | "completed";
export type LessonTaskType = "learn" | "practice" | "memory" | "review" | "custom";

export interface LessonTaskRecord {
  id: string;
  teacherId: string;
  targetUserId: string;
  poemId: string;
  title: string;
  detail: string;
  taskType: LessonTaskType | string;
  status: LessonTaskStatus | string;
  to: string;
  dueDate?: string | null;
  completedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface LessonTasksPayload {
  items: LessonTaskRecord[];
}

export interface LessonTaskCreatePayload {
  targetUserId?: string | null;
  poemId?: string | null;
  title: string;
  detail?: string | null;
  taskType?: LessonTaskType;
  status?: LessonTaskStatus;
  to?: string | null;
  dueDate?: string | null;
}

export interface ClassRecord {
  id: string;
  name: string;
  description: string;
  teacherId: string;
  inviteCode: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface ClassesPayload {
  items: ClassRecord[];
}

export interface ClassStudentRecord {
  id: string;
  user_id?: string;
  userId?: string;
  role: string;
  joined_at?: string | null;
  joinedAt?: string | null;
}

export interface ClassStudentsPayload {
  items: ClassStudentRecord[];
}

export interface ClassSummaryPayload {
  classId: string;
  className: string;
  studentCount: number;
  taskCount: number;
  taskCompletionRate: number;
}

export interface ClassTaskCreateResult {
  items: LessonTaskRecord[];
  createdCount: number;
  classId: string;
}

export interface ClassWrongbookDistributionRow {
  label: string;
  value: string;
  count: number;
}

export interface ClassWrongbookDistributionPayload {
  classId: string;
  totalWrong: number;
  studentCount?: number;
  byType: ClassWrongbookDistributionRow[];
  byDynasty: ClassWrongbookDistributionRow[];
  byTheme: ClassWrongbookDistributionRow[];
  byKeywordTag: ClassWrongbookDistributionRow[];
}

export interface ClassJoinResult {
  joined: boolean;
  classId: string;
  item: ClassRecord;
}

export interface CurriculumNavItem {
  id: string;
  label: string;
  keyword?: string;
  gradeLevel?: string;
}

export interface CurriculumNavSection {
  title: string;
  caption: string;
  items: CurriculumNavItem[];
}
