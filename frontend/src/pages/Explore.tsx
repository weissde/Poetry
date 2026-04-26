import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { usePoemTeachingContent } from "@/hooks/usePoemTeachingContent";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { apiGet, apiPost, createLessonTask, getPoemDetail } from "@/lib/api";
import { requireSupabase } from "@/lib/supabase";
import { Magnet, PillNav, SpotlightCard, TiltedCard, type PillNavItem } from "@/components/react-bits";
import type { CurriculumNavSection, PoemRecord, TeachingUnitItem } from "@/types";

type GradeFilter = "all" | "primary" | "middle" | "high";
type ExploreView = "library" | "units" | "themes";

interface ExplorePreset {
  label: string;
  keyword: string;
  gradeLevel: GradeFilter;
  description: string;
  mood: string;
}

interface ThemeEntry {
  label: string;
  count: number;
  keyword: string;
  detail: string;
}

const explorePresets: readonly ExplorePreset[] = [
  { label: "月夜思乡", keyword: "明月 思乡", gradeLevel: "all", description: "从高频意象入手，适合快速热身。", mood: "清冷乡思" },
  { label: "边塞豪情", keyword: "边塞 将军", gradeLevel: "middle", description: "适合练习情感与手法的对照阅读。", mood: "苍茫壮阔" },
  { label: "田园山水", keyword: "山水 田园", gradeLevel: "primary", description: "节奏舒缓，适合作为入门精读主题。", mood: "淡雅空灵" },
] as const;

const themeEntries: readonly ThemeEntry[] = [
  { label: "明月", count: 0, keyword: "明月", detail: "从月意象切入思乡、怀人和清夜意境。" },
  { label: "杨柳", count: 0, keyword: "杨柳", detail: "适合讲送别诗中景与情的关联。" },
  { label: "鸿雁", count: 0, keyword: "鸿雁", detail: "适合串联边塞、思乡与征旅主题。" },
  { label: "菊花", count: 0, keyword: "菊花", detail: "连接隐逸、节操与秋景审美。" },
  { label: "长亭", count: 0, keyword: "长亭", detail: "从经典送别场景进入古诗词教材单元。" },
  { label: "家书", count: 0, keyword: "家书", detail: "和家国题材形成联动。" },
] as const;

const themeSearchCache = new Map<string, number>();
const RECENT_SEARCH_KEY = "poetry_ai_explore_recent_keywords";
const MAX_RECENT_SEARCH = 6;

const gradeNavItems: readonly PillNavItem<GradeFilter>[] = [
  { id: "all", label: "全部学段" },
  { id: "primary", label: "小学" },
  { id: "middle", label: "初中" },
  { id: "high", label: "高中" },
];

const viewNavItems: readonly PillNavItem<ExploreView>[] = [
  { id: "library", label: "发现·诗词库" },
  { id: "units", label: "发现·课程单元" },
  { id: "themes", label: "发现·主题探索" },
];

function normalizeRecentKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const unique: string[] = [];
  input.forEach((item) => {
    const text = String(item || "").trim();
    if (!text || unique.includes(text)) {
      return;
    }
    unique.push(text);
  });

  return unique.slice(0, MAX_RECENT_SEARCH);
}

function toLessonTaskErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lower = String(message || "").toLowerCase();
  if (lower.includes("020_lesson_tasks.sql") || lower.includes("lesson tasks are not ready")) {
    return "课堂任务表未就绪，请先执行迁移 `020_lesson_tasks.sql`。";
  }
  return message;
}

function themeTone(poem: PoemRecord): { banner: string; badge: string } {
  const tags = (poem.tags || []).map((item) => String(item).toLowerCase()).join(" ");
  if (tags.includes("边塞") || tags.includes("战争")) {
    return {
      banner: "bg-[linear-gradient(135deg,#E9D7BE,#C9A96E)]",
      badge: "text-[#8A6330]",
    };
  }
  if (tags.includes("山水") || tags.includes("田园")) {
    return {
      banner: "bg-[linear-gradient(135deg,#DDE9E1,#9FB9A7)]",
      badge: "text-[#4F6E5A]",
    };
  }
  if (tags.includes("思乡") || tags.includes("离别")) {
    return {
      banner: "bg-[linear-gradient(135deg,#E6EBF5,#A8B9D6)]",
      badge: "text-[#4A5F87]",
    };
  }
  return {
    banner: "bg-[linear-gradient(135deg,#EFE6DE,#D6BFA9)]",
    badge: "text-[#76563D]",
  };
}

export default function ExplorePage(): JSX.Element {
  const { isTeacherMode } = useTeachingMode();
  const [searchParams] = useSearchParams();
  const poemIdParam = searchParams.get("poemId");

  const [keyword, setKeyword] = useState("");
  const [gradeLevel, setGradeLevel] = useState<GradeFilter>("all");
  const [viewMode, setViewMode] = useState<ExploreView>("library");
  const [expandedPoemId, setExpandedPoemId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [workbenchPoem, setWorkbenchPoem] = useState<PoemRecord | null>(null);
  const [workbenchPoemLoading, setWorkbenchPoemLoading] = useState(false);

  const [items, setItems] = useState<PoemRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [hasActivatedResults, setHasActivatedResults] = useState(false);

  const [selectedDynasties, setSelectedDynasties] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  const [learnedPoemIds, setLearnedPoemIds] = useState<Set<string>>(new Set());
  const [themeCounts, setThemeCounts] = useState<Record<string, number>>({});
  const { data: teachingUnitsPayload, refresh: refreshTeachingUnits } = useTeachingUnits();
  const teachingUnits: TeachingUnitItem[] = teachingUnitsPayload?.items || [];
  const {
    data: workbenchContent,
    loading: workbenchContentLoading,
    error: workbenchContentError,
  } = usePoemTeachingContent(poemIdParam);

  const isWorkbenchMode = Boolean(poemIdParam);
  const workbenchObjective = useMemo(
    () => (workbenchContent?.teachingObjectives?.length ? workbenchContent.teachingObjectives[0] : null),
    [workbenchContent?.teachingObjectives],
  );

  useEffect(() => {
    if (!poemIdParam) {
      setWorkbenchPoem(null);
      return;
    }

    let disposed = false;
    setWorkbenchPoemLoading(true);

    void getPoemDetail(poemIdParam)
      .then((poemData) => {
        if (!disposed) {
          setWorkbenchPoem(poemData);
          setExpandedPoemId(poemIdParam);
        }
      })
      .catch((err: unknown) => {
        if (!disposed) {
          setError(err instanceof Error ? err.message : "加载教学数据失败");
        }
      })
      .finally(() => {
        if (!disposed) {
          setWorkbenchPoemLoading(false);
        }
      });

    return () => {
      disposed = true;
    };
  }, [poemIdParam]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) {
      return;
    }

    try {
      setRecentKeywords(normalizeRecentKeywords(JSON.parse(raw) as unknown));
    } catch {
      setRecentKeywords([]);
    }
  }, []);

  useEffect(() => {
    let active = true;
    try {
      const supabase = requireSupabase();
      void supabase
        .from("user_answers")
        .select("poem_id")
        .limit(500)
        .then(({ data }) => {
          if (!active || !data) return;
          const ids = new Set(data.map((row: { poem_id: string | null }) => row.poem_id).filter(Boolean) as string[]);
          setLearnedPoemIds(ids);
        }, () => {
          // keep empty set on failure
        });
    } catch {
      // Supabase not configured
    }
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const counts: Record<string, number> = {};
    const promises = themeEntries.map(async (entry) => {
      try {
        const data = await apiGet<{ total?: number; pagination?: { total?: number } }>(
          `/poems/search?q=${encodeURIComponent(entry.keyword)}&pageSize=1`
        );
        if (active) {
          counts[entry.label] = data.total ?? data.pagination?.total ?? 0;
        }
      } catch {
        if (active) counts[entry.label] = 0;
      }
    });
    void Promise.allSettled(promises).then(() => {
      if (active) setThemeCounts({ ...counts });
    });
    return () => {
      active = false;
    };
  }, []);

  const persistRecentKeywords = (next: string[]): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
  };

  const addRecentKeyword = (value: string): void => {
    const text = value.trim();
    if (!text) {
      return;
    }

    setRecentKeywords((prev) => {
      const next = [text, ...prev.filter((item) => item !== text)].slice(0, MAX_RECENT_SEARCH);
      persistRecentKeywords(next);
      return next;
    });
  };

  const search = async (
    q: string,
    nextPage = page,
    nextPageSize = pageSize,
    nextGradeLevel: GradeFilter = gradeLevel,
  ): Promise<void> => {
    setHasActivatedResults(true);
    setLoading(true);
    setError(null);

    const trimmedQuery = q.trim();
    addRecentKeyword(trimmedQuery);

    try {
      const gradeQuery = nextGradeLevel !== "all" ? `&gradeLevel=${encodeURIComponent(nextGradeLevel)}` : "";
      const data = await apiGet<{
        items: PoemRecord[];
        pagination?: { page: number; pageSize: number; total: number; totalPages: number };
      }>(`/poems/search?q=${encodeURIComponent(trimmedQuery)}${gradeQuery}&page=${nextPage}&pageSize=${nextPageSize}`);

      setItems(data.items || []);
      const fallbackTotal = data.items?.length || 0;
      setTotal(Number(data.pagination?.total ?? fallbackTotal));
      setTotalPages(Math.max(1, Number(data.pagination?.totalPages ?? 1)));
      setPage(Number(data.pagination?.page ?? nextPage));
      setPageSize(Number(data.pagination?.pageSize ?? nextPageSize));
      setExpandedPoemId((data.items || [])[0]?.id || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "搜索失败");
    } finally {
      setLoading(false);
    }
  };

  const openAllShelf = (): void => {
    setKeyword("");
    setGradeLevel("all");
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    setViewMode("library");
    void search("", 1, pageSize, "all");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    setViewMode("library");
    void search(keyword.trim(), 1, pageSize);
  };

  const applyPreset = (preset: ExplorePreset): void => {
    setKeyword(preset.keyword);
    setGradeLevel(preset.gradeLevel);
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    setViewMode("library");
    void search(preset.keyword, 1, pageSize, preset.gradeLevel);
  };

  const runRecentSearch = (q: string): void => {
    const nextKeyword = q.trim();
    if (!nextKeyword) {
      return;
    }
    setKeyword(nextKeyword);
    setGradeLevel("all");
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    setViewMode("library");
    void search(nextKeyword, 1, pageSize, "all");
  };

  const enrollPoem = async (poem: PoemRecord): Promise<void> => {
    setEnrollingId(poem.id);
    setActionMessage(null);
    setActionError(null);
    try {
      const data = await apiPost<{ created: boolean }>("/memory/enroll", { poemId: poem.id });
      setActionMessage(data.created ? `已将《${poem.title}》加入记忆列表。` : `《${poem.title}》已在记忆列表中。`);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "加入记忆失败");
    } finally {
      setEnrollingId(null);
    }
  };

  const publishPoem = async (poem: PoemRecord): Promise<void> => {
    setPublishingId(poem.id);
    setActionError(null);
    setActionMessage(null);
    try {
      await createLessonTask({
        poemId: poem.id,
        title: `学习《${poem.title}》`,
        detail: `进入《${poem.title}》精讲页，完成导入、解析和课堂探究。`,
        taskType: "learn",
        status: "assigned",
        to: `/learn/${poem.id}`,
      });
      setActionMessage(`已将《${poem.title}》写入今日课堂任务。`);
    } catch (err: unknown) {
      setActionError(toLessonTaskErrorMessage(err, "发布课堂任务失败"));
    } finally {
      setPublishingId(null);
    }
  };

  const availableDynasties = useMemo(() => {
    const dynasties = Array.from(new Set(items.map((item) => String(item.dynasty || "").trim()).filter(Boolean)));
    return dynasties.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [items]);

  const availableThemes = useMemo(() => {
    const themes = Array.from(
      new Set(
        items
          .flatMap((item) => item.tags || [])
          .map((tag) => String(tag || "").trim())
          .filter(Boolean),
      ),
    );
    return themes.sort((a, b) => a.localeCompare(b, "zh-Hans-CN")).slice(0, 24);
  }, [items]);

  useEffect(() => {
    setSelectedDynasties((prev) => prev.filter((item) => availableDynasties.includes(item)));
  }, [availableDynasties]);

  useEffect(() => {
    setSelectedThemes((prev) => prev.filter((item) => availableThemes.includes(item)));
  }, [availableThemes]);

  const filteredItems = useMemo(() => {
    return items.filter((poem) => {
      const dynasty = String(poem.dynasty || "").trim();
      const tags = (poem.tags || []).map((tag) => String(tag || "").trim());
      const matchDynasty = selectedDynasties.length === 0 || selectedDynasties.includes(dynasty);
      const matchTheme = selectedThemes.length === 0 || tags.some((tag) => selectedThemes.includes(tag));
      return matchDynasty && matchTheme;
    });
  }, [items, selectedDynasties, selectedThemes]);

  useEffect(() => {
    if (!expandedPoemId && filteredItems.length > 0) {
      setExpandedPoemId(filteredItems[0].id);
      return;
    }

    if (expandedPoemId && !filteredItems.some((item) => item.id === expandedPoemId)) {
      setExpandedPoemId(filteredItems[0]?.id || null);
    }
  }, [expandedPoemId, filteredItems]);

  const expandedPoem = useMemo(
    () => filteredItems.find((item) => item.id === expandedPoemId) || filteredItems[0] || null,
    [expandedPoemId, filteredItems],
  );

  const gradeLevelLabel = useMemo(
    () => (gradeLevel === "primary" ? "小学" : gradeLevel === "middle" ? "初中" : gradeLevel === "high" ? "高中" : "全部学段"),
    [gradeLevel],
  );

  const queryLabel = useMemo(() => {
    if (!hasActivatedResults) {
      return "未开始搜索";
    }
    return keyword.trim() || "全部诗词";
  }, [hasActivatedResults, keyword]);

  const unitSections = useMemo<CurriculumNavSection[]>(() => {
    if (!teachingUnits.length) {
      return [];
    }
    const groups = new Map<string, TeachingUnitItem[]>();
    for (const unit of teachingUnits) {
      const key = unit.gradeLevel[0] || "all";
      groups.set(key, [...(groups.get(key) || []), unit]);
    }
    return Array.from(groups.entries()).map(([grade, items]) => ({
      title: `课程单元 · ${grade === "all" ? "全部" : grade}`,
      caption: "数据库驱动的教学单元入口",
      items: items.map((item) => ({
        id: item.id,
        label: item.title,
      })),
    }));
  }, [teachingUnits]);

  const libraryCards = (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--neutral)' }}>
        <span className="rounded-full bg-stone-100 px-3 py-1">关键词：{queryLabel}</span>
        <span className="rounded-full bg-stone-100 px-3 py-1">学段：{gradeLevelLabel}</span>
        <span className="rounded-full bg-stone-100 px-3 py-1">结果：{total} 首</span>
      </div>

      {availableDynasties.length > 0 || availableThemes.length > 0 ? (
        <div className="space-y-3 rounded-[24px] bg-stone-50 p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]">
          {availableDynasties.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] tracking-[0.12em] text-slate-400">朝代</p>
              <div className="flex flex-wrap gap-2">
                {availableDynasties.map((dynasty) => {
                  const active = selectedDynasties.includes(dynasty);
                  return (
                    <button
                      key={`dynasty-${dynasty}`}
                      type="button"
                      onClick={() => setSelectedDynasties((prev) => (prev.includes(dynasty) ? prev.filter((item) => item !== dynasty) : [...prev, dynasty]))}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs transition",
                        active ? "bg-[#E9DBC0] text-[#6C542B]" : "hover:bg-stone-100",
                      ].join(" ")}
                      style={{ background: active ? undefined : 'var(--bg-surface)', color: active ? undefined : 'var(--neutral)' }}
                    >
                      {dynasty}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {availableThemes.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] tracking-[0.12em] text-slate-400">题材</p>
              <div className="flex flex-wrap gap-2">
                {availableThemes.map((theme) => {
                  const active = selectedThemes.includes(theme);
                  return (
                    <button
                      key={`theme-${theme}`}
                      type="button"
                      onClick={() => setSelectedThemes((prev) => (prev.includes(theme) ? prev.filter((item) => item !== theme) : [...prev, theme]))}
                      className={[
                        "rounded-full px-3 py-1.5 text-xs transition",
                        active ? "bg-[#DCE6F2] text-[#486189]" : "hover:bg-stone-100",
                      ].join(" ")}
                      style={{ background: active ? undefined : 'var(--bg-surface)', color: active ? undefined : 'var(--neutral)' }}
                    >
                      {theme}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={`loading-${index}`} className="h-[260px] rounded-[24px] animate-pulse shadow-[0_12px_28px_rgba(26,43,76,0.08)]" style={{ background: 'var(--bg-surface)' }} />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <SectionCard title="暂无匹配结果" subtitle="换一个关键词，或直接从课程单元与主题入口开始。">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={openAllShelf} className="btn-secondary-compact">
              打开全部目录
            </button>
            <button type="button" onClick={() => applyPreset(explorePresets[0])} className="btn-secondary-compact">
              试试推荐主题
            </button>
          </div>
        </SectionCard>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((poem) => {
              const tone = themeTone(poem);
              const learned = learnedPoemIds.has(poem.id);
              const active = poem.id === expandedPoemId;
              return (
                <TiltedCard key={poem.id} className="h-full">
                  <button
                    type="button"
                    onClick={() => setExpandedPoemId(poem.id)}
                    className={[
                      "group flex h-full w-full flex-col rounded-[24px] p-4 text-left shadow-[0_12px_28px_rgba(26,43,76,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(26,43,76,0.13)]",
                      active ? "ring-2 ring-[#C9A96E]" : "",
                    ].join(" ")}
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div className={`rounded-2xl px-3 py-3 ${tone.banner}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className={`text-[11px] tracking-[0.14em] ${tone.badge}`}>POEM ENTRY</p>
                          <h2 className="mt-1 font-serif text-2xl text-[#1A2B4C]">{poem.title}</h2>
                          <p className="text-xs" style={{ color: 'var(--neutral)' }}>
                            {poem.dynasty} · {poem.author}
                          </p>
                        </div>
                        {learned ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">已学</span> : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {(poem.tags || []).slice(0, 4).map((tag) => (
                        <span key={`${poem.id}-${tag}`} className="rounded-full px-2.5 py-1 text-[11px]" style={{ background: 'var(--bg-subtle)', color: 'var(--neutral)' }}>
                          {tag}
                        </span>
                      ))}
                    </div>

                    <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-7 text-slate-700">{poem.content}</p>

                    <div className="mt-auto pt-4 text-xs text-slate-500">{learned ? "继续复习这首诗" : "点击展开预览面板"}</div>
                  </button>
                </TiltedCard>
              );
            })}
          </div>

          {expandedPoem ? (
            <SectionCard
              title={`${expandedPoem.title} · ${expandedPoem.author} · ${expandedPoem.dynasty}`}
              subtitle="原地预览后再决定进入精讲、练习或加入收藏。"
              density="roomy"
              weight="workspace"
            >
              <div className="space-y-4">
                <div className="rounded-[24px] bg-stone-50 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                  <p className="whitespace-pre-wrap font-serif text-xl leading-10 text-[#1A2B4C]">{expandedPoem.content}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Link to={`/learn/${expandedPoem.id}`} className="btn-primary-compact justify-center">
                    深度精讲
                  </Link>
                  <Link
                    to={`/practice?entry=practice&topic=${encodeURIComponent(expandedPoem.title)}&count=8&difficulty=medium&auto=1`}
                    className="btn-secondary-compact justify-center"
                  >
                    练习此诗
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      void enrollPoem(expandedPoem);
                    }}
                    disabled={enrollingId === expandedPoem.id}
                    className="btn-secondary-compact justify-center disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {enrollingId === expandedPoem.id ? "加入中..." : "加入收藏 / 记忆"}
                  </button>
                  {isTeacherMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        void publishPoem(expandedPoem);
                      }}
                      disabled={publishingId === expandedPoem.id}
                      className="btn-secondary-compact justify-center disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {publishingId === expandedPoem.id ? "发布中..." : "发布给学生"}
                    </button>
                  ) : null}
                </div>
              </div>
            </SectionCard>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              第 {page}/{totalPages} 页 · 每页 {pageSize} 首
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => {
                  const next = Math.max(1, page - 1);
                  setPage(next);
                  void search(keyword.trim(), next, pageSize);
                }}
                className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => {
                  const next = Math.min(totalPages, page + 1);
                  setPage(next);
                  void search(keyword.trim(), next, pageSize);
                }}
                className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="page-shell">
      {isWorkbenchMode ? (
        <PageStage tone="primary">
          <PageHeader
            variant="standard"
            kicker="探究工作台"
            title={workbenchPoem ? `${workbenchPoem.title} · ${workbenchPoem.author}` : "加载中..."}
            subtitle="基于教学目标、探究任务与预设问题的探究工作台"
          />
          {workbenchPoemLoading || workbenchContentLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C9A96E] border-t-transparent" />
            </div>
          ) : workbenchContent ? (
            <div className="space-y-6">
              <TeachingObjectiveCard
                variant="panel"
                kicker="教学目标"
                title={workbenchObjective?.title || workbenchContent.poemTitle}
                summary={workbenchObjective?.summary || `课程单元：${workbenchContent.curriculumUnit || "未指定"}`}
                goals={workbenchObjective?.goals || []}
                chipLabel={`难度：${workbenchContent.difficultyLevel || "中等"}`}
                className="shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
              />
              {workbenchContent.inquiryTasks && workbenchContent.inquiryTasks.length > 0 ? (
                <SectionCard
                  title="探究任务"
                  subtitle="引导性问题与探究方向"
                  density="roomy"
                  weight="workspace"
                >
                  <div className="space-y-4">
                    {workbenchContent.inquiryTasks.map((task, index) => (
                      <article key={index} className="rounded-xl bg-stone-50 p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                        <p className="text-sm font-medium text-[#1A2B4C]">
                          {index + 1}. {task.title}
                        </p>
                        <p className="mt-2 text-sm leading-7 text-slate-700">{task.prompt}</p>
                        {task.presetQuestions.length > 0 ? (
                          <div className="mt-3 space-y-2">
                            {task.presetQuestions.slice(0, 4).map((question) => (
                              <p
                                key={question}
                                className="rounded-lg px-3 py-2 text-xs leading-6 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]"
                                style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}
                              >
                                {question}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </SectionCard>
              ) : null}
              <div className="flex flex-wrap gap-3">
                <Link to={`/learn/${poemIdParam}`} className="btn-primary justify-center">
                  进入精讲
                </Link>
                <Link
                  to={`/practice?entry=practice&topic=${encodeURIComponent(workbenchPoem?.title || "")}&count=8&difficulty=medium&auto=1&source=explore`}
                  className="btn-secondary justify-center"
                >
                  开始练习
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (workbenchPoem) {
                      void enrollPoem(workbenchPoem);
                    }
                  }}
                  disabled={enrollingId === poemIdParam}
                  className="btn-secondary-compact disabled:cursor-not-allowed disabled:opacity-60"
                >
                  加入记忆
                </button>
              </div>
            </div>
          ) : (
            <SectionCard title="暂无教学数据" subtitle="该诗词尚未配置教学目标，请稍后重试或选择其他诗词。">
              {workbenchContentError ? (
                <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
                  {workbenchContentError}
                </p>
              ) : null}
              <Link to="/explore" className="btn-secondary-compact">
                返回探索
              </Link>
            </SectionCard>
          )}
        </PageStage>
      ) : (
        <PageStage tone="primary">
          <PageHeader
            variant="compact"
            kicker="诗词发现"
            title="探索发现"
            subtitle="发现经典诗词，按主题、诗人、朝代浏览，找到适合你的下一首诗，开始精讲旅程。"
          />

          <LearnJourneyProgress className="mt-4" />

          <SpotlightCard
            className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(140deg,#FFFFFF_0%,#F7F5F1_45%,#F0ECE4_100%)] p-6 shadow-[0_18px_44px_rgba(26,43,76,0.09)] md:p-7"
            spotlightColor="rgba(26,43,76,0.08)"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_20%,rgba(201,169,110,0.22),transparent_42%)]" />

            <div className="relative z-[2] space-y-5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#C9A96E]" />
                <p className="text-[11px] tracking-[0.14em] text-slate-500">今天想学什么</p>
              </div>

              <form className="space-y-4" onSubmit={onSubmit}>
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={keyword}
                      onChange={(event) => setKeyword(event.target.value)}
                      placeholder="搜索诗词、诗人、诗句、意象..."
                      className="w-full rounded-full py-3 pl-10 pr-4 text-sm outline-none shadow-[inset_0_0_0_1px_rgba(148,163,184,0.26)] transition focus:shadow-[inset_0_0_0_1px_rgba(26,43,76,0.46)]"
                      style={{ background: 'var(--bg-surface)', color: 'var(--ink-900)' }}
                    />
                  </label>

                  <Magnet className="inline-flex">
                    <button
                      type="submit"
                      className="rounded-full bg-[#C9A96E] px-6 py-3 text-sm font-semibold text-[#1A2B4C] shadow-[0_12px_26px_rgba(201,169,110,0.36)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_rgba(201,169,110,0.44)]"
                    >
                      搜索诗词
                    </button>
                  </Magnet>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--neutral)' }}>
                  {explorePresets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className="rounded-full px-3 py-1.5 shadow-[0_4px_12px_rgba(26,43,76,0.06)] transition hover:bg-stone-50"
                      style={{ background: 'var(--bg-surface)' }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <PillNav
                    items={gradeNavItems}
                    value={gradeLevel}
                    onChange={(next) => {
                      setGradeLevel(next);
                      setPage(1);
                      setSelectedDynasties([]);
                      setSelectedThemes([]);
                      if (hasActivatedResults && viewMode === "library") {
                        void search(keyword.trim(), 1, pageSize, next);
                      }
                    }}
                    className="bg-stone-100"
                  />

                  <div className="flex flex-wrap items-center gap-2 text-xs" style={{ color: 'var(--neutral)' }}>
                    {recentKeywords.slice(0, 3).map((item) => (
                      <button key={`recent-${item}`} type="button" onClick={() => runRecentSearch(item)} className="rounded-full bg-stone-100 px-3 py-1 transition hover:bg-stone-200">
                        {item}
                      </button>
                    ))}
                    <button type="button" onClick={openAllShelf} className="rounded-full bg-stone-100 px-3 py-1 transition hover:bg-stone-200">
                      打开全部目录
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </SpotlightCard>
        </PageStage>
      )}

      <PageStage tone="secondary">
        {error ? <section className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]">{error}</section> : null}
        {actionError ? <section className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]">{actionError}</section> : null}
        {actionMessage ? <section className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 shadow-[inset_0_0_0_1px_rgba(22,163,74,0.2)]">{actionMessage}</section> : null}

        <SectionCard
          title="选择学习入口"
          subtitle="先定视图，再决定是按诗词库、课程单元还是主题意象进入。"
          density="roomy"
          weight="workspace"
          actions={
            <PillNav items={viewNavItems} value={viewMode} onChange={setViewMode} className="bg-stone-100" />
          }
        >
          {viewMode === "library" ? libraryCards : null}

          {viewMode === "units" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm leading-7" style={{ color: 'var(--neutral)' }}>课程单元视图突出“教师可分发的学习单元”，比单纯搜索更适合课堂组织。</p>
                {isTeacherMode ? <button type="button" className="btn-secondary-compact">创建单元</button> : null}
              </div>

              {unitSections.length === 0 ? (
                <SectionCard title="暂无教学单元" subtitle="确认后端 teaching units 数据已初始化，或稍后重试。">
                  <button
                    type="button"
                    onClick={() => {
                      void refreshTeachingUnits();
                    }}
                    className="btn-secondary-compact"
                  >
                    重新加载
                  </button>
                </SectionCard>
              ) : null}

              {unitSections.map((section) => (
                <div key={section.title} className="space-y-3">
                  <div>
                    <p className="text-xs tracking-[0.14em] text-slate-400">{section.title}</p>
                    <p className="mt-1 text-sm" style={{ color: 'var(--neutral)' }}>{section.caption}</p>
                  </div>
                  <div className="space-y-3">
                    {section.items.map((item) => (
                      <article key={item.id} className="rounded-[24px] bg-stone-50 px-5 py-5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                        {(() => {
                          const unit = teachingUnits.find((entry) => entry.id === item.id);
                          if (!unit) {
                            return null;
                          }
                          const gradeText =
                            unit.gradeLevel.length === 0
                              ? "全学段"
                              : unit.gradeLevel
                                  .map((grade) => (grade === "primary" ? "小学" : grade === "middle" ? "初中" : grade === "high" ? "高中" : grade))
                                  .join(" / ");
                          const targetTo = unit.poemIds[0] ? `/learn/${unit.poemIds[0]}` : "/learn";
                          return (
                            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                              <div>
                                <h3 className="font-serif text-2xl text-[#1A2B4C]">{unit.title}</h3>
                                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>{unit.subtitle || "从该教学单元进入精讲流程。"}</p>
                                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>
                                  适用学段：{gradeText} · 诗词数：{unit.poemIds.length} · 掌握目标：{unit.masteryTarget}%
                                </p>
                                {unit.curriculumRef ? <p className="mt-1 text-xs text-slate-500">教材归属：{unit.curriculumRef}</p> : null}
                              </div>
                              <Link to={targetTo} className="btn-primary-compact justify-center">
                                进入单元
                              </Link>
                            </div>
                          );
                        })()}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {viewMode === "themes" ? (
            <div className="space-y-5">
              <p className="text-sm leading-7" style={{ color: 'var(--neutral)' }}>从意象与主题云进入列表，比单首搜索更适合课堂导入和专题学习。</p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {themeEntries.map((entry) => {
                  const realCount = themeCounts[entry.label] ?? entry.count;
                  return (
                  <SpotlightCard
                    key={entry.label}
                    className="rounded-[24px] p-4 shadow-[0_10px_28px_rgba(26,43,76,0.08)]"
                    style={{ background: 'var(--bg-surface)' }}
                    spotlightColor="rgba(201,169,110,0.14)"
                  >
                    <p className="text-[11px] tracking-[0.14em] text-slate-400">主题探索</p>
                    <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">
                      {entry.label} <span className="text-lg text-slate-400">{realCount} 首</span>
                    </h3>
                    <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>{entry.detail}</p>
                    <button
                      type="button"
                      onClick={() => {
                        setKeyword(entry.keyword);
                        setViewMode("library");
                        void search(entry.keyword, 1, pageSize, gradeLevel);
                      }}
                      className="mt-4 inline-flex items-center gap-1 rounded-full bg-stone-100 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-stone-200"
                    >
                      查看该主题
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </SpotlightCard>
                  );
                })}
              </div>
            </div>
          ) : null}
        </SectionCard>
      </PageStage>
    </div>
  );
}
