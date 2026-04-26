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
    label: "璇楄瘝绮捐",
    to: "/learn",
    matchPrefixes: ["/learn"],
    prefetchTargets: ["/learn"],
  },
  {
    label: "鎺㈢┒鍙戠幇",
    to: "/explore",
    matchPrefixes: ["/explore"],
    prefetchTargets: ["/explore"],
  },
  {
    label: "缁冩祴璇勪及",
    to: "/practice",
    matchPrefixes: ["/practice"],
    prefetchTargets: ["/practice"],
  },
  {
    label: "鐭ヨ瘑鍥捐氨",
    to: "/graph",
    matchPrefixes: ["/graph"],
    prefetchTargets: ["/graph"],
  },
  {
    label: "鍒涗綔澶╁湴",
    to: "/create",
    matchPrefixes: ["/create"],
    prefetchTargets: ["/create"],
  },
  {
    label: "鎴戠殑瀛︽儏",
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
            <span className="nav-brand-mark">璇?</span>
            <span className="nav-brand-wordmark">璇楀閫?</span>
          </NavLink>

          <nav className="nav-teaching-list hidden lg:flex" aria-label="涓诲鑸?">
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
            
            {user?.role === 'teacher' && (
              <NavLink
                to="/teacher"
                className={joinClassNames(
                  "nav-teaching-link", 
                  matchesNavItem(location.pathname, { label: "", to: "/teacher", matchPrefixes: ["/teacher"], prefetchTargets: [] }) && "nav-teaching-link-active"
                )}
                style={{ marginLeft: '8px', color: 'var(--warm-primary)' }}
              >
                馃懆鈥嶐煆?鏁欏笀宸ヤ綔鍙?              </NavLink>
            )}
          </nav>
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(isTeacherMode ? "纭畾瑕佸垏鎹㈠埌瀛︾敓妯″紡鍚楋紵" : "纭畾瑕佸紑鍚暀甯堟紨绀烘ā寮忓悧锛?)) {
                toggleTeachingMode();
              }
            }}
            className="relative flex items-center justify-center h-8 px-3 rounded-full text-white text-sm font-medium overflow-hidden"
            title={isTeacherMode ? "鐐瑰嚮鍒囨崲鍥炲鐢熻瑙? : "鐐瑰嚮寮€鍚暀甯堟紨绀鸿瑙?}
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
                  <span>馃懆鈥嶐煆?/span>
                  <span>鏁欏笀妯″紡</span>
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
                  <span>馃懆鈥嶐煄?/span>
                  <span>瀛︾敓妯″紡</span>
                </motion.div>
              )}
            </AnimatePresence>
            {/* 鎾戝紑瀹藉害鐨勯殣钘忓厓绱?*/}
            <div className="opacity-0 flex items-center gap-1.5 pointer-events-none">
              <span>馃懆鈥嶐煆?/span>
              <span>鏁欏笀妯″紡</span>
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
              title={teacherControlPanelOpen ? "鏀惰捣鏁欏娴佺▼涓庡揩鎹峰姩浣? : "灞曞紑鏁欏娴佺▼涓庡揩鎹峰姩浣?}
            >
              {teacherControlPanelOpen ? "鏀惰捣鏁欏闈㈡澘" : "鏁欏笀鎺у埗闈㈡澘"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={toggleReduceMotion}
            className={joinClassNames("nav-motion-button", reduceMotion && "nav-motion-button-active")}
            title={reduceMotion ? "宸插惎鐢ㄥ噺灏戝姩鏁? : "鐐瑰嚮鍑忓皯鍔ㄦ晥"}
          >
            {reduceMotion ? "绠€娲佸姩鏁? : "鍑忓皯鍔ㄦ晥"}
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
              {isLoading ? "閫€鍑轰腑..." : "閫€鍑虹櫥褰?}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                navigate("/login");
              }}
              className="btn-secondary-compact bg-white/92 text-slate-700 hover:bg-white"
            >
              鐧诲綍
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          className="nav-mobile-toggle md:hidden"
          aria-label={mobileMenuOpen ? "鍏抽棴鑿滃崟" : "鎵撳紑鑿滃崟"}
        >
          {mobileMenuOpen ? "脳" : "鈽?}
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
                if (window.confirm(isTeacherMode ? "纭畾瑕佸垏鎹㈠埌瀛︾敓妯″紡鍚楋紵" : "纭畾瑕佸紑鍚暀甯堟紨绀烘ā寮忓悧锛?)) {
                  toggleTeachingMode();
                }
              }}
            >
              <span>{isTeacherMode ? "馃懆鈥嶐煆? : "馃懆鈥嶐煄?}</span>
              <span>{isTeacherMode ? "鍒囨崲鍒板鐢熸ā寮? : "寮€鍚暀甯堟ā寮?}</span>
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
                {teacherControlPanelOpen ? "鏀惰捣鏁欏闈㈡澘" : "鏁欏笀鎺у埗闈㈡澘"}
              </button>
            ) : null}

            <button
              type="button"
              onClick={toggleReduceMotion}
              className={joinClassNames("nav-motion-button", "justify-center", reduceMotion && "nav-motion-button-active")}
            >
              {reduceMotion ? "绠€娲佸姩鏁堝凡寮€鍚? : "寮€鍚噺灏戝姩鏁?}
            </button>

            <nav className="flex flex-col gap-2" aria-label="绉诲姩绔富瀵艰埅">
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
              
              {user?.role === 'teacher' && (
                <NavLink
                  to="/teacher"
                  className={joinClassNames("nav-mobile-link", matchesNavItem(location.pathname, { label: "", to: "/teacher", matchPrefixes: ["/teacher"], prefetchTargets: [] }) && "nav-mobile-link-active")}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{ color: 'var(--warm-primary)' }}
                >
                  <span>馃懆鈥嶐煆?鏁欏笀宸ヤ綔鍙?/span>
                </NavLink>
              )}
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
                {isLoading ? "閫€鍑轰腑..." : "閫€鍑虹櫥褰?}
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
                鐧诲綍
              </button>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}

