import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { WorkspaceLayout } from "@/components/common/WorkspaceLayout";
import { SectionCard } from "@/components/common/SectionCard";
import { VirtualizedList } from "@/components/common/VirtualizedList";
import { apiGet, apiPost } from "@/lib/api";
import type { ExamHistoryItem, ExamResult, ExamSession, PaginationMeta } from "@/types";

type ExamMode = "zhongkao" | "gaokao" | "custom";
type AnswerValue = number | string | null;

interface ExamCreateResponse {
  session: ExamSession;
}

interface ExamSubmitResponse {
  result: ExamResult;
}

interface ExamHistoryResponse {
  items: ExamHistoryItem[];
  pagination?: PaginationMeta;
}

const modeOptions: Array<{ value: ExamMode; label: string; topic: string; count: number; durationMinutes: number }> = [
  { value: "zhongkao", label: "中考模拟", topic: "古诗词基础巩固", count: 8, durationMinutes: 60 },
  { value: "gaokao", label: "高考模拟", topic: "古诗鉴赏综合", count: 10, durationMinutes: 90 },
  { value: "custom", label: "自定义", topic: "古诗词综合练测", count: 8, durationMinutes: 60 },
];

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function isSubjectiveQuestion(question: ExamSession["questions"][number]): boolean {
  return question.questionKind === "subjective" || !Array.isArray(question.options) || question.options.length < 2;
}

function errorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.trim() || fallback;
}

export function ExamWorkspace(): JSX.Element {
  const [mode, setMode] = useState<ExamMode>("zhongkao");
  const [topic, setTopic] = useState("古诗词基础巩固");
  const [count, setCount] = useState(8);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<AnswerValue[]>([]);
  const [result, setResult] = useState<ExamResult | null>(null);
  const [history, setHistory] = useState<ExamHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [loading, setLoading] = useState<"create" | "submit" | "history" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedMode = useMemo(() => modeOptions.find((item) => item.value === mode) || modeOptions[0], [mode]);
  const selectedHistory = useMemo(
    () => history.find((item) => item.id === selectedHistoryId) || history[0] || null,
    [history, selectedHistoryId],
  );
  const answeredCount = useMemo(() => answers.filter((answer) => answer !== null && String(answer).trim().length > 0).length, [answers]);

  useEffect(() => {
    setTopic(selectedMode.topic);
    setCount(selectedMode.count);
    setDurationMinutes(selectedMode.durationMinutes);
  }, [selectedMode]);

  async function loadHistory(force = false): Promise<void> {
    setLoading("history");
    setError(null);
    try {
      const data = await apiGet<ExamHistoryResponse>("/exam/history?includeDetail=1&page=1&pageSize=12", { force, cacheTtlMs: 120000 });
      const items = data.items || [];
      setHistory(items);
      setSelectedHistoryId((current) => (current && items.some((item) => item.id === current) ? current : items[0]?.id || null));
    } catch (err) {
      setError(errorMessage(err, "读取考试历史失败"));
    } finally {
      setLoading(null);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function createExam(): Promise<void> {
    setLoading("create");
    setError(null);
    setResult(null);
    try {
      const data = await apiPost<ExamCreateResponse>(
        "/exam/create",
        { mode, topic, count, durationMinutes, subjectiveRatio: mode === "gaokao" ? 0.4 : 0.25 },
        { timeoutMs: 35000 },
      );
      setSession(data.session);
      setAnswers(Array.from({ length: data.session.questions.length }, () => null));
    } catch (err) {
      setError(errorMessage(err, "创建考试失败"));
    } finally {
      setLoading(null);
    }
  }

  async function submitExam(): Promise<void> {
    if (!session) {
      return;
    }
    setLoading("submit");
    setError(null);
    try {
      const data = await apiPost<ExamSubmitResponse>(
        "/exam/submit",
        { mode: session.mode, topic: session.topic, questions: session.questions, answers },
        { timeoutMs: 35000 },
      );
      setResult(data.result);
      await loadHistory(true);
    } catch (err) {
      setError(errorMessage(err, "提交阅卷失败"));
    } finally {
      setLoading(null);
    }
  }

  function updateAnswer(index: number, value: AnswerValue): void {
    setAnswers((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  }

  const setupPanel = (
    <SectionCard title="考试设置" subtitle="选择模式后生成一套模拟卷。">
      <div className="flow-sm">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">模式</span>
          <select value={mode} onChange={(event) => setMode(event.target.value as ExamMode)} className="input-main">
            {modeOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">主题</span>
          <input value={topic} onChange={(event) => setTopic(event.target.value)} className="input-main" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">题量</span>
            <input type="number" min={3} max={20} value={count} onChange={(event) => setCount(Number(event.target.value))} className="input-main" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">时长</span>
            <input
              type="number"
              min={20}
              max={150}
              value={durationMinutes}
              onChange={(event) => setDurationMinutes(Number(event.target.value))}
              className="input-main"
            />
          </label>
        </div>
        <button type="button" onClick={createExam} disabled={loading === "create"} className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60">
          {loading === "create" ? "组卷中..." : "生成试卷"}
        </button>
      </div>
    </SectionCard>
  );

  return (
    <WorkspaceLayout
      aside={setupPanel}
      colsClassName="xl:grid-cols-[360px_minmax(0,1fr)]"
      mainClassName="flow-md"
    >
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}

      {session ? (
        <SectionCard title="本次模拟卷" subtitle={`${session.topic} · 已答 ${answeredCount}/${session.questions.length}`}>
          <div className="flow-md">
            {session.questions.map((question, index) => {
              const subjective = isSubjectiveQuestion(question);
              const options = question.options || [];
              return (
                <article key={`${question.content}-${index}`} className="rounded-lg bg-white p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
                  <p className="text-xs text-slate-500">
                    第 {index + 1} 题 · {subjective ? "主观题" : "客观题"}
                  </p>
                  <p className="mt-2 text-sm leading-7 text-slate-800">{question.content}</p>
                  {subjective ? (
                    <textarea
                      rows={4}
                      value={typeof answers[index] === "string" ? String(answers[index]) : ""}
                      onChange={(event) => updateAnswer(index, event.target.value)}
                      className="mt-3 w-full rounded-lg px-3 py-2 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.28)] outline-none focus:ring-1 focus:ring-ink-700"
                      placeholder="写下观点、依据和分析。"
                    />
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                      {options.map((option, optionIndex) => (
                        <button
                          key={`${option}-${optionIndex}`}
                          type="button"
                          onClick={() => updateAnswer(index, optionIndex)}
                          className={[
                            "rounded-lg px-3 py-2 text-left text-sm transition",
                            answers[index] === optionIndex ? "bg-ink-700 text-white" : "bg-slate-50 text-slate-700 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          {String.fromCharCode(65 + optionIndex)}. {option}
                        </button>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
            <button type="button" onClick={submitExam} disabled={loading === "submit"} className="btn-primary disabled:cursor-not-allowed disabled:opacity-60">
              {loading === "submit" ? "阅卷中..." : "交卷并评分"}
            </button>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="考试中心" subtitle="左侧生成试卷后开始作答。">
          <p className="text-sm text-slate-500">支持中考、高考和自定义主题，提交后自动生成成绩与薄弱项。</p>
        </SectionCard>
      )}

      {result ? (
        <SectionCard title="成绩诊断" subtitle={`得分 ${result.score}/${result.maxScore} · 正确率 ${result.percent}%`}>
          <div className="flow-sm">
            <p className="rounded-lg bg-warm-50 p-3 text-sm text-slate-700">{result.feedback}</p>
            {result.diagnostics?.weakest?.length ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {result.diagnostics.weakest.slice(0, 4).map((item) => (
                  <article key={`${item.dimension}-${item.key}`} className="rounded-lg bg-white p-3 text-sm shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
                    <p className="font-medium text-slate-700">{item.label}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      错误 {item.wrong}/{item.attempts} · 正确率 {Math.round(item.rate * 100)}%
                    </p>
                    <Link to={`/my-learning?tab=wrongbook&type=${encodeURIComponent(item.key)}`} className="mt-2 inline-block text-xs text-ink-700 hover:text-ink-900">
                      去错题本复盘
                    </Link>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="历史成绩" subtitle="最近 12 次模拟考试记录。">
        {loading === "history" ? <p className="text-sm text-slate-500">读取中...</p> : null}
        {!history.length && loading !== "history" ? <p className="text-sm text-slate-500">暂无历史成绩。</p> : null}
        {history.length ? (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <VirtualizedList
              items={history}
              getKey={(item) => item.id}
              height={360}
              estimateHeight={86}
              renderItem={(item) => (
                <button
                  type="button"
                  onClick={() => setSelectedHistoryId(item.id)}
                  className={[
                    "mb-2 w-full rounded-lg p-3 text-left text-sm transition",
                    selectedHistory?.id === item.id ? "bg-ink-50 shadow-[inset_0_0_0_1px_rgba(26,43,76,0.44)]" : "bg-white shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]",
                  ].join(" ")}
                >
                  <span className="block text-xs text-slate-500">{formatDateTime(item.createdAt)}</span>
                  <span className="mt-1 block text-slate-700">
                    {item.examType} · {item.score}/{item.maxScore} · {item.percent}%
                  </span>
                </button>
              )}
            />
            <article className="rounded-lg bg-white p-4 shadow-[inset_0_0_0_1px_rgba(148,163,184,0.22)]">
              {selectedHistory ? (
                <div className="flow-sm">
                  <p className="text-sm text-slate-700">
                    {selectedHistory.examType} · {formatDateTime(selectedHistory.createdAt)}
                  </p>
                  <p className="font-display text-3xl text-ink-700">{selectedHistory.percent}%</p>
                  {(selectedHistory.diagnostics?.weakest || []).slice(0, 5).map((item) => (
                    <p key={`${selectedHistory.id}-${item.dimension}-${item.key}`} className="rounded bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      {item.label}: 错误 {item.wrong}/{item.attempts}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">选择一场历史考试查看诊断。</p>
              )}
            </article>
          </div>
        ) : null}
      </SectionCard>
    </WorkspaceLayout>
  );
}
