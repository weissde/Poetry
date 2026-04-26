export type TeachingMode = "teacher" | "student";

export const defaultTeachingMode: TeachingMode = "student";

export interface TeachingFlowStep {
  index: string;
  title: string;
  note: string;
  to: string;
}

export const teachingFlowSteps: readonly TeachingFlowStep[] = [
  { index: "01", title: "课前导入", note: "课件预览、背景激活", to: "/" },
  { index: "02", title: "精讲解析", note: "AI 多维拆解诗词", to: "/learn" },
  { index: "03", title: "探究对话", note: "问答与诗人穿越", to: "/explore" },
  { index: "04", title: "练测巩固", note: "专项练习与模拟测评", to: "/practice" },
  { index: "05", title: "记忆复习", note: "复习打卡与间隔重复", to: "/practice?tab=memory" },
  { index: "06", title: "创作迁移", note: "点评、润色与作品导出", to: "/create" },
] as const;

export interface PracticeTeacherCueItem {
  label: string;
  value: string;
}

export interface PracticeTeacherCue {
  distribution: readonly PracticeTeacherCueItem[];
  ctaTo: string;
  ctaLabel: string;
  detail: string;
}

export const practiceTeacherCue: PracticeTeacherCue = {
  distribution: [
    { label: "本次练习进度", value: "--" },
    { label: "班级平均正确率", value: "--" },
  ],
  ctaTo: "/practice",
  ctaLabel: "进入练习",
  detail: "数据将在学生完成练习后更新；当前显示占位值，避免教师视角误读为真实班级统计。",
};

export interface GraphGuideCard {
  title: string;
  detail: string;
}

export const graphGuideCards: readonly GraphGuideCard[] = [
  {
    title: "知识图谱",
    detail: "投屏时建议先展示“我的薄弱图谱”，再切到诗人网络或时间轴做对比讲解。",
  },
  {
    title: "学情复盘",
    detail: "把图谱中的薄弱节点与练测错题对照，帮助学生找到最该优先巩固的方向。",
  },
] as const;

export interface TeacherHintItem {
  page: string;
  title: string;
  detail: string;
}

export const teacherHintItems: readonly TeacherHintItem[] = [
  {
    page: "learn",
    title: "精讲提示",
    detail: "先让学生说出画面，再追问“为什么是霜而不是雪”，把注意力聚焦到意象选择。",
  },
  {
    page: "create",
    title: "创作提示",
    detail: "优先让学生把精讲结论迁移到仿写表达中，避免创作入口与课堂主线脱节。",
  },
  {
    page: "explore",
    title: "探究提示",
    detail: "引导学生在预设问题基础上提出自己的疑问，让 AI 追问而不是直接代答。",
  },
  {
    page: "practice",
    title: "练测提示",
    detail: "先做专项练习巩固当前诗词，再根据正确率决定是否进入模拟考试或记忆复习。",
  },
  {
    page: "memory",
    title: "记忆提示",
    detail: "优先复习易错字和句序，正确率稳定后再挑战半句或全篇默写。",
  },
  {
    page: "graph",
    title: "图谱提示",
    detail: "引导学生从薄弱节点出发探索关联诗词，而不是漫无目的地浏览全图。",
  },
  {
    page: "my-learning",
    title: "学情提示",
    detail: "定期查看错题分布与阶段正确率趋势，帮助学生建立可量化的进步感知。",
  },
] as const;

export interface TeacherModeRouteMeta {
  path: string;
  label: string;
  tags: string[];
  description: string;
}

export const teacherModeRouteMetas: readonly TeacherModeRouteMeta[] = [
  {
    path: "/",
    label: "总览",
    tags: ["导入", "课件"],
    description: "课堂导入与课件预览，激活背景知识。",
  },
  {
    path: "/learn",
    label: "精讲",
    tags: ["解析", "AI"],
    description: "AI 多维拆解：译解、意象、情感、手法。",
  },
  {
    path: "/explore",
    label: "探究",
    tags: ["对话", "穿越"],
    description: "问答探究与诗人穿越对话。",
  },
  {
    path: "/practice",
    label: "练测",
    tags: ["练习", "测评"],
    description: "专项练习、模拟考试与记忆复习。",
  },
  {
    path: "/create",
    label: "创作",
    tags: ["点评", "润色"],
    description: "创作点评、白话转诗与历史润色。",
  },
  {
    path: "/graph",
    label: "图谱",
    tags: ["知识", "网络"],
    description: "知识图谱与诗人网络可视化。",
  },
  {
    path: "/memory",
    label: "记忆",
    tags: ["复习", "打卡"],
    description: "间隔重复与复习打卡管理。",
  },
  {
    path: "/my-learning",
    label: "学情",
    tags: ["复盘", "报告"],
    description: "学习数据复盘与阶段报告导出。",
  },
] as const;

export function resolveTeachingRouteMeta(pathname: string): TeacherModeRouteMeta | null {
  const cleaned = pathname.replace(/\/$/, "") || "/";
  return teacherModeRouteMetas.find((meta) => meta.path === cleaned) ?? null;
}
