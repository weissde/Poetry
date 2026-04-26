import { useMemo } from "react";
import { useMotionPreference } from "@/contexts/MotionPreferenceContext";
import { useCountUp } from "@/hooks/useCountUp";

interface AnimatedMetricValueProps {
  value: string;
  className?: string;
  durationMs?: number;
}

interface ParsedMetricValue {
  prefix: string;
  suffix: string;
  numericValue: number | null;
  decimals: number;
}

function parseMetricValue(value: string): ParsedMetricValue {
  const source = String(value ?? "");
  const match = source.match(/-?\d+(?:\.\d+)?/);
  if (!match || typeof match.index !== "number") {
    return {
      prefix: source,
      suffix: "",
      numericValue: null,
      decimals: 0,
    };
  }

  const numericToken = match[0];
  const numericValue = Number(numericToken);
  if (!Number.isFinite(numericValue)) {
    return {
      prefix: source,
      suffix: "",
      numericValue: null,
      decimals: 0,
    };
  }

  const decimals = numericToken.includes(".") ? numericToken.split(".")[1]?.length || 0 : 0;

  return {
    prefix: source.slice(0, match.index),
    suffix: source.slice(match.index + numericToken.length),
    numericValue,
    decimals,
  };
}

export function AnimatedMetricValue({ value, className = "", durationMs = 920 }: AnimatedMetricValueProps): JSX.Element {
  const { reduceMotion } = useMotionPreference();
  const parsed = useMemo(() => parseMetricValue(value), [value]);

  const animatedNumber = useCountUp(parsed.numericValue ?? 0, {
    enabled: !reduceMotion && parsed.numericValue !== null,
    durationMs,
  });

  if (parsed.numericValue === null) {
    return <span className={className}>{value}</span>;
  }

  const normalizedValue = parsed.decimals > 0 ? animatedNumber.toFixed(parsed.decimals) : String(Math.round(animatedNumber));
  return <span className={className}>{`${parsed.prefix}${normalizedValue}${parsed.suffix}`}</span>;
}
