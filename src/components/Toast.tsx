import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { IconCheck } from './Icons';

interface ToastItem { id: number; text: string; leaving: boolean }
interface ToastApi { show: (text: string) => void }

const Ctx = createContext<ToastApi | null>(null);

const SHOW_MS = 3200;
const LEAVE_MS = 300;

/** 저장, 접수처럼 성공했을 때 화면 아래에서 잠깐 뜨는 안내 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const show = useCallback((text: string) => {
    const id = ++seq.current;
    setItems((cur) => [...cur.slice(-2), { id, text, leaving: false }]);
    setTimeout(() => setItems((cur) => cur.map((t) => (t.id === id ? { ...t, leaving: true } : t))), SHOW_MS);
    setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), SHOW_MS + LEAVE_MS);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t, i) => (
          <div key={t.id} className={`toast${t.leaving ? ' leaving' : ''}`} style={{ marginBottom: (items.length - 1 - i) * 58 }}>
            <span className="ok"><IconCheck size={14} strokeWidth={3} /></span>
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('ToastProvider 안에서만 쓸 수 있습니다.');
  return v;
}
