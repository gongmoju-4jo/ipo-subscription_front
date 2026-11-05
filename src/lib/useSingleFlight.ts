import { useCallback, useRef } from 'react';

/**
 * 진행 중인 작업이 있으면 같은 작업을 다시 시작하지 않는다.
 * mutation의 isPending은 다음 렌더에야 바뀌어서, 더블클릭의 두 번째 클릭이 그 사이에 통과한다.
 * ref는 즉시 바뀌므로 두 번째 클릭을 확실히 막는다.
 */
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(async (task: () => Promise<unknown>): Promise<void> => {
    if (busy.current) return;
    busy.current = true;
    try {
      await task();
    } finally {
      busy.current = false;
    }
  }, []);
}
