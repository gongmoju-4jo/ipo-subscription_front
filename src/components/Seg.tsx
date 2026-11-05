import { useIndicator } from '../lib/useIndicator';

interface Item<K extends string> {
  key: K;
  label: string;
  count?: number;
}

interface Props<K extends string> {
  items: Item<K>[];
  value: K;
  onChange: (key: K) => void;
  label: string;
  full?: boolean;
}

/** 선택 표시가 미끄러져 옮겨 가는 탭 */
export function Seg<K extends string>({ items, value, onChange, label, full = false }: Props<K>) {
  const [ref, pos] = useIndicator<HTMLDivElement>(value, '[aria-selected="true"]');
  return (
    <div className={`seg${full ? ' seg-full' : ''}`} role="tablist" aria-label={label} ref={ref}>
      {pos.ready && <span className="seg-ind" aria-hidden="true" style={{ transform: `translateX(${pos.x}px)`, width: pos.w }} />}
      {items.map((i) => (
        <button key={i.key} type="button" role="tab" className="seg-btn" aria-selected={value === i.key} onClick={() => onChange(i.key)}>
          {i.label}
          {i.count !== undefined && <>{' '}<span className="seg-count">{i.count}</span></>}
        </button>
      ))}
    </div>
  );
}
