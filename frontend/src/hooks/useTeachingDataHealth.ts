export interface DataHealthField {
  key: string;
  label: string;
  description: string;
  fixLabel: string;
  fixTo?: string;
  severity: "error" | "warning" | "info";
}

export interface UseTeachingDataHealthReturn {
  missingFields: DataHealthField[];
  hasIssues: boolean;
  hasErrors: boolean;
  health: "ok" | "warning" | "error";
}

interface HealthInput {
  poemId?: string;
  hasPoem: boolean;
  hasTeachingContent: boolean;
  teachingContentError: string | null;
  hasAnalysis: boolean;
  analysisError: string | null;
  hasExamPoints: boolean;
  examPointsError: string | null;
  hasRelatedPoems: boolean;
  relatedError: string | null;
  hasStudyState: boolean;
  studyStateError: string | null;
  isTeacherMode: boolean;
}

export function useTeachingDataHealth(input: HealthInput): UseTeachingDataHealthReturn {
  const { hasPoem, hasTeachingContent, teachingContentError, hasAnalysis, analysisError } = input;

  const missingFields: DataHealthField[] = [];

  if (!hasPoem) {
    missingFields.push({
      key: "poem",
      label: "诗词数据",
      description: "未加载到当前诗词信息，精讲内容无法展示",
      fixLabel: "去选诗",
      fixTo: "/explore",
      severity: "error",
    });
  }

  if (!hasTeachingContent && teachingContentError) {
    missingFields.push({
      key: "teachingContent",
      label: "教学配置",
      description: `教学目标与探究任务未配置：${teachingContentError}`,
      fixLabel: "补齐教学内容",
      severity: "warning",
    });
  }

  if (!hasAnalysis && analysisError) {
    missingFields.push({
      key: "analysis",
      label: "AI 解析",
      description: "当前诗词的 AI 多维解析不可用",
      fixLabel: "重新解析",
      severity: "warning",
    });
  }

  // Teacher-only checks
  if (input.isTeacherMode && !hasTeachingContent) {
    missingFields.push({
      key: "teacherObjectives",
      label: "教师目标数据",
      description: "课堂推进需要教学目标数据支持",
      fixLabel: "配置教学目标",
      severity: "info",
    });
  }

  const hasErrors = missingFields.some((f) => f.severity === "error");
  const hasIssues = missingFields.length > 0;
  const health: "ok" | "warning" | "error" = hasErrors ? "error" : hasIssues ? "warning" : "ok";

  return { missingFields, hasIssues, hasErrors, health };
}
