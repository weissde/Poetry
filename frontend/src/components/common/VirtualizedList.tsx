import { useEffect, useMemo, useRef, useState } from "react";

interface VirtualizedListProps<T> {
  items: T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => JSX.Element;
  height?: number;
  estimateHeight?: number;
  overscan?: number;
  className?: string;
}

interface VirtualRow {
  index: number;
  top: number;
}

function findStartIndex(offsets: number[], target: number): number {
  let low = 0;
  let high = offsets.length - 2;
  let answer = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const start = offsets[mid];
    const end = offsets[mid + 1];

    if (target < start) {
      high = mid - 1;
      continue;
    }

    if (target >= end) {
      low = mid + 1;
      answer = Math.min(offsets.length - 2, mid + 1);
      continue;
    }

    return mid;
  }

  return answer;
}

export function VirtualizedList<T>({
  items,
  getKey,
  renderItem,
  height = 760,
  estimateHeight = 240,
  overscan = 3,
  className,
}: VirtualizedListProps<T>): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeObserverMapRef = useRef<Map<number, ResizeObserver>>(new Map());
  const heightMapRef = useRef<Map<number, number>>(new Map());

  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(height);
  const [layoutVersion, setLayoutVersion] = useState<number>(0);

  const getRowHeight = (index: number): number => {
    return heightMapRef.current.get(index) ?? estimateHeight;
  };

  const offsets = useMemo(() => {
    const next = new Array<number>(items.length + 1);
    next[0] = 0;
    for (let i = 0; i < items.length; i += 1) {
      next[i + 1] = next[i] + getRowHeight(i);
    }
    return next;
  }, [items.length, estimateHeight, layoutVersion]);

  const totalHeight = offsets[offsets.length - 1] ?? 0;

  const visibleRows = useMemo(() => {
    if (items.length === 0) {
      return [] as VirtualRow[];
    }

    const start = Math.max(0, findStartIndex(offsets, scrollTop) - overscan);
    const endBound = scrollTop + viewportHeight;
    const rawEnd = findStartIndex(offsets, endBound);
    const end = Math.min(items.length - 1, rawEnd + overscan);

    const rows: VirtualRow[] = [];
    for (let index = start; index <= end; index += 1) {
      rows.push({ index, top: offsets[index] });
    }
    return rows;
  }, [items.length, offsets, overscan, scrollTop, viewportHeight]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      const nextHeight = Math.max(1, Math.floor(entry.contentRect.height));
      setViewportHeight(nextHeight);
    });

    observer.observe(element);
    setViewportHeight(Math.max(1, element.clientHeight));

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const observer of resizeObserverMapRef.current.values()) {
        observer.disconnect();
      }
      resizeObserverMapRef.current.clear();
    };
  }, []);

  const attachMeasureRef = (index: number, node: HTMLDivElement | null): void => {
    const existing = resizeObserverMapRef.current.get(index);
    if (existing) {
      existing.disconnect();
      resizeObserverMapRef.current.delete(index);
    }

    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }

      const nextHeight = Math.max(1, Math.ceil(entry.contentRect.height));
      const prevHeight = heightMapRef.current.get(index);
      if (prevHeight !== nextHeight) {
        heightMapRef.current.set(index, nextHeight);
        setLayoutVersion((value) => value + 1);
      }
    });

    observer.observe(node);
    resizeObserverMapRef.current.set(index, observer);
  };

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height, overflowY: "auto" }}
      onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
    >
      <div style={{ position: "relative", height: totalHeight }}>
        {visibleRows.map(({ index, top }) => {
          const item = items[index];
          return (
            <div key={getKey(item, index)} style={{ position: "absolute", left: 0, right: 0, top }}>
              <div ref={(node) => attachMeasureRef(index, node)}>{renderItem(item, index)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
