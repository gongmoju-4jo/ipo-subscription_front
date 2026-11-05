import { useEffect, useState } from 'react';

/** 화면의 "마감까지", 청약 가능 여부 표시용 시계. 서버 시각이 아니라 브라우저 시각이다 */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
