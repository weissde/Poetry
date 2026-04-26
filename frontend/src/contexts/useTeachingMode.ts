import { useContext } from "react";
import { TeachingModeContext, type TeachingModeContextValue } from "@/contexts/TeachingModeContext";

export function useTeachingMode(): TeachingModeContextValue {
  const context = useContext(TeachingModeContext);
  if (!context) {
    throw new Error("useTeachingMode must be used within TeachingModeProvider");
  }
  return context;
}
