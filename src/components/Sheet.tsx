import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconClose } from './Icons';

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}

const OUT_MS = 240;

/**
 * 좁은 화면에서 옆 패널 대신 쓰는 하단 시트.
 * 아래로 끌어 내리거나 바깥을 누르거나 Esc로 닫는다. 열려 있는 동안 뒤 화면은 inert(포커스, 클릭 불가)로 둔다.
 */
export function Sheet({ open, onClose, label, children }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const drag = useRef<number | null>(null);

  // 닫을 때는 나가는 애니메이션이 끝난 뒤에 지운다
  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mountedRef.current) return; // 처음부터 닫혀 있으면 할 일이 없다
    setClosing(true);
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, OUT_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = document.getElementById('root');
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    root?.setAttribute('inert', '');
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = overflow;
      root?.removeAttribute('inert');
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [mounted]);

  if (!mounted) return null;

  const down = (e: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = e.clientY;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (panel.current) panel.current.style.transition = 'none';
  };
  const move = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === null || !panel.current) return;
    panel.current.style.transform = `translateY(${Math.max(0, e.clientY - drag.current)}px)`;
  };
  const up = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (drag.current === null || !panel.current) return;
    const dy = e.clientY - drag.current;
    drag.current = null;
    panel.current.style.transition = '';
    panel.current.style.transform = '';
    if (dy > 90) onClose();
  };

  return createPortal(
    <div className="sheet-root">
      <div className={`sheet-backdrop${closing ? ' out' : ''}`} onClick={onClose} />
      <div ref={panel} className={`sheet${closing ? ' out' : ''}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="sheet-grip" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span />
        </div>
        <button type="button" className="sheet-close btn btn-ghost btn-sm" aria-label="닫기" onClick={onClose}>
          <IconClose size={18} />
        </button>
        <div className="sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
