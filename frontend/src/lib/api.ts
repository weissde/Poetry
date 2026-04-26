﻿import { requireSupabase } from "@/lib/supabase";
import type {
  ApiEnvelope,
  ClassRecord,
  ClassesPayload,
  ClassJoinResult,
  ClassStudentsPayload,
  ClassSummaryPayload,
  ClassTaskCreateResult,
  ClassWrongbookDistributionPayload,
  LearningSummaryPayload,
  LatestTeachingSessionPayload,
  LessonTaskCreatePayload,
  LessonTaskRecord,
  LessonTaskStatus,
  LessonTasksPayload,
  PersonalGraphInsightsPayload,
  PoemExamPointsPayload,
  PoemRecord,
  PoemTeachingContentPayload,
  TeachingSessionCreatePayload,
  TeachingSessionEndPayload,
  TeachingSessionRecord,
  TeachingSessionStepUpdatePayload,
  TeachingUnitsPayload,
  TodayTasksPayload,
  UserRole,
  UserRolePayload,
  UserSummaryPayload,
} from "@/types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://127.0.0.1:8000";
const API_PREFIX = `${API_BASE_URL.replace(/\/$/, "")}/api`;

const ACCESS_TOKEN_CACHE_MS = 5000;
const DEFAULT_GET_CACHE_TTL_MS = 120000;
const REQUEST_TIMEOUT_MS = Math.max(3000, Number(import.meta.env.VITE_API_TIMEOUT_MS || 12000));
const REQUEST_RETRY_TIMES = Math.max(0, Number(import.meta.env.VITE_API_RETRY_TIMES || 1));
const REQUEST_RETRY_BASE_DELAY_MS = Math.max(100, Number(import.meta.env.VITE_API_RETRY_BASE_DELAY_MS || 350));

let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;
let tokenRequestPromise: Promise<string | null> | null = null;
let signingOutOnUnauthorized = false;
let redirectingOnUnauthorized = false;

type CachedGetEntry = {
  expiresAt: number;
  data: unknown;
};

const getResponseCache = new Map<string, CachedGetEntry>();
const getInFlight = new Map<string, Promise<unknown>>();

interface ApiGetOptions {
  cacheTtlMs?: number;
  force?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

interface ApiRequestOptions {
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

function normalizeApiPath(path: string): string {
  const raw = String(path || "").trim();
  if (!raw.startsWith("/")) {
    return `/${raw}`;
  }
  return raw;
}

function warnIfApiPrefixedPath(path: string): void {
  if (path.startsWith("/api/")) {
    console.warn("API path should not start with /api/:", path);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIdempotentMethod(method?: string): boolean {
  const m = (method || "GET").toUpperCase();
  return m === "GET" || m === "HEAD";
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("请求超时")
    );
  }

  return false;
}

function buildGetCacheKey(path: string, token: string | null): string {
  const tokenScope = token ? token.slice(-16) : "anon";
  return `${tokenScope}:${path}`;
}

function purgeExpiredGetCache(now = Date.now()): void {
  for (const [key, entry] of getResponseCache.entries()) {
    if (entry.expiresAt <= now) {
      getResponseCache.delete(key);
    }
  }
}

export function invalidateApiGetCache(pathPrefix?: string): void {
  if (!pathPrefix) {
    getResponseCache.clear();
    getInFlight.clear();
    return;
  }

  for (const key of getResponseCache.keys()) {
    const separatorIndex = key.indexOf(":");
    const path = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : key;
    if (path.startsWith(pathPrefix)) {
      getResponseCache.delete(key);
    }
  }

  for (const key of getInFlight.keys()) {
    const separatorIndex = key.indexOf(":");
    const path = separatorIndex >= 0 ? key.slice(separatorIndex + 1) : key;
    if (path.startsWith(pathPrefix)) {
      getInFlight.delete(key);
    }
  }
}

export function clearApiAuthCache(): void {
  cachedAccessToken = null;
  tokenExpiresAt = 0;
  tokenRequestPromise = null;
  invalidateApiGetCache();
}

async function handleUnauthorized(): Promise<void> {
  clearApiAuthCache();
  if (typeof window !== "undefined") {
    window.sessionStorage.setItem("poetry_ai_auth_expired", "1");
    const currentPath = `${window.location.pathname}${window.location.search}`;
    if (currentPath.startsWith("/") && !currentPath.startsWith("/login")) {
      window.sessionStorage.setItem("poetry_ai_return_to", currentPath);
      if (!redirectingOnUnauthorized) {
        redirectingOnUnauthorized = true;
        window.location.replace(`/login?returnTo=${encodeURIComponent(currentPath)}`);
      }
    }
  }
  if (signingOutOnUnauthorized) {
    return;
  }
  signingOutOnUnauthorized = true;
  try {
    await requireSupabase().auth.signOut({ scope: "local" });
  } catch {
    // ignore
  } finally {
    signingOutOnUnauthorized = false;
  }
}

async function getAccessToken(): Promise<string | null> {
  const now = Date.now();
  if (tokenExpiresAt > now) {
    return cachedAccessToken;
  }

  if (tokenRequestPromise) {
    return tokenRequestPromise;
  }

  tokenRequestPromise = (async () => {
    try {
      const { data } = await requireSupabase().auth.getSession();
      cachedAccessToken = data.session?.access_token ?? null;
      tokenExpiresAt = Date.now() + ACCESS_TOKEN_CACHE_MS;
      return cachedAccessToken;
    } catch {
      cachedAccessToken = null;
      tokenExpiresAt = Date.now() + ACCESS_TOKEN_CACHE_MS;
      return null;
    } finally {
      tokenRequestPromise = null;
    }
  })();

  return tokenRequestPromise;
}

async function parseApiPayload<T>(response: Response): Promise<ApiEnvelope<T> | null> {
  try {
    return (await response.json()) as ApiEnvelope<T>;
  } catch {
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs?: number): Promise<Response> {
  const effectiveTimeoutMs = Math.max(1000, Number(timeoutMs || REQUEST_TIMEOUT_MS));
  const controller = new AbortController();
  let abortedByCaller = false;
  const handleCallerAbort = (): void => {
    abortedByCaller = true;
    controller.abort();
  };

  if (init.signal) {
    if (init.signal.aborted) {
      handleCallerAbort();
    } else {
      init.signal.addEventListener("abort", handleCallerAbort, { once: true });
    }
  }

  const timer = setTimeout(() => controller.abort(), effectiveTimeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "AbortError") {
      if (abortedByCaller || init.signal?.aborted) {
        throw error;
      }
      throw new Error(`请求超时（>${effectiveTimeoutMs}ms），请稍后重试。`);
    }
    if (error instanceof TypeError) {
      throw new Error("网络连接失败，请检查网络或确认后端服务可访问。");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", handleCallerAbort);
  }
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options?: {
    retries?: number;
    method?: string;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
): Promise<Response> {
  const retries = Math.max(0, options?.retries ?? 0);
  const method = (options?.method || init.method || "GET").toUpperCase();
  const canRetry = retries > 0 && isIdempotentMethod(method);

  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    if (options?.signal?.aborted) {
      throw new DOMException("The operation was aborted.", "AbortError");
    }
    try {
      const response = await fetchWithTimeout(url, init, options?.timeoutMs);
      if (canRetry && isRetryableStatus(response.status) && attempt < retries) {
        await sleep(REQUEST_RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      return response;
    } catch (error: unknown) {
      lastError = error;
      if (canRetry && isRetryableNetworkError(error) && attempt < retries) {
        await sleep(REQUEST_RETRY_BASE_DELAY_MS * (attempt + 1));
        continue;
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error("请求失败，请稍后重试。");
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("请求失败，请稍后重试。");
}

async function request<T>(path: string, init?: RequestInit, options?: ApiRequestOptions): Promise<T> {
  const safePath = normalizeApiPath(path);
  warnIfApiPrefixedPath(safePath);
  const token = await getAccessToken();

  const response = await fetchWithRetry(
    `${API_PREFIX}${safePath}`,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    },
    { retries: options?.retries ?? 0, method: init?.method, timeoutMs: options?.timeoutMs, signal: options?.signal },
  );

  const payload = await parseApiPayload<T>(response);

  if (response.status === 401) {
    await handleUnauthorized();
    throw new Error("登录已过期，请重新登录。");
  }

  if (!response.ok || !payload || payload.code !== 0) {
    const message = payload?.message || `请求失败（${response.status}）`;
    throw new Error(message);
  }

  return payload.data;
}

export async function apiGet<T>(path: string, options?: ApiGetOptions): Promise<T> {
  const safePath = normalizeApiPath(path);
  warnIfApiPrefixedPath(safePath);
  const token = await getAccessToken();
  const cacheTtlMs = options?.cacheTtlMs ?? DEFAULT_GET_CACHE_TTL_MS;
  const useCache = cacheTtlMs > 0 && !options?.force;
  const cacheKey = buildGetCacheKey(safePath, token);

  if (useCache) {
    const now = Date.now();
    purgeExpiredGetCache(now);

    const cached = getResponseCache.get(cacheKey);
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    const inFlight = getInFlight.get(cacheKey);
    if (inFlight) {
      return (await inFlight) as T;
    }
  }

  const runRequest = (async (): Promise<T> => {
    const response = await fetchWithRetry(
      `${API_PREFIX}${safePath}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        signal: options?.signal,
      },
      { retries: REQUEST_RETRY_TIMES, method: "GET", timeoutMs: options?.timeoutMs, signal: options?.signal },
    );

    const payload = await parseApiPayload<T>(response);
    if (!response.ok || !payload || payload.code !== 0) {
      const message = payload?.message || `请求失败（${response.status}）`;
      throw new Error(message);
    }

    const data = payload.data;
    if (useCache) {
      getResponseCache.set(cacheKey, {
        expiresAt: Date.now() + cacheTtlMs,
        data,
      });
    }

    return data;
  })();

  if (useCache) {
    getInFlight.set(cacheKey, runRequest as Promise<unknown>);
  }

  try {
    return await runRequest;
  } finally {
    if (useCache) {
      getInFlight.delete(cacheKey);
    }
  }
}

export async function apiPost<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
  const data = await request<T>(path, {
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  }, options);
  invalidateApiGetCache();
  return data;
}

export async function apiPatch<T>(path: string, body?: unknown, options?: ApiRequestOptions): Promise<T> {
  const data = await request<T>(path, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  }, options);
  invalidateApiGetCache();
  return data;
}

export async function apiDelete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
  const data = await request<T>(path, { method: "DELETE" }, options);
  invalidateApiGetCache();
  return data;
}

interface StreamPostOptions {
  path: string;
  body: unknown;
  onToken?: (token: string, cumulativeText: string, source?: string) => void;
  signal?: AbortSignal;
}

interface StreamEventPayload {
  token?: string;
  text?: string;
  source?: string;
}

export async function streamPost({ path, body, onToken, signal }: StreamPostOptions): Promise<{ text: string; source?: string }> {
  const safePath = normalizeApiPath(path);
  warnIfApiPrefixedPath(safePath);
  const token = await getAccessToken();
  const response = await fetch(`${API_PREFIX}${safePath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    signal,
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    let message = `Stream request failed (${response.status})`;
    try {
      const maybe = (await response.json()) as { message?: string };
      message = maybe.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let cumulative = "";
  let source: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes("\n\n")) {
      const idx = buffer.indexOf("\n\n");
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = rawEvent.split("\n");
      let eventName = "message";
      let dataText = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          eventName = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataText += line.slice(5).trim();
        }
      }

      if (!dataText) {
        continue;
      }

      let parsed: StreamEventPayload | null = null;
      try {
        parsed = JSON.parse(dataText) as StreamEventPayload;
      } catch {
        parsed = { text: dataText, token: dataText };
      }

      if (eventName === "token") {
        cumulative = parsed.text ?? cumulative + (parsed.token ?? "");
        source = parsed.source ?? source;
        onToken?.(parsed.token ?? "", cumulative, source);
      } else if (eventName === "done") {
        cumulative = parsed.text ?? cumulative;
        source = parsed.source ?? source;
      }
    }
  }

  return { text: cumulative, source };
}

export async function getUserSummary(force = false): Promise<UserSummaryPayload> {
  return apiGet<UserSummaryPayload>("/user/summary", { force });
}

export async function getUserRole(force = false): Promise<UserRolePayload> {
  return apiGet<UserRolePayload>("/user/role", { force, cacheTtlMs: 30000 });
}

export async function updateUserRole(role: UserRole): Promise<UserRolePayload> {
  return apiPatch<UserRolePayload>("/user/role", { role });
}

export async function getUserLearningSummary(force = false, signal?: AbortSignal): Promise<LearningSummaryPayload> {
  return apiGet<LearningSummaryPayload>("/user/learning-summary", { force, signal });
}

export async function getTodayTasks(force = false): Promise<TodayTasksPayload> {
  return apiGet<TodayTasksPayload>("/user/today-tasks", { force });
}

export async function getTeachingUnits(force = false, gradeLevel?: string): Promise<TeachingUnitsPayload> {
  const search = gradeLevel ? `?gradeLevel=${encodeURIComponent(gradeLevel)}` : "";
  return apiGet<TeachingUnitsPayload>(`/teaching/units${search}`, { force });
}

export async function getLatestTeachingSession(force = false): Promise<LatestTeachingSessionPayload> {
  return apiGet<LatestTeachingSessionPayload>("/teaching/sessions/latest", { force });
}

export async function createTeachingSession(payload: TeachingSessionCreatePayload): Promise<{ session: TeachingSessionRecord | null }> {
  return apiPost<{ session: TeachingSessionRecord | null }>("/teaching/sessions", payload);
}

export async function advanceTeachingSession(
  sessionId: string,
  payload: TeachingSessionStepUpdatePayload,
): Promise<{ session: TeachingSessionRecord | null }> {
  return apiPatch<{ session: TeachingSessionRecord | null }>(
    `/teaching/sessions/${encodeURIComponent(sessionId)}/advance-step`,
    payload,
  );
}

export async function endTeachingSession(
  sessionId: string,
  payload?: TeachingSessionEndPayload,
): Promise<{ session: TeachingSessionRecord | null }> {
  return apiPatch<{ session: TeachingSessionRecord | null }>(
    `/teaching/sessions/${encodeURIComponent(sessionId)}/end`,
    payload || {},
  );
}

export async function getPoemDetail(poemId: string, force = false): Promise<PoemRecord> {
  return apiGet<PoemRecord>(`/poems/${poemId}`, { force, cacheTtlMs: 120000 });
}

export async function getPoemTeachingContent(poemId: string, force = false): Promise<PoemTeachingContentPayload> {
  return apiGet<PoemTeachingContentPayload>(`/teaching/objectives?poemId=${encodeURIComponent(poemId)}`, {
    force,
    cacheTtlMs: 120000,
  });
}

export async function getPoemExamPoints(poemId: string, force = false): Promise<PoemExamPointsPayload> {
  return apiGet<PoemExamPointsPayload>(`/poems/${poemId}/exam-points`, { force, cacheTtlMs: 120000 });
}

export async function getLessonTasks(force = false, targetUserId?: string): Promise<LessonTasksPayload> {
  const search = targetUserId ? `?targetUserId=${encodeURIComponent(targetUserId)}` : "";
  return apiGet<LessonTasksPayload>(`/lesson-tasks${search}`, { force, cacheTtlMs: 30000 });
}

export async function createLessonTask(payload: LessonTaskCreatePayload): Promise<{ item: LessonTaskRecord }> {
  return apiPost<{ item: LessonTaskRecord }>("/lesson-tasks", payload);
}

export async function updateLessonTaskStatus(taskId: string, status: LessonTaskStatus): Promise<{ item: LessonTaskRecord }> {
  return apiPatch<{ item: LessonTaskRecord }>(`/lesson-tasks/${taskId}/status`, { status });
}

export async function getClasses(force = false): Promise<ClassesPayload> {
  return apiGet<ClassesPayload>("/classes", { force, cacheTtlMs: 30000 });
}

export async function createClass(payload: { name: string; description?: string | null }): Promise<{ item: ClassRecord }> {
  return apiPost<{ item: ClassRecord }>("/classes", payload);
}

export async function joinClassByInvite(inviteCode: string): Promise<ClassJoinResult> {
  return apiPost<ClassJoinResult>("/classes/join", { inviteCode });
}

export async function getClassStudents(classId: string, force = false): Promise<ClassStudentsPayload> {
  return apiGet<ClassStudentsPayload>(`/classes/${encodeURIComponent(classId)}/students`, { force, cacheTtlMs: 30000 });
}

export async function getClassSummary(classId: string, force = false): Promise<ClassSummaryPayload> {
  return apiGet<ClassSummaryPayload>(`/classes/${encodeURIComponent(classId)}/summary`, { force, cacheTtlMs: 30000 });
}

export async function createClassTask(classId: string, payload: LessonTaskCreatePayload): Promise<ClassTaskCreateResult> {
  return apiPost<ClassTaskCreateResult>(`/classes/${encodeURIComponent(classId)}/tasks`, payload);
}

export async function getClassTasks(classId: string, force = false): Promise<LessonTasksPayload> {
  return apiGet<LessonTasksPayload>(`/classes/${encodeURIComponent(classId)}/tasks`, { force, cacheTtlMs: 30000 });
}

export async function getClassWrongbookDistribution(classId: string, force = false): Promise<ClassWrongbookDistributionPayload> {
  return apiGet<ClassWrongbookDistributionPayload>(`/classes/${encodeURIComponent(classId)}/wrongbook/distribution`, { force, cacheTtlMs: 30000 });
}

export async function getPersonalGraphInsights(force = false): Promise<PersonalGraphInsightsPayload> {
  return apiGet<PersonalGraphInsightsPayload>("/graph/personal/insights", {
    force,
    cacheTtlMs: 120000,
  });
}


export async function getUserPoemProgress(force = false): Promise<Record<string, unknown>> {
  return apiGet<Record<string, unknown>>("/user/poem-progress", {
    force,
    cacheTtlMs: 60000,
  });
}

export async function updatePoemStudyState(
  poemId: string,
  payload: { current_stage?: string; stage_completed?: string },
): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>(`/poems/${poemId}/study-state`, payload);
}
