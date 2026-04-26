import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Minus, Plus, RotateCcw, Search } from "lucide-react";
import ForceGraph2D from "react-force-graph-2d";
import { PageHeader } from "@/components/common/PageHeader";
import { NextStepRecommendations } from "@/components/common/NextStepRecommendations";
import { PageStage } from "@/components/common/PageStage";
import ContextBanner from "@/components/ContextBanner";
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

const relatedKindLabelMap: Record<NodeKind, string> = {
  poet: "诗人",
  imagery: "意象",
  dynasty: "朝代",
  theme: "题材",
  title: "诗名",
  error_type: "题型弱项",
};

const poetEdgeTypeLabelMap: Record<string, string> = {
  same_dynasty: "同朝代",
  shared_theme: "主题相似",
};

const practiceTypeLabelMap: Record<string, string> = {
  memorization: "默写",
  meaning: "词义",
  technique: "手法",
  emotion: "情感",
  appreciation: "赏析",
  comparison: "比较阅读",
  context: "语境默写",
};

const practiceTypeSet = new Set(["memorization", "meaning", "technique", "emotion", "appreciation", "comparison", "context"]);
const GRAPH_PRIMARY_ITEMS: ReadonlyArray<PillNavItem<GraphPrimaryNav>> = [
  { id: "poet", label: "诗人关系" },
  { id: "imagery", label: "意象关联" },
  { id: "timeline", label: "朝代时间轴" },
  { id: "learning", label: "我的学习版图" },
];

const graphTeachingObjective = {
  title: "图谱教学目标",
  summary: "把“理解”转成结构：先锁定薄弱点，再用关系网络讲清迁移路径，并把发现送回练测与学情复盘。",
  goals: ["锁定 1 个薄弱节点（题型/意象/诗人/题材）", "打开关联诗词并挑 1 首做对比或延展", "进入练测/学情完成闭环复盘"],
  teacherHint: "演示建议：先展示“薄弱节点→关联诗词→对应练测”，再回到学情页展示错因与计划。",
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
    params.set("topic", `${practiceTypeLabelMap[key] || key}专项练习`);
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
  params.set("topic", `${left}与${right}对比赏析`);
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
  const match = text.match(/^(.+?)与(.+?)对比赏析$/);
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
  const [enrichedGraph, setEnrichedGraph] = useState<KnowledgeGraphPayload | null>(null);
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
        const [poets, imagery, personal, personalInsightsPayload, timeline, enriched] = await Promise.all([
          apiGet<KnowledgeGraphPayload>("/graph/poets", { cacheTtlMs: 120000 }),
          apiGet<KnowledgeGraphPayload>("/graph/imagery", { cacheTtlMs: 120000 }),
          apiGet<PersonalGraphResponse>("/graph/personal", { cacheTtlMs: 120000 }),
          apiGet<PersonalGraphInsightsPayload>("/graph/personal/insights?days=7", { cacheTtlMs: 60000 }),
          apiGet<GraphTimelinePayload>("/graph/timeline", { cacheTtlMs: 120000 }),
          apiGet<KnowledgeGraphPayload>("/graph/enriched", { cacheTtlMs: 120000 }),
        ]);
        if (!active) {
          return;
        }
        setPoetGraph(poets);
        setImageryGraph(imagery);
        setPersonalGraph(personal);
        setEnrichedGraph(enriched);
        setPersonalInsights(personalInsightsPayload);
        setTimelineGraph(timeline);
      } catch (err: unknown) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : "图谱加载失败");
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
        label: `去做${typeLabel}专项`,
        to: buildPracticeLink({ kind: "error_type", value: questionTypeKey }),
        kind: "error_type",
        value: questionTypeKey,
      });
    }

    const dynastyKey = String(personalInsights?.focus?.dynasty?.key || "").trim();
    if (dynastyKey) {
      pushAction({
        key: `d-${dynastyKey}`,
        label: `去做${dynastyKey}专项`,
        to: buildPracticeLink({ kind: "dynasty", value: dynastyKey }),
        kind: "dynasty",
        value: dynastyKey,
      });
    }

    const themeKey = String(personalInsights?.focus?.theme?.key || "").trim();
    if (themeKey) {
      pushAction({
        key: `t-${themeKey}`,
        label: `去做${themeKey}专项`,
        to: buildPracticeLink({ kind: "theme", value: themeKey }),
        kind: "theme",
        value: themeKey,
      });
    }

    if (actions.length === 0) {
      return [
        {
          key: "default-practice",
          label: "开始综合练习",
          to: "/practice?topic=古诗词综合&count=8&difficulty=medium&auto=1",
        },
      ];
    }
    return actions.slice(0, 3);
  }, [personalInsights]);

  const learningBehaviorNodes = useMemo(
    () => [
      {
        key: "practice",
        label: "练习",
        value: Number(personalInsights?.summary?.weeklyPractice || 0),
        to: "/practice?topic=古诗词综合&count=8&difficulty=medium&auto=1",
        colorClass: "bg-blue-50 text-blue-700 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.18)]",
      },
      {
        key: "memory",
        label: "记忆复习",
        value: Number(personalInsights?.summary?.weeklyMemoryReview || 0),
        to: "/memory",
        colorClass: "bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.18)]",
      },
      {
        key: "creation",
        label: "创作",
        value: Number(personalInsights?.summary?.weeklyCreations || 0),
        to: "/create",
        colorClass: "bg-violet-50 text-violet-700 shadow-[inset_0_0_0_1px_rgba(139,92,246,0.18)]",
      },
      {
        key: "wrongbook",
        label: "错题新增",
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
              title: String(data.recommendation.title || "").trim() || "学习建议",
              reason: String(data.recommendation.reason || "").trim() || "建议先学后练并回错题本复盘。",
              actionPlan: Array.isArray(data.recommendation.actionPlan)
                ? data.recommendation.actionPlan.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 3)
                : [],
            }
          : null,
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "关联诗词加载失败");
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
      setPoetCompareError(err instanceof Error ? err.message : "诗人对比加载失败");
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
      setRecentCompareError(err instanceof Error ? err.message : "读取最近对比记录失败");
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
        setRecentCompareError(err instanceof Error ? err.message : "删除对比记录失败");
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
      {nodes.length === 0 ? <p className="mt-2 text-xs text-slate-400">暂无数据</p> : null}
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
                <span>{node.count ?? 0} 题</span>
              </div>
              {typeof node.rate === "number" ? (
                <p className={active ? "mt-1 text-[11px] text-ink-100" : "mt-1 text-[11px] text-slate-500"}>
                  正确率 {node.rate}%
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
    const focusNode = related ? `${relatedKindLabelMap[related.kind]} · ${related.value}` : "未选择节点";
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
    graphDetailTab === "poet" ? "诗人网络" : graphDetailTab === "imagery" ? "意象网络" : graphDetailTab === "timeline" ? "朝代时间轴" : "学习洞察";
  const graphWorkspaceTitle = graphWorkspaceView === "overview" ? "图谱总览" : graphWorkspaceView === "related" ? "关联诗词" : "图谱详情";
  const graphWorkspaceSubtitle =
    graphWorkspaceView === "overview"
      ? "先选一个薄弱节点，再进入关联诗词或详情。"
      : graphWorkspaceView === "related"
        ? "围绕焦点节点完成学习闭环。"
        : `当前详情：${graphDetailTabLabel}`;
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
    ? `${focusQuestionType}${typeof focusQuestionRate === "number" ? ` · 正确率 ${focusQuestionRate}%` : ""}`
    : "先在总览中选择一个高频薄弱节点";
  const teacherHint = useMemo(() => teacherHintItems.find((item) => item.page === "graph") || null, []);

  const graphHighlightQuery = useMemo(() => String(searchParams.get("highlight") || "").trim(), [searchParams]);
  const graphLearnBackTo = graphHighlightQuery ? `/learn/${encodeURIComponent(graphHighlightQuery)}` : "/learn";
  const graphContextHeadline = graphFocusNode || graphHighlightQuery || "未指定作品";

  return (
    <div className="page-shell">
      <PageHeader
        variant="compact"
        kicker="Knowledge Graph"
        title="知识图谱"
        subtitle="锁定薄弱点并进入对应工作区。"
      />
      {isTeacherMode ? (
        <TeachingObjectiveCard
          variant="panel"
          kicker="教师目标提示"
          title={graphTeachingObjective.title}
          summary={graphTeachingObjective.summary}
          goals={graphTeachingObjective.goals}
          chipLabel="当前阶段 · 图谱拓展"
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
            ←
          </span>
          返回学习页
        </Link>
        <p className="max-w-[min(520px,100%)] text-right text-xs leading-6" style={{ color: 'var(--neutral)' }}>
          知识图谱 · <span className="font-medium text-slate-800">{graphContextHeadline}</span>
          <span className="mt-1 block text-[11px] text-slate-400">当前查看：该作品在诗人网络中的位置；需要继续精讲或解析时请点左侧返回。</span>
        </p>
      </section>

      <section className="surface-card card-dense">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.14em] text-slate-400">图谱导航</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--neutral)' }}>在诗人关系、意象关联、朝代时间轴和我的学习版图之间切换。</p>
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
        <p className="text-xs tracking-[0.14em] text-slate-400">交互探索</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-7" style={{ color: 'var(--neutral)' }}>
          <li>关系网络画布可拖拽平移；右下角 + / − 控制缩放，「复位」恢复默认视野。</li>
          <li>点击节点可聚焦诗人或意象，并在侧栏加载关联诗词与练测入口。</li>
          <li>切换上方「图谱导航」可在总览、意象、时间轴与学习版图之间跳转，便于课堂演示由浅入深。</li>
        </ul>
      </section>

      {isTeacherMode ? (
        <section className="surface-card card-dense">
          <StateCalloutCard
            eyebrow="教师演示脚本（轻量）"
            title="3 步把图谱讲成“可迁移的理解”"
            description="① 先锁定一个薄弱节点（题型/意象/诗人/题材）→ ② 打开关联诗词做 1 次对比阅读 → ③ 立刻进入练测并回到学情展示错因与计划。"
            tone="warm"
            actions={[
              { label: "打开总览", to: "/graph?view=learning", variant: "primary" },
              { label: "去练测", to: buildPracticeLink(related) },
              { label: "回学情收口", to: buildWrongbookLink(related) },
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
                打开教学视角
              </button>
            }
          />
        ) : null}
      </section>

      {loading ? <section className="surface-card card-roomy text-sm text-slate-500">图谱加载中...</section> : null}

      {error ? <section className="rounded-lg bg-red-50 p-4 text-sm text-red-700 shadow-[inset_0_0_0_1px_rgba(220,38,38,0.2)]">{error}</section> : null}

      <PageStage tone="detail">
        <ContextBanner />
        <NextStepRecommendations
          title="图谱之后推荐动作"
          subtitle="图谱不是终点，而是把发现重新送回练测、精讲与学情复盘。"
          items={[
            {
              title: "围绕当前节点去练测",
              description: related ? `已锁定 ${relatedKindLabelMap[related.kind]}“${related.value}”，建议立刻做一组对应巩固题。` : "先选一个节点，再进入对应题组巩固。",
              to: buildPracticeLink(related),
              ctaLabel: "去练测",
              badge: "巩固",
            },
            {
              title: "回到学情中心",
              description: "把图谱里暴露出的薄弱点，和错题、复习计划、记忆任务放在一起复盘。",
              to: buildWrongbookLink(related),
              ctaLabel: "看学情",
              badge: "收束",
            },
            {
              title: "把发现转成创作输出",
              description: related
                ? `围绕${relatedKindLabelMap[related.kind]}“${related.value}”写一段仿写或改写，把理解变成可展示的作品。`
                : "选一个意象/主题做仿写，把图谱里的发现转成你的课堂输出。",
              to: related?.value ? `/create?topic=${encodeURIComponent(related.value)}` : "/create",
              ctaLabel: "去创作",
              badge: "输出",
            },
            {
              title: "返回精讲继续讲",
              description: "如果当前图谱是从课堂精讲跳过来的，可以回到原诗继续推进教学。",
              to: graphLearnBackTo,
              ctaLabel: "回学习页",
              badge: "回讲",
            },
          ]}
          className="mt-4"
        />
      </PageStage>

      {!loading ? (
        <>
          <section className="dashboard-strip flow-md">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flow-sm">
                <p className="section-kicker">今日焦点</p>
                <h2 className="font-display text-2xl text-ink-700">先处理一个薄弱点</h2>
                <span className="surface-chip">{focusSummary}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Magnet className="inline-flex">
                  <button
                    type="button"
                    onClick={() => openGraphWorkspace("overview")}
                    className="btn-primary-compact"
                  >
                    打开总览
                  </button>
                </Magnet>
                <button
                  type="button"
                  onClick={() => openGraphWorkspace("related")}
                  className="btn-secondary-compact"
                >
                  关联诗词
                </button>
                <button
                  type="button"
                  onClick={() => openGraphWorkspace("details", "insights")}
                  className="btn-secondary-compact"
                >
                  图谱详情
                </button>
              </div>
            </div>

            <div className="workspace-meta-grid">
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">薄弱节点</p>
                <p className="workspace-meta-value">{graphWorkspaceStats.totalNodes}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">当前焦点</p>
                <p className="workspace-meta-value line-clamp-1">{graphWorkspaceStats.focusNode}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">关联诗词</p>
                <p className="workspace-meta-value">{graphWorkspaceStats.relatedPoemCount}</p>
              </article>
              <article className="workspace-meta-item">
                <p className="workspace-meta-label">覆盖朝代</p>
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
                      总览
                    </button>
                    <button
                      type="button"
                      onClick={() => openGraphWorkspace("related")}
                      className={["segmented-tab", graphWorkspaceView === "related" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      关联诗词
                    </button>
                    <button
                      type="button"
                      onClick={() => openGraphWorkspace("details")}
                      className={["segmented-tab", graphWorkspaceView === "details" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      图谱详情
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">薄弱节点</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.totalNodes}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">关联诗词</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.relatedPoemCount}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">当前焦点</div>
                    <div className="mt-1 line-clamp-1 text-sm text-ink-700">{graphWorkspaceStats.focusNode}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">最近对比</div>
                    <div className="mt-1 text-sm text-ink-700">{graphWorkspaceStats.latestCompareAccuracy}</div>
                  </div>
                </div>
                <div className="rounded-lg px-3 py-2 text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-subtle)', color: 'var(--neutral)' }}>
                  {related
                    ? `已选节点：${relatedKindLabelMap[related.kind]} · ${related.value}`
                    : "先在总览中选择一个节点，再进入关联诗词。"}
                </div>
              </section>

              {graphWorkspaceView === "overview" ? (
                <section className="graph-primary-grid">
                  <article className="surface-card flow-md">
                    <h2 className="font-display text-2xl text-ink-700">我的薄弱图谱</h2>
                    <p className="mt-2 text-xs text-slate-500">基于错题与练习记录自动生成，优先点击高频节点。</p>

                    <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
                      <div className="metric-card p-2 text-center">
                        <div className="text-[11px] text-slate-500">错题</div>
                        <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.wrongCount ?? 0}</div>
                      </div>
                      <div className="metric-card p-2 text-center">
                        <div className="text-[11px] text-slate-500">题型</div>
                        <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.typeCount ?? 0}</div>
                      </div>
                      <div className="metric-card p-2 text-center">
                        <div className="text-[11px] text-slate-500">朝代</div>
                        <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.dynastyCount ?? 0}</div>
                      </div>
                      <div className="metric-card p-2 text-center">
                        <div className="text-[11px] text-slate-500">题材</div>
                        <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.themeCount ?? 0}</div>
                      </div>
                      <div className="metric-card p-2 text-center">
                        <div className="text-[11px] text-slate-500">高频诗</div>
                        <div className="mt-1 text-base font-semibold text-ink-700">{personalGraph?.summary?.poemCount ?? 0}</div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {renderGroup("题型薄弱点", personalGroups.question_type || [])}
                      {renderGroup("朝代薄弱点", personalGroups.dynasty || [])}
                      {renderGroup("题材薄弱点", personalGroups.theme || [])}
                      {renderGroup("高频错题诗名", personalGroups.poem || [])}
                    </div>

                    <article className="mt-4 rounded-lg bg-amber-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
                      <h3 className="text-xs text-amber-800">今日建议动作</h3>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {insightActions.map((action) => (
                          <div key={action.key} className="flex items-center gap-1">
                            <Link
                              to={action.to}
                              className="rounded px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100" style={{ background: 'var(--bg-surface)' }}
                            >
                              {action.label}
                            </Link>
                            {action.kind && action.value ? (
                              <button
                                type="button"
                                onClick={() => {
                                  void loadRelatedPoems(action.kind as NodeKind, action.value as string);
                                }}
                                className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
                              >
                                看关联诗词
                              </button>
                            ) : null}
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => openGraphWorkspace("details", "insights")}
                          className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
                        >
                          查看学习洞察
                        </button>
                      </div>
                    </article>
                  </article>

                  <section className="surface-card card-cozy flow-md">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-display text-2xl text-ink-700">下一步建议</h2>
                        <p className="text-xs text-slate-500">{related ? `已锁定：${relatedKindLabelMap[related.kind]} · ${related.value}` : "先锁定一个节点"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openGraphWorkspace("related")} className="btn-secondary-compact">
                          去看关联诗词
                        </button>
                        <button type="button" onClick={() => openGraphWorkspace("details")} className="btn-secondary-compact">
                          打开图谱详情
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <div className="text-[11px] text-slate-500">当前焦点</div>
                        <div className="mt-1 line-clamp-1 text-sm text-ink-700">{graphWorkspaceStats.focusNode}</div>
                      </div>
                      <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <div className="text-[11px] text-slate-500">关联诗词候选</div>
                        <div className="mt-1 text-sm text-ink-700">{relatedPoems.length} 首</div>
                      </div>
                    </div>
                  </section>
                </section>
              ) : null}

              {graphWorkspaceView === "related" ? (
                <section className="surface-card card-cozy flow-md">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink-700">关联诗词</h2>
                    <p className="text-xs text-slate-500">{related ? `当前节点：${relatedKindLabelMap[related.kind]} · ${related.value}` : "等待选择节点"}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openGraphWorkspace("overview")} className="btn-secondary-compact">
                      返回总览
                    </button>
                    {related ? (
                      <Link to={buildWrongbookLink(related)} className="btn-secondary-compact">
                        在错题本查看
                      </Link>
                    ) : null}
                    {related ? (
                      <Link to={buildPracticeLink(related)} className="btn-secondary-compact">
                        一键专项练习
                      </Link>
                    ) : null}
                  </div>
                </div>

                {!related && !relatedLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <article key={`related-skeleton-${index}`} className="rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)] animate-pulse" style={{ background: 'var(--bg-surface)' }}>
                        <div className="h-4 w-24 rounded bg-slate-200" />
                        <div className="mt-2 h-3 w-32 rounded bg-slate-100" />
                        <div className="mt-3 h-3 w-full rounded bg-slate-100" />
                        <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
                        <div className="mt-3 h-7 w-20 rounded bg-slate-200" />
                      </article>
                    ))}
                  </div>
                ) : null}

                {!relatedLoading && related && relatedRecommendation ? (
                  <div className="rounded-lg bg-amber-50 p-3 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
                    <p className="text-xs font-medium text-amber-900">{relatedRecommendation.title}</p>
                    <p className="mt-1 text-xs leading-5 text-amber-900">{relatedRecommendation.reason}</p>
                    {relatedRecommendation.actionPlan.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {relatedRecommendation.actionPlan.map((item, index) => (
                          <li key={`node-rec-step-${index}`} className="text-[11px] leading-5 text-amber-900">
                            {index + 1}. {item}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}

                {relatedLoading ? <p className="text-sm text-slate-500">加载中...</p> : null}

                {!relatedLoading && related && relatedPoems.length === 0 ? (
                  <div className="rounded-lg p-4 text-sm text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)]" style={{ background: 'var(--bg-subtle)' }}>暂无匹配诗词。</div>
                ) : null}

                {!relatedLoading && relatedPoems.length > 0 ? (
                  <div className="max-h-[620px] flow-sm overflow-auto">
                    {relatedPoems.map((poem) => (
                      <SpotlightCard
                        key={poem.id}
                        className="rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]" style={{ background: 'var(--bg-surface)' }}
                        spotlightColor="rgba(26,43,76,0.08)"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <h3 className="text-sm text-ink-700">{poem.title}</h3>
                          <span className="text-xs text-slate-500">
                            {poem.author} · {poem.dynasty}
                          </span>
                        </div>
                        <p className="mt-2 line-clamp-3 text-xs leading-6" style={{ color: 'var(--neutral)' }}>{poem.content}</p>
                        <div className="mt-3 flex items-center gap-2">
                          <Link
                            to={buildPoemWrongbookLink(poem.title)}
                            className="btn-secondary inline-block text-xs"
                          >
                            查看这首错题
                          </Link>
                          <Link
                            to={`/learn/${poem.id}`}
                            className="btn-secondary inline-block text-xs"
                          >
                            进入学习页
                          </Link>
                          <Link
                            to={buildPoemPracticeLink(poem.title)}
                            className="btn-secondary-compact inline-block text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.26)] hover:bg-ink-50"
                          >
                            基于此诗练习
                          </Link>
                        </div>
                      </SpotlightCard>
                    ))}
                  </div>
                ) : null}
              </section>
                ) : null}

              {graphWorkspaceView === "details" ? (
                <section className="surface-card card-cozy flow-md">
              <section className="flow-md">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-2xl text-ink-700">图谱详情</h2>
                    <p className="mt-1 text-xs text-slate-500">按标签查看诗人、意象、时间轴与学习洞察。</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => openGraphWorkspace("overview")} className="btn-secondary-compact">
                      返回总览
                    </button>
                    <span className="text-xs text-slate-500">当前标签：{graphDetailTabLabel}</span>
                  </div>
                  <div className="segmented-tabs">
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("poet")}
                      className={["segmented-tab", graphDetailTab === "poet" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      诗人网络
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("imagery")}
                      className={["segmented-tab", graphDetailTab === "imagery" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      意象网络
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("timeline")}
                      className={["segmented-tab", graphDetailTab === "timeline" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      朝代时间轴
                    </button>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("insights")}
                      className={["segmented-tab", graphDetailTab === "insights" ? "segmented-tab-active" : ""].join(" ")}
                    >
                      学习洞察
                    </button>
                  </div>
                </div>
              </section>

          {(graphDetailTab === "poet" || graphDetailTab === "imagery") ? (
            <section className="grid grid-cols-1 gap-6">
              {graphDetailTab === "poet" ? (
                <article className="surface-card flow-md">
              <h2 className="font-display text-2xl text-ink-700">诗人节点</h2>
              <p className="mt-2 text-xs text-slate-500">点击诗人查看其关联诗词。</p>
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
                      placeholder="搜索诗人节点并定位"
                      className="w-full bg-transparent text-sm text-slate-700 outline-none"
                    />
                  </div>
                  <button type="button" onClick={applyPoetSearch} className="btn-secondary-compact">
                    定位
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
                    清空
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
                  <p className="mt-2 text-[11px] text-slate-500">当前搜索：{graphSearchKeyword}</p>
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
                    <p className="font-serif text-2xl text-[#1A2B4C]">图谱尚未点亮</p>
                    <p className="mt-2 font-sans text-sm text-slate-500">
                      开始学习后，你的知识图谱将在这里生长。
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
                          
                          const nodeRadius = 4 + Math.sqrt(node.count || 1) * 2;
                          
                          // Subtle glow for active node
                          if (active) {
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, nodeRadius + 4, 0, 2 * Math.PI, false);
                            ctx.fillStyle = "rgba(200,155,90,0.18)";
                            ctx.fill();
                          }
                          
                          ctx.beginPath();
                          ctx.arc(node.x, node.y, nodeRadius, 0, 2 * Math.PI, false);
                          if (active) {
                            const grad = ctx.createRadialGradient(node.x - nodeRadius * 0.3, node.y - nodeRadius * 0.3, nodeRadius * 0.1, node.x, node.y, nodeRadius);
                            grad.addColorStop(0, "#e8c97a");
                            grad.addColorStop(1, "#c89b5a");
                            ctx.fillStyle = grad;
                          } else {
                            ctx.fillStyle = "var(--brand-ink)";
                          }
                          ctx.fill();
                          
                          ctx.textAlign = 'center';
                          ctx.textBaseline = 'middle';
                          ctx.fillStyle = active ? "#8A6B32" : "#475569";
                          ctx.fillText(label, node.x, node.y + nodeRadius + 10);
                        }}
                        onNodeClick={handleNodeClick}
                        cooldownTicks={100}
                      />
                    </div>
                    <div className="absolute left-3 top-3 flex gap-2">
                      <SpotlightCard className="rounded-xl bg-white/90 px-3 py-2 shadow-[0_4px_12px_rgba(26,43,76,0.08)]" spotlightColor="rgba(26,43,76,0.08)">
                        <p className="text-[10px] text-slate-500">节点</p>
                        <p className="font-serif text-xl text-[#1A2B4C]">{poetForceLayout.nodes.length}</p>
                      </SpotlightCard>
                      <SpotlightCard className="rounded-xl bg-white/90 px-3 py-2 shadow-[0_4px_12px_rgba(26,43,76,0.08)]" spotlightColor="rgba(201,169,110,0.12)">
                        <p className="text-[10px] text-slate-500">关系边</p>
                        <p className="font-serif text-xl text-[#1A2B4C]">{poetForceLayout.edges.length}</p>
                      </SpotlightCard>
                    </div>
                    <div className="absolute bottom-3 right-3 flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fgRef.current?.zoom(fgRef.current.zoom() * 1.2, 400)}
                        className="rounded-full bg-white p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50"
                        aria-label="放大"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => fgRef.current?.zoom(fgRef.current.zoom() / 1.2, 400)}
                        className="rounded-full bg-white p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50"
                        aria-label="缩小"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={resetPoetGraphView}
                        className="rounded-full p-2 text-slate-700 shadow-[0_4px_14px_rgba(26,43,76,0.16)] transition hover:bg-stone-50" style={{ background: 'var(--bg-surface)' }}
                        aria-label="复位"
                      >
                        <RotateCcw className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
                {graphFocusNode ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="rounded-full px-3 py-1 text-xs shadow-[0_2px_8px_rgba(26,43,76,0.06)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>当前焦点：{graphFocusNode}</span>
                    <button type="button" onClick={() => void loadRelatedPoems("poet", graphFocusNode, { view: "details", scroll: false })} className="btn-secondary-compact">
                      查看关联诗词
                    </button>
                  </div>
                ) : null}
              </SpotlightCard>
              <div className="mt-4 rounded-2xl bg-stone-50 px-4 py-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.16)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="learn-goal-kicker">节点详情</p>
                    <h3 className="mt-2 font-serif text-2xl text-[#1A2B4C]">{related?.kind === "poet" ? related.value : graphFocusNode || "等待选择诗人"}</h3>
                  </div>
                  {related?.kind === "poet" && selectedPoetPanelPoems.length > 0 ? (
                    <Link to={`/learn/${selectedPoetPanelPoems[0].id}`} className="btn-primary-compact">
                      精讲此诗
                    </Link>
                  ) : null}
                </div>
                {selectedPoetPanelPoems.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {selectedPoetPanelPoems.map((poem) => (
                      <article key={`focus-poem-${poem.id}`} className="rounded-xl px-4 py-3 shadow-[0_6px_18px_rgba(26,43,76,0.06)]" style={{ background: 'var(--bg-surface)' }}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-[#1A2B4C]">{poem.title}</p>
                            <p className="mt-0.5 text-xs text-slate-500">{poem.author} · {poem.dynasty}</p>
                            {poem.content ? (
                              <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 font-display">
                                {poem.content.slice(0, 60)}{poem.content.length > 60 ? "…" : ""}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <Link to={`/learn/${poem.id}`} className="btn-primary-compact text-xs">
                              进入精讲
                            </Link>
                            <Link to={buildPoemPracticeLink(poem.title)} className="btn-secondary-compact text-xs">
                              练习
                            </Link>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-sm leading-7" style={{ color: 'var(--neutral)' }}>点击图谱中的诗人节点后，这里会展示代表作品和继续学习入口。</p>
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
                      {node.label} · {node.dynasty || "未知"} · {node.count ?? 0} 首
                    </button>
                  );
                })}
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                <h3 className="text-sm text-slate-500">诗人关系边</h3>
                <select
                  value={poetEdgeDynastyFilter}
                  onChange={(event) => setPoetEdgeDynastyFilter(event.target.value)}
                  className="input-main control-compact"
                >
                  <option value="all">全部朝代</option>
                  {poetEdgeDynasties.map((dynasty) => (
                    <option key={`edge-dynasty-${dynasty}`} value={dynasty}>
                      {dynasty}
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-[11px] text-slate-400">当前关系数：{filteredPoetEdges.length}</p>
              <div className="mt-2 max-h-[180px] flow-sm overflow-auto">
                {filteredPoetEdges.slice(0, 120).map((edge, index) => (
                  <article
                    key={`poet-edge-${edge.source}-${edge.target}-${index}`}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}
                  >
                    <div className="flex items-center gap-1">
                      <span>{edge.source} ↔ {edge.target}</span>
                      <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px] text-slate-500 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)]" style={{ background: 'var(--bg-surface)' }}>
                        {edge.dynasty || "未知朝代"}
                      </span>
                      <span className="ml-1 rounded-full bg-ink-50 px-1.5 py-0.5 text-[10px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.18)]">
                        {poetEdgeTypeLabelMap[String(edge.type || "")] || edge.type || "关系"}
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
                        看关联
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          openPoetCompare(edge.source, edge.target, edge.dynasty);
                        }}
                        className="rounded bg-ink-50 px-2 py-1 text-[11px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] transition hover:bg-ink-100"
                      >
                        对比诗人
                      </button>
                    </div>
                  </article>
                ))}
              </div>

              <div className="mt-5 rounded-lg p-3 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-subtle)' }}>
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm text-slate-700">最近对比记录</h4>
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
                      {recentCompareSort === "accuracy_asc" ? "低分优先" : "最新优先"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void loadRecentCompareLogs({ page: recentComparePage })}
                      className="btn-secondary-compact"
                    >
                      刷新
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
                    placeholder="按诗人名搜索（如 李白）"
                    className="input-main control-compact flex-1"
                  />
                  <button
                    type="submit"
                    className="btn-secondary-compact"
                  >
                    搜索
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
                    清空
                  </button>
                </form>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[11px] text-slate-500">时间范围</span>
                  {[
                    { key: "7", label: "近7天" },
                    { key: "30", label: "近30天" },
                    { key: "all", label: "全部" },
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
                {recentCompareLoading ? <p className="mt-2 text-xs text-slate-500">加载中...</p> : null}
                {recentCompareError ? <p className="mt-2 text-xs" style={{ color: 'var(--error)' }}>{recentCompareError}</p> : null}
                {!recentCompareLoading && !recentCompareError && recentCompareSorted.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">暂无记录，先去完成一组图谱对比练习。</p>
                ) : null}
                {!recentCompareLoading && recentCompareSorted.length > 0 ? (
                  <ul className="mt-2 flow-sm">
                    {recentCompareSorted.map((item) => {
                      const pair = parseCompareTopic(item.topic || "");
                      const canOpen = Boolean(pair?.left && pair?.right);
                      return (
                        <li key={`recent-compare-${item.id}`} className="rounded px-2 py-1.5 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-[11px] text-slate-700">{item.topic || "图谱对比练习"}</span>
                            <span className="text-[10px] text-slate-500">
                              {Math.max(0, Math.min(100, Number(item.accuracy || 0)))}%
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                            <span>
                              对错 {Number(item.correct || 0)}/{Number(item.attempts || 0)}
                            </span>
                            {item.weak_type ? (
                              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-amber-700">
                                薄弱:{practiceTypeLabelMap[item.weak_type] || item.weak_type}
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
                                {recentCompareDeleteId === item.id ? "删除中..." : "删除"}
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
                                回到该对比
                              </button>
                              {pair ? (
                                <Link
                                  to={buildPoetComparePracticeLink(pair.left, pair.right)}
                                  className="rounded px-2 py-0.5 text-[10px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)] transition hover:bg-ink-50" style={{ background: 'var(--bg-surface)' }}
                                >
                                  再做一套
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
                      第 {recentComparePage}/{recentCompareTotalPages} 页 · 共 {recentCompareTotal} 条
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
                        上一页
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
                        下一页
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              {poetCompare ? (
                <div className="mt-4 rounded-lg bg-ink-50 p-3 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)]">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs text-ink-700">
                      诗人对比：{poetCompare.left} vs {poetCompare.right}
                    </h4>
                    <div className="flex items-center gap-2">
                      <Link
                        to={buildPoetComparePracticeLink(poetCompare.left, poetCompare.right)}
                        className="rounded px-2 py-1 text-[11px] text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)] transition hover:bg-ink-100" style={{ background: 'var(--bg-surface)' }}
                      >
                        生成对比练习
                      </Link>
                      <button
                        type="button"
                        onClick={closePoetCompare}
                        className="btn-secondary-compact"
                      >
                        关闭
                      </button>
                    </div>
                  </div>
                  {poetCompare.dynasty ? <p className="mt-1 text-[11px] text-slate-500">关系朝代：{poetCompare.dynasty}</p> : null}
                  {poetCompareLoading ? <p className="mt-2 text-xs text-slate-500">对比加载中...</p> : null}
                  {poetCompareError ? <p className="mt-2 text-xs" style={{ color: 'var(--error)' }}>{poetCompareError}</p> : null}
                  {!poetCompareLoading && !poetCompareError ? (
                    <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <article className="rounded p-2 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <p className="text-xs" style={{ color: 'var(--neutral)' }}>{poetCompare.left} 代表作（前6首）</p>
                        <ul className="mt-1 space-y-1">
                          {poetCompareLeftPoems.slice(0, 6).map((poem) => (
                            <li key={`left-${poem.id}`} className="text-[11px] text-slate-700">
                              {poem.title}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-500">
                          高频意象：{compareLeftImagery.length > 0 ? compareLeftImagery.map((item) => `${item.keyword}(${item.count})`).join("、") : "暂无"}
                        </p>
                      </article>
                      <article className="rounded p-2 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                        <p className="text-xs" style={{ color: 'var(--neutral)' }}>{poetCompare.right} 代表作（前6首）</p>
                        <ul className="mt-1 space-y-1">
                          {poetCompareRightPoems.slice(0, 6).map((poem) => (
                            <li key={`right-${poem.id}`} className="text-[11px] text-slate-700">
                              {poem.title}
                            </li>
                          ))}
                        </ul>
                        <p className="mt-2 text-[11px] text-slate-500">
                          高频意象：{compareRightImagery.length > 0 ? compareRightImagery.map((item) => `${item.keyword}(${item.count})`).join("、") : "暂无"}
                        </p>
                      </article>
                    </div>
                  ) : null}
                </div>
              ) : null}
                </article>
              ) : null}

              {graphDetailTab === "imagery" ? (
                <article className="surface-card flow-md">
              <h2 className="font-display text-2xl text-ink-700">意象节点</h2>
              <p className="mt-2 text-xs text-slate-500">点击意象查看相关诗词。</p>
              <div className="mt-4 max-h-[320px] flow-sm overflow-auto">
                {imageryKeywords.map((node) => {
                  const active = related?.kind === "imagery" && related.value === node.label;
                  return (
                    <button
                      key={node.id}
                      type="button"
                      onClick={() => void loadRelatedPoems("imagery", node.label)}
                      className={[
                        "w-full rounded-lg px-3 py-2 text-left text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.24)] transition",
                        active
                          ? "bg-ink-700 text-white shadow-[inset_0_0_0_1px_rgba(26,43,76,0.62)]"
                          : "bg-white text-slate-700 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      {node.label}
                    </button>
                  );
                })}
              </div>

              <h3 className="mt-5 text-sm text-slate-500">意象关系（示例）</h3>
              <div className="mt-2 max-h-[180px] flow-sm overflow-auto">
                {(imageryGraph?.edges || []).slice(0, 50).map((edge, index) => (
                  <button
                    key={`${edge.source}-${edge.target}-${index}`}
                    type="button"
                    onClick={() => void loadRelatedPoems("imagery", edge.source)}
                    className="w-full rounded-lg bg-white px-3 py-2 text-left text-xs text-slate-600 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] transition hover:bg-slate-50"
                  >
                    {edge.source} → {edge.target.replace("poem:", "")}
                  </button>
                ))}
              </div>
                </article>
              ) : null}
            </section>
          ) : null}

          {graphDetailTab === "timeline" ? (
            <section className="surface-card flow-md">
            <h2 className="font-display text-2xl text-ink-700">朝代时间轴</h2>
            <p className="mt-2 text-xs text-slate-500">
              已收录 {timelineGraph?.totalPoems ?? 0} 首诗词，覆盖 {timelineGraph?.dynastyCount ?? 0} 个朝代。
            </p>

            {Array.isArray(timelineGraph?.items) && timelineGraph.items.length > 0 ? (
              <div className="mt-4 flow-sm">
                {timelineGraph.items.map((item) => {
                  const maxCount = Math.max(...timelineGraph.items.map((row) => row.count), 1);
                  const width = Math.max(8, Math.round((item.count / maxCount) * 100));
                  return (
                    <article key={`timeline-${item.dynasty}`} className="rounded-lg p-3 shadow-[0_10px_24px_rgba(26,43,76,0.08)]" style={{ background: 'var(--bg-surface)' }}>
                      <div className="flex items-center justify-between text-sm text-slate-700">
                        <button
                          type="button"
                          onClick={() => void loadRelatedPoems("dynasty", item.dynasty)}
                          className="text-left text-ink-700 transition hover:text-ink-900"
                        >
                          {item.dynasty}
                        </button>
                        <span>{item.count} 首</span>
                      </div>
                      <div className="mt-2 h-2 rounded-full bg-slate-100">
                        <div className="h-2 rounded-full bg-ink-700" style={{ width: `${width}%` }} />
                      </div>
                      {item.topPoets.length > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          代表诗人：{item.topPoets.map((poet) => `${poet.author}(${poet.count})`).join("、")}
                        </p>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">暂无时间轴数据。</p>
            )}
            </section>
          ) : null}

          {graphDetailTab === "insights" ? (
            <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <article className="surface-card flow-md">
                <h2 className="font-display text-2xl text-ink-700">学习洞察（近 7 天）</h2>
                <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded bg-ink-50 p-2 text-center">
                    <div className="text-[11px] text-slate-500">练习</div>
                    <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyPractice ?? 0}</div>
                  </div>
                  <div className="rounded bg-ink-50 p-2 text-center">
                    <div className="text-[11px] text-slate-500">错题新增</div>
                    <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyWrongAdded ?? 0}</div>
                  </div>
                  <div className="rounded bg-ink-50 p-2 text-center">
                    <div className="text-[11px] text-slate-500">背诵复习</div>
                    <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyMemoryReview ?? 0}</div>
                  </div>
                  <div className="rounded bg-ink-50 p-2 text-center">
                    <div className="text-[11px] text-slate-500">创作发布</div>
                    <div className="mt-1 text-sm text-ink-700">{personalInsights?.summary?.weeklyCreations ?? 0}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">收藏诗词</div>
                    <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.favoritesCount ?? 0}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">已掌握</div>
                    <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.masteredCount ?? 0}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">公开作品</div>
                    <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.publicCreations ?? 0}</div>
                  </div>
                  <div className="rounded p-2 text-center shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)' }}>
                    <div className="text-[11px] text-slate-500">累计获赞</div>
                    <div className="mt-1 text-xs text-slate-700">{personalInsights?.summary?.receivedLikes ?? 0}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <h3 className="text-xs text-slate-500">日活跃走势</h3>
                  <div className="mt-2 flow-sm">
                    {(personalInsights?.activity?.items || []).map((item) => {
                      const dayTotal =
                        Number(item.practice || 0) + Number(item.wrongAdded || 0) + Number(item.memoryReview || 0) + Number(item.creation || 0);
                      const width = Math.max(6, Math.round((dayTotal / Math.max(1, activityPeak)) * 100));
                      return (
                        <div key={`insight-day-${item.date}`} className="grid grid-cols-[86px_1fr_58px] items-center gap-2 text-[11px]">
                          <span className="text-slate-500">{item.date.slice(5)}</span>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-ink-700" style={{ width: `${width}%` }} />
                          </div>
                          <span className="text-right" style={{ color: 'var(--neutral)' }}>{dayTotal}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                  <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
                    题型焦点：{personalInsights?.focus?.questionType?.key || "暂无"}{" "}
                    {typeof personalInsights?.focus?.questionType?.rate === "number" ? `(${personalInsights?.focus?.questionType?.rate}%)` : ""}
                  </div>
                  <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
                    朝代焦点：{personalInsights?.focus?.dynasty?.key || "暂无"}{" "}
                    {typeof personalInsights?.focus?.dynasty?.rate === "number" ? `(${personalInsights?.focus?.dynasty?.rate}%)` : ""}
                  </div>
                  <div className="rounded px-2 py-1.5 text-[11px] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.2)]" style={{ background: 'var(--bg-surface)', color: 'var(--neutral)' }}>
                    题材焦点：{personalInsights?.focus?.theme?.key || "暂无"}{" "}
                    {typeof personalInsights?.focus?.theme?.rate === "number" ? `(${personalInsights?.focus?.theme?.rate}%)` : ""}
                  </div>
                </div>

                <div className="mt-3 rounded bg-amber-50 px-3 py-2 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.2)]">
                  <h3 className="text-xs text-amber-800">本周建议</h3>
                  <ul className="mt-1 space-y-1">
                    {(personalInsights?.recommendations || []).map((item, index) => (
                      <li key={`insight-rec-${index}`} className="text-[11px] leading-5 text-amber-900">
                        {index + 1}. {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Link to={buildWrongbookLink(null)} className="rounded px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100" style={{ background: 'var(--bg-surface)' }}>
                      查看全部错题
                    </Link>
                    <button
                      type="button"
                      onClick={() => setGraphDetailTab("poet")}
                      className="rounded bg-white px-2 py-1 text-[11px] text-amber-900 shadow-[inset_0_0_0_1px_rgba(217,119,6,0.3)] transition hover:bg-amber-100"
                    >
                      回到诗人网络
                    </button>
                  </div>
                </div>
              </article>

              <article className="surface-card flow-md">
                <h2 className="font-display text-2xl text-ink-700">学习行为图谱（近7天）</h2>
                <p className="mt-1 text-[11px] text-slate-500">将练习、记忆、创作与错题行为汇总成个人学习节点。</p>
                <div className="mt-3 rounded-lg bg-ink-50 p-3 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.2)]">
                  <div className="flex items-center justify-center">
                    <div className="rounded-full px-4 py-1.5 text-xs text-ink-700 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.22)]" style={{ background: 'var(--bg-surface)' }}>
                      学习中心
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {learningBehaviorNodes.map((node) => (
                      <Link
                        key={`learning-node-${node.key}`}
                        to={node.to}
                        className={`rounded-lg px-3 py-2 text-xs transition hover:brightness-95 ${node.colorClass}`}
                      >
                        <div className="flex items-center justify-between">
                          <span>{node.label}</span>
                          <span>{node.value}</span>
                        </div>
                        <p className="mt-1 text-[10px] opacity-80">点击进入对应模块</p>
                      </Link>
                    ))}
                  </div>
                </div>
              </article>
            </section>
              ) : null}
            </section>
              ) : null}
            </PageStage>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
