import { useMemo } from "react";
import { usePoemTeachingContent } from "@/hooks/usePoemTeachingContent";
import { getTeachingFallback, type TeachingStageFallback } from "@/lib/teachingFallback";

export interface TeachingStageData {
  /** Fallback template data (always available) */
  fallback: TeachingStageFallback;
  /** Student-oriented objectives for this stage */
  studentObjectives: string[];
  /** Tip displayed to the student during this stage */
  studentTip: string;
  /** Teacher-oriented hints for guiding the class */
  teacherHints: string[];
  /** Suggested guiding questions the teacher can use */
  guidedQuestions: string[];
  /** Suggested time allocation in minutes */
  suggestedMinutes: number;
  /** Whether database teaching content was loaded successfully */
  hasLiveContent: boolean;
}

export interface UseTeachingStageReturn {
  data: TeachingStageData;
  loading: boolean;
  error: string | null;
}

export function useTeachingStage(poemId?: string, stageId?: string): UseTeachingStageReturn {
  const { data: teachingContent, loading, error: contentError } = usePoemTeachingContent(poemId);

  const result = useMemo<TeachingStageData>(() => {
    const fallback = getTeachingFallback(stageId ?? "stage1");
    const objectives = teachingContent?.teachingObjectives?.[0];
    const hasLiveContent = Boolean(teachingContent && !contentError);

    if (!hasLiveContent || !objectives) {
      return {
        fallback,
        studentObjectives: fallback.studentObjectives,
        studentTip: fallback.studentTip,
        teacherHints: fallback.teacherHints,
        guidedQuestions: fallback.guidedQuestions,
        suggestedMinutes: fallback.suggestedMinutes,
        hasLiveContent: false,
      };
    }

    return {
      fallback,
      studentObjectives: objectives.goals?.length ? objectives.goals : fallback.studentObjectives,
      studentTip: objectives.summary || fallback.studentTip,
      teacherHints: objectives.teacherHint
        ? [objectives.teacherHint, ...fallback.teacherHints]
        : fallback.teacherHints,
      guidedQuestions: fallback.guidedQuestions,
      suggestedMinutes: fallback.suggestedMinutes,
      hasLiveContent: true,
    };
  }, [teachingContent, contentError, stageId]);

  return {
    data: result,
    loading,
    error: contentError,
  };
}
