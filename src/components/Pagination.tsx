import { pageWindow } from '../lib/pagination';
import { IconNext, IconPrev } from './Icons';

interface Props {
  page: number; // 1부터
  totalPages: number;
  totalElements: number;
  pageSize: number;
  onChange: (page: number) => void;
}

/** 페이지가 한 쪽뿐이면 아무것도 그리지 않는다 */
export function Pagination({ page, totalPages, totalElements, pageSize, onChange }: Props) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, totalElements);
  return (
    <nav className="pager" aria-label="페이지 이동">
      <span className="pager-count">{from}–{to} / {totalElements}건</span>
      <div className="pager-buttons">
        <button type="button" className="pager-btn" aria-label="이전 페이지" disabled={page <= 1} onClick={() => onChange(page - 1)}><IconPrev size={18} /></button>
        {pageWindow(page, totalPages).map((p, i) =>
          p === '…' ? (
            <span key={`gap${i}`} className="pager-gap" aria-hidden="true">…</span>
          ) : (
            <button key={p} type="button" className="pager-btn" aria-label={`${p}페이지`} aria-current={p === page ? 'page' : undefined} onClick={() => onChange(p)}>{p}</button>
          ),
        )}
        <button type="button" className="pager-btn" aria-label="다음 페이지" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><IconNext size={18} /></button>
      </div>
    </nav>
  );
}
