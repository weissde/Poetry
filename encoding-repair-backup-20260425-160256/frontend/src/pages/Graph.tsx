﻿﻿﻿import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { PageHeader } from "@/components/common/PageHeader";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageStage } from "@/components/common/PageStage";
import { TeacherHintCallout } from "@/components/teaching/TeacherHintCallout";
import { TeachingObjectiveCard } from "@/components/teaching/TeachingObjectiveCard";
import { StateCalloutCard } from "@/components/common/StateCalloutCard";
import { apiDelete, apiGet } from "@/lib/api";
import { useScrollRestore } from "@/hooks/useScrollRestore";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { graphGuideCards, teacherHintItems } from "@/content/teachingStatic";
import { Magnet, PillNav, SpotlightCard, type PillNavItem } from "@/components/react-bits";
import type {
  GraphEdge,
  GraphNode,
  GraphTimelinePayload,
  KnowledgeGraphPayload,
  PersonalGraphInsightsPayload,
  PoemRecord,
  PracticeSessionSummaryRecord,
} from "@/types";

type NodeKind = "poet" | "imagery" | "dynasty" | "theme" | "title" | "error_type";
type RecentCompareDays = "7" | "30" | "all";
type GraphDetailTab = "poet" | "imagery" | "timeline" | "insights";
type GraphWorkspaceView = "overview" | "related" | "details";
type GraphPrimaryNav = "poet" | "imagery" | "timeline" | "learning";

interface RelatedState {
  kind: NodeKind;
  value: string;
}

interface NodePoemRecommendation {
  title: string;
  reason: string;
  actionPlan: string[];
}

interface NodePoemsResponse {
  items: PoemRecord[];
  kind?: string;
  value?: string;
  recommendation?: NodePoemRecommendation;
}

interface PersonalGraphResponse extends KnowledgeGraphPayload {
  summary?: {
    wrongCount?: number;
    typeCount?: number;
    dynastyCount?: number;
    themeCount?: number;
    poemCount?: number;
  };
}

interface InsightActionItem {
  key: string;
  label: string;
  to: string;
  kind?: NodeKind;
  value?: string;
}

interface PoetCompareState {
  left: string;
  right: string;
  dynasty?: string;
}

interface PracticeSessionSummaryListResponse {
  items: PracticeSessionSummaryRecord[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
  };
}

const GraphOverview = lazy(async () => {
  const module = await import("@/components/graph/GraphOverview");
  return { default: module.GraphOverview };
});

const GraphRelatedPoems = lazy(async () => {
  const module = await import("@/components/graph/GraphRelatedPoems");
  return { default: module.GraphRelatedPoems };
});

const GraphImageryView = lazy(async () => {
  const module = await import("@/components/graph/GraphImageryView");
  return { default: module.GraphImageryView };
});

const GraphTimelineView = lazy(async () => {
  const module = await import("@/components/graph/GraphTimelineView");
  return { default: module.GraphTimelineView };
});

const GraphInsightsView = lazy(async () => {
  const module = await import("@/components/graph/GraphInsightsView");
  return { default: module.GraphInsightsView };
});

function GraphLazyFallback({ label }: { label: string }): JSX.Element {
  return (
    <section className="surface-card card-cozy text-sm text-slate-500">
      {label}鍔犺浇涓?..
    </section>
  );
}

const relatedKindLabelMap: Record<NodeKind, string> = {
  poet: "璇椾汉",
  imagery: "鎰忚薄",
  dynasty: "鏈濅唬",
  theme: "棰樻潗",
  title: "璇楀悕",
  error_type: "棰樺瀷寮遍」",
};

const poetEdgeTypeLabelMap: Record<string, string> = {
  same_dynasty: "鍚屾湞浠?,
  shared_theme: "涓婚鐩镐技",
};

const practiceTypeLabelMap: Record<string, string> = {
  memorization: "榛樺啓",
  meaning: "璇嶄箟",
  technique: "鎵嬫硶",
  emotion: "鎯呮劅",
  appreciation: "璧忔瀽",
  comparison: "姣旇緝闃呰",
  context: "璇榛樺啓",
};

const practiceTypeSet = new Set(["memorization", "meaning", "technique", "emotion", "appreciation", "comparison", "context"]);
const GRAPH_PRIMARY_ITEMS: ReadonlyArray<PillNavItem<GraphPrimaryNav>> = [
  { id: "poet", label: "璇椾汉鍏崇郴" },
  { id: "imagery", label: "鎰忚薄鍏宠仈" },
  { id: "timeline", label: "鏈濅唬鏃堕棿杞? },
  { id: "learning", label: "鎴戠殑瀛︿範鐗堝浘" },
];

const graphTeachingObjective = {
  title: "鍥捐氨鏁欏鐩爣",
  summary: "鎶娾€滅悊瑙ｂ€濊浆鎴愮粨鏋勶細鍏堥攣瀹氳杽寮辩偣锛屽啀鐢ㄥ叧绯荤綉缁滆娓呰縼绉昏矾寰勶紝骞舵妸鍙戠幇閫佸洖缁冩祴涓庡鎯呭鐩樸€?,
  goals: ["閿佸畾 1 涓杽寮辫妭鐐癸紙棰樺瀷/鎰忚薄/璇椾汉/棰樻潗锛?, "鎵撳紑鍏宠仈璇楄瘝骞舵寫 1 棣栧仛瀵规瘮鎴栧欢灞?, "杩涘叆缁冩祴/瀛︽儏瀹屾垚闂幆澶嶇洏"],
  teacherHint: "婕旂ず寤鸿锛氬厛灞曠ず鈥滆杽寮辫妭鐐光啋鍏宠仈璇楄瘝鈫掑搴旂粌娴嬧€濓紝鍐嶅洖鍒板鎯呴〉灞曠ず閿欏洜涓庤鍒掋€?,
};

function topImageryKeywords(poems: PoemRecord[], imageryKeywords: string[], limit = 5): Array<{ keyword: string; count: number }> {
  const counts = new Map<string, number>();
  poems.forEach((poem) => {
    const content = String(poem.content || "");
    imageryKeywords.forEach((keyword) => {
      if (!keyword) {
        return;
      }
      if (content.includes(keyword)) {
        counts.set(keyword, (counts.get(keyword) || 0) + 1);
      }
    });
  });
  return Array.from(counts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => {
      if (a.count === b.count) {
        return a.keyword.localeCompare(b.keyword, "zh-Hans-CN");
      }
      return b.count - a.count;
    })
    .slice(0, limit);
}

function splitPersonalNodes(nodes: GraphNode[]): Record<string, GraphNode[]> {
  const grouped: Record<string, GraphNode[]> = {
    question_type: [],
    dynasty: [],
    theme: [],
    poem: [],
  };

  nodes.forEach((node) => {
    const key = node.group || "";
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(node);
  });

  return grouped;
}

function buildPracticeLink(related: RelatedState | null): string {
  if (!related) {
    return "/practice";
  }

  const params = new URLSearchParams();
  params.set("auto", "1");
  params.set("difficulty", "medium");

  if (related.kind === "error_type") {
    const key = related.value.trim();
    params.set("topic", `${practiceTypeLabelMap[key] || key}涓撻」缁冧範`);
    params.set("count", "8");
    if (practiceTypeSet.has(key)) {
      params.set("types", key);
    }
    return `/practice?${params.toString()}`;
  }

  params.set("topic", related.value);
  params.set("count", related.kind === "title" ? "5" : "8");
  if (related.kind === "imagery" || related.kind === "theme") {
    params.set("types", "emotion,appreciation");
  } else if (related.kind === "poet" || related.kind === "dynasty") {
    params.set("types", "meaning,technique,emotion,appreciation");
  }
  return `/practice?${params.toString()}`;
}

function buildPoemPracticeLink(title: string): string {
  const params = new URLSearchParams();
  params.set("topic", title);
  params.set("count", "5");
  params.set("difficulty", "medium");
  params.set("auto", "1");
  return `/practice?${params.toString()}`;
}

function buildPoetComparePracticeLink(left: string, right: string): string {
  const params = new URLSearchParams();
  params.set("topic", `${left}涓?{right}瀵规瘮璧忔瀽`);
  params.set("count", "8");
  params.set("difficulty", "medium");
  params.set("types", "meaning,technique,emotion,appreciation");
  params.set("source", "graph_compare");
  params.set("poetA", left);
  params.set("poetB", right);
  params.set("auto", "1");
  return `/practice?${params.toString()}`;
}

function buildWrongbookLink(related: RelatedState | null): string {
  const params = new URLSearchParams();
  params.set("tab", "wrongbook");
  if (!related) {
    return `/my-learning?${params.toString()}`;
  }

  if (related.kind === "error_type") {
    params.set("type", related.value);
  } else if (related.kind === "dynasty") {
    params.set("dynasty", related.value);
  } else if (related.kind === "theme") {
    params.set("theme", related.value);
  } else {
    params.set("keyword", related.value);
  }

  return `/my-learning?${params.toString()}`;
}

function buildPoemWrongbookLink(title: string): string {
  const params = new URLSearchParams();
  params.set("tab", "wrongbook");
  params.set("keyword", title);
  return `/my-learning?${params.toString()}`;
}

function parseCompareTopic(topic: string): { left: string; right: string } | null {
  const text = String(topic || "").trim();
  if (!text) {
    return null;
  }
  const match = text.match(/^(.+?)涓?.+?)瀵规瘮璧忔瀽$/);
  if (match?.[1] && match?.[2]) {
    return { left: match[1].trim(), right: match[2].trim() };
  }
  const fallback = text.match(/^(.+?)\s+vs\s+(.+)$/i);
  if (fallback?.[1] && fallback?.[2]) {
    return { left: fallback[1].trim(), right: fallback[2].trim() };
  }
  return null;
}

function parseRecentCompareDays(value: string | null): RecentCompareDays {
  if (value === "7" || value === "30" || value === "all") {
    return value;
  }
  return "30";
}

function parseRecentCompareSort(value: string | null): "latest" | "accuracy_asc" {
  if (value === "latest" || value === "accuracy_asc") {
    return value;
  }
  return "accuracy_asc";
}

function parseRecentComparePage(value: string | null): number {
  const page = Number(value || "1");
  if (Number.isFinite(page) && page >= 1) {
    return Math.floor(page);
  }
  return 1;
}

function parseGraphPrimaryNav(value: string | null): GraphPrimaryNav {
  if (value === "imagery" || value === "timeline" || value === "learning") {
    return value;
  }
  return "poet";
}

export default function GraphPage(): JSX.Element {
  useScrollRestore("graph");
  const { isTeacherMode } = useTeachingMode();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const comparePresetAppliedRef = useRef<string>("");
  const highlightPresetAppliedRef = useRef<string>("");
  const initialRecentCompareKeyword = String(searchParams.get("rc_q") || "").trim();
  const initialRecentCompareDays = parseRecentCompareDays(searchParams.get("rc_days"));
  const initialRecentCompareSort = parseRecentCompareSort(searchParams.get("rc_sort"));
  const initialRecentComparePage = parseRecentComparePage(searchParams.get("rc_page"));

  const [poetGraph, setPoetGraph] = useState<KnowledgeGraphPayload | null>(null);
  const [imageryGraph, setImageryGraph] = useState<KnowledgeGraphPayload | null>(null);
  const [personalGraph, setPersonalGraph] = useState<PersonalGraphResponse | null>(null);
  const [personalInsights, setPersonalInsights] = useState<PersonalGraphInsightsPayload | null>(null);
  const [timelineGraph, setTimelineGraph] = useState<GraphTimelinePayload | null>(null);

  const [related, setRelated] = useState<RelatedState | null>(null);
  const [relatedPoems, setRelatedPoems] = useState<PoemRecord[]>([]);
  const [relatedRecommendation, setRelatedRecommendation] = useState<NodePoemRecommendation | null>(null);
  const [relatedLoading, setRelatedLoading] = useState<boolean>(false);
  const [poetEdgeDynastyFilter, setPoetEdgeDynastyFilter] = useState<string>("all");
  const [poetCompare, setPoetCompare] = useState<PoetCompareState | null>(null);
  const [poetCompareLoading, setPoetCompareLoading] = useState<boolean>(false);
  const [poetCompareError, setPoetCompareError] = useState<string | null>(null);
  const [poetCompareLeftPoems, setPoetCompareLeftPoems] = useState<PoemRecord[]>([]);
  const [poetCompareRightPoems, setPoetCompareRightPoems] = useState<PoemRecord[]>([]);
  const [recentCompareLogs, setRecentCompareLogs] = useState<PracticeSessionSummaryRecord[]>([]);
  const [recentCompareLoading, setRecentCompareLoading] = useState<boolean>(false);
  const [recentCompareError, setRecentCompareError] = useState<string | null>(null);
  const [recentCompareSort, setRecentCompareSort] = useState<"latest" | "accuracy_asc">(initialRecentCompareSort);
  const [recentCompareKeyword, setRecentCompareKeyword] = useState<string>(initialRecentCompareKeyword);
  const [recentCompareAppliedKeyword, setRecentCompareAppliedKeyword] = useState<string>(initialRecentCompareKeyword);
  const [recentCompareDays, setRecentCompareDays] = useState<RecentCompareDays>(initialRecentCompareDays);
  const [recentComparePage, setRecentComparePage] = useState<number>(initialRecentComparePage);
  const [recentCompareTotal, setRecentCompareTotal] = useState<number>(0);
  const [recentCompareTotalPages, setRecentCompareTotalPages] = useState<number>(1);
  const [recentComparePageSize] = useState<number>(12);
  const [recentCompareDeleteId, setRecentCompareDeleteId] = useState<string | null>(null);
  const [graphStage, setGraphStage] = useState<"overview" | "deep">("deep");
  const [graphWorkspaceView, setGraphWorkspaceView] = useState<GraphWorkspaceView>("overview");
  const [graphDetailTab, setGraphDetailTab] = useState<GraphDetailTab>("poet");
  const [graphSearchInput, setGraphSearchInput] = useState<string>("");
  const [graphSearchKeyword, setGraphSearchKeyword] = useState<string>("");
  const [graphFocusNode, setGraphFocusNode] = useState<string>("");
  const fgRef = useRef<any>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const [poets, imagery, personal, personalInsightsPayload, timeline] = await Promise.all([
          apiGet<KnowledgeGraphPayload>("/graph/poets", { cacheTtlMs: 120000 }),
          apiGet<KnowledgeGraphPayload>("/graph/imagery", { cacheTtlMs: 120000 }),
          apiGet<PersonalGraphResponse>("/graph/personal", { cacheTtlMs: 120000 }),
          apiGet<PersonalGraphInsightsPayload>("/graph/personal/insights?days=7", { cacheTtlMs: 60000 }),
          apiGet<GraphTimelinePayload>("/graph/timeline", { cacheTtlMs: 120000 }),
        ]);
        if (!active) {
          return;
        }
        setPoetGraph(poets);
        setImageryGraph(imagery);
        setPersonalGraph(personal);
        setPersonalInsights(personalInsightsPayload);
        setTimelineGraph(timeline);
      } catch (err: unknown) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "鍥捐氨鍔犺浇澶辫触");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const imageryKeywords = useMemo(
    () => (imageryGraph?.nodes || []).filter((node) => node.type === "imagery"),
    [imageryGraph?.nodes],
  );
  const imageryKeywordValues = useMemo(
    () => imageryKeywords.map((node) => String(node.label || "").trim()).filter((item) => item.length > 0),
    [imageryKeywords],
  );

  const personalNodes = useMemo(
    () => (personalGraph?.nodes || []).filter((node) => node.type === "weakness"),
    [personalGraph?.nodes],
  );

  const personalGroups = useMemo(() => splitPersonalNodes(personalNodes), [personalNodes]);
  const poetEdges = useMemo(() => (poetGraph?.edges || []) as GraphEdge[], [poetGraph?.edges]);
  const poetEdgeDynasties = useMemo(() => {
    const values = new Set<string>();
    poetEdges.forEach((edge) => {
      const dynasty = String(edge.dynasty || "").trim();
      if (dynasty) {
        values.add(dynasty);
      }
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
  }, [poetEdges]);
  const filteredPoetEdges = useMemo(() => {
    if (poetEdgeDynastyFilter === "all") {
      return poetEdges;
    }
    return poetEdges.filter((edge) => String(edge.dynasty || "").trim() === poetEdgeDynastyFilter);
  }, [poetEdges, poetEdgeDynastyFilter]);
  const poetForceLayout = useMemo(() => {
    const poetNodes = (poetGraph?.nodes || []).filter((node) => String(node.type || "").trim() === "poet");
    
    // Sort and limit nodes
    const sortedNodes = [...poetNodes]
      .sort((a, b) => Number(b.count || 0) - Number(a.count || 0))
      .slice(0, 36);
    const nodeKeys = new Set(sortedNodes.map((node) => String(node.label || "").trim()).filter(Boolean));

    // Filter edges
    const edges = filteredPoetEdges
      .map((edge) => ({
        source: String(edge.source || "").trim(),
        target: String(edge.target || "").trim(),
      }))
      .filter((edge) => edge.source && edge.target && nodeKeys.has(edge.source) && nodeKeys.has(edge.target));

    const nodes = sortedNodes.map((node) => ({
      id: String(node.label || "").trim(),
      label: String(node.label || "").trim(),
      count: Number(node.count || 0),
    }));

    return { nodes, edges };
  }, [poetGraph?.nodes, filteredPoetEdges]);
  const poetForceNodeLookup = useMemo(() => {
    const map = new Map<string, any>();
    poetForceLayout.nodes.forEach((node) => map.set(node.label, node));
    return map;
  }, [poetForceLayout.nodes]);
  const poetGraphSearchMatches = useMemo(() => {
    const keyword = String(graphSearchInput || "").trim();
    if (!keyword) {
      return poetForceLayout.nodes.slice(0, 8);
    }
    return poetForceLayout.nodes.filter((node) => node.label.includes(keyword)).slice(0, 8);
  }, [graphSearchInput, poetForceLayout.nodes]);
  const compareLeftImagery = useMemo(
    () => topImageryKeywords(poetCompareLeftPoems, imageryKeywordValues, 6),
    [poetCompareLeftPoems, imageryKeywordValues],
  );
  const compareRightImagery = useMemo(
    () => topImageryKeywords(poetCompareRightPoems, imageryKeywordValues, 6),
    [poetCompareRightPoems, imageryKeywordValues],
  );
  const recentCompareSorted = useMemo(() => {
    const list = [...recentCompareLogs];
    if (recentCompareSort === "accuracy_asc") {
      return list.sort((a, b) => {
        const accuracyDiff = Number(a.accuracy || 0) - Number(b.accuracy || 0);
        if (accuracyDiff !== 0) {
          return accuracyDiff;
        }
        return String(b.created_at || "").localeCompare(String(a.created_at || ""));
      });
    }
    return list.sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")));
  }, [recentCompareLogs, recentCompareSort]);
  const activityPeak = useMemo(() => {
    const items = personalInsights?.activity?.items || [];
    return items.reduce((max, item) => {
      const total = Number(item.practice || 0) + Number(item.wrongAdded || 0) + Number(item.memoryReview || 0) + Number(item.creation || 0);
      return Math.max(max, total);
    }, 1);
  }, [personalInsights?.activity?.items]);

  const insightActions = useMemo(() => {
    const actions: InsightActionItem[] = [];
    const pushAction = (item: InsightActionItem): void => {
      if (actions.some((action) => action.key === item.key)) {
        return;
      }
      actions.push(item);
    };

    const questionTypeKey = String(personalInsights?.focus?.questionType?.key || "").trim();
    if (questionTypeKey) {
      const typeLabel = practiceTypeLabelMap[questionTypeKey] || questionTypeKey;
      pushAction({
        key: `q-${questionTypeKey}`,
        label: `鍘诲仛${typeLabel}涓撻」`,
        to: buildPracticeLink({ kind: "error_type", value: questionTypeKey }),
        kind: "error_type",
        value: questionTypeKey,
      });
    }

    const dynastyKey = String(personalInsights?.focus?.dynasty?.key || "").trim();
    if (dynastyKey) {
      pushAction({
        key: `d-${dynastyKey}`,
        label: `鍘诲仛${dynastyKey}涓撻」`,
        to: buildPracticeLink({ kind: "dynasty", value: dynastyKey }),
        kind: "dynasty",
        value: dynastyKey,
      });
    }

    const themeKey = String(personalInsights?.focus?.theme?.key || "").trim();
    if (themeKey) {
      pushAction({
        key: `t-${themeKey}`,
        label: `鍘诲仛${themeKey}涓撻」`,
        to: buildPracticeLink({ kind: "theme", value: themeKey }),
        kind: "theme",
        value: themeKey,
      });
    }

    if (actions.length === 0) {
      return [
        {
          key: "default-practice",
          label: "寮€濮嬬患鍚堢粌涔?,
          to: "/practice?topic=鍙よ瘲璇嶇患鍚?count=8&difficulty=medium&auto=1",
        },
      ];
    }
    return actions.slice(0, 3);
  }, [personalInsights]);

  const learningBehaviorNodes = useMemo(
    () => [
      {
        key: "practice",
        label: "缁冧範",
        value: Number(personalInsights?.summary?.weeklyPractice || 0),
        to: "/practice?topic=鍙よ瘲璇嶇患鍚?count=8&difficulty=medium&auto=1",
        colorClass: "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]",
      },
      {
        key: "memory",
        label: "璁板繂澶嶄範",
        value: Number(personalInsights?.summary?.weeklyMemoryReview || 0),
        to: "/memory",
        colorClass: "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]",
      },
      {
        key: "creation",
        label: "鍒涗綔",
        value: Number(personalInsights?.summary?.weeklyCreations || 0),
        to: "/create",
        colorClass: "bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]",
      },
      {
        key: "wrongbook",
        label: "閿欓鏂板",
        value: Number(personalInsights?.summary?.weeklyWrongAdded || 0),
        to: "/my-learning?tab=wrongbook",
        colorClass: "bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.18)]",
      },
    ],
    [personalInsights?.summary?.weeklyPractice, personalInsights?.summary?.weeklyMemoryReview, personalInsights?.summary?.weeklyCreations, personalInsights?.summary?.weeklyWrongAdded],
  );

  const scrollToSection = (id: string): void => {
    if (typeof document === "undefined") {
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };
  const scrollToSectionDeferred = (id: string): void => {
    if (typeof window === "undefined") {
      return;
    }
    window.requestAnimationFrame(() => {
      scrollToSection(id);
    });
  };

  const openGraphWorkspace = (view: GraphWorkspaceView, detailTab?: GraphDetailTab): void => {
    setGraphStage("deep");
    setGraphWorkspaceView(view);
    if (detailTab) {
      setGraphDetailTab(detailTab);
    }
    scrollToSectionDeferred("graph-workspace");
  };

  const loadRelatedPoems = async (
    kind: NodeKind,
    value: string,
    options?: {
      view?: GraphWorkspaceView;
      scroll?: boolean;
    },
  ): Promise<void> => {
    const nextView = options?.view || "related";
    const shouldScroll = options?.scroll ?? true;
    setRelated({ kind, value });
    setGraphStage("deep");
    setGraphWorkspaceView(nextView);
    if (shouldScroll) {
      scrollToSectionDeferred("graph-workspace");
    }
    setRelatedLoading(true);
    setError(null);

    try {
      const data = await apiGet<NodePoemsResponse>(
        `/graph/node-poems?kind=${kind}&value=${encodeURIComponent(value)}&limit=36`,
        { cacheTtlMs: 120000 },
      );
      setRelatedPoems(data.items || []);
      setRelatedRecommendation(
        data.recommendation && typeof data.recommendation === "object"
          ? {
              title: String(data.recommendation.title || "").trim() || "瀛︿範寤鸿",
              reason: String(data.recommendation.reason || "").trim() || "寤鸿鍏堝鍚庣粌骞跺洖閿欓鏈鐩樸€?,
              actionPlan: Array.isArray(data.recommendation.actionPlan)
                ? data.recommendation.actionPlan.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
                : [],
            }
          : null,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "鍏宠仈璇楄瘝鍔犺浇澶辫触");
      setRelatedPoems([]);
      setRelatedRecommendation(null);
    } finally {
      setRelatedLoading(false);
    }
  };

  useEffect(() => {
    if (poetForceLayout.nodes.length === 0) {
      setGraphFocusNode("");
      return;
    }
    if (graphFocusNode && !poetForceNodeLookup.has(graphFocusNode)) {
      setGraphFocusNode("");
    }
  }, [poetForceLayout.nodes.length, poetForceNodeLookup, graphFocusNode]);

  const resetPoetGraphView = (): void => {
    setGraphFocusNode("");
    fgRef.current?.zoomToFit(400);
  };

  const locatePoetGraphNode = (label: string): void => {
    const target = poetForceNodeLookup.get(label);
    if (!target) {
      return;
    }
    setGraphFocusNode(label);
    setGraphSearchInput(label);
    setGraphSearchKeyword(label);
    fgRef.current?.centerAt(target.x, target.y, 800);
    fgRef.current?.zoom(1.8, 800);
  };

  const applyPoetSearch = (): void => {
    const keyword = String(graphSearchInput || "").trim();
    setGraphSearchKeyword(keyword);
    if (!keyword) {
      resetPoetGraphView();
      return;
    }
    const first = poetForceLayout.nodes.find((node) => node.label.includes(keyword));
    if (first) {
      locatePoetGraphNode(first.label);
    }
  };

  const handleNodeClick = useCallback((node: any) => {
    locatePoetGraphNode(node.label);
    void loadRelatedPoems("poet", node.label, { view: "details", scroll: false });
    fgRef.current?.centerAt(node.x, node.y, 1000);
    fgRef.current?.zoom(1.8, 1000);
  }, [loadRelatedPoems, locatePoetGraphNode]);

  const loadPoetCompare = useCallback(async (left: string, right: string, dynasty?: string): Promise<void> => {
    const leftName = String(left || "").trim();
    const rightName = String(right || "").trim();
    if (!leftName || !rightName) {
      return;
    }
    setPoetCompare({ left: leftName, right: rightName, dynasty: dynasty || undefined });
    setPoetCompareLoading(true);
    setPoetCompareError(null);
    try {
      const [leftData, rightData] = await Promise.all([
        apiGet<{ items: PoemRecord[] }>(`/graph/node-poems?kind=poet&value=${encodeURIComponent(leftName)}&limit=24`, { cacheTtlMs: 120000 }),
        apiGet<{ items: PoemRecord[] }>(`/graph/node-poems?kind=poet&value=${encodeURIComponent(rightName)}&limit=24`, { cacheTtlMs: 120000 }),
      ]);
      setPoetCompareLeftPoems(leftData.items || []);
      setPoetCompareRightPoems(rightData.items || []);
    } catch (err: unknown) {
      setPoetCompareError(err instanceof Error ? err.message : "璇椾汉瀵规瘮鍔犺浇澶辫触");
      setPoetCompareLeftPoems([]);
      setPoetCompareRightPoems([]);
    } finally {
      setPoetCompareLoading(false);
    }
  }, []);

  const openPoetCompare = useCallback(
    (left: string, right: string, dynasty?: string): void => {
      const leftName = String(left || "").trim();
      const rightName = String(right || "").trim();
      if (!leftName || !rightName) {
        return;
      }
      const params = new URLSearchParams();
      params.set("compare", "1");
      params.set("left", leftName);
      params.set("right", rightName);
      if (dynasty) {
        params.set("dynasty", dynasty);
      }
      navigate(`/graph?${params.toString()}`);
      void loadPoetCompare(leftName, rightName, dynasty);
    },
    [navigate, loadPoetCompare],
  );

  const syncRecentCompareQuery = useCallback(
    (filters?: {
      keyword?: string;
      days?: RecentCompareDays;
      page?: number;
      sort?: "latest" | "accuracy_asc";
    }): void => {
      const nextKeyword = String(filters?.keyword ?? recentCompareAppliedKeyword).trim();
      const nextDays = (filters?.days ?? recentCompareDays) as RecentCompareDays;
      const nextSort = (filters?.sort ?? recentCompareSort) as "latest" | "accuracy_asc";
      const nextPage = Math.max(1, Number(filters?.page ?? recentComparePage));
      const params = new URLSearchParams(searchParams);
      if (nextKeyword) {
        params.set("rc_q", nextKeyword);
      } else {
        params.delete("rc_q");
      }
      if (nextDays === "30") {
        params.delete("rc_days");
      } else {
        params.set("rc_days", nextDays);
      }
      if (nextSort === "accuracy_asc") {
        params.delete("rc_sort");
      } else {
        params.set("rc_sort", nextSort);
      }
      if (nextPage <= 1) {
        params.delete("rc_page");
      } else {
        params.set("rc_page", String(nextPage));
      }
      const query = params.toString();
      navigate(query ? `/graph?${query}` : "/graph", { replace: true });
    },
    [navigate, searchParams, recentCompareAppliedKeyword, recentCompareDays, recentCompareSort, recentComparePage],
  );

  const closePoetCompare = useCallback((): void => {
    const params = new URLSearchParams(searchParams);
    params.delete("compare");
    params.delete("left");
    params.delete("right");
    params.delete("dynasty");
    const next = params.toString();
    navigate(next ? `/graph?${next}` : "/graph", { replace: true });
    setPoetCompare(null);
    setPoetCompareError(null);
    setPoetCompareLeftPoems([]);
    setPoetCompareRightPoems([]);
  }, [navigate, searchParams]);

  const loadRecentCompareLogs = useCallback(async (filters?: {
    keyword?: string;
    days?: RecentCompareDays;
    page?: number;
  }): Promise<void> => {
    setRecentCompareLoading(true);
    setRecentCompareError(null);
    try {
      const q = String(filters?.keyword ?? recentCompareAppliedKeyword).trim();
      const days = (filters?.days ?? recentCompareDays) as RecentCompareDays;
      const requestedPage = Math.max(1, Number(filters?.page ?? recentComparePage));
      const query = new URLSearchParams();
      query.set("source", "graph_compare");
      query.set("page", String(requestedPage));
      query.set("pageSize", String(recentComparePageSize));
      if (days !== "all") {
        query.set("days", days);
      }
      if (q) {
        query.set("q", q);
      }
      const data = await apiGet<PracticeSessionSummaryListResponse>(`/practice/session-summaries?${query.toString()}`, {
        cacheTtlMs: 20000,
      });
      setRecentCompareLogs(Array.isArray(data.items) ? data.items : []);
      setRecentCompareAppliedKeyword(q);
      setRecentCompareDays(days);
      const total = Number(data.pagination?.total ?? data.items?.length ?? 0);
      const totalPages = Math.max(1, Number(data.pagination?.totalPages ?? 1));
      const currentPage = Math.max(1, Number(data.pagination?.page ?? requestedPage));
      setRecentCompareTotal(total);
      setRecentCompareTotalPages(totalPages);
      setRecentComparePage(currentPage);
      if (currentPage !== requestedPage) {
        syncRecentCompareQuery({ keyword: q, days, page: currentPage });
      }
    } catch (err: unknown) {
      setRecentCompareError(err instanceof Error ? err.message : "璇诲彇鏈€杩戝姣旇褰曞け璐?);
    } finally {
      setRecentCompareLoading(false);
    }
  }, [recentCompareAppliedKeyword, recentCompareDays, recentComparePage, recentComparePageSize, syncRecentCompareQuery]);

  const deleteRecentCompareLog = useCallback(
    async (id: string): Promise<void> => {
      setRecentCompareDeleteId(id);
      setRecentCompareError(null);
      try {
        await apiDelete(`/practice/session-summaries/${id}`);
        await loadRecentCompareLogs({ page: recentComparePage });
      } catch (err: unknown) {
        setRecentCompareError(err instanceof Error ? err.message : "鍒犻櫎瀵规瘮璁板綍澶辫触");
      } finally {
        setRecentCompareDeleteId(null);
      }
    },
    [loadRecentCompareLogs, recentComparePage],
  );

  useEffect(() => {
    const compare = (searchParams.get("compare") || "").trim();
    if (compare !== "1") {
      return;
    }
    setGraphStage("deep");
    setGraphWorkspaceView("details");
    setGraphDetailTab("poet");
    if (!poetEdges.length) {
      return;
    }

    const presetKey = searchParams.toString();
    if (comparePresetAppliedRef.current === presetKey) {
      return;
    }
    comparePresetAppliedRef.current = presetKey;

    const dynasty = (searchParams.get("dynasty") || "").trim();
    const left = (searchParams.get("left") || "").trim();
    const right = (searchParams.get("right") || "").trim();

    if (dynasty) {
      setPoetEdgeDynastyFilter(dynasty);
    }

    if (left && right) {
      void loadPoetCompare(left, right, dynasty || undefined);
      return;
    }

    const candidates = dynasty ? poetEdges.filter((edge) => String(edge.dynasty || "").trim() === dynasty) : poetEdges;
    const fallback = candidates[0] || poetEdges[0];
    if (fallback) {
      void loadPoetCompare(String(fallback.source || ""), String(fallback.target || ""), String(fallback.dynasty || "") || undefined);
    }
  }, [searchParams, poetEdges, loadPoetCompare]);

  useEffect(() => {
    const compare = (searchParams.get("compare") || "").trim();
    if (compare === "1") {
      return;
    }

    const highlight = String(searchParams.get("highlight") || "").trim();
    const primaryView = parseGraphPrimaryNav(searchParams.get("view"));
    const presetKey = `${highlight}|${primaryView}`;
    if (highlightPresetAppliedRef.current === presetKey) {
      return;
    }

    if (primaryView === "learning") {
      highlightPresetAppliedRef.current = presetKey;
      openGraphWorkspace("overview");
      return;
    }

    if (!highlight) {
      highlightPresetAppliedRef.current = presetKey;
      openGraphWorkspace("details", primaryView === "timeline" ? "timeline" : primaryView === "imagery" ? "imagery" : "poet");
      return;
    }

    if (!poetGraph?.nodes?.length) {
      return;
    }

    let cancelled = false;

    const applyHighlight = async (): Promise<void> => {
      const nextDetailTab: GraphDetailTab =
        primaryView === "timeline" ? "timeline" : primaryView === "imagery" ? "imagery" : "poet";

      if (nextDetailTab !== "poet") {
        if (!cancelled) {
          openGraphWorkspace("details", nextDetailTab);
        }
        highlightPresetAppliedRef.current = presetKey;
        return;
      }

      let author = "";
      try {
        const poem = await apiGet<PoemRecord>(`/poems/${highlight}`, { cacheTtlMs: 120000 });
        author = String(poem.author || "").trim();
      } catch {
        try {
          const data = await apiGet<{ items: PoemRecord[] }>(`/poems/search?q=${encodeURIComponent(highlight)}&page=1&pageSize=6`, {
            cacheTtlMs: 120000,
          });
          const exact = (data.items || []).find((item) => String(item.title || "").trim() === highlight) || data.items?.[0];
          author = String(exact?.author || "").trim();
        } catch {
          author = "";
        }
      }

      if (cancelled) {
        return;
      }

      openGraphWorkspace("details", "poet");
      if (author) {
        setRelated({ kind: "poet", value: author });
        void loadRelatedPoems("poet", author, { view: "details", scroll: false });
        window.requestAnimationFrame(() => {
          locatePoetGraphNode(author);
        });
      } else {
        setGraphFocusNode(highlight);
      }
      highlightPresetAppliedRef.current = presetKey;
    };

    void applyHighlight();

    return () => {
      cancelled = true;
    };
  }, [searchParams, poetGraph?.nodes, loadRelatedPoems]);

  useEffect(() => {
    void loadRecentCompareLogs();
  }, [loadRecentCompareLogs]);

  const renderGroup = (title: string, nodes: GraphNode[]): JSX.Element => (
    <SpotlightCard
      className="rounded-2xl p-3 shadow-[0_10px_28px_rgba(26,43,76,0.08)]" style={{ background: 'var(--bg-surface)' }}
      spotlightColor="rgba(26,43,76,0.08)"
    >
      <h3 className="text-sm" style={{ color: 'var(--neutral)' }}>{title}</h3>
      {nodes.length === 0 ? <p className="mt-2 text-xs text-slate-400">鏆傛棤鏁版嵁</p> : null}
      <div className="mt-2 flow-sm">
        {nodes.map((node) => {
          const nodeKind = node.kind as NodeKind | undefined;
          const nodeValue = node.value || node.label;
          const active = !!nodeKind && related?.kind === nodeKind && related.value === nodeValue;
          return (
            <button
              key={node.id}
              type="button"
              disabled={!nodeKind}
              onClick={() => {
                if (nodeKind) {
                  void loadRelatedPoems(nodeKind, nodeValue);
                }
              }}
              className={[
                "w-full rounded-lg px-3 py-2 text-left text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] transition",
                !nodeKind
                  ? "cursor-not-allowed bg-slate-50 text-slate-400"
                  : active
                    ? "bg-ink-700 text-white shadow-[inset_0_0_0_1px_rgba(26,43,76,0.65)]"
                    : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <span>{node.label}</span>
                <span>{node.count ?? 0} 棰?</span>
              </div>
              {typeof node.rate === "number" ? (
                <p className={active ? "mt-1 text-[11px] text-ink-100" : "mt-1 text-[11px] text-slate-500"}>
                  姝ｇ‘鐜?{node.rate}%
                </p>
              ) : null}
            </button>
          );
        })}
      </div>
    </SpotlightCard>
  );

  const graphWorkspaceStats = useMemo(() => {
    const totalNodes =
      (poetGraph?.nodes?.length ?? 0) +
      (imageryGraph?.nodes?.length ?? 0) +
      (personalGraph?.nodes?.length ?? 0);
    const timelineDynastyCount = timelineGraph?.dynastyCount ?? timelineGraph?.items?.length ?? 0;
    const focusNode = related ? `${relatedKindLabelMap[related.kind]} 路 ${related.value}` : "鏈€夋嫨鑺傜偣";
    const latestCompare = recentCompareSorted[0];
    const latestCompareAccuracy = latestCompare
      ? `${Math.round(Math.max(0, Math.min(100, Number(latestCompare.accuracy || 0))))}%`
      : "--";
    return {
      totalNodes,
      timelineDynastyCount,
      focusNode,
      relatedPoemCount: relatedPoems.length,
      recentCompareCount: recentCompareTotal,
      latestCompareAccuracy,
    };
  }, [
    imageryGraph?.nodes?.length,
    personalGraph?.nodes?.length,
    poetGraph?.nodes?.length,
    recentCompareSorted,
    recentCompareTotal,
    related,
    relatedPoems.length,
    timelineGraph?.dynastyCount,
    timelineGraph?.items?.length,
  ]);
  const graphDetailTabLabel =
    graphDetailTab === "poet" ? "璇椾汉缃戠粶" : graphDetailTab === "imagery" ? "鎰忚薄缃戠粶" : graphDetailTab === "timeline" ? "鏈濅唬鏃堕棿杞? : "瀛︿範娲炲療";
  const graphWorkspaceTitle = graphWorkspaceView === "overview" ? "鍥捐氨鎬昏" : graphWorkspaceView === "related" ? "鍏宠仈璇楄瘝" : "鍥捐氨璇︽儏";
  const graphWorkspaceSubtitle =
    graphWorkspaceView === "overview"
      ? "鍏堥€変竴涓杽寮辫妭鐐癸紝鍐嶈繘鍏ュ叧鑱旇瘲璇嶆垨璇︽儏銆?
      : graphWorkspaceView === "related"
        ? "鍥寸粫鐒︾偣鑺傜偣瀹屾垚瀛︿範闂幆銆?
        : `褰撳墠璇︽儏锛?{graphDetailTabLabel}`;
  const graphPrimaryNavValue: GraphPrimaryNav =
    graphWorkspaceView === "overview"
      ? "learning"
      : graphDetailTab === "imagery"
        ? "imagery"
        : graphDetailTab === "timeline"
          ? "timeline"
          : "poet";
  const selectedPoetPanelPoems = related?.kind === "poet" ? relatedPoems.slice(0, 4) : [];
  const focusQuestionType = String(personalInsights?.focus?.questionType?.key || "").trim();
  const focusQuestionRate = typeof personalInsights?.focus?.questionType?.rate === "number" ? personalInsights.focus.questionType.rate : null;
  const focusSummary = focusQuestionType
    ? `${focusQuestionType}${typeof focusQuestionRate === "number" ? ` 路 姝ｇ‘鐜?${focusQuestionRate}%` : ""}`
    : "鍏堝湪鎬昏涓€夋嫨涓€涓珮棰戣杽寮辫妭鐐?;
  const teacherHint = useMemo(() => teacherHintItems.find((item) => item.page === "graph") || null, []);

  const graphHighlightQuery = useMemo(() => String(searchParams.get("highlight") || "").trim(), [searchParams]);
  const graphLearnBackTo = graphHighlightQuery ? `/learn/${encodeURIComponent(graphHighlightQuery)}` : "/learn";
  const graphContextHeadline = graphFocusNode || graphHighlightQuery || "鏈寚瀹氫綔鍝?;

  return (
    <div className="page-shell">
      <PageHeader
        variant="compact"
        kicker="Knowledge Graph"
        title="鐭ヨ瘑鍥捐氨"
        subtitle="閿佸畾钖勫急鐐瑰苟杩涘叆瀵瑰簲宸ヤ綔鍖恒€?
      />
      {isTeacherMode ? (
        <TeachingObjectiveCard
          variant="panel"
          kicker="鏁欏笀鐩爣鎻愮ず"
          title={graphTeachingObjective.title}
          summary={graphTeachingObjective.summary}
          goals={graphTeachingObjective.goals}
          chipLabel="褰撳墠闃舵 路 鍥捐氨鎷撳睍"
          hint={graphTeachingObjective.teacherHint}
          className="mb-4 shadow-[0_16px_36px_rgba(34,58,94,0.08)]"
        />
      ) : null}

      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-stone-50 px-4 py-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.18)]">
        <Link
          to={graphLearnBackTo}
          className="inline-flex items-center gap-2 text-sm font-medium text-[#1A2B4C] no-underline transition hover:text-[#223A5E]"
        >
          <span aria-hidden className="text-base leading-none">
            鈫?
          </span>
          杩斿洖瀛︿範椤?
        </Link>
        <p className="max-w-[min(520px,100%)] text-right text-xs leading-6" style={{ color: 'var(--neutral)' }}>
          鐭ヨ瘑鍥捐氨 路 <span className="font-medium text-slate-800">{graphContextHeadline}</span>
          <span className="mt-1 block text-[11px] text-slate-400">褰撳墠鏌ョ湅锛氳浣滃搧鍦ㄨ瘲浜虹綉缁滀腑鐨勪綅缃紱闇€瑕佺户缁簿璁叉垨瑙ｆ瀽鏃惰鐐瑰乏渚ц繑鍥炪€?</span>
        </p>
      </section>

      <section className="surface-card card-dense">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-slate-400">鍥捐氨瀵艰埅</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--neutral)' }}>鍦ㄨ瘲浜哄叧绯汇€佹剰璞″叧鑱斻€佹湞浠ｆ椂闂磋酱鍜屾垜鐨勫涔犵増鍥句箣闂村垏鎹€?</p>
          </div>
          <PillNav
            items={GRAPH_PRIMARY_ITEMS}
            value={graphPrimaryNavValue}
            onChange={(next) => {
              if (next === "learning") {
                openGraphWorkspace("overview");
                return;
              }
              openGraphWorkspace("details", next === "timeline" ? "timeline" : next === "imagery" ? "imagery" : "poet");
            }}
            className="bg-stone-100"
          />
        </div>
      </section>

      <section className="surface-card card-dense">
        <p className="text-xs tracking-[0.14em] text-slate-400">浜や簰鎺㈢储</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7" style={{ color: 'var(--neutral)' }}>
          <li>鍏崇郴缃戠粶鐢诲竷鍙嫋鎷藉钩绉伙紱鍙充笅瑙?+ / 鈭?鎺у埗缂╂斁锛屻€屽浣嶃€嶆仮澶嶉粯璁よ閲庛€?</li>
          <li>鐐瑰嚮鑺傜偣鍙仛鐒﹁瘲浜烘垨鎰忚薄锛屽苟鍦ㄤ晶鏍忓姞杞藉叧鑱旇瘲璇嶄笌缁冩祴鍏ュ彛銆?</li>
          <li>鍒囨崲涓婃柟銆屽浘璋卞鑸€嶅彲鍦ㄦ€昏銆佹剰璞°€佹椂闂磋酱涓庡涔犵増鍥句箣闂磋烦杞紝渚夸簬璇惧爞婕旂ず鐢辨祬鍏ユ繁銆?</li>
        </ul>
      </section>

      {isTeacherMode ? (
        <section className="surface-card card-dense">
          <StateCalloutCard
            eyebrow="鏁欏笀婕旂ず鑴氭湰锛堣交閲忥級"
            title="3 姝ユ妸鍥捐氨璁叉垚鈥滃彲杩佺Щ鐨勭悊瑙ｂ€?
            description="鈶?鍏堥攣瀹氫竴涓杽寮辫妭鐐癸紙棰樺瀷/鎰忚薄/璇椾汉/棰樻潗锛夆啋 鈶?鎵撳紑鍏宠仈璇楄瘝鍋?1 娆″姣旈槄璇?鈫?鈶?绔嬪埢杩涘叆缁冩祴骞跺洖鍒板鎯呭睍绀洪敊鍥犱笌璁″垝銆?
            tone="warm"
            actions={[
              { label: "鎵撳紑鎬昏", to: "/graph?view=learning", variant: "primary" },
              { label: "鍘荤粌娴?, to: buildPracticeLink(related) },
              { label: "鍥炲鎯呮敹鍙?, to: buildWrongbookLink(related) },
            ]}
          />
        </section>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <SpotlightCard
          className="rounded-[1.25rem] p-4 shadow-[0_10px_28px_rgba(34,58,94,0.06)]" style={{ background: 'var(--bg-surface)' }}
          spotlightColor="rgba(26,43,76,0.08)"
        >
          <div className="grid gap-3 md:grid-cols-2">
            {graphGuideCards.map((item) => (
              <article key={item.title} className="rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.12)]">
                <p className="learn-goal-kicker">{item.title}</p>
                <p className="mt-2 text-sm leading-7" style={{ color: 'var(--neutral)' }}>{item.detail}</p>
              </article>
            ))}
          </div>
        </SpotlightCard>

        {isTeacherMode && teacherHint ? (
          <TeacherHintCallout
            title={teacherHint.title}
            detail={teacherHint.detail}
            action={
              <button type="button" className="btn-primary-compact" onClick={() => openGraphWorkspace("overview")}>
                鎵撳紑鏁欏瑙嗚
              </button>
            }
          />
        ) : null}
      </section>

      {loading ? <section className="surface-card card-roomy text-sm text-slate-500">鍥捐氨鍔犺浇涓?..</section> : null}

      {error ? <section className="rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]">{error}</section> : null}

      <PageStage tone="detail">
        <NextStepRecommendations
          title="鍥捐氨涔嬪悗鎺ㄨ崘鍔ㄤ綔"
          subtitle="鍥捐氨涓嶆槸缁堢偣锛岃€屾槸鎶婂彂鐜伴噸鏂伴€佸洖缁冩祴銆佺簿璁蹭笌瀛︽儏澶嶇洏銆?
          items={[
            {
              title: "鍥寸粫褰撳墠鑺傜偣鍘荤粌娴?,
              description: related ? `宸查攣瀹?${relatedKindLabelMap[related.kind]}鈥?{related.value}鈥濓紝寤鸿绔嬪埢鍋氫竴缁勫搴斿珐鍥洪銆俙 : "鍏堥€変竴涓妭鐐癸紝鍐嶈繘鍏ュ搴旈缁勫珐鍥恒€?,
              to: buildPracticeLink(related),
              ctaLabel: "鍘荤粌娴?,
              badge: "宸╁浐",
            },
            {
              title: "鍥炲埌瀛︽儏涓績",
              description: "鎶婂浘璋遍噷鏆撮湶鍑虹殑钖勫急鐐癸紝鍜岄敊棰樸€佸涔犺鍒掋€佽蹇嗕换鍔℃斁鍦ㄤ竴璧峰鐩樸€?,
              to: buildWrongbookLink(related),
              ctaLabel: "鐪嬪鎯?,
              badge: "鏀舵潫",
            },
            {
              title: "鎶婂彂鐜拌浆鎴愬垱浣滆緭鍑?,
              description: related
                ? `鍥寸粫${relatedKindLabelMap[related.kind]}鈥?{related.value}鈥濆啓涓€娈典豢鍐欐垨鏀瑰啓锛屾妸鐞嗚В鍙樻垚鍙睍绀虹殑浣滃搧銆俙
                : "閫変竴涓剰璞?涓婚鍋氫豢鍐欙紝鎶婂浘璋遍噷鐨勫彂鐜拌浆鎴愪綘鐨勮鍫傝緭鍑恒€?,
              to: related?.value ? `/create?topic=${encodeURIComponent(related.value)}` : "/create",
              ctaLabel: "鍘诲垱浣?,
              badge: "杈撳嚭",
            },
            {
              title: "杩斿洖绮捐缁х画璁?,
              description: "濡傛灉褰撳墠鍥捐氨鏄粠璇惧爞绮捐璺宠繃鏉ョ殑锛屽彲浠ュ洖鍒板師璇楃户缁帹杩涙暀瀛︺€?,
              to: graphLearnBackTo,
              ctaLabel: "鍥炲涔犻〉",
              badge: "鍥炶",
            },
          ]}
          className="mt-4"
        />
      </PageStage>

      {!loading ? (
        <div className="flow-md">
          <section className="dashboard-strip flow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flow-sm">
                <p className="section-kicker">浠婃棩鐒︾偣</p>
                <h2 className="font-display text-2xl text-ink-700">鍏堝鐞嗕竴涓杽寮辩偣</h2>
                <span className="surface-chip">{focusSummary}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Magnet className="inline-flex">
                  <button
                    type="button"
                    onClick={() => openGraphWorkspace("overview")}
                    className="btn-primary-compact"
                  >
                    鎵撳紑鎬昏
                  </button>
                </Magnet>
                <button
                  type="button"
                  onClick={() => openGraphWorkspace("related")}
                  className="btn-secondary-compact"
                >
                  鍏宠仈璇楄瘝
                </button>
                <button
                  type="button"
                  onClick={() => openGraphWorkspace("details", "insights")}
                  className="btn-secondary-compact"
                >
                  鍥捐氨璇︽儏
                </button>
              </div>
            </div>

            <div className="workspace-meta-grid">
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">钖勫急鑺傜偣</p>
                <p className="workspace-meta-value">{graphWorkspaceStats.totalNodes}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">褰撳墠鐒︾偣</p>
                <p className="workspace-meta-value line-clamp-1">{graphWorkspaceStats.focusNode}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">鍏宠仈璇楄瘝</p>
                <p className="workspace-meta-value">{graphWorkspaceStats.relatedPoemCount}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">瑕嗙洊鏈濅唬</p>
                <p className="workspace-meta-value">{graphWorkspaceStats.timelineDynastyCount}</p>
              </article>
            </div>
          </section>

          {graphStage === "deep" ? (
            <PageStage id="graph-workspace" tone={graphWorkspaceView === "details" ? "detail" : "secondary"} className="flow-md">
              <section className="surface-card card-cozy flow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink-700">{graphWorkspaceTitle}</h2>
                    <p className="mt-1 text-xs text-slate-500">{graphWorkspaceSubtitle}</p>
                  </div>
                  <div className="segmented-tabs">
                    <button
                      type="button"
                      onClick={() => openGraphWorkspace("overview")}
                      className={["segmented-tab", graphWorkspaceView === "overview" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      鎬昏
                    </button>
                    <button
                      type="button"
                      onClick={() => openGraphWorkspace("related")}
                      className={["segmented-tab", graphWorkspaceView === "related" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      鍏宠仈璇楄瘝
                    </button>
                    <button
                      type="button"
                      onClick={() => openGraphWorkspace("details")}
                      className={["segmented-tab", graphWorkspaceView === "details" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      鍥捐氨璇︽儏
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">钖勫急鑺傜偣</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.totalNodes}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">鍏宠仈璇楄瘝</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.relatedPoemCount}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">褰撳墠鐒︾偣</div>
                    <div className="mt-1 line-clamp-1 text-sm text-ink-700">{graphWorkspaceStats.focusNode}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">鏈€杩戝姣?</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.latestCompareAccuracy}</div>
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-subtle)', color: 'var(--neutral)' }}>
                  {related
                    ? `宸查€夎妭鐐癸細${relatedKindLabelMap[related.kind]} 路 ${related.value}`
                    : "鍏堝湪鎬昏涓€夋嫨涓€涓妭鐐癸紝鍐嶈繘鍏ュ叧鑱旇瘲璇嶃€?}
                </div>
              </section>

              {graphWorkspaceView === "overview" ? (
                <Suspense fallback={<GraphLazyFallback label="鍥捐氨鎬昏" />}>
                <GraphOverview
                  personalGraph={personalGraph}
                  personalGroups={personalGroups}
                  insightActions={insightActions}
                  related={related}
                  relatedKindLabelMap={relatedKindLabelMap}
                  graphWorkspaceStats={graphWorkspaceStats}
                  relatedPoemsCount={relatedPoems.length}
                  openGraphWorkspace={openGraphWorkspace}
                  loadRelatedPoems={(kind, value) => void loadRelatedPoems(kind, value)}
                  renderGroup={renderGroup}
                />
                </Suspense>
              ) : null}

              {graphWorkspaceView === "related" ? (
                <Suspense fallback={<GraphLazyFallback label="鍏宠仈璇楄瘝" />}>
                <GraphRelatedPoems
                  related={related}
                  relatedLoading={relatedLoading}
                  relatedPoems={relatedPoems}
                  relatedRecommendation={relatedRecommendation}
                  relatedKindLabelMap={relatedKindLabelMap}
                  openGraphWorkspace={openGraphWorkspace}
                  buildWrongbookLink={buildWrongbookLink}
                  buildPracticeLink={buildPracticeLink}
                  buildPoemWrongbookLink={buildPoemWrongbookLink}
                  buildPoemPracticeLink={buildPoemPracticeLink}
                />
                </Suspense>
              ) : null}

              {graphWorkspaceView === "details" ? (
                <section className="surface-card card-cozy flow-md">
              <section className="flow-md">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink-700">鍥捐氨璇︽儏</h2>
                    <p className="mt-1 text-xs text-slate-500">鎸夋爣绛炬煡鐪嬭瘲浜恒€佹剰璞°€佹椂闂磋酱涓庡涔犳礊瀵熴€?</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openGraphWorkspace("overview")} className="btn-secondary-compact">
                      杩斿洖鎬昏
                    </button>
                    <span className="text-xs text-slate-500">褰撳墠鏍囩锛歿graphDetailTabLabel}</span>
                  </div>
                  <div className="segmented-tabs">
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("poet")}
                      className={["segmented-tab", graphDetailTab === "poet" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      璇椾汉缃戠粶
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("imagery")}
                      className={["segmented-tab", graphDetailTab === "imagery" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      鎰忚薄缃戠粶
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("timeline")}
                      className={["segmented-tab", graphDetailTab === "timeline" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      鏈濅唬鏃堕棿杞?
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("insights")}
                      className={["segmented-tab", graphDetailTab === "insights" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      瀛︿範娲炲療
                    </button>
                  </div>
                </div>
              </section>

          {(graphDetailTab === "poet" || graphDetailTab === "imagery") ? (
            <section className="grid grid-cols-1 gap-6">
              {graphDetailTab === "poet" ? (
                <article className="surface-card flow-md">
              <h2 className="font-display text-2xl text-ink-700">璇椾汉鑺傜偣</h2>
              <p className="mt-2 text-xs text-slate-500">鐐瑰嚮璇椾汉鏌ョ湅鍏跺叧鑱旇瘲璇嶃€?</p>
              <SpotlightCard
                className="relative mt-4 rounded-2xl bg-[linear-gradient(140deg,rgba(26,43,76,0.08),rgba(201,169,110,0.12))] p-3 shadow-[0_10px_28px_rgba(26,43,76,0.09)]"
                spotlightColor="rgba(201,169,110,0.14)"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl bg-white/90 px-3 py-2 shadow-[0_3px_12px_rgba(26,43,76,0.06)]">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={graphSearchInput}
                      onChange={(event) => setGraphSearchInput(event.target.value)}
                      placeholder="鎼滅储璇椾汉鑺傜偣骞跺畾浣?
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <button type="button" onClick={applyPoetSearch} className="btn-secondary-compact">
                    瀹氫綅
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setGraphSearchInput("");
                      setGraphSearchKeyword("");
                      resetPoetGraphView();
                    }}
                    className="btn-secondary-compact"
                  >
                    娓呯┖
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {poetGraphSearchMatches.map((node) => (
                    <button
                      key={`poet-search-${node.id}`}
                      type="button"
                      onClick={() => locatePoetGraphNode(node.label)}
                      className={[
                        "rounded-full px-2.5 py-1 text-[11px] shadow-[0_2px_8px_rgba(26,43,76,0.06)] transition",
                        graphFocusNode === node.label ? "bg-[#1A2B4C] text-white" : "bg-white text-slate-600 hover:bg-stone-50",
                      ].join(" ")}
                    >
                      {node.label}
                    </button>
                  ))}
                </div>
                {graphSearchKeyword ? (
                  <p className="mt-2 text-[11px] text-slate-500">褰撳墠鎼滅储锛歿graphSearchKeyword}</p>
                ) : null}

                {poetForceLayout.nodes.length === 0 ? (
                  <div className="mt-3 flex flex-col items-center justify-center rounded-2xl bg-white/90 px-4 py-20 text-center shadow-[inset_0_0_0_1px_rgba(26,43,76,0.06)]">
                    <svg className="mb-6 h-32 w-32 text-slate-200" viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="100" cy="100" r="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
                      <circle cx="100" cy="100" r="40" stroke="currentColor" strokeWidth="2" strokeDasharray="4 8" />
                      <circle cx="100" cy="100" r="8" fill="currentColor" />
                      <circle cx="60" cy="60" r="6" fill="currentColor" />
                      <circle cx="140" cy="60" r="6" fill="currentColor" />
                      <circle cx="60" cy="140" r="6" fill="currentColor" />
                      <circle cx="140" cy="140" r="6" fill="currentColor" />
                      <path d="M100 100L60 60M100 100L140 60M100 100L60 140M100 100L140 140" stroke="currentColor" strokeWidth="2" strokeDasharray="2 4" />
                    </svg>
                    <p className="font-serif text-2xl text-[#1A2B4C]">鍥捐氨灏氭湭鐐逛寒</p>
                    <p className="mt-2 font-sans text-sm text-slate-500">
                      寮€濮嬪涔犲悗锛屼綘鐨勭煡璇嗗浘璋卞皢鍦ㄨ繖閲岀敓闀裤€?
                    </p>
                  </div>
                ) : (
                  <div className="relative mt-3 overflow-hidden rounded-2xl bg-white/92 border border-slate-200">
                    <div className="h-[420px] w-full cursor-grab active:cursor-grabbing">
                      <ForceGraph2D
                        ref={fgRef}
                        graphData={{
                          nodes: poetForceLayout.nodes,
                          links: poetForceLayout.edges
                        }}
                        width={980}
                        height={420}
                        nodeRelSize={4}
                        nodeVal={(node: any) => node.count}
                        nodeLabel="label"
                        nodeColor={(node: any) => node.label === graphFocusNode ? "#C9A96E" : "#1A2B4C"}
                        linkColor={(link: any) => 
                          graphFocusNode && (link.source.id === graphFocusNode || link.target.id === graphFocusNode) 
                            ? "rgba(201,169,110,0.9)" 
                            : "rgba(26,43,76,0.25)"
                        }
                        linkWidth={(link: any) => 
                          graphFocusNode && (link.source.id === graphFocusNode || link.target.id === graphFocusNode) ? 2 : 1
                        }
                        nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                          const label = node.label;
                          const fontSize = 12/globalScale;
                          ctx.font = `${fontSize}px Sans-Serif`;
                          const active = node.label === graphFocusNode;
                          
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, 4 + Math.sqrt(node.count || 1) * 2, 0, 2 * Math.PI, false);
                          ctx.fillStyle = active ? "#C9A96E" : "#1A2B4C";
                          ctx.fill();
                          
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = active ? "#7B5D2A" : "#334155";
                          ctx.fillText(label, node.x, node.y + 12 + Math.sqrt(node.count || 1) * 2);
                        }}
                        onNodeClick={handleNodeClick}
                        cooldownTicks={100}
                      />
                    </div>
                    <div className="absolute left-3 top-3 flex gap-2">
                      <SpotlightCard className="rounded-xl bg-white/90 px-3 py-2 shadow-[0_4px_12px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
                        <p className="text-[10px] text-slate-500">鑺傜偣</p>
                        <p className="font-serif text-xl text-[#1A2B4C]">{poetForceLayout.nodes.length}</p>
                      </SpotlightCard>
                      <SpotlightCard className="rounded-xl bg-white/90 px-3 py-2 shadow-[0_4px_12px_rgba(26,43,76,0.08)]" spotlightColor="rgba(201,169,110,0.12)">
                        <p className="text-[10px] text-slate-500">鍏崇郴杈?</p>
                        <p className="font-serif text-xl text-[#1A2B4C]">{poetForceLayout.edges.length}</p>
                      </SpotlightCard>
                    </div>
                    <div className="absolute bottom-3 right-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.2, 400)}
                        className="rounded-full bg-white p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50"
                        aria-label="鏀惧ぇ"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.2, 400)}
                        className="rounded-full bg-white p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50"
                        aria-label="缂╁皬"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={resetPoetGraphView}
                        className="rounded-full p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50" style={{ background: 'var(--bg-surface)' }}
                        aria-label="澶嶄綅"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {graphFocusNode ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-xs shadow-[0_2px_8px_rgba(26,43,76,0.06)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>褰撳墠鐒︾偣锛歿graphFocusNode}</span>
                    <button type="button" onClick={() => void loadRelatedPoems("poet", graphFocusNode, { view: "details", scroll: false })} className="btn-secondary-compact">
                      鏌ョ湅鍏宠仈璇楄瘝
                    </button>
                  </div>
                ) : null}
              </SpotlightCard>
              <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="learn-goal-kicker">鑺傜偣璇︽儏</p>
                    <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{related?.kind === "poet" ? related.value : graphFocusNode || "绛夊緟閫夋嫨璇椾汉"}</h3>
                  </div>
                  {related?.kind === "poet" && selectedPoetPanelPoems.length > 0 ? (
                    <Link to={`/learn/${selectedPoetPanelPoems[0].id}`} className="btn-primary-compact">
                      绮捐姝よ瘲
                    </Link>
                  ) : null}
                </div>
                {selectedPoetPanelPoems.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {selectedPoetPanelPoems.map((poem) => (
                      <article key={`focus-poem-${poem.id}`} className="rounded-xl px-4 py-3 shadow-[0_6px_18px_rgba(26,43,76,0.06)]" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-[#1A2B4C]">{poem.title}</p>
                            <p className="mt-1 text-xs text-slate-500">{poem.author} 路 {poem.dynasty}</p>
                          </div>
                          <Link to={buildPoemPracticeLink(poem.title)} className="btn-secondary-compact">
                            缁冧範
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-7" style={{ color: 'var(--neutral)' }}>鐐瑰嚮鍥捐氨涓殑璇椾汉鑺傜偣鍚庯紝杩欓噷浼氬睍绀轰唬琛ㄤ綔鍝佸拰缁х画瀛︿範鍏ュ彛銆?</p>
                )}
              </div>
              <div className="mt-4 max-h-[520px] flow-sm overflow-auto">
                {(poetGraph?.nodes || []).map((node) => {
                  const active = related?.kind === "poet" && related.value === node.label;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => void loadRelatedPoems("poet", node.label, { view: "details", scroll: false })}
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition",
                        active
                          ? "bg-ink-700 text-white shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)]"
                          : "bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {node.label} 路 {node.dynasty || "鏈煡"} 路 {node.count ?? 0} 棣?
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <h3 className="text-sm text-slate-500">璇椾汉鍏崇郴杈?</h3>
                <select
                  value={poetEdgeDynastyFilter}
                  onChange={(event) => setPoetEdgeDynastyFilter(event.target.value)}
                  className="input-main control-compact"
                >
                  <option value="all">鍏ㄩ儴鏈濅唬</option>
                  {poetEdgeDynasties.map((dynasty) => (
                    <option key={`edge-dynasty-${dynasty}`} value={dynasty}>
                      {dynasty}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">褰撳墠鍏崇郴鏁帮細{filteredPoetEdges.length}</p>
              <div className="mt-2 max-h-[180px] flow-sm overflow-auto">
                {filteredPoetEdges.slice(0, 120).map((edge, index) => (
                  <article
                    key={`poet-edge-${edge.source}-${edge.target}-${index}`}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{edge.source} 鈫?{edge.target}</span>
                      <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)]" style={{ background: 'var(--bg-surface)' }}>
                        {edge.dynasty || "鏈煡鏈濅唬"}
                      </span>
                      <span className="ml-1 rounded-full bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.18)]">
                        {poetEdgeTypeLabelMap[String(edge.type || "")] || edge.type || "鍏崇郴"}
                      </span>
                      {edge.type === "shared_theme" && edge.tag ? (
                        <span className="ml-1 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.24)]">
                          {edge.tag}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void loadRelatedPoems("poet", edge.source)}
                        className="btn-secondary-compact"
                      >
                        鐪嬪叧鑱?
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openPoetCompare(edge.source, edge.target, edge.dynasty);
                        }}
                        className="rounded bg-ink-50 px-2 py-1 text-[11px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] transition hover:bg-ink-100"
                      >
                        瀵规瘮璇椾汉
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-lg p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-subtle)' }}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm text-slate-700">鏈€杩戝姣旇褰?</h4>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextSort = recentCompareSort === "accuracy_asc" ? "latest" : "accuracy_asc";
                        setRecentCompareSort(nextSort);
                        syncRecentCompareQuery({ sort: nextSort, page: 1 });
                        void loadRecentCompareLogs({ page: 1 });
                      }}
                      className="btn-secondary-compact"
                    >
                      {recentCompareSort === "accuracy_asc" ? "浣庡垎浼樺厛" : "鏈€鏂颁紭鍏?}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadRecentCompareLogs({ page: recentComparePage })}
                      className="btn-secondary-compact"
                    >
                      鍒锋柊
                    </button>
                  </div>
                </div>
                <form
                  className="mt-2 flex items-center gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const keyword = String(recentCompareKeyword || "").trim();
                    syncRecentCompareQuery({ keyword, page: 1 });
                    void loadRecentCompareLogs({ keyword, page: 1 });
                  }}
                >
                  <input
                    value={recentCompareKeyword}
                    onChange={(event) => setRecentCompareKeyword(event.target.value)}
                    placeholder="鎸夎瘲浜哄悕鎼滅储锛堝 鏉庣櫧锛?
                    className="input-main control-compact flex-1"
                  />
                  <button
                    type="submit"
                    className="btn-secondary-compact"
                  >
                    鎼滅储
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentCompareKeyword("");
                      syncRecentCompareQuery({ keyword: "", page: 1 });
                      void loadRecentCompareLogs({ keyword: "", page: 1 });
                    }}
                    className="btn-secondary-compact text-slate-500"
                  >
                    娓呯┖
                  </button>
                </form>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">鏃堕棿鑼冨洿</span>
                  {[
                    { key: "7", label: "杩?澶? },
                    { key: "30", label: "杩?0澶? },
                    { key: "all", label: "鍏ㄩ儴" },
                  ].map((item) => (
                    <button
                      key={`recent-days-${item.key}`}
                      type="button"
                      onClick={() => {
                        const nextDays = item.key as RecentCompareDays;
                        syncRecentCompareQuery({ days: nextDays, page: 1 });
                        void loadRecentCompareLogs({ days: nextDays, page: 1 });
                      }}
                      className={`rounded px-2 py-1 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition ${
                        recentCompareDays === item.key
                          ? "bg-ink-700 text-white shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)]"
                          : "bg-white text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {recentCompareLoading ? <p className="mt-2 text-xs text-slate-500">鍔犺浇涓?..</p> : null}
                {recentCompareError ? <p className="mt-2 text-xs" style={{ color: 'var(--error)' }}>{recentCompareError}</p> : null}
                {!recentCompareLoading && !recentCompareError && recentCompareSorted.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">鏆傛棤璁板綍锛屽厛鍘诲畬鎴愪竴缁勫浘璋卞姣旂粌涔犮€?</p>
                ) : null}
                {!recentCompareLoading && recentCompareSorted.length > 0 ? (
                  <ul className="mt-2 flow-sm">
                    {recentCompareSorted.map((item) => {
                      const pair = parseCompareTopic(item.topic || "");
                      const canOpen = Boolean(pair?.left && pair?.right);
                      return (
                        <li key={`recent-compare-${item.id}`} className="rounded px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-slate-700">{item.topic || "鍥捐氨瀵规瘮缁冧範"}</span>
                            <span className="text-[10px] text-slate-500">
                              {Math.max(0, Math.min(100, Number(item.accuracy || 0)))}%
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>
                              瀵归敊 {Number(item.correct || 0)}/{Number(item.attempts || 0)}
                            </span>
                            {item.weak_type ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                                钖勫急:{practiceTypeLabelMap[item.weak_type] || item.weak_type}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <span className="text-[10px] text-slate-400">{new Date(item.created_at).toLocaleDateString()}</span>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                disabled={recentCompareDeleteId === item.id}
                                onClick={() => {
                                  void deleteRecentCompareLog(item.id);
                                }}
                                className="rounded bg-white px-2 py-0.5 text-[10px] text-red-500 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.24)] transition hover:bg-red-50 disabled:cursor-not-allowed disabled:text-red-300"
                              >
                                {recentCompareDeleteId === item.id ? "鍒犻櫎涓?.." : "鍒犻櫎"}
                              </button>
                              <button
                                type="button"
                                disabled={!canOpen}
                                onClick={() => {
                                  if (!pair) {
                                    return;
                                  }
                                  openPoetCompare(pair.left, pair.right);
                                }}
                                className="rounded bg-ink-50 px-2 py-0.5 text-[10px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)] transition hover:bg-ink-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                              >
                                鍥炲埌璇ュ姣?
                              </button>
                              {pair ? (
                                <Link
                                  to={buildPoetComparePracticeLink(pair.left, pair.right)}
                                  className="rounded px-2 py-0.5 text-[10px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)] transition hover:bg-ink-50" style={{ background: 'var(--bg-surface)' }}
                                >
                                  鍐嶅仛涓€濂?
                                </Link>
                              ) : null}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
                {!recentCompareLoading && !recentCompareError && recentCompareTotal > 0 ? (
                  <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      绗?{recentComparePage}/{recentCompareTotalPages} 椤?路 鍏?{recentCompareTotal} 鏉?
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={recentComparePage <= 1}
                        onClick={() => {
                          const nextPage = recentComparePage - 1;
                          syncRecentCompareQuery({ page: nextPage });
                          void loadRecentCompareLogs({ page: nextPage });
                        }}
                        className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        涓婁竴椤?
                      </button>
                      <button
                        type="button"
                        disabled={recentComparePage >= recentCompareTotalPages}
                        onClick={() => {
                          const nextPage = recentComparePage + 1;
                          syncRecentCompareQuery({ page: nextPage });
                          void loadRecentCompareLogs({ page: nextPage });
                        }}
                        className="btn-secondary-compact disabled:cursor-not-allowed disabled:text-slate-300"
                      >
                        涓嬩竴椤?
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {poetCompare ? (
                <div className="mt-4 rounded-lg bg-ink-50 p-3 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)]">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs text-ink-700">
                      璇椾汉瀵规瘮锛歿poetCompare.left} vs {poetCompare.right}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Link
                        to={buildPoetComparePracticeLink(poetCompare.left, poetCompare.right)}
                        className="rounded px-2 py-1 text-[11px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] transition hover:bg-ink-100" style={{ background: 'var(--bg-surface)' }}
                      >
                        鐢熸垚瀵规瘮缁冧範
                      </Link>
                      <button
                        type="button"
                        onClick={closePoetCompare}
                        className="btn-secondary-compact"
                      >
                        鍏抽棴
                      </button>
                    </div>
                  </div>
                  {poetCompare.dynasty ? <p className="mt-1 text-[11px] text-slate-500">鍏崇郴鏈濅唬锛歿poetCompare.dynasty}</p> : null}
                  {poetCompareLoading ? <p className="mt-2 text-xs text-slate-500">瀵规瘮鍔犺浇涓?..</p> : null}
                  {poetCompareError ? <p className="mt-2 text-xs" style={{ color: 'var(--error)' }}>{poetCompareError}</p> : null}
                  {!poetCompareLoading && !poetCompareError ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <article className="rounded p-2 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <p className="text-xs" style={{ color: 'var(--neutral)' }}>{poetCompare.left} 浠ｈ〃浣滐紙鍓?棣栵級</p>
                        <ul className="mt-1 space-y-1">
                          {poetCompareLeftPoems.slice(0, 6).map((poem) => (
                            <li key={`left-${poem.id}`} className="text-[11px] text-slate-700">
                              {poem.title}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-500">
                          楂橀鎰忚薄锛歿compareLeftImagery.length > 0 ? compareLeftImagery.map((item) => `${item.keyword}(${item.count})`).join("銆?) : "鏆傛棤"}
                        </p>
                      </article>
                      <article className="rounded p-2 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <p className="text-xs" style={{ color: 'var(--neutral)' }}>{poetCompare.right} 浠ｈ〃浣滐紙鍓?棣栵級</p>
                        <ul className="mt-1 space-y-1">
                          {poetCompareRightPoems.slice(0, 6).map((poem) => (
                            <li key={`right-${poem.id}`} className="text-[11px] text-slate-700">
                              {poem.title}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-500">
                          楂橀鎰忚薄锛歿compareRightImagery.length > 0 ? compareRightImagery.map((item) => `${item.keyword}(${item.count})`).join("銆?) : "鏆傛棤"}
                        </p>
                      </article>
                    </div>
                  ) : null}
                </div>
              ) : null}
                </article>
              ) : null}

              {graphDetailTab === "imagery" ? (
                <Suspense fallback={<GraphLazyFallback label="鎰忚薄缃戠粶" />}>
                <GraphImageryView
                  imageryKeywords={imageryKeywords}
                  imageryGraphEdges={imageryGraph?.edges || []}
                  related={related}
                  loadRelatedPoems={(kind, value) => void loadRelatedPoems(kind, value)}
                />
                </Suspense>
              ) : null}
            </section>
          ) : null}

          {graphDetailTab === "timeline" ? (
            <Suspense fallback={<GraphLazyFallback label="鏈濅唬鏃堕棿杞? />}>
            <GraphTimelineView
              timelineGraph={timelineGraph}
              loadRelatedPoems={(kind, value) => void loadRelatedPoems(kind, value)}
            />
            </Suspense>
          ) : null}

          {graphDetailTab === "insights" ? (
            <Suspense fallback={<GraphLazyFallback label="瀛︿範娲炲療" />}>
            <GraphInsightsView
              personalInsights={personalInsights}
              activityPeak={activityPeak}
              learningBehaviorNodes={learningBehaviorNodes}
              setGraphDetailTab={setGraphDetailTab}
              buildWrongbookLink={buildWrongbookLink}
            />
            </Suspense>
          ) : null}
        </section>
      ) : null}
      </PageStage>
          ) : null}
    </div>
      ) : null}
    </div>
  );
}

