import { Outlet } from "react-router-dom";
import { useEffect, type ReactNode } from "react";
import { GlobalTeachingContext } from "@/components/layout/GlobalTeachingContext";
import { Navbar } from "@/components/layout/Navbar";
import { LearnJourneyProgress } from "@/components/common/LearnJourneyProgress";
import { TeachingModePanel } from "@/components/teaching/TeachingModePanel";
import { prefetchAppWarmup } from "@/lib/routePrefetch";

export function AppShell({ children }: { children?: ReactNode }) {
  useEffect(() => {
    const warmup = (): void => prefetchAppWarmup();
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warmup, { timeout: 1800 });
      return () => window.cancelIdleCallback(id);
    }
    const timer = setTimeout(warmup, 900);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="app-unified-theme min-h-screen bg-paper-0 font-sans text-text-primary paper-bg">
      <Navbar />
      <GlobalTeachingContext />
      <main className="app-main">
        <div className="page-container">
          <LearnJourneyProgress className="app-journey-progress" />
          {children ?? <Outlet />}
          <TeachingModePanel />
        </div>
      </main>
    </div>
  );
}
