import { useEffect } from "react";

function readScroll(storageKey: string): number {
  if (typeof window === "undefined") {
    return 0;
  }
  const raw = window.sessionStorage.getItem(storageKey);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function writeScroll(storageKey: string, y: number): void {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(storageKey, String(Math.max(0, Math.floor(y))));
}

export function useScrollRestore(scope: string): void {
  useEffect(() => {
    const storageKey = `poetry-ai:scroll:${scope}`;
    const savedY = readScroll(storageKey);
    if (savedY > 0) {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: savedY, behavior: "auto" });
      });
    }

    let frameId = 0;
    const onScroll = (): void => {
      if (frameId) {
        return;
      }
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        writeScroll(storageKey, window.scrollY || window.pageYOffset || 0);
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      writeScroll(storageKey, window.scrollY || window.pageYOffset || 0);
    };
  }, [scope]);
}

