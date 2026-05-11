import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ChevronDown, LogIn, LogOut, MoonStar, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";

function getDisplayName(user: User | null): string {
  if (!user) {
    return "访客";
  }
  const metadata = user.user_metadata as Record<string, unknown> | undefined;
  const candidates = [metadata?.display_name, metadata?.full_name, metadata?.name, user.email?.split("@")[0]];
  const match = candidates.find((item) => String(item || "").trim().length > 0);
  return String(match || "同学").trim();
}

function getAvatarText(name: string): string {
  const cleaned = String(name || "").trim().replace(/\s+/g, "");
  if (!cleaned) {
    return "访";
  }
  return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
}

interface UserMenuProps {
  user: User | null;
  isLoading: boolean;
  onLogin: () => void;
  onSignOut: () => void;
}

export function UserMenu({ user, isLoading, onLogin, onSignOut }: UserMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const { reduceMotion, toggleReduceMotion } = useMotionPreference();

  const displayName = useMemo(() => getDisplayName(user), [user]);
  const avatarText = useMemo(() => getAvatarText(displayName), [displayName]);
  const emailText = user?.email || "登录后同步学习进度";

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent): void => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  const triggerLabel = user ? displayName : "登录";

  return (
    <div ref={rootRef} className="nav-user-menu">
      <button
        type="button"
        className="nav-user-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className="nav-user-avatar">{avatarText}</span>
        <span className="nav-user-trigger-copy">
          <span className="nav-user-name">{triggerLabel}</span>
          <span className="nav-user-meta">{user ? "学习账户" : "未登录"}</span>
        </span>
        <ChevronDown className={`nav-user-chevron ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.14 }}
            className="nav-user-dropdown"
            role="menu"
          >
            <div className="nav-user-panel">
              <div className="nav-user-panel-head">
                <span className="nav-user-avatar nav-user-avatar-large">{avatarText}</span>
                <div className="min-w-0">
                  <p className="nav-user-panel-title">{displayName}</p>
                  <p className="nav-user-panel-subtitle">{emailText}</p>
                </div>
              </div>

              <div className="nav-user-preference">
                <div className="nav-user-preference-icon">
                  {reduceMotion ? <MoonStar className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                </div>
                <div className="min-w-0">
                  <p className="nav-user-preference-title">动效偏好</p>
                  <p className="nav-user-preference-text">
                    {reduceMotion ? "当前为简洁动效" : "当前为完整动效"}
                  </p>
                </div>
                <button
                  type="button"
                  className={`nav-user-switch ${reduceMotion ? "nav-user-switch-on" : ""}`}
                  onClick={toggleReduceMotion}
                  aria-pressed={reduceMotion}
                  role="menuitem"
                >
                  <span />
                </button>
              </div>

              <div className="nav-user-actions">
                {user ? (
                  <button
                    type="button"
                    disabled={isLoading}
                    className="nav-user-action nav-user-action-danger"
                    onClick={() => {
                      setOpen(false);
                      onSignOut();
                    }}
                    role="menuitem"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>{isLoading ? "退出中..." : "退出登录"}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="nav-user-action"
                    onClick={() => {
                      setOpen(false);
                      onLogin();
                    }}
                    role="menuitem"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>前往登录</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
