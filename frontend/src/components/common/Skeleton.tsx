import { type CSSProperties } from "react";

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({
  width = "100%",
  height = "1rem",
  borderRadius = "8px",
  className = "",
  style,
}: SkeletonProps): JSX.Element {
  return (
    <div
      className={`animate-pulse bg-[var(--ink-100)] ${className}`}
      style={{
        width,
        height,
        borderRadius,
        ...style,
      }}
      aria-hidden="true"
    />
  );
}

export function SkeletonText({
  lines = 3,
  gap = "0.75rem",
  className = "",
}: {
  lines?: number;
  gap?: string;
  className?: string;
}): JSX.Element {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap }} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          width={i === lines - 1 ? "60%" : "100%"}
          height="0.875rem"
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  className = "",
}: {
  className?: string;
}): JSX.Element {
  return (
    <div
      className={`rounded-2xl bg-white p-5 shadow-[0_4px_18px_rgba(26,43,76,0.04)] ${className}`}
      aria-hidden="true"
    >
      <Skeleton width="40%" height="0.75rem" />
      <div style={{ marginTop: "1rem" }}>
        <Skeleton height="1.25rem" />
      </div>
      <div style={{ marginTop: "0.75rem" }}>
        <SkeletonText lines={2} />
      </div>
    </div>
  );
}
