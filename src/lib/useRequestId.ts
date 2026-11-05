import { useCallback, useRef, useState } from 'react';
import { newRequestId } from './requestId';

/**
 * 요청 내용(key)이 같으면 같은 requestId를 돌려준다.
 * - 연타, 타임아웃 재시도, 5xx 뒤 재전송: key가 같으니 같은 값 → 서버가 한 번만 반영
 * - 금액, 수량, 계좌를 바꿈: key가 바뀌니 새 값 (같은 requestId에 다른 내용을 보내면 서버가 충돌로 처리)
 * - 성공 뒤: renew()로 새 값 (다음 요청은 새 의도)
 */
export function useRequestId(key: string) {
  const [, force] = useState(0);
  const ref = useRef<{ key: string; id: string } | null>(null);
  if (ref.current === null || ref.current.key !== key) {
    ref.current = { key, id: newRequestId() };
  }
  const renew = useCallback(() => {
    if (ref.current) ref.current = { key: ref.current.key, id: newRequestId() };
    force((n) => n + 1);
  }, []);
  return [ref.current.id, renew] as const;
}
