export type WrongFilterStatusLike = "all" | "pending" | "mastered" | "retry";
export type SubjectiveDifficultyLike = "easy" | "medium" | "hard";

interface WrongRowLike {
  question_kind?: string | null;
  keyword_tags?: string[] | null;
  error_type?: string | null;
  dynasty?: string | null;
  theme?: string | null;
  poem_title?: string | null;
}

interface PracticeSummaryLike {
  topic?: string | null;
  weak_type?: string | null;
}

const practiceLinkTypes = ["memorization", "meaning", "technique", "emotion", "appreciation", "comparison", "context"] as const;
type PracticeLinkType = (typeof practiceLinkTypes)[number];

const practiceLinkTypeSet = new Set<PracticeLinkType>(practiceLinkTypes);
const subjectiveTypeSignalSet = new Set(["subjective", "主观", "主观题", "essay", "shortanswer", "open"]);
const practiceTypeAliasMap: Record<string, PracticeLinkType[]> = {
  memorization: ["memorization"],
  默写: ["memorization"],
  默写题: ["memorization"],
  全文默写: ["memorization"],
  fulltext: ["memorization"],
  meaning: ["meaning"],
  词义: ["meaning"],
  词义理解: ["meaning"],
  释义: ["meaning"],
  technique: ["technique"],
  手法: ["technique"],
  表达手法: ["technique"],
  技巧: ["technique"],
  修辞: ["technique"],
  emotion: ["emotion"],
  情感: ["emotion"],
  情绪: ["emotion"],
  主旨情感: ["emotion"],
  appreciation: ["appreciation"],
  赏析: ["appreciation"],
  鉴赏: ["appreciation"],
  综合赏析: ["appreciation"],
  comparison: ["comparison"],
  比较: ["comparison"],
  比较阅读: ["comparison"],
  对比: ["comparison"],
  对比阅读: ["comparison"],
  context: ["context"],
  语境: ["context"],
  语境默写: ["context"],
  情境默写: ["context"],
  subjective: ["appreciation", "emotion", "technique"],
  主观: ["appreciation", "emotion", "technique"],
  主观题: ["appreciation", "emotion", "technique"],
  essay: ["appreciation", "emotion", "technique"],
  shortanswer: ["appreciation", "emotion", "technique"],
  open: ["appreciation", "emotion", "technique"],
  exam: ["meaning", "technique", "emotion", "appreciation"],
  考试: ["meaning", "technique", "emotion", "appreciation"],
  objective: ["meaning", "technique", "emotion", "appreciation"],
  客观: ["meaning", "technique", "emotion", "appreciation"],
  客观题: ["meaning", "technique", "emotion", "appreciation"],
};

export function normalizeTypeToken(value: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, "");
}

export function splitTypeTokens(raw: string | null | undefined): string[] {
  return String(raw || "")
    .split(/[，,、/|]/)
    .map((item) => item.trim())
    .filter((item) => Boolean(item));
}

export function normalizePracticeTypesForLink(raw: string | null | undefined): PracticeLinkType[] {
  const seen = new Set<PracticeLinkType>();
  splitTypeTokens(raw).forEach((token) => {
    const normalized = normalizeTypeToken(token);
    const mapped = practiceTypeAliasMap[normalized];
    if (mapped?.length) {
      mapped.forEach((item) => seen.add(item));
      return;
    }
    if (practiceLinkTypeSet.has(normalized as PracticeLinkType)) {
      seen.add(normalized as PracticeLinkType);
    }
  });
  return Array.from(seen);
}

export function hasSubjectiveTypeSignal(raw: string | null | undefined): boolean {
  return splitTypeTokens(raw).some((token) => subjectiveTypeSignalSet.has(normalizeTypeToken(token)));
}

export function formatSourceLabel(rawKey: string): string {
  const key = (rawKey || "").trim();
  if (!key) return "未知来源";
  if (key.includes("plan_task")) return "计划任务练习";
  if (key.includes("exam_submit")) return "考试提交小结";
  if (key.includes("subjective_pack_exam")) return "考试回流专项";
  if (key.includes("subjective_pack_my_learning")) return "我的学习专项";
  if (key.includes("subjective_pack")) return "错题本专项";
  if (key.includes("practice_exam")) return "考试入口练习";
  if (key.includes("practice_my_learning")) return "我的学习入口练习";
  if (key.includes("practice_graph_compare")) return "图谱对比练习";
  if (key.includes("practice_auto")) return "自动生成练习";
  if (key.includes("wrongbook_subjective:")) return "主观专项（来源已标记）";
  if (key === "ai") return "AI 题目";
  if (key === "cache") return "缓存题目";
  if (key === "fallback_local") return "本地兜底题目";
  return key.replace(/_/g, " ");
}

export function buildPracticeBySourceLink(sourceKey: string): { to: string; label: string } {
  const key = (sourceKey || "").trim().toLowerCase();
  if (key.includes("plan_task")) {
    return {
      to: `/practice?topic=${encodeURIComponent("计划任务专项巩固")}&count=8&difficulty=medium&auto=1&source=plan_task`,
      label: "继续计划任务专项",
    };
  }
  if (key.includes("subjective_pack_exam")) {
    return {
      to: buildSubjectivePracticeLink({ status: "all", difficulty: "easy", count: 8, source: "exam" }),
      label: "继续考试回流专项",
    };
  }
  if (key.includes("subjective_pack_my_learning")) {
    return {
      to: buildSubjectivePracticeLink({ status: "all", difficulty: "easy", count: 8, source: "my_learning" }),
      label: "继续我的学习专项",
    };
  }
  if (key.includes("subjective_pack") || key.includes("wrongbook_subjective:")) {
    return {
      to: buildSubjectivePracticeLink({ status: "all", difficulty: "easy", count: 8, source: "my_learning" }),
      label: "继续错题本专项",
    };
  }
  if (key.includes("practice_exam")) {
    return {
      to: `/practice?topic=${encodeURIComponent("考试错因巩固")}&count=6&difficulty=easy&auto=1&source=exam`,
      label: "继续考试入口练习",
    };
  }
  if (key.includes("practice_my_learning")) {
    return {
      to: `/practice?topic=${encodeURIComponent("学习页薄弱点巩固")}&count=6&difficulty=easy&auto=1&source=my_learning`,
      label: "继续学习页练习",
    };
  }
  if (key.includes("practice_graph_compare")) {
    return {
      to: "/graph?compare=1",
      label: "去图谱继续对比练习",
    };
  }
  if (key.includes("practice_auto")) {
    return {
      to: `/practice?topic=${encodeURIComponent("自动生成薄弱点巩固")}&count=6&difficulty=easy&auto=1&source=my_learning`,
      label: "继续自动练习",
    };
  }
  return {
    to: `/practice?topic=${encodeURIComponent("古诗词薄弱点巩固")}&count=6&difficulty=easy&auto=1&source=my_learning`,
    label: "继续该来源练习",
  };
}

export function buildGraphCompareLinkFromTopic(topic: string | null | undefined): string {
  const text = String(topic || "").trim();
  if (!text) {
    return "/graph?compare=1";
  }
  const match = text.match(/^(.+?)与(.+?)对比赏析$/);
  if (!match) {
    return "/graph?compare=1";
  }
  const left = match[1].trim();
  const right = match[2].trim();
  if (!left || !right) {
    return "/graph?compare=1";
  }
  const params = new URLSearchParams();
  params.set("compare", "1");
  params.set("left", left);
  params.set("right", right);
  return `/graph?${params.toString()}`;
}

export function buildSubjectivePracticeLink(options?: {
  status?: WrongFilterStatusLike;
  dynasty?: string;
  theme?: string;
  keywordTag?: string;
  difficulty?: SubjectiveDifficultyLike;
  count?: number;
  source?: string;
}): string {
  const params = new URLSearchParams();
  const topicBase = (options?.theme || "").trim() || "主观题专项复习";
  params.set("topic", topicBase);
  params.set("pack", "subjective_wrongbook");
  params.set("auto", "1");
  params.set("count", String(options?.count ?? 8));
  params.set("difficulty", options?.difficulty || "medium");
  params.set("types", "appreciation,emotion,technique");
  params.set("status", options?.status && options.status !== "all" ? options.status : "pending");
  params.set("source", (options?.source || "my_learning").trim());

  if ((options?.dynasty || "").trim()) {
    params.set("dynasty", String(options?.dynasty).trim());
  }
  if ((options?.theme || "").trim()) {
    params.set("theme", String(options?.theme).trim());
  }
  if ((options?.keywordTag || "").trim()) {
    params.set("keywordTag", String(options?.keywordTag).trim());
  }
  return `/practice?${params.toString()}`;
}

export function buildWrongRowPracticeLink(row: WrongRowLike): string {
  const questionKind = normalizeTypeToken(String(row.question_kind || ""));
  const keywordTag = Array.isArray(row.keyword_tags) && row.keyword_tags.length > 0 ? row.keyword_tags[0] : "";
  const normalizedTypes = normalizePracticeTypesForLink(row.error_type);
  const shouldUseSubjectivePack = questionKind === "subjective" || hasSubjectiveTypeSignal(row.error_type) || Boolean(keywordTag);

  if (shouldUseSubjectivePack) {
    return buildSubjectivePracticeLink({
      status: "pending",
      dynasty: row.dynasty || undefined,
      theme: row.theme || undefined,
      keywordTag: keywordTag || undefined,
      difficulty: "easy",
      count: 6,
      source: "my_learning",
    });
  }

  const params = new URLSearchParams();
  params.set("topic", row.poem_title || row.theme || row.dynasty || "错题专项巩固");
  params.set("count", "6");
  params.set("difficulty", "easy");
  params.set("auto", "1");
  params.set("source", "my_learning");
  if (normalizedTypes.length > 0) {
    params.set("types", normalizedTypes.join(","));
  }
  return `/practice?${params.toString()}`;
}

export function buildExamSummaryPracticeLink(item: PracticeSummaryLike): string {
  const topic = (item.topic || "").trim() || "考试错因巩固";
  const params = new URLSearchParams();
  params.set("topic", topic);
  params.set("count", "8");
  params.set("difficulty", "easy");
  params.set("auto", "1");
  params.set("source", "exam");
  const normalizedTypes = normalizePracticeTypesForLink(item.weak_type);
  if (normalizedTypes.length > 0) {
    params.set("types", normalizedTypes.join(","));
  }
  return `/practice?${params.toString()}`;
}

export function extractExamSummaryTopic(sample: string): string {
  const text = String(sample || "").trim();
  if (!text) return "";
  const idx = text.indexOf(":");
  if (idx <= 0) return text;
  return text.slice(0, idx).trim();
}

export function extractWrongSummaryTitle(sample: string): string {
  const text = String(sample || "").trim();
  if (!text || text.includes("暂无错题")) return "";
  const idx = text.indexOf(":");
  if (idx <= 0) return text;
  return text.slice(0, idx).trim();
}

export function buildPlanTaskPracticeLink(options: {
  focus?: string;
  task?: string;
  priority?: string;
}): string {
  const focus = String(options.focus || "").trim();
  const task = String(options.task || "").trim();
  const priority = String(options.priority || "medium").trim().toLowerCase();
  const topic = task || focus || "古诗词专项巩固";
  const textForKeyword = `${task} ${focus}`.trim();
  let keywordTag = "";
  const quotedMatch = textForKeyword.match(/[“"「『](.+?)[”"」』]/);
  if (quotedMatch?.[1]) {
    keywordTag = quotedMatch[1].trim();
  }
  if (!keywordTag) {
    const keywordPattern = /(关键词|围绕|针对|聚焦)\s*[:：]?\s*([A-Za-z0-9\u4e00-\u9fa5]{2,12})/;
    const plainMatch = textForKeyword.match(keywordPattern);
    if (plainMatch?.[2]) {
      keywordTag = plainMatch[2].trim();
    }
  }

  const maybeSubjective = /主观|赏析|表达|手法|情感|意象/.test(textForKeyword);
  const params = new URLSearchParams();
  params.set("topic", topic);
  params.set("count", priority === "high" ? "8" : "6");
  params.set("difficulty", priority === "high" ? "medium" : "easy");
  params.set("auto", "1");
  params.set("source", "plan_task");
  if (maybeSubjective) {
    params.set("pack", "subjective_wrongbook");
    params.set("status", "pending");
    params.set("types", "appreciation,emotion,technique");
  }
  if (keywordTag) {
    params.set("keywordTag", keywordTag);
  }
  return `/practice?${params.toString()}`;
}

