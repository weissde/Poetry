import OpenAI from "openai";
import {
  analysisSectionOrder,
  analysisSectionTitleMap,
  createEmptyAnalysisResult,
} from "@/types";
import type { AnalysisDepth, AnalysisResult } from "@/types";

const DOUBAO_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3";
const doubaoApiKey = import.meta.env.VITE_DOUBAO_API_KEY;
export const DOUBAO_MODEL = import.meta.env.VITE_DOUBAO_MODEL_ID;

let doubaoClient: OpenAI | null = null;

function requireDoubaoClient(): OpenAI {
  if (!doubaoApiKey) {
    throw new Error("豆包 API Key 缺失，请在 .env.local 中配置 VITE_DOUBAO_API_KEY。");
  }

  if (!doubaoClient) {
    doubaoClient = new OpenAI({
      apiKey: doubaoApiKey,
      baseURL: DOUBAO_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
  }

  return doubaoClient;
}

function requireDoubaoModelId(): string {
  if (!DOUBAO_MODEL) {
    throw new Error("豆包模型 ID 缺失，请在 .env.local 中配置 VITE_DOUBAO_MODEL_ID。");
  }

  return DOUBAO_MODEL;
}

export interface DoubaoStreamRequest {
  poemTitle?: string;
  poemAuthor?: string;
  poemContent: string;
  depth?: AnalysisDepth;
  signal?: AbortSignal;
  onToken?: (token: string, cumulativeText: string) => void;
  onComplete?: (fullText: string) => void;
}

export type ChatRole = "system" | "user" | "assistant";

export interface ChatTurn {
  role: Exclude<ChatRole, "system">;
  content: string;
}

export interface DoubaoChatStreamRequest {
  systemPrompt: string;
  history: ChatTurn[];
  userMessage: string;
  signal?: AbortSignal;
  onToken?: (token: string, cumulativeText: string) => void;
  onComplete?: (fullText: string) => void;
}

export interface DoubaoJSONRequest {
  prompt: string;
  temperature?: number;
  signal?: AbortSignal;
}

export function buildAnalysisPrompt(params: {
  poemTitle?: string;
  poemAuthor?: string;
  poemContent: string;
  depth: AnalysisDepth;
}): string {
  const { poemTitle, poemAuthor, poemContent, depth } = params;
  const titleLine = poemTitle ? `题目：${poemTitle}` : "题目：未知";
  const authorLine = poemAuthor ? `作者：${poemAuthor}` : "作者：未知";

  return [
    "你是一位资深中学语文教师，擅长古诗词教学。",
    `解析深度：${depth}`,
    titleLine,
    authorLine,
    "原文：",
    poemContent,
    "请仅输出一个 JSON 对象，不要输出任何额外说明。",
    "JSON 必须包含以下字段：",
    "basicInfo, annotationsAndTranslation, imageryAndMood, techniques, themeAndEmotion, authorAndContext, examPoints",
    "每个字段结构为：{ \"title\": string, \"content\": string }。",
    "title 使用中文固定名称，content 要简洁、准确、适合中学生阅读。",
  ].join("\n");
}

function isValidAnalysisResult(value: unknown): value is AnalysisResult {
  if (!value || typeof value !== "object") {
    return false;
  }

  return analysisSectionOrder.every((key) => {
    const section = (value as Record<string, unknown>)[key];
    if (!section || typeof section !== "object") {
      return false;
    }

    const title = (section as Record<string, unknown>).title;
    const content = (section as Record<string, unknown>).content;
    return typeof title === "string" && typeof content === "string";
  });
}

function extractFirstJsonObject(rawText: string): string | null {
  const start = rawText.indexOf("{");
  const end = rawText.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  return rawText.slice(start, end + 1);
}

export function parseDoubaoAnalysis(rawText: string): AnalysisResult {
  const jsonText = extractFirstJsonObject(rawText);
  if (!jsonText) {
    return parseAnalysisFallback(rawText);
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (isValidAnalysisResult(parsed)) {
      return parsed;
    }
  } catch {
    return parseAnalysisFallback(rawText);
  }

  return parseAnalysisFallback(rawText);
}

function parseAnalysisFallback(rawText: string): AnalysisResult {
  const fallback = createEmptyAnalysisResult();
  const compact = rawText.trim();

  if (!compact) {
    return fallback;
  }

  const chunks = compact
    .split(/\n(?=\d+[.、]|[一二三四五六七]、|#{1,3}\s)/)
    .map((item) => item.trim())
    .filter(Boolean);

  analysisSectionOrder.forEach((key, index) => {
    const chunk = chunks[index] ?? "";
    fallback[key] = {
      title: analysisSectionTitleMap[key],
      content: chunk.replace(/^([#\d一二三四五六七\s.、]+)/, "").trim(),
    };
  });

  return fallback;
}

export async function callDoubaoStream({
  poemTitle,
  poemAuthor,
  poemContent,
  depth = "standard",
  signal,
  onToken,
  onComplete,
}: DoubaoStreamRequest): Promise<string> {
  const client = requireDoubaoClient();
  const modelId = requireDoubaoModelId();

  const stream = await client.chat.completions.create(
    {
      model: modelId,
      temperature: 0.3,
      stream: true,
      messages: [
        {
          role: "user",
          content: buildAnalysisPrompt({ poemTitle, poemAuthor, poemContent, depth }),
        },
      ],
    },
    { signal },
  );

  let fullText = "";

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (!token) {
      continue;
    }

    fullText += token;
    onToken?.(token, fullText);
  }

  onComplete?.(fullText);
  return fullText;
}

export async function callDoubaoChatStream({
  systemPrompt,
  history,
  userMessage,
  signal,
  onToken,
  onComplete,
}: DoubaoChatStreamRequest): Promise<string> {
  const client = requireDoubaoClient();
  const modelId = requireDoubaoModelId();

  const messages: Array<{ role: ChatRole; content: string }> = [
    { role: "system", content: systemPrompt },
    ...history,
    { role: "user", content: userMessage },
  ];

  const stream = await client.chat.completions.create(
    {
      model: modelId,
      temperature: 0.5,
      stream: true,
      messages,
    },
    { signal },
  );

  let fullText = "";

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? "";
    if (!token) {
      continue;
    }

    fullText += token;
    onToken?.(token, fullText);
  }

  onComplete?.(fullText);
  return fullText;
}

function extractJSONText(raw: string): string {
  const trimmed = raw.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  return trimmed;
}

export async function callDoubaoJSON<T>({
  prompt,
  temperature = 0.3,
  signal,
}: DoubaoJSONRequest): Promise<T> {
  const client = requireDoubaoClient();
  const modelId = requireDoubaoModelId();

  const completion = await client.chat.completions.create(
    {
      model: modelId,
      temperature,
      stream: false,
      messages: [{ role: "user", content: prompt }],
    },
    { signal },
  );

  const content = completion.choices[0]?.message?.content ?? "";
  if (!content.trim()) {
    throw new Error("豆包返回内容为空，无法解析 JSON。");
  }

  const jsonText = extractJSONText(content);

  try {
    return JSON.parse(jsonText) as T;
  } catch (error: unknown) {
    throw new Error(
      `题目 JSON 解析失败：${error instanceof Error ? error.message : "未知错误"}`,
    );
  }
}
