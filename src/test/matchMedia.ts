import { vi } from 'vitest';

/** 테스트에서 화면 크기를 흉내 낸다. compact가 true면 960px 이하(태블릿, 휴대폰)로 본다 */
export function stubViewport(compact: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('max-width: 960px') ? compact : false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  }));
}
