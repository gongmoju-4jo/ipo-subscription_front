import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import * as api from '../api/endpoints';
import type { Subscription } from '../api/types';
import { StatusChip } from '../components/Chips';
import { IconBack } from '../components/Icons';
import { Num } from '../components/Num';
import { Pagination } from '../components/Pagination';
import { Loading, QueryError } from '../components/QueryState';
import {
  CANCEL_REASON_LABEL, HAS_ALLOCATION, IN_FLIGHT, isFailed, progressStep, REJECT_REASON_LABEL,
} from '../lib/domain';
import { accountNo, kstCompact, kstSeconds, won } from '../lib/format';
import { parsePage } from '../lib/pagination';
import { UUID_PATTERN } from '../lib/requestId';
import { stagger } from '../lib/ui';
import { useIsCompact } from '../lib/useMediaQuery';
import { ACCOUNTS_KEY, useAccounts } from './AccountsPage';

const PAGE_SIZE = 20;

export function SubscriptionsPage() {
  const compact = useIsCompact();
  const [params, setParams] = useSearchParams();
  const page = parsePage(params.get('page')); // 주소는 1부터, API는 0부터
  const list = useQuery({
    queryKey: ['subscriptions', page],
    queryFn: async () => (await api.listSubscriptions({ page: page - 1, size: PAGE_SIZE })).data,
    placeholderData: keepPreviousData, // 쪽을 넘길 때 목록이 깜빡이지 않게
  });
  const items = list.data?.items ?? [];
  const wantedRaw = params.get('id');
  const wanted = wantedRaw && UUID_PATTERN.test(wantedRaw) ? wantedRaw : null;

  // 넓은 화면은 목록과 상세가 나란히 있어 첫 청약이 기본 선택된다.
  // 좁은 화면은 목록 → 상세로 화면을 오간다 (id가 있을 때만 상세)
  const selectedId = wanted ?? (compact ? null : items[0]?.subscriptionId ?? null);
  const showList = !compact || !wanted;

  // 주소의 page가 범위를 넘으면 마지막 쪽으로 맞춘다
  useEffect(() => {
    const d = list.data;
    if (d && !list.isPlaceholderData && d.items.length === 0 && d.totalPages > 0 && page > d.totalPages) {
      setParams({ page: String(d.totalPages) }, { replace: true });
    }
  }, [list.data, list.isPlaceholderData, page, setParams]);

  const goPage = (p: number) => {
    setParams(p === 1 ? {} : { page: String(p) }); // 새 쪽의 첫 청약이 선택된다
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const select = (id: string) => {
    setParams((prev) => { const n = new URLSearchParams(prev); n.set('id', id); return n; }, { replace: !compact });
    if (compact) window.scrollTo({ top: 0 });
  };
  const back = () => setParams(page > 1 ? { page: String(page) } : {});

  return (
    <main className="main">
      {!(compact && wanted) && (
        <div className="page-top">
          <div>
            <p className="eyebrow">최근 신청 순{list.data ? ` · ${list.data.totalElements}건` : ''}</p>
            <h1 className="display">내 청약</h1>
          </div>
        </div>
      )}

      <div className="split">
        {showList && (
          <section className="side" aria-label="청약 목록">
            {list.isPending ? (
              <Loading rows={4} height={76} />
            ) : list.isError ? (
              <div className="card"><QueryError error={list.error} onRetry={() => void list.refetch()} /></div>
            ) : items.length === 0 ? (
              <div className="card empty">아직 청약 내역이 없습니다.<br /><Link to="/ipos">공모주 보러 가기 →</Link></div>
            ) : (
              <div className="sub-list">
                {items.map((s, i) => (
                  <button key={s.subscriptionId} type="button" className="sub-item rise" data-spot style={stagger(i)}
                    aria-pressed={!compact && s.subscriptionId === selectedId}
                    onClick={() => select(s.subscriptionId)}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontWeight: 650, fontSize: 16, letterSpacing: '-0.02em' }}>{s.ipoName}</span>
                      <StatusChip status={s.status} />
                    </span>
                    <span className="muted small" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <span className="tnum">{won(s.requestedQuantity)}주{s.status === 'REJECTED' ? '' : ` · ${won(s.marginAmount)}원`}</span>
                      <span className="tnum">{kstCompact(s.receivedAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {list.data && <Pagination page={page} totalPages={list.data.totalPages} totalElements={list.data.totalElements} pageSize={PAGE_SIZE} onChange={goPage} />}
          </section>
        )}

        {selectedId && (
          <section className="grow" aria-label="청약 상세">
            {compact && (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: -12, marginBottom: 12 }} onClick={back}>
                <IconBack size={16} /> 내 청약
              </button>
            )}
            <SubscriptionDetail key={selectedId} subscriptionId={selectedId} />
          </section>
        )}
      </div>
    </main>
  );
}

function SubscriptionDetail({ subscriptionId }: { subscriptionId: string }) {
  const queryClient = useQueryClient();
  const accounts = useAccounts();

  const q = useQuery({
    queryKey: ['subscription', subscriptionId],
    queryFn: async () => (await api.getSubscription(subscriptionId)).data,
    // 처리 중인 상태는 짧은 간격으로 다시 조회
    refetchInterval: (query) => {
      const d = query.state.data;
      return d && IN_FLIGHT.includes(d.status) ? 3000 : false;
    },
  });
  const hasAlloc = !!q.data && HAS_ALLOCATION.includes(q.data.status);

  // 균등, 비례 개별 수량은 배정 서비스에서만 준다. 실패해도 청약 상세의 합계 값은 보여준다
  const alloc = useQuery({
    queryKey: ['allocation', subscriptionId],
    queryFn: async () => (await api.getAllocation(subscriptionId)).data,
    enabled: hasAlloc,
    retry: false,
  });

  // 상태가 바뀌어 잔고가 달라졌을 수 있으면 계좌를 갱신
  const status = q.data?.status;
  useEffect(() => {
    if (status && !IN_FLIGHT.includes(status)) void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
  }, [status, queryClient]);

  if (q.isPending) return <Loading rows={3} height={120} />;
  if (q.isError) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div className="card">
        {notFound ? <div className="empty">청약 내역을 찾을 수 없습니다. 접수 직후라면 잠시 후 다시 확인해 주세요.</div> : <QueryError error={q.error} onRetry={() => void q.refetch()} />}
      </div>
    );
  }

  const sub = q.data;
  const account = accounts.data?.find((a) => a.accountId === sub.accountId);
  const step = progressStep(sub.status);
  const failed = isFailed(sub.status);
  const steps = [
    { label: '접수', time: sub.receivedAt ? kstSeconds(sub.receivedAt) : '—' },
    { label: '확정', time: sub.confirmedAt ? kstSeconds(sub.confirmedAt) : '—' },
    { label: '배정', time: step >= 3 ? '완료' : '—' },
    { label: '환불', time: step >= 4 ? '완료' : '—' },
  ];

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="card" style={{ padding: 28 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 0 }}>
            <div className="mono muted" style={{ fontSize: 12, overflowWrap: 'anywhere' }}>{sub.subscriptionId}</div>
            <h2 style={{ margin: '8px 0 0', fontSize: 28, fontWeight: 750, letterSpacing: '-0.035em', lineHeight: 1.2 }}>{sub.ipoName}</h2>
          </div>
          <StatusChip status={sub.status} large />
        </div>

        <ol className="steps" style={{ marginTop: 28 }}>
          {steps.map((s, i) => {
            const done = i < step;
            const cls = done ? (failed ? 'failed' : i === step - 1 && step < 4 ? 'now' : 'done') : '';
            return (
              <li key={s.label} className="stack" style={{ gap: 8 }}>
                <span className="step-bar">{done && <i className={cls} style={stagger(i)} />}</span>
                <span style={{ fontSize: 14, fontWeight: done ? 650 : 400, color: done ? 'var(--ink)' : 'var(--faint)' }}>{s.label}</span>
                <span className="muted small tnum">{s.time}</span>
              </li>
            );
          })}
        </ol>

        {sub.status === 'REJECTED' && <RejectedNotice sub={sub} />}
        {(sub.status === 'CANCELLED' || sub.status === 'COMPENSATING') && (
          <div className="alert alert-quiet" style={{ marginTop: 24, fontSize: 14, padding: '16px 18px' }}>
            <div style={{ fontWeight: 650 }}>{sub.status === 'CANCELLED' ? '취소됨' : '취소 처리 중'} · {sub.cancelReason ? CANCEL_REASON_LABEL[sub.cancelReason] : ''}</div>
            <div style={{ marginTop: 4 }}>
              {sub.status === 'CANCELLED' ? `청약증거금 ${won(sub.marginAmount)}원 전액이 예수금으로 반환됐습니다. 같은 종목에 다시 청약할 수 있습니다.` : '증거금을 예수금으로 되돌리는 중입니다.'}
            </div>
          </div>
        )}
        {sub.status === 'PENDING' && <div className="alert alert-info" style={{ marginTop: 24, fontSize: 14, padding: '16px 18px' }}>증거금 인출을 처리하고 있습니다.</div>}
        {sub.status === 'CONFIRMED' && <div className="alert alert-info" style={{ marginTop: 24, fontSize: 14, padding: '16px 18px' }}>청약이 확정됐습니다. 마감 후 배정 결과가 자동으로 나옵니다.</div>}
      </div>

      <div className="tiles">
        <div className="tile" data-spot><div className="tile-label">청약 수량</div><div className="tile-value"><Num value={sub.requestedQuantity} fromZero /><span className="unit">주</span></div></div>
        <div className="tile" data-spot><div className="tile-label">{sub.status === 'REJECTED' ? '필요 증거금 (인출되지 않음)' : '증거금'}</div><div className="tile-value"><Num value={sub.marginAmount} fromZero /><span className="unit">원</span></div></div>
        <div className="tile" data-spot><div className="tile-label">청약 계좌</div><div className="tile-value" style={{ fontSize: 20 }}>{account ? accountNo(account.accountNumber) : '-'}</div></div>
      </div>

      {hasAlloc && <AllocationCard sub={sub} equal={alloc.data?.equalAllocatedQuantity} prop={alloc.data?.proportionalAllocatedQuantity} />}
    </div>
  );
}

/** 거절은 증거금을 옮기기 전에 실패한 것이라 빠져나간 돈이 없다. 다음에 할 일은 사유마다 다르다 */
function RejectedNotice({ sub }: { sub: Subscription }) {
  const retry = { to: `/ipos/${sub.ipoId}`, label: '다시 청약하기 →' };
  const guide: { text: string; links: Array<{ to: string; label: string }> } =
    sub.rejectReason === 'ALREADY_SUBSCRIBED'
      ? { text: '이미 이 종목에 청약한 내역이 있어 거절됐습니다. 먼저 청약한 건이 그대로 유효합니다.', links: [] }
      : sub.rejectReason === 'INSUFFICIENT_BALANCE'
        ? { text: '예수금이 부족해 거절됐습니다. 입금한 뒤 다시 청약할 수 있습니다.', links: [{ to: '/accounts', label: '입금하러 가기 →' }, retry] }
        : { text: '다른 계좌로 다시 청약할 수 있습니다.', links: [retry] };
  return (
    <div className="alert alert-warn" style={{ marginTop: 24, fontSize: 14, padding: '16px 18px' }}>
      <div style={{ fontWeight: 650 }}>거절됨 · {sub.rejectReason ? REJECT_REASON_LABEL[sub.rejectReason] : ''}</div>
      <div style={{ marginTop: 4 }}>{guide.text} 증거금을 옮기기 전에 실패해 빠져나간 돈은 없습니다.</div>
      {guide.links.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', marginTop: 10 }}>
          {guide.links.map((l) => (
            <Link key={l.to} to={l.to} style={{ color: 'var(--warn-ink)', fontWeight: 650 }}>{l.label}</Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AllocationCard({ sub, equal, prop }: { sub: Subscription; equal?: number; prop?: number }) {
  const allocated = sub.allocatedQuantity;
  const paid = sub.allocatedAmount;
  const refund = sub.refundAmount; // 정산 전이면 null
  const pct = paid !== null && sub.marginAmount > 0 ? Math.max(paid === 0 ? 0 : 1.5, (paid / sub.marginAmount) * 100) : 0;

  return (
    <div className="alloc">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16, alignItems: 'flex-end' }}>
        <div>
          <div className="k">배정 수량</div>
          <div className="big">
            {allocated === null ? '-' : <Num value={allocated} fromZero />}<span style={{ fontSize: 18, fontWeight: 500, color: '#a8b0c2', letterSpacing: 0 }}> / {won(sub.requestedQuantity)}주</span>
          </div>
        </div>
        {equal !== undefined && prop !== undefined && (
          <div style={{ display: 'flex', gap: 28, fontSize: 13 }}>
            <div><div className="k">균등</div><div className="tnum" style={{ fontSize: 20, fontWeight: 700 }}>{won(equal)}주</div></div>
            <div><div className="k">비례</div><div className="tnum" style={{ fontSize: 20, fontWeight: 700 }}>{won(prop)}주</div></div>
          </div>
        )}
      </div>

      {paid !== null && (
        <div style={{ marginTop: 28 }}>
          <div className="k" style={{ marginBottom: 10 }}>증거금 {won(sub.marginAmount)}원은 이렇게 나뉩니다</div>
          <div className="split-bar" aria-hidden="true">
            <span className="paid" style={{ width: `${pct}%` }} />
            <span className="refund" />
          </div>
          <dl style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: '#fff', flex: 'none' }} aria-hidden="true" />
              <div><dt className="k">배정 대금 (정산)</dt><dd className="tnum" style={{ fontSize: 20, fontWeight: 700 }}>{won(paid)}원</dd></div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--accent-on-dark)', flex: 'none' }} aria-hidden="true" />
              <div>
                <dt className="k">환불액 (예수금으로)</dt>
                <dd className="tnum" style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent-on-dark)' }}>{refund === null ? '정산 중' : `${won(refund)}원`}</dd>
              </div>
            </div>
          </dl>
        </div>
      )}
    </div>
  );
}
