import { useCallback, useEffect, useState } from "react";

const DEMO_MODE_STORAGE_KEY = "poetry_ai_demo_mode";
const DEMO_MODE_CLASS = "demo-mode";

export function useDemoMode() {
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Sync to body class
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (isDemoMode) {
      document.body.classList.add(DEMO_MODE_CLASS);
    } else {
      document.body.classList.remove(DEMO_MODE_CLASS);
    }
    return () => {
      document.body.classList.remove(DEMO_MODE_CLASS);
    };
  }, [isDemoMode]);

  // Keyboard shortcut: Ctrl+Shift+D
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setIsDemoMode((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Listen for fullscreen exit (Esc or user action)
  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && isDemoMode) {
        setIsDemoMode(false);
      }
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isDemoMode]);

  const enterDemoMode = useCallback(async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Fullscreen may be denied — still apply visual changes
    }
    setIsDemoMode(true);
    try {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "1");
    } catch { /* ignore */ }
  }, []);

  const exitDemoMode = useCallback(async () => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch { /* ignore */ }
    setIsDemoMode(false);
    try {
      window.localStorage.setItem(DEMO_MODE_STORAGE_KEY, "0");
    } catch { /* ignore */ }
  }, []);

  const toggleDemoMode = useCallback(async () => {
    if (isDemoMode) {
      await exitDemoMode();
    } else {
      await enterDemoMode();
    }
  }, [isDemoMode, enterDemoMode, exitDemoMode]);

  return {
    isDemoMode,
    enterDemoMode,
    exitDemoMode,
    toggleDemoMode,
  };
}
