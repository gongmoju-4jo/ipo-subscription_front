import { useEffect, useRef, useState } from 'react';
import { won } from '../lib/format';

const prefersReduced = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 값이 바뀌면 이전 값에서 새 값까지 숫자가 올라가거나 내려간다 */
export function useCountUp(target: number, { duration = 650, fromZero = false }: { duration?: number; fromZero?: boolean } = {}) {
  const [shown, setShown] = useState(fromZero ? 0 : target);
  const current = useRef(shown);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (prefersReduced() || duration <= 0) {
      current.current = target;
      setShown(target);
      return;
    }
    const from = current.current;
    if (from === target) return;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = t >= 1 ? target : Math.round(from + (target - from) * eased);
      current.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return shown;
}

interface NumProps {
  value: number;
  /** 처음 나타날 때 0에서 올라오게 */
  fromZero?: boolean;
  duration?: number;
  className?: string;
}

/** 금액, 건수처럼 변하는 숫자. 자릿수가 달라도 흔들리지 않게 같은 폭 숫자를 쓴다 */
export function Num({ value, fromZero = false, duration, className }: NumProps) {
  const v = useCountUp(value, { fromZero, duration });
  return <span className={`tnum ${className ?? ''}`}>{won(v)}</span>;
}
