import { useSyncExternalStore } from 'react';

/** 화면 조건이 바뀌면 컴포넌트가 다시 그려진다. CSS로 숨기는 것이 아니라 구성 자체를 바꿀 때 쓴다 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (notify) => {
      const m = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query) : null;
      m?.addEventListener('change', notify);
      return () => m?.removeEventListener('change', notify);
    },
    () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false),
    () => false,
  );
}

/** 태블릿 이하: 옆 패널 대신 하단 시트, 목록과 상세를 화면 단위로 오간다 */
export const useIsCompact = () => useMediaQuery('(max-width: 960px)');
