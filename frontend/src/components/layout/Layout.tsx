import { Outlet } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { TeachingModePanel } from "@/components/teaching/TeachingModePanel";
import { TeachingStepBarGlobal } from "@/components/teaching/TeachingStepBar";
import { GlobalTeachingContext } from "@/components/layout/GlobalTeachingContext";

export function Layout(): JSX.Element {
  return (
    <div className="paper-bg min-h-screen font-body text-ink-900">
      <Navbar />
      <GlobalTeachingContext />
      <TeachingStepBarGlobal />
      <main className="app-main">
        <div className="page-container">
          <Outlet />
          <TeachingModePanel />
        </div>
      </main>
    </div>
  );
}
