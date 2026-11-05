import { ApiError } from '../api/client';

/** 조회 실패 안내. 사용자에게는 서버가 준 message를 그대로 보여준다 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : '알 수 없는 오류가 발생했습니다.';
  return (
    <div className="alert alert-warn" role="alert" style={{ margin: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <span>{message}</span>
      {onRetry && <button type="button" className="btn-link" onClick={onRetry}>다시 시도</button>}
    </div>
  );
}

/** 불러오는 동안 들어올 자리의 모양을 미리 보여준다 */
export function Loading({ rows = 4, height = 72 }: { rows?: number; height?: number }) {
  return (
    <div className="stack" style={{ gap: 10, padding: 4 }} role="status" aria-label="불러오는 중">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height, borderRadius: 18, animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}
