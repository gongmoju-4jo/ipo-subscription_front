import { useLayoutEffect, useRef, useState } from 'react';

interface Pos { x: number; w: number; ready: boolean }

/**
 * 탭, 메뉴에서 선택된 항목 아래로 미끄러지는 표시의 위치를 잰다.
 * 선택이 바뀌면 위치가 바뀌어 CSS transition으로 움직이고, 처음 잰 순간에는 움직임 없이 자리에 놓인다.
 */
export function useIndicator<T extends HTMLElement>(activeKey: string, selector: string) {
  const ref = useRef<T>(null);
  const [pos, setPos] = useState<Pos>({ x: 0, w: 0, ready: false });

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const measure = () => {
      const el = root.querySelector<HTMLElement>(selector);
      if (!el) return setPos((p) => (p.ready ? { ...p, ready: false } : p));
      setPos((p) => (p.ready && p.x === el.offsetLeft && p.w === el.offsetWidth ? p : { x: el.offsetLeft, w: el.offsetWidth, ready: true }));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [activeKey, selector]);

  return [ref, pos] as const;
}
