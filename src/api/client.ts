import { loadSession } from '../auth/session';
import type { ApiEnvelope, ApiErrorDetail } from './types';

/** 서버가 공통 오류 형식으로 응답했거나, 응답을 받지 못한 경우의 오류 */
export class ApiError extends Error {
  readonly status: number; // HTTP 상태. 응답을 받지 못했으면 0
  readonly code: string;
  readonly details: ApiErrorDetail[];

  constructor(status: number, code: string, message: string, details: ApiErrorDetail[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** 응답을 못 받았거나 5xx: 같은 requestId로 다시 보내도 되는 실패 */
  get retryable(): boolean {
    return this.status === 0 || this.status >= 500;
  }

  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.reason;
  }
}

export interface ApiResult<T> {
  status: number;
  data: T;
  message?: string;
}

type UnauthorizedHandler = (code: string) => void;

let onUnauthorized: UnauthorizedHandler = () => {};

/**
 * AuthProvider가 401 처리 함수를 등록한다. 응답은 비동기로 오므로 effect에서 등록해도 늦지 않다.
 * 토큰은 등록하지 않고 매 요청마다 세션 저장소에서 읽는다 (등록에 의존하면 새로고침 직후 첫 요청에 토큰이 빠진다).
 */
export function configureClient(unauthorizedHandler: UnauthorizedHandler) {
  onUnauthorized = unauthorizedHandler;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** 회원가입, 로그인처럼 토큰 없이 부르는 공개 경로 */
  auth?: boolean;
  signal?: AbortSignal;
}

const TIMEOUT_MS = 10_000;

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', body, query, auth = true, signal } = options;

  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const url = qs ? `${path}?${qs}` : path;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = loadSession()?.accessToken;
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', '서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(timer);
  }

  let envelope: ApiEnvelope<T> | null = null;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    envelope = null;
  }

  if (!res.ok || !envelope || envelope.success === false) {
    const err = envelope?.error;
    const apiError = new ApiError(
      res.status,
      err?.code ?? `HTTP_${res.status}`,
      err?.message ?? '요청을 처리하지 못했습니다.',
      err?.details ?? [],
    );
    // 토큰이 필요한 요청에서 401이면 세션을 끝낸다 (로그인 실패 INVALID_CREDENTIALS는 공개 경로라 해당 없음)
    if (auth && res.status === 401) onUnauthorized(apiError.code);
    throw apiError;
  }

  return { status: res.status, data: envelope.data as T, message: envelope.message };
}
