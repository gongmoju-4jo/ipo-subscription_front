/**
 * 멱등 요청 ID (UUID v4).
 * crypto.randomUUID()는 보안 컨텍스트(HTTPS, localhost)에서만 있어서
 * HTTP로 여는 배포 주소에서는 crypto.getRandomValues()로 직접 만든다.
 */
export function newRequestId(): string {
  const c = globalThis.crypto;
  if (globalThis.isSecureContext && typeof c.randomUUID === 'function') return c.randomUUID();
  const b = c.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40; // version 4
  b[8] = (b[8]! & 0x3f) | 0x80; // variant 10xx
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
