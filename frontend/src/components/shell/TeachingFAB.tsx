import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { Button } from "@/components/ui/Button";

const TEACHING_STEPS = [
  { num: 1, label: "总览", hint: "查看今日课堂概览，确认教学目标和进度" },
  { num: 2, label: "精讲", hint: "进入诗词精讲，带领学生逐句解析" },
  { num: 3, label: "探究", hint: "引导学生进入探究互动，深度理解诗词" },
  { num: 4, label: "练测", hint: "发布练习或测评，检验学习效果" },
  { num: 5, label: "记忆", hint: "进入记忆环节，巩固知识点" },
  { num: 6, label: "学情", hint: "查看学情报告，分析班级整体表现" },
] as const;

export function TeachingFAB() {
  const { isTeacherMode, currentStep, teachingMode } = useTeachingMode();
  const [open, setOpen] = useState(false);

  if (!isTeacherMode) return null;

  const stepLabel =
    currentStep && typeof currentStep === "number"
      ? `第 ${currentStep} 步`
      : "课堂控制台";

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 rounded-full bg-cinnabar-500 pl-3 pr-4 py-3 text-white shadow-cinnabar hover:bg-cinnabar-600 hover:shadow-cinnabar-hover transition hover:-translate-y-0.5"
      >
        <span className="grid h-6 w-6 place-items-center rounded-full bg-white text-cinnabar-600 text-[11px] font-semibold tabular-nums">
          {currentStep ?? "?"}
        </span>
        <span className="text-[13px] font-medium">{stepLabel}</span>
      </button>

      {/* Side Sheet */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] bg-ink-900/20"
              onClick={() => setOpen(false)}
            />

            {/* Sheet */}
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 z-[70] h-full w-[400px] max-w-[90vw] overflow-y-auto bg-paper-0 shadow-lg border-l border-ink-100"
            >
              <div className="flex items-center justify-between border-b border-ink-100 px-6 py-4">
                <h2 className="font-display text-[17px] font-semibold text-ink-900">
                  课堂控制台
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-500 hover:bg-paper-100 transition"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Teaching Progress */}
                <section>
                  <h3 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-cinnabar-500">
                    教学进度
                  </h3>
                  <ol className="space-y-3">
                    {TEACHING_STEPS.map((s, i) => {
                      const isDone = (currentStep ?? 0) > s.num;
                      const isCurrent = (currentStep ?? 0) === s.num;
                      return (
                        <li key={s.num} className="flex items-start gap-3">
                          <span
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11.5px] font-semibold tabular-nums transition ${
                              isDone
                                ? "bg-teal-500 text-white"
                                : isCurrent
                                  ? "bg-cinnabar-500 text-paper-0 ring-4 ring-cinnabar-100"
                                  : "bg-paper-100 text-ink-300 border border-ink-200"
                            }`}
                          >
                            {isDone ? "✓" : String(s.num).padStart(2, "0")}
                          </span>
                          <div>
                            <div
                              className={`text-[13.5px] font-medium ${
                                isCurrent ? "text-cinnabar-500" : "text-ink-900"
                              }`}
                            >
                              {s.label}
                            </div>
                            <div className="mt-0.5 text-[12px] text-ink-500">
                              {s.hint}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </section>

                {/* Quick Actions */}
                <section>
                  <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                    快捷操作
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm">
                      发布练习
                    </Button>
                    <Button variant="secondary" size="sm">
                      切换演示
                    </Button>
                    <Button variant="secondary" size="sm">
                      班级学情
                    </Button>
                    <Button variant="secondary" size="sm">
                      教学备忘
                    </Button>
                  </div>
                </section>

                {/* Demo Records */}
                <section>
                  <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink-300">
                    演示记录
                  </h3>
                  <div className="rounded-xl border border-ink-100 p-4 text-center">
                    <p className="text-[13px] text-ink-300">暂无演示记录</p>
                    <p className="mt-1 text-[11.5px] text-ink-300">
                      开始教学后，演示记录将在此显示
                    </p>
                  </div>
                </section>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
