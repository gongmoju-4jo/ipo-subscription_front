import { afterEach, describe, expect, it, vi } from 'vitest';
import { newRequestId, UUID_PATTERN } from './requestId';

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('newRequestId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('보안 컨텍스트가 아니어도(HTTP 배포) UUID v4를 만든다', () => {
    vi.stubGlobal('isSecureContext', false);
    const ids = new Set(Array.from({ length: 200 }, () => newRequestId()));
    expect(ids.size).toBe(200);
    ids.forEach((id) => {
      expect(id).toMatch(V4);
      expect(id).toMatch(UUID_PATTERN); // 서버의 UUID 패턴 검증을 통과해야 한다
    });
  });

  it('보안 컨텍스트에서는 randomUUID를 쓴다', () => {
    vi.stubGlobal('isSecureContext', true);
    expect(newRequestId()).toMatch(V4);
  });
});
