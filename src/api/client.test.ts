import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'ipo.session';

function stubSessionStorage() {
  const store = new Map<string, string>();
  vi.stubGlobal('sessionStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
}

function stubFetch(status = 200, body: unknown = { success: true, data: {} }) {
  const fn = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fn);
  return fn;
}

const authHeader = (fn: ReturnType<typeof stubFetch>) =>
  (fn.mock.calls[0]?.[1]?.headers as Record<string, string> | undefined)?.Authorization;

describe('request의 토큰 처리', () => {
  beforeEach(() => {
    vi.resetModules(); // 매번 새 모듈로: AuthProvider가 아직 아무것도 등록하지 않은 상태를 만든다
    stubSessionStorage();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('새로고침 직후 첫 요청에도 저장된 토큰을 붙인다 (AuthProvider 등록 전)', async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ accessToken: 'tok', loginId: 'u', expiresAt: Date.now() + 60_000 }));
    const fetchFn = stubFetch();
    const { request } = await import('./client');
    await request('/api/v1/ipos');
    expect(authHeader(fetchFn)).toBe('Bearer tok');
  });

  it('만료된 세션의 토큰은 붙이지 않는다', async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ accessToken: 'old', loginId: 'u', expiresAt: Date.now() - 1 }));
    const fetchFn = stubFetch();
    const { request } = await import('./client');
    await request('/api/v1/ipos');
    expect(authHeader(fetchFn)).toBeUndefined();
  });

  it('공개 경로(auth: false)에는 토큰을 붙이지 않는다', async () => {
    sessionStorage.setItem(KEY, JSON.stringify({ accessToken: 'tok', loginId: 'u', expiresAt: Date.now() + 60_000 }));
    const fetchFn = stubFetch();
    const { request } = await import('./client');
    await request('/api/v1/auth/login', { method: 'POST', body: {}, auth: false });
    expect(authHeader(fetchFn)).toBeUndefined();
  });

  it('토큰이 필요한 요청이 401이면 등록된 처리기를 부르고, 공개 경로 401은 부르지 않는다', async () => {
    stubFetch(401, { success: false, error: { code: 'TOKEN_EXPIRED', message: '만료' } });
    const { request, configureClient } = await import('./client');
    const handler = vi.fn();
    configureClient(handler);
    await expect(request('/api/v1/accounts')).rejects.toMatchObject({ status: 401, code: 'TOKEN_EXPIRED' });
    expect(handler).toHaveBeenCalledWith('TOKEN_EXPIRED');
    handler.mockClear();
    await expect(request('/api/v1/auth/login', { method: 'POST', body: {}, auth: false })).rejects.toMatchObject({ status: 401 });
    expect(handler).not.toHaveBeenCalled();
  });
});
