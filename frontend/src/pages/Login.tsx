import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

type AuthMode = "login" | "register";

export default function LoginPage(): JSX.Element {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [sessionExpiredTip, setSessionExpiredTip] = useState<string>("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signInWithPassword, signUpWithPassword, isLoading, error, notice, clearError, clearNotice } = useAuthStore();

  const title = useMemo(() => (mode === "login" ? "登录诗境通" : "注册诗境通"), [mode]);
  const safeReturnTo = useMemo(() => {
    const queryReturnTo = (searchParams.get("returnTo") || "").trim();
    if (queryReturnTo.startsWith("/") && !queryReturnTo.startsWith("//")) {
      return queryReturnTo;
    }
    if (typeof window !== "undefined") {
      const fallback = (window.sessionStorage.getItem("poetry_ai_return_to") || "").trim();
      if (fallback.startsWith("/") && !fallback.startsWith("//")) {
        return fallback;
      }
    }
    return "/";
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const flag = window.sessionStorage.getItem("poetry_ai_auth_expired");
    if (flag === "1") {
      setSessionExpiredTip("登录已过期，请重新登录。");
      window.sessionStorage.removeItem("poetry_ai_auth_expired");
    }
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    clearError();
    clearNotice();

    if (mode === "login") {
      await signInWithPassword(email.trim(), password);
      if (!useAuthStore.getState().error && useAuthStore.getState().user) {
        if (typeof window !== "undefined") {
          window.sessionStorage.removeItem("poetry_ai_return_to");
        }
        navigate(safeReturnTo, { replace: true });
      }
      return;
    }

    await signUpWithPassword(email.trim(), password);
    if (!useAuthStore.getState().error) {
      setMode("login");
    }
  };

  return (
    <div className="paper-bg min-h-screen">
      <div className="page-container py-8 sm:py-10 lg:py-14">
        <div className="grid grid-cols-1 gap-6 lg:min-h-[calc(100vh-9rem)] lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <section className="hero-panel hidden flow-md lg:block">
            <p className="surface-chip w-fit text-xs">诗境通 Poetry AI</p>
            <h1 className="font-display text-5xl leading-tight text-ink-700">
              让古诗词学习
              <br />
              更系统、更高级
            </h1>
            <p className="max-w-[520px] text-base leading-8 text-slate-600">
              解析、练习、记忆、考试、创作、图谱全链路联动。登录后即可进入你的个人学习空间。
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="metric-card">
                <p className="metric-label">学习闭环</p>
                <p className="mt-1 text-sm font-medium text-ink-700">探索 → 解析 → 练习 → 复盘</p>
              </div>
              <div className="metric-card">
                <p className="metric-label">智能能力</p>
                <p className="mt-1 text-sm font-medium text-ink-700">AI 点评 + 弱点诊断</p>
              </div>
            </div>
          </section>

          <section className="surface-card card-roomy mx-auto w-full max-w-[560px] lg:max-w-none">
            <h2 className="font-display text-3xl text-ink-700">{title}</h2>
            <p className="mt-2 text-sm text-slate-500">使用邮箱和密码访问你的学习空间。</p>

            <div className="segmented-tabs mt-6 grid grid-cols-2 gap-1.5">
              <button
                type="button"
                className={["segmented-tab w-full py-2 text-sm", mode === "login" ? "segmented-tab-active" : ""].join(" ")}
                onClick={() => {
                  setMode("login");
                  clearError();
                  clearNotice();
                }}
              >
                登录
              </button>
              <button
                type="button"
                className={["segmented-tab w-full py-2 text-sm", mode === "register" ? "segmented-tab-active" : ""].join(" ")}
                onClick={() => {
                  setMode("register");
                  clearError();
                  clearNotice();
                }}
              >
                注册
              </button>
            </div>

            <form className="mt-5 flow-md" onSubmit={handleSubmit}>
              {sessionExpiredTip ? <p className="status-banner status-banner-warning">{sessionExpiredTip}</p> : null}

              {notice ? <p className="status-banner status-banner-success">{notice}</p> : null}

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-700">邮箱</span>
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="input-main w-full"
                  placeholder="you@example.com"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm text-slate-700">密码</span>
                <input
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="input-main w-full"
                  placeholder="请输入至少 6 位密码"
                />
              </label>

              {error ? <p className="status-banner status-banner-error">{error}</p> : null}

              <button
                type="submit"
                disabled={isLoading}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "处理中..." : mode === "login" ? "立即登录" : "立即注册"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

