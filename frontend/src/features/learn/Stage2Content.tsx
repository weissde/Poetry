import { ArrowRight } from "lucide-react";
import { SectionCard } from "@/components/common/SectionCard";
import { PillNav } from "@/components/react-bits";
import { AnalysisPanel } from "@/components/analysis/AnalysisPanel";

interface Stage2ContentProps {
  depth: string; // "lite" | "standard" | "exam"
  onDepthChange: (depth: any) => void;
  depthNavItems: ReadonlyArray<{ id: string; label: string }>;
  analysisOutline: { translation: string[]; emotion: string[]; technique: string[] };
  analysis: any;
  streamText: string | null;
  isLoading: boolean;
  error: string | null;
  source: string | null;
  title: string;
  poemId: string | undefined;
  onStop: () => void;
  onAdvance: () => void;
  onGoBack: () => void;
}

export default function Stage2Content({
  depth,
  onDepthChange,
  depthNavItems,
  analysisOutline,
  analysis,
  streamText,
  isLoading,
  error,
  source,
  title,
  poemId,
  onStop,
  onAdvance,
  onGoBack,
}: Stage2ContentProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-8">
      {/* LEFT SIDEBAR */}
      <div className="space-y-6">
        <SectionCard title="解析导航" subtitle="选择深度，定位抓手">
          <div className="mb-5">
            <PillNav
              items={depthNavItems}
              value={depth}
              onChange={onDepthChange}
            />
          </div>

          {/* 3 Grasping-point articles */}
          <div className="space-y-3">
            <div
              className="p-3 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                background: "rgba(200,155,90,0.06)",
                border: "1px solid rgba(200,155,90,0.12)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--accent-gold)" }}
              >
                译解
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink-60)" }}
              >
                {analysisOutline.translation.slice(0, 2).join("；")}
              </p>
            </div>

            <div
              className="p-3 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                background: "rgba(34,58,94,0.04)",
                border: "1px solid rgba(34,58,94,0.08)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--brand-ink)" }}
              >
                主旨
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink-60)" }}
              >
                {analysisOutline.emotion.slice(0, 2).join("；")}
              </p>
            </div>

            <div
              className="p-3 rounded-lg cursor-pointer transition-all duration-200"
              style={{
                background: "rgba(34,58,94,0.04)",
                border: "1px solid rgba(34,58,94,0.08)",
              }}
            >
              <p
                className="text-sm font-semibold mb-1"
                style={{ color: "var(--brand-ink)" }}
              >
                手法
              </p>
              <p
                className="text-xs leading-relaxed"
                style={{ color: "var(--ink-60)" }}
              >
                {analysisOutline.technique.slice(0, 2).join("；")}
              </p>
            </div>
          </div>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-6">
        <SectionCard
          title="Stage 2 · AI 多维解析"
          subtitle={`深度: ${depth === "lite" ? "轻松" : depth === "standard" ? "标准" : "备考"}`}
        >
          <AnalysisPanel
            analysis={analysis}
            streamText={streamText || ""}
            isLoading={isLoading}
            error={error}
            source={source === "cache" || source === "ai" ? source : null}
            poemTitle={title}
            graphHighlight={title}
          />
        </SectionCard>

        {/* Navigation buttons */}
        <div className="flex items-center gap-4">
          <button
            onClick={onGoBack}
            className="px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200"
            style={{
              background: "rgba(34,58,94,0.06)",
              color: "var(--ink-60)",
            }}
          >
            回到原文
          </button>
          <button
            onClick={onAdvance}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ml-auto"
            style={{
              background: "var(--brand-ink)",
              color: "var(--paper-base)",
            }}
          >
            继续探究
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
