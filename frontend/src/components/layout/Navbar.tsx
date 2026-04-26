import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";
import { useTeachingMode } from "@/contexts/useTeachingMode";
import { clearApiAuthCache, apiGet } from "@/lib/api";
import { prefetchRoute } from "@/lib/routePrefetch";
import { useAuthStore } from "@/stores/authStore";
import { useTeachingStore } from "@/stores/teachingStore";

import { AnimatePresence, motion } from "framer-motion";

interface NavPendingSummaryResponse {
  planPending: number;
  wrongbookPending: number;
  pendingTaskCount: number;
}

interface JourneyNavItem {
  label: string;
  to: string;
  matchPrefixes: string[];
  prefetchTargets: string[];
  showPendingBadge?: boolean;
}

const journeyNavItems: readonly JourneyNavItem[] = [
  {
    label: "诗词精讲",
    to: "/learn",
    matchPrefixes: ["/learn"],
    prefetchTargets: ["/learn"],
  },
  {
    label: "探究互动",
    to: "/explore",
    matchPrefixes: ["/explore"],
    prefetchTargets: ["/explore"],
  },
  {
    label: "练测评估",
    to: "/practice",
    matchPrefixes: ["/practice"],
    prefetchTargets: ["/practice"],
  },
  {
    label: "知识图谱",
    to: "/graph",
    matchPrefixes: ["/graph"],
    prefetchTargets: ["/graph"],
  },
  {
    label: "创作坊",
    to: "/create",
    matchPrefixes: ["/create"],
    prefetchTargets: ["/create"],
  },
  {
    label: "我的学情",
    to: "/my-learning",
    matchPrefixes: ["/my-learning"],
    prefetchTargets: ["/my-learning"],
    showPendingBadge: true,
  },
];

function matchesNavItem(pathname: string, item: JourneyNavItem): boolean {
  return item.matchPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function joinClassNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function prefetchTargets(targets: readonly string[]): void {
  targets.forEach((target) => prefetchRoute(target));
}

export function Navbar(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, isLoading, initialized, initialize } = useAuthStore();
  const { isTeacherMode, toggleTeachingMode } = useTeachingMode();
  const teacherControlPanelOpen = useTeachingStore((state) => state.teacherControlPanelOpen);
  const toggleTeacherControlPanel = useTeachingStore((state) => state.toggleTeacherControlPanel);
  const { reduceMotion, toggleReduceMotion } = useMotionPreference();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pendingTaskCount, setPendingTaskCount] = useState(0);

  useEffect(() => {
    if (!initialized) {
      void initialize();
    }
  }, [initialized, initialize]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setPendingTaskCount(0);
      return;
    }

    let disposed = false;

    const loadPendingTaskCount = async (): Promise<void> => {
      try {
        const data = await apiGet<NavPendingSummaryResponse>("/nav/pending-summary", {
          cacheTtlMs: 20000,
        });

        if (!disposed) {
          setPendingTaskCount(Math.max(0, Number(data.pendingTaskCount || 0)));
        }
      } catch {
        if (!disposed) {
          setPendingTaskCount(0);
        }
      }
    };

    void loadPendingTaskCount();

    const onFocus = (): void => {
      void loadPendingTaskCount();
    };

    window.addEventListener("focus", onFocus);
    return () => {
      disposed = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [user]);

  const handleSignOut = async (): Promise<void> => {
    await signOut();
    clearApiAuthCache();
    setMobileMenuOpen(false);
    navigate("/login", { replace: true });
  };

  return (
    <header className={joinClassNames("app-navbar-shell", isTeacherMode && "border-b-[3px] border-[#C98C45]")}>
      <div className="app-navbar-inner">
        <div className="flex min-w-0 items-center gap-4 lg:gap-6">
          <NavLink to="/" className="nav-brand" onMouseEnter={() => prefetchRoute("/")}>
            <span className="nav-brand-mark">诗</span>
            <span className="nav-brand-wordmark">诗境通</span>
          </NavLink>

          <nav className="nav-teaching-list hidden lg:flex" aria-label="主导航">
            {journeyNavItems.map((item) => {
              const active = matchesNavItem(location.pathname, item);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  aria-current={active ? "page" : undefined}
                  className={joinClassNames("nav-teaching-link", active && "nav-teaching-link-active")}
                  onMouseEnter={() => prefetchTargets(item.prefetchTargets)}
                  onFocus={() => prefetchTargets(item.prefetchTargets)}
                  onTouchStart={() => prefetchTargets(item.prefetchTargets)}
                >
                  <span>{item.label}</span>
                  {item.showPendingBadge && pendingTaskCount > 0 ? (
                    <span className="nav-pending-badge">{pendingTaskCount > 99 ? "99+" : pendingTaskCount}</span>
                  ) : null}
                </NavLink>
              );
            })}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(isTeacherMode ? "确定要切换到学生模式吗？" : "确定要开启教师演示模式吗？")) {
                toggleTeachingMode();
              }
            }}
            className="relative flex items-center justify-center h-8 px-3 rounded-full text-white text-sm font-medium overflow-hidden"
            title={isTeacherMode ? "点击切换回学生视角" : "点击开启教师演示视角"}
          >
            <AnimatePresence mode="wait">
              {isTeacherMode ? (
                <motion.div
                  key="teacher"
                  layoutId="modeBadgeBg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: 'var(--warm-700)' }}
                >
                  <span>👨‍🏫</span>
                  <span>教师模式</span>
                </motion.div>
              ) : (
                <motion.div
                  key="student"
                  layoutId="modeBadgeBg"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="absolute inset-0 flex items-center justify-center gap-1.5"
                  style={{ backgroundColor: 'var(--ink-500)' }}
                >
                  <span>👨‍🎓</span>
                  <span>学生模式</span>
                </motion.div>
              )}
            </AnimatePresence>
            {/* 撑开宽度的隐藏元素 */}
            <div className="opacity-0 flex items-center gap-1.5 pointer-events-none">
              <span>👨‍🏫</span>
              <span>教师模式</span>
            </div>
          </button>

          {isTeacherMode ? (
            <button
              type="button"
              onClick={() => toggleTeacherControlPanel()}
              className={joinClassNames(
                "btn-secondary-compact bg-white/92 text-slate-700 hover:bg-white",
                teacherControlPanelOpen && "border-[#C98C45] bg-amber-50/95 text-[#5A3D18]",
              )}
              title={teacherControlPanelOpen ? "收起教学流程与快捷动作" : "展开教学流程与快捷动作"}
            >
              {teacherControlPanelOpen ? "收起教学面板" : "教师控制面板"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleReduceMotion}
            className={joinClassNames("nav-motion-button", reduceMotion && "nav-motion-button-active")}
            title={reduceMotion ? "已启用减少动效" : "点击减少动效"}
          >
            {reduceMotion ? "简洁动效" : "减少动效"}
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => {
                void handleSignOut();
              }}
              disabled={isLoading}
              className="btn-secondary-compact bg-white/92 text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "退出中..." : "退出登录"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                navigate("/login");
              }}
              className="btn-secondary-compact bg-white/92 text-slate-700 hover:bg-white"
            >
              登录
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="nav-mobile-toggle md:hidden"
          aria-label={mobileMenuOpen ? "关闭菜单" : "打开菜单"}
        >
          {mobileMenuOpen ? "×" : "☰"}
        </button>
      </div>

      {mobileMenuOpen ? (
        <div className="nav-mobile-panel md:hidden">
          <div className="nav-mobile-content">
            <button
              type="button"
              className="flex items-center justify-center gap-2 h-10 px-4 rounded-full text-white text-sm font-medium w-full"
              style={{ backgroundColor: isTeacherMode ? 'var(--warm-700)' : 'var(--ink-500)' }}
              onClick={() => {
                if (window.confirm(isTeacherMode ? "确定要切换到学生模式吗？" : "确定要开启教师演示模式吗？")) {
                  toggleTeachingMode();
                }
              }}
            >
              <span>{isTeacherMode ? "👨‍🏫" : "👨‍🎓"}</span>
              <span>{isTeacherMode ? "切换到学生模式" : "开启教师模式"}</span>
            </button>

            {isTeacherMode ? (
              <button
                type="button"
                onClick={() => toggleTeacherControlPanel()}
                className={joinClassNames(
                  "btn-secondary-compact justify-center bg-white/92 text-slate-700 hover:bg-white",
                  teacherControlPanelOpen && "border-[#C98C45] bg-amber-50/95 text-[#5A3D18]",
                )}
              >
                {teacherControlPanelOpen ? "收起教学面板" : "教师控制面板"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggleReduceMotion}
              className={joinClassNames("nav-motion-button", "justify-center", reduceMotion && "nav-motion-button-active")}
            >
              {reduceMotion ? "简洁动效已开启" : "开启减少动效"}
            </button>

            <nav className="flex flex-col gap-2" aria-label="移动端主导航">
              {journeyNavItems.map((item) => {
                const active = matchesNavItem(location.pathname, item);
                return (
                  <NavLink
                    key={`mobile-${item.to}`}
                    to={item.to}
                    className={joinClassNames("nav-mobile-link", active && "nav-mobile-link-active")}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <span>{item.label}</span>
                    {item.showPendingBadge && pendingTaskCount > 0 ? (
                      <span className="nav-pending-badge">{pendingTaskCount > 99 ? "99+" : pendingTaskCount}</span>
                    ) : null}
                  </NavLink>
                );
              })}
            </nav>

            {user ? (
              <button
                type="button"
                onClick={() => {
                  void handleSignOut();
                }}
                disabled={isLoading}
                className="btn-secondary-compact justify-start bg-white/92 text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "退出中..." : "退出登录"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate("/login");
                }}
                className="btn-secondary-compact justify-start bg-white/92 text-slate-700 hover:bg-white"
              >
                登录
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
