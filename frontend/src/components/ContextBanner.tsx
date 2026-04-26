import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

type SourceKind = "explore" | "graph" | "wrongbook" | "practice" | "home";

interface SourceStyle {
  bg: string;
  border: string;
  text: string;
  label: string;
}

const sourceStyleMap: Record<SourceKind, SourceStyle> = {
  explore: { bg: "rgba(34,58,94,0.04)", border: "rgba(34,58,94,0.12)", text: "#223a5e", label: "诗词发现" },
  graph: { bg: "rgba(200,155,90,0.08)", border: "rgba(200,155,90,0.22)", text: "#8A6B32", label: "知识图谱" },
  wrongbook: { bg: "rgba(192,59,59,0.05)", border: "rgba(192,59,59,0.16)", text: "#a83232", label: "错题本" },
  practice: { bg: "rgba(100,116,139,0.05)", border: "rgba(100,116,139,0.14)", text: "#475569", label: "专项练习" },
  home: { bg: "rgba(34,58,94,0.03)", border: "rgba(34,58,94,0.10)", text: "#223a5e", label: "首页" },
};

export default function ContextBanner() {
  const [searchParams, setSearchParams] = useSearchParams();

  const source = searchParams.get("source") as SourceKind | null;
  const refLabel = searchParams.get("refLabel");
  const isValidSource = source !== null && source in sourceStyleMap;

  const style = isValidSource ? sourceStyleMap[source!] : null;

  const displayedLabel = useMemo(() => {
    if (refLabel) return refLabel;
    if (style) return style.label;
    return "";
  }, [refLabel, style]);

  const handleDismiss = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete("source");
    next.delete("refId");
    next.delete("refLabel");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  if (!isValidSource) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0, marginBottom: 0 }}
        animate={{ height: "auto", opacity: 1, marginBottom: 16 }}
        exit={{ height: 0, opacity: 0, marginBottom: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
          style={{
            background: style!.bg,
            border: `1px solid ${style!.border}`,
            color: style!.text,
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span className="flex-1 leading-tight">
            来自<span className="font-medium">「{displayedLabel}」</span>
          </span>
          <button
            onClick={handleDismiss}
            className="inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-black/6 transition-colors shrink-0"
            aria-label="关闭"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
