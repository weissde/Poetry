import { useEffect, useRef, useState } from "react";

interface UseCountUpOptions {
  enabled?: boolean;
  durationMs?: number;
}

function easeOutCubic(progress: number): number {
  return 1 - Math.pow(1 - progress, 3);
}

export function useCountUp(target: number, options: UseCountUpOptions = {}): number {
  const { enabled = true, durationMs = 880 } = options;
  const [value, setValue] = useState<number>(enabled ? 0 : target);
  const previousTargetRef = useRef<number>(0);

  useEffect(() => {
    if (!Number.isFinite(target)) {
      previousTargetRef.current = target;
      setValue(target);
      return;
    }

    if (!enabled || durationMs <= 0) {
      previousTargetRef.current = target;
      setValue(target);
      return;
    }

    const from = previousTargetRef.current;
    const to = target;
    previousTargetRef.current = target;

    if (!Number.isFinite(from) || from === to) {
      setValue(to);
      return;
    }

    let frameId = 0;
    const startedAt = performance.now();

    const animate = (timestamp: number): void => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = easeOutCubic(progress);
      setValue(from + (to - from) * eased);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animate);
      }
    };

    frameId = window.requestAnimationFrame(animate);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [durationMs, enabled, target]);

  return value;
}
