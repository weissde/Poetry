import { motion } from "framer-motion";
import type { AnalysisDepth } from "@/types";

interface Stage1Meta {
  stage: "stage1";
  lineCount: number;
}

interface Stage2Meta {
  stage: "stage2";
  depth: AnalysisDepth;
  insightCount: number;
}

interface Stage3Meta {
  stage: "stage3";
  mode: "qa" | "poet";
}

interface Stage4Meta {
  stage: "stage4";
  accuracy: number;
  itemsTested: number;
}

type StageCompleteMeta = Stage1Meta | Stage2Meta | Stage3Meta | Stage4Meta;

const stageLabels: Record<string, string> = {
  stage1: "初读完成",
  stage2: "赏析完成",
  stage3: "探究完成",
  stage4: "记忆完成",
};

function Stage1Summary({ lineCount }: { lineCount: number }) {
  return (
    <p className="text-base text-ink-secondary leading-relaxed">
      全诗共 <span className="font-semibold text-brand-ink">{lineCount}</span>{" "}
      句，已通读原文与译文，初步把握诗意。
    </p>
  );
}

function Stage2Summary({ depth, insightCount }: { depth: AnalysisDepth; insightCount: number }) {
  const depthLabel = depth === "lite" ? "基础" : depth === "standard" ? "标准" : "深度";
  return (
    <p className="text-base text-ink-secondary leading-relaxed">
      以<span className="font-semibold text-brand-ink">「{depthLabel}」</span>
      深度完成多维拆解，提炼{" "}
      <span className="font-semibold text-brand-ink">{insightCount}</span>{" "}
      个关键要点。
    </p>
  );
}

function Stage3Summary({ mode }: { mode: "qa" | "poet" }) {
  const modeLabel = mode === "qa" ? "问答探究" : "诗人对话";
  return (
    <p className="text-base text-ink-secondary leading-relaxed">
      以<span className="font-semibold text-brand-ink">「{modeLabel}」</span>
      模式完成探究，深化了对诗意的理解。
    </p>
  );
}

function Stage4Summary({ accuracy, itemsTested }: { accuracy: number; itemsTested: number }) {
  const pct = Math.round(accuracy * 100);
  const tone = pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-600" : "text-rose-600";
  return (
    <p className="text-base text-ink-secondary leading-relaxed">
      完成{" "}
      <span className="font-semibold text-brand-ink">{itemsTested}</span>{" "}
      项记忆练习，正确率{" "}
      <span className={`font-semibold ${tone}`}>{pct}%</span>。
    </p>
  );
}

export default function StageCompleteCard({
  meta,
  onDismiss,
}: {
  meta: StageCompleteMeta;
  onDismiss: () => void;
}) {
  return (
    <motion.div
      className="absolute inset-0 z-30 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onDismiss}
    >
      <motion.div
        className="bg-white/92 backdrop-blur-md border border-[rgba(200,155,90,0.28)] rounded-2xl px-10 py-9 shadow-[0_18px_48px_rgba(34,58,94,0.09)] max-w-sm w-full text-center"
        initial={{ scale: 0.88, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[rgba(200,155,90,0.12)] mb-5">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[#c89b5a]"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="text-xl font-serif text-brand-ink mb-3">
          {stageLabels[meta.stage]}
        </h3>
        {meta.stage === "stage1" && <Stage1Summary lineCount={meta.lineCount} />}
        {meta.stage === "stage2" && <Stage2Summary depth={meta.depth} insightCount={meta.insightCount} />}
        {meta.stage === "stage3" && <Stage3Summary mode={meta.mode} />}
        {meta.stage === "stage4" && <Stage4Summary accuracy={meta.accuracy} itemsTested={meta.itemsTested} />}
      </motion.div>
    </motion.div>
  );
}
