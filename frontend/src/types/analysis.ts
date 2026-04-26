export interface AnalysisSection {
  title: string;
  content: string;
}

export interface AnalysisResult {
  basicInfo: AnalysisSection;
  annotationsAndTranslation: AnalysisSection;
  imageryAndMood: AnalysisSection;
  techniques: AnalysisSection;
  themeAndEmotion: AnalysisSection;
  authorAndContext: AnalysisSection;
  examPoints: AnalysisSection;
}

export type AnalysisDepth = "lite" | "standard" | "exam";

export type AnalysisSectionKey = keyof AnalysisResult;

export const analysisSectionOrder: AnalysisSectionKey[] = [
  "basicInfo",
  "annotationsAndTranslation",
  "imageryAndMood",
  "techniques",
  "themeAndEmotion",
  "authorAndContext",
  "examPoints",
];

export const analysisSectionTitleMap: Record<AnalysisSectionKey, string> = {
  basicInfo: "基本信息",
  annotationsAndTranslation: "注释与译文",
  imageryAndMood: "意象与意境",
  techniques: "艺术手法",
  themeAndEmotion: "情感主旨",
  authorAndContext: "作者与背景",
  examPoints: "考点提示",
};

export function createEmptyAnalysisResult(): AnalysisResult {
  return {
    basicInfo: { title: analysisSectionTitleMap.basicInfo, content: "" },
    annotationsAndTranslation: { title: analysisSectionTitleMap.annotationsAndTranslation, content: "" },
    imageryAndMood: { title: analysisSectionTitleMap.imageryAndMood, content: "" },
    techniques: { title: analysisSectionTitleMap.techniques, content: "" },
    themeAndEmotion: { title: analysisSectionTitleMap.themeAndEmotion, content: "" },
    authorAndContext: { title: analysisSectionTitleMap.authorAndContext, content: "" },
    examPoints: { title: analysisSectionTitleMap.examPoints, content: "" },
  };
}
