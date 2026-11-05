import { useEffect } from 'react';

/**
 * 커서에 반응하는 효과를 한 곳에서 처리한다 (요소마다 리스너를 달지 않는다).
 * - [data-spot]: 커서 위치를 --mx, --my 로 넣어 카드 위에서 빛이 따라오게 한다
 * - [data-magnetic]: 주요 버튼이 커서 쪽으로 살짝 끌려온다 (--tx, --ty)
 * 터치 기기와 "동작 줄이기" 설정에서는 켜지 않는다.
 */
export function usePointerEffects() {
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let raf = 0;
    let last: PointerEvent | null = null;

    const apply = () => {
      raf = 0;
      const e = last;
      const target = e?.target;
      if (!e || !(target instanceof Element)) return;

      const spot = target.closest<HTMLElement>('[data-spot]');
      if (spot) {
        const r = spot.getBoundingClientRect();
        spot.style.setProperty('--mx', `${e.clientX - r.left}px`);
        spot.style.setProperty('--my', `${e.clientY - r.top}px`);
      }
      const mag = target.closest<HTMLElement>('[data-magnetic]');
      if (mag) {
        const r = mag.getBoundingClientRect();
        const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        mag.style.setProperty('--tx', `${(dx * 5).toFixed(2)}px`);
        mag.style.setProperty('--ty', `${(dy * 3).toFixed(2)}px`);
      }
    };

    const onMove = (e: PointerEvent) => {
      last = e;
      if (!raf) raf = requestAnimationFrame(apply);
    };
    const onOut = (e: PointerEvent) => {
      const el = e.target instanceof Element ? e.target.closest<HTMLElement>('[data-magnetic]') : null;
      if (el && !(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) {
        el.style.setProperty('--tx', '0px');
        el.style.setProperty('--ty', '0px');
      }
    };

    document.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerout', onOut, { passive: true });
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerout', onOut);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
