import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Magnet } from "@/components/react-bits";
import type { AnalysisResult, AnalysisSectionKey } from "@/types";

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  streamText: string;
  isLoading: boolean;
  error: string | null;
  source: "cache" | "ai" | null;
  poemTitle?: string;
  /** 传给图谱页 `highlight` 参数，默认同 `poemTitle` */
  graphHighlight?: string;
}

type AnalysisTab = "translation" | "imagery" | "emotion" | "technique";

const TAB_CONFIG: Array<{ id: AnalysisTab; label: string; key: AnalysisSectionKey }> = [
  { id: "translation", label: "译解", key: "annotationsAndTranslation" },
  { id: "imagery", label: "意象", key: "imageryAndMood" },
  { id: "emotion", label: "情感", key: "themeAndEmotion" },
  { id: "technique", label: "手法", key: "techniques" },
];

const SUPPLEMENT_KEYS: AnalysisSectionKey[] = ["basicInfo", "authorAndContext", "examPoints"];

function extractStudyPoints(input: string, limit = 3): string[] {
  const chunks = String(input || "")
    .split(/[\n。！？；]/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 6)
    .slice(0, 12);

  return Array.from(new Set(chunks)).slice(0, limit);
}

export function AnalysisPanel({
  analysis,
  streamText,
  isLoading,
  error,
  source,
  poemTitle = "",
  graphHighlight,
}: AnalysisPanelProps): JSX.Element {
  const [activeTab, setActiveTab] = useState<AnalysisTab>("translation");

  const activeSection = useMemo(() => {
    if (!analysis) return null;
    const tab = TAB_CONFIG.find((item) => item.id === activeTab) || TAB_CONFIG[0];
    return analysis[tab.key];
  }, [analysis, activeTab]);

  const studyPoints = useMemo(() => {
    if (!analysis) return [];
    const merged = [
      ...extractStudyPoints(analysis.themeAndEmotion?.content || "", 2),
      ...extractStudyPoints(analysis.techniques?.content || "", 2),
      ...extractStudyPoints(analysis.examPoints?.content || "", 2),
    ];
    return Array.from(new Set(merged)).slice(0, 3);
  }, [analysis]);

  const practiceTopic = useMemo(() => encodeURIComponent(poemTitle.trim() || "古诗词综合"), [poemTitle]);
  const graphHref = useMemo(() => {
    const raw = (graphHighlight ?? poemTitle).trim() || "古诗词综合";
    return `/graph?highlight=${encodeURIComponent(raw)}`;
  }, [graphHighlight, poemTitle]);
  const sourceLabel = source === "cache" ? "缓存" : "AI 实时";

  if (error) {
    return <section className="rounded-xl shadow-[inset_0_0_0_1px_rgba(239,68,68,0.24)] bg-red-50 p-4 text-red-700">{error}</section>;
  }

  if (isLoading && !analysis) {
    return (
      <section className="result-card">
        <div className="mb-2 text-sm text-ink-500">AI 正在解析中...</div>
        <pre className="max-h-[42vh] overflow-auto whitespace-pre-wrap break-words rounded-lg bg-ink-50 p-4 text-sm text-ink-700 stream-caret">
          {streamText || "正在建立流式连接..."}
        </pre>
      </section>
    );
  }

  if (!analysis) {
    return <section className="state-card">输入诗词后点击“开始解析”，这里会按译解、意象、情感、手法分步展示。</section>;
  }

  return (
    <section className="result-card space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3 shadow-[inset_0_-1px_0_rgba(148,163,184,0.22)] pb-3">
        <div>
          <h3 className="font-display text-2xl text-ink-700">解析结果</h3>
          <p className="mt-1 text-xs text-slate-500">先看核心分组，再进入练习与复盘。</p>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">点击「进入图谱」查看本诗在诗人、意象与主题网络中的位置。</p>
        </div>
        <div className="flex flex-shrink-0 flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <Magnet className="inline-flex justify-end sm:justify-center" strength={0.26}>
            <Link to={graphHref} className="btn-secondary-compact justify-center whitespace-nowrap">
              进入图谱 →
            </Link>
          </Magnet>
          <span className="rounded-full shadow-[inset_0_0_0_1px_rgba(201,169,110,0.30)] bg-warm-50 px-3 py-1 text-center text-xs text-warm-700">
            数据来源：{sourceLabel}
          </span>
        </div>
      </header>

      <div className="segmented-tabs w-full max-w-max">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={["segmented-tab min-w-[76px]", activeTab === tab.id ? "segmented-tab-active" : "hover:text-ink-700"].join(" ")}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <motion.article
        key={activeTab}
        className="rounded-xl shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-white p-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
      >
        <h4 className="font-display text-lg text-ink-700">{activeSection?.title || "暂无标题"}</h4>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">{activeSection?.content || "暂无内容"}</p>
      </motion.article>

      <section className="rounded-xl shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-ink-50/40 p-4">
        <h5 className="text-sm font-semibold text-ink-700">本轮先记住</h5>
        {studyPoints.length > 0 ? (
          <ul className="mt-2 space-y-2 text-sm text-slate-700">
            {studyPoints.map((point) => (
              <li key={point} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-white px-3 py-2 leading-7">
                {point}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 rounded-lg shadow-[inset_0_0_0_1px_rgba(26,43,76,0.14)] bg-white px-3 py-2 text-sm leading-7 text-slate-600">
            建议优先复盘“情感主旨”和“艺术手法”，再进入练习巩固。
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {SUPPLEMENT_KEYS.map((key) => {
          const section = analysis[key];
          return (
            <article key={key} className="rounded-lg shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-slate-50/80 p-3">
              <h5 className="text-sm font-medium text-ink-700">{section?.title || "补充信息"}</h5>
              <p className="mt-1 line-clamp-4 text-xs leading-6 text-slate-600">{section?.content || "暂无内容"}</p>
            </article>
          );
        })}
      </div>

      <section className="rounded-xl shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)] bg-white/95 p-4">
        <h5 className="text-sm font-semibold text-ink-700">解析后下一步</h5>
        <p className="mt-1 text-xs text-slate-500">将当前结果转入练习和记忆，形成学习闭环。</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Link to={`/practice?topic=${practiceTopic}&count=6&difficulty=medium&auto=1&source=learn`} className="btn-primary-compact justify-center">
            做 6 题巩固
          </Link>
          <Link to="/memory" className="btn-secondary-compact justify-center">
            去记忆打卡
          </Link>
          <Link to="/my-learning?tab=wrongbook" className="btn-secondary-compact justify-center">
            看错题复盘
          </Link>
        </div>
      </section>
    </section>
  );
}
