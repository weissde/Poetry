import { ArrowRight, Pause, Play, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SectionCard } from "@/components/common/SectionCard";

interface Stage1ContentProps {
  poemLines: string[];
  selectedLineIndex: number;
  onSelectLine: (index: number) => void;
  translationRows: Array<{ source: string; meaning: string }>;
  content: string;
  author: string;
  dynasty: string;
  isSpeaking: boolean;
  speechMessage: string | null;
  onSpeakFull: () => void;
  onSpeakCurrent: () => void;
  onStopSpeech: () => void;
  onAdvance: () => void;
}

export default function Stage1Content({
  poemLines,
  selectedLineIndex,
  onSelectLine,
  translationRows,
  content,
  author,
  dynasty,
  isSpeaking,
  speechMessage,
  onSpeakFull,
  onSpeakCurrent,
  onStopSpeech,
  onAdvance,
}: Stage1ContentProps) {
  const currentTranslationRow = translationRows[selectedLineIndex] ?? translationRows[0];

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-8">
      {/* LEFT COLUMN */}
      <div className="space-y-6">
        <SectionCard title="Stage 1 · 初见" subtitle="品读原诗，初探文意">
          {/* Poem lines */}
          <div className="space-y-3">
            {poemLines.map((line, idx) => (
              <button
                key={idx}
                onClick={() => onSelectLine(idx)}
                className="w-full text-left px-4 py-3 rounded-lg transition-all duration-200 font-display text-[1.65rem] tracking-[0.08em]"
                style={{
                  background:
                    selectedLineIndex === idx
                      ? "linear-gradient(135deg, rgba(200,155,90,0.12), rgba(200,155,90,0.04))"
                      : "transparent",
                  boxShadow:
                    selectedLineIndex === idx
                      ? "inset 0 0 0 1px var(--accent-gold)"
                      : "none",
                  color:
                    selectedLineIndex === idx
                      ? "var(--brand-ink)"
                      : "var(--ink-60)",
                }}
              >
                {line}
              </button>
            ))}
          </div>

          {/* Translation panel */}
          {currentTranslationRow && (
            <div
              className="mt-6 p-5 rounded-xl"
              style={{
                background: "rgba(200,155,90,0.08)",
                border: "1px solid rgba(200,155,90,0.18)",
              }}
            >
              <p
                className="text-sm font-medium mb-2"
                style={{ color: "var(--accent-gold)" }}
              >
                {currentTranslationRow.source}
              </p>
              <p
                className="text-base leading-relaxed"
                style={{ color: "var(--ink-80)" }}
              >
                {currentTranslationRow.meaning}
              </p>
            </div>
          )}

          {/* TTS Controls */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-ink-10">
            <button
              onClick={isSpeaking ? onStopSpeech : onSpeakFull}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: "var(--brand-ink)",
                color: "var(--paper-base)",
              }}
            >
              {isSpeaking ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {isSpeaking ? "停止" : "播放全文"}
            </button>
            <button
              onClick={onSpeakCurrent}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
              style={{
                background: "rgba(200,155,90,0.12)",
                color: "var(--accent-gold)",
              }}
            >
              <Volume2 className="w-4 h-4" />
              朗读当前句
            </button>
            {speechMessage && (
              <span
                className="text-xs ml-2"
                style={{ color: "var(--ink-50)" }}
              >
                {speechMessage}
              </span>
            )}
          </div>
        </SectionCard>
      </div>

      {/* RIGHT COLUMN */}
      <div className="space-y-6">
        <SectionCard title="背景导入">
          <div
            className="p-4 rounded-xl mb-4"
            style={{
              background: "rgba(34,58,94,0.04)",
              border: "1px solid rgba(34,58,94,0.08)",
            }}
          >
            <p
              className="text-sm font-medium"
              style={{ color: "var(--ink-60)" }}
            >
              {dynasty} · {author}
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--ink-40)" }}
            >
              {content.slice(0, 50)}...
            </p>
          </div>
          <ul className="space-y-2">
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--ink-70)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "var(--accent-gold)" }}
              />
              了解诗人背景与创作年代
            </li>
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--ink-70)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "var(--accent-gold)" }}
              />
              通读全诗，感知节奏韵律
            </li>
            <li
              className="flex items-center gap-2 text-sm"
              style={{ color: "var(--ink-70)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full inline-block"
                style={{ background: "var(--accent-gold)" }}
              />
              借助翻译，理解诗句大意
            </li>
          </ul>
        </SectionCard>

        <SectionCard title="下一步">
          <button
            onClick={onAdvance}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 rounded-xl text-base font-semibold transition-all duration-200"
            style={{
              background: "var(--brand-ink)",
              color: "var(--paper-base)",
            }}
          >
            <ArrowRight className="w-5 h-5" />
            开始解析
          </button>
          <Link
            to="/explore"
            className="block text-center mt-3 text-sm transition-colors duration-200 hover:underline"
            style={{ color: "var(--ink-50)" }}
          >
            去探索换一首
          </Link>
        </SectionCard>
      </div>
    </div>
  );
}
