import { FormEvent, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/common/PageHeader";
import { PageStage } from "@/components/common/PageStage";
import { SectionCard } from "@/components/common/SectionCard";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { useTeachingUnits } from "@/hooks/useTeachingUnits";
import { apiGet, apiPost, createLessonTask } from "@/lib/api";
import { PillNav, SpotlightCard, TiltedCard, type PillNavItem } from "@/components/react-bits";
import type { PoemRecord, TeachingUnitItem } from "@/types";

import { UnitGrid } from "@/components/explore/UnitGrid";
import { AITopicSelector } from "@/components/explore/AITopicSelector";
import { AITopicWorkbench } from "@/components/explore/AITopicWorkbench";

type GradeFilter = "all" | "primary" | "middle" | "high";
type ExploreMainTab = "units" | "ai";

const learnedPoemTitles = new Set(["静夜思", "春望", "望岳", "水调歌头"]);
const RECENT_SEARCH_KEY = "poetry_ai_explore_recent_keywords";
const MAX_RECENT_SEARCH = 6;

const gradeNavItems: readonly PillNavItem<GradeFilter>[] = [
  { id: "all", label: "鍏ㄩ儴瀛︽" },
  { id: "primary", label: "灏忓" },
  { id: "middle", label: "鍒濅腑" },
  { id: "high", label: "楂樹腑" },
];

const mainTabs: readonly PillNavItem<ExploreMainTab>[] = [
  { id: "units", label: "馃摎 璇剧▼鍗曞厓" },
  { id: "ai", label: "馃攳 AI 鎺㈢┒" },
];

function normalizeRecentKeywords(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const unique: string[] = [];
  input.forEach((item) => {
    const text = String(item || "").trim();
    if (!text || unique.includes(text)) return;
    unique.push(text);
  });
  return unique.slice(0, MAX_RECENT_SEARCH);
}

function toLessonTaskErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  const lower = String(message || "").toLowerCase();
  if (lower.includes("020_lesson_tasks.sql") || lower.includes("lesson tasks are not ready")) {
    return "璇惧爞浠诲姟琛ㄦ湭灏辩华锛岃鍏堟墽琛岃縼绉?`020_lesson_tasks.sql`銆?;
  }
  return message;
}

function themeTone(poem: PoemRecord): { banner: string; badge: string } {
  const tags = (poem.tags || []).map((item) => String(item).toLowerCase()).join(" ");
  if (tags.includes("杈瑰") || tags.includes("鎴樹簤")) {
    return { banner: "bg-[linear-gradient(135deg,#E9D7BE,#C9A96E)]", badge: "text-[#8A6330]" };
  }
  if (tags.includes("灞辨按") || tags.includes("鐢板洯")) {
    return { banner: "bg-[linear-gradient(135deg,#DDE9E1,#9FB9A7)]", badge: "text-[#4F6E5A]" };
  }
  if (tags.includes("鎬濅埂") || tags.includes("绂诲埆")) {
    return { banner: "bg-[linear-gradient(135deg,#E6EBF5,#A8B9D6)]", badge: "text-[#4A5F87]" };
  }
  return { banner: "bg-[linear-gradient(135deg,#EFE6DE,#D6BFA9)]", badge: "text-[#76563D]" };
}

export default function ExplorePage(): JSX.Element {
  const { isTeacherMode } = useTeachingMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const initialTab = searchParams.get("tab") as ExploreMainTab;
  const [exploreTab, setExploreTab] = useState<ExploreMainTab>(initialTab === "ai" ? "ai" : "units");
  const [inquiryTopic, setInquiryTopic] = useState<string | null>(null);

  const [keyword, setKeyword] = useState("");
  const [gradeLevel, setGradeLevel] = useState<GradeFilter>("all");
  const [expandedPoemId, setExpandedPoemId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);

  const [items, setItems] = useState<PoemRecord[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [total, setTotal] = useState(0);
  const [hasActivatedResults, setHasActivatedResults] = useState(false);

  const [selectedDynasties, setSelectedDynasties] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [recentKeywords, setRecentKeywords] = useState<string[]>([]);
  
  const { data: teachingUnitsPayload } = useTeachingUnits();
  const teachingUnits: TeachingUnitItem[] = teachingUnitsPayload?.items || [];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(RECENT_SEARCH_KEY);
    if (!raw) return;
    try {
      setRecentKeywords(normalizeRecentKeywords(JSON.parse(raw) as unknown));
    } catch {
      setRecentKeywords([]);
    }
  }, []);

  const persistRecentKeywords = (next: string[]): void => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(next));
    }
  };

  const addRecentKeyword = (value: string): void => {
    const text = value.trim();
    if (!text) return;
    setRecentKeywords((prev) => {
      const next = [text, ...prev.filter((item) => item !== text)].slice(0, MAX_RECENT_SEARCH);
      persistRecentKeywords(next);
      return next;
    });
  };

  const search = async (q: string, nextPage = page, nextPageSize = pageSize, nextGradeLevel: GradeFilter = gradeLevel): Promise<void> => {
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
      setPage(Number(data.pagination?.page ?? nextPage));
      setPageSize(Number(data.pagination?.pageSize ?? nextPageSize));
      setExpandedPoemId((data.items || [])[0]?.id || null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "鎼滅储澶辫触");
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
    void search("", 1, pageSize, "all");
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    void search(keyword.trim(), 1, pageSize);
  };

  const runRecentSearch = (q: string): void => {
    const nextKeyword = q.trim();
    if (!nextKeyword) return;
    setKeyword(nextKeyword);
    setGradeLevel("all");
    setPage(1);
    setSelectedDynasties([]);
    setSelectedThemes([]);
    void search(nextKeyword, 1, pageSize, "all");
  };

  const enrollPoem = async (poem: PoemRecord): Promise<void> => {
    setEnrollingId(poem.id);
    setActionMessage(null);
    setActionError(null);
    try {
      const data = await apiPost<{ created: boolean }>("/memory/enroll", { poemId: poem.id });
      setActionMessage(data.created ? `宸插皢銆?{poem.title}銆嬪姞鍏ヨ蹇嗗垪琛ㄣ€俙 : `銆?{poem.title}銆嬪凡鍦ㄨ蹇嗗垪琛ㄤ腑銆俙);
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "鍔犲叆璁板繂澶辫触");
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
        title: `瀛︿範銆?{poem.title}銆媊,
        detail: `杩涘叆銆?{poem.title}銆嬬簿璁查〉锛屽畬鎴愬鍏ャ€佽В鏋愬拰璇惧爞鎺㈢┒銆俙,
        taskType: "learn",
        status: "assigned",
        to: `/learn/${poem.id}`,
      });
      setActionMessage(`宸插皢銆?{poem.title}銆嬪啓鍏ヤ粖鏃ヨ鍫備换鍔°€俙);
    } catch (err: unknown) {
      setActionError(toLessonTaskErrorMessage(err, "鍙戝竷璇惧爞浠诲姟澶辫触"));
    } finally {
      setPublishingId(null);
    }
  };

  const handleSelectTopic = (topic: string) => {
    setInquiryTopic(topic);
    void search(topic, 1, 5, "all");
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

  const gradeLevelLabel = useMemo(
    () => (gradeLevel === "primary" ? "灏忓" : gradeLevel === "middle" ? "鍒濅腑" : gradeLevel === "high" ? "楂樹腑" : "鍏ㄩ儴瀛︽"),
    [gradeLevel],
  );

  const queryLabel = useMemo(() => {
    if (!hasActivatedResults) return "鏈紑濮嬫悳绱?;
    return keyword.trim() || "鍏ㄩ儴璇楄瘝";
  }, [hasActivatedResults, keyword]);

  return (
    <div className="page-shell">
      <PageStage tone="primary">
        <PageHeader
          variant="compact"
          kicker="鍙戠幇妯″紡"
          title="鎺㈢┒鍙戠幇"
          subtitle={'鎸夎绋嬪崟鍏冩祻瑙堣瘲璇嶏紝鎴栬繘鍏?AI 鎺㈢┒宸ヤ綔鍙拌繘琛屽鎰忚薄銆佸鏈濅唬鐨勪富棰樺璇濄€?}
        />

        <div className="mt-6 flex justify-center">
          <PillNav 
            items={mainTabs} 
            value={exploreTab} 
            onChange={(v) => {
              setExploreTab(v);
              setSearchParams({ tab: v });
            }} 
            className="bg-stone-100 shadow-sm" 
          />
        </div>
      </PageStage>

      <PageStage tone="secondary">
        {error ? <section className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</section> : null}
        {actionError ? <section className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{actionError}</section> : null}
        {actionMessage ? <section className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{actionMessage}</section> : null}

        {exploreTab === "units" ? (
          <div className="space-y-8">
            <SectionCard title="璇剧▼鍗曞厓" subtitle="鍩轰簬鏁欏澶х翰鐨勭粨鏋勫寲鍗曞厓锛屽彲鐩存帴杩涘叆绮捐鎴栧垎鍙戜换鍔°€?>
              <UnitGrid 
                units={teachingUnits} 
                onSelectUnit={(unit) => navigate(unit.poemIds[0] ? `/learn/${unit.poemIds[0]}` : "/learn")} 
              />
            </SectionCard>

            <SectionCard title="璇楄瘝妫€绱? subtitle="鎸夋湞浠ｃ€侀鏉愭垨鍏抽敭璇嶅叏搴撴悳绱㈣瘲璇嶃€?>
              <SpotlightCard className="rounded-[30px] bg-white p-6 shadow-sm md:p-7">
                <form className="space-y-4" onSubmit={onSubmit}>
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder="鎼滅储璇楄瘝銆佽瘲浜恒€佽瘲鍙ャ€佹剰璞?.."
                        className="w-full rounded-full bg-stone-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:bg-white focus:ring-2 focus:ring-[#C9A96E]/50"
                      />
                    </label>
                    <button type="submit" className="rounded-full bg-[#C9A96E] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-[#B68747]">
                      鎼滅储
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <PillNav items={gradeNavItems} value={gradeLevel} onChange={(next) => { setGradeLevel(next); setPage(1); if (hasActivatedResults) void search(keyword.trim(), 1, pageSize, next); }} className="bg-stone-100" />
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {recentKeywords.slice(0, 3).map((item) => (
                        <button key={`recent-${item}`} type="button" onClick={() => runRecentSearch(item)} className="rounded-full bg-stone-100 px-3 py-1 hover:bg-stone-200">{item}</button>
                      ))}
                      <button type="button" onClick={openAllShelf} className="rounded-full bg-stone-100 px-3 py-1 hover:bg-stone-200">鎵撳紑鍏ㄩ儴</button>
                    </div>
                  </div>
                </form>
              </SpotlightCard>

              {hasActivatedResults && (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="rounded-full bg-stone-100 px-3 py-1">鍏抽敭璇嶏細{queryLabel}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1">瀛︽锛歿gradeLevelLabel}</span>
                    <span className="rounded-full bg-stone-100 px-3 py-1">缁撴灉锛歿total} 棣?</span>
                  </div>

                  {loading ? (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-[24px] bg-white shadow-sm" />)}
                    </div>
                  ) : filteredItems.length === 0 ? (
                    <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                      <p className="text-slate-500">鏆傛棤鍖归厤缁撴灉锛岃灏濊瘯鍏朵粬鍏抽敭璇嶃€?</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {filteredItems.map((poem) => {
                        const tone = themeTone(poem);
                        const learned = learnedPoemTitles.has(poem.title);
                        const active = poem.id === expandedPoemId;
                        return (
                          <TiltedCard key={poem.id} className="h-full">
                            <div className={["group flex h-full flex-col rounded-[24px] bg-white p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md", active ? "ring-2 ring-[#C9A96E]" : ""].join(" ")}>
                              <div className={`rounded-2xl px-3 py-3 ${tone.banner}`}>
                                <div className="flex justify-between gap-3">
                                  <div>
                                    <p className={`text-[11px] tracking-[0.14em] ${tone.badge}`}>POEM ENTRY</p>
                                    <h2 className="mt-1 font-serif text-2xl text-[#1A2B4C]">{poem.title}</h2>
                                    <p className="text-xs text-slate-600/80">{poem.dynasty} 路 {poem.author}</p>
                                  </div>
                                  {learned && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] text-emerald-700">宸插</span>}
                                </div>
                              </div>
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                {(poem.tags || []).slice(0, 4).map(tag => <span key={tag} className="rounded-full bg-stone-50 px-2.5 py-1 text-[11px] text-slate-500">{tag}</span>)}
                              </div>
                              <div className="mt-auto pt-4 flex gap-2">
                                <Link to={`/learn/${poem.id}`} className="btn-primary-compact flex-1 justify-center">绮捐</Link>
                                <button type="button" onClick={() => enrollPoem(poem)} disabled={enrollingId === poem.id} className="btn-secondary-compact flex-1">鍔犲叆璁板繂</button>
                                {isTeacherMode && <button type="button" onClick={() => publishPoem(poem)} disabled={publishingId === poem.id} className="btn-secondary-compact flex-1">鍙戜换鍔?</button>}
                              </div>
                            </div>
                          </TiltedCard>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
          </div>
        ) : (
          <div className="space-y-6">
            {!inquiryTopic ? (
              <AITopicSelector onSelectTopic={handleSelectTopic} />
            ) : (
              <AITopicWorkbench 
                topic={inquiryTopic} 
                relatedPoems={items} 
                onClose={() => setInquiryTopic(null)} 
                loadingRelatedPoems={loading} 
              />
            )}
          </div>
        )}
      </PageStage>
    </div>
  );
}

