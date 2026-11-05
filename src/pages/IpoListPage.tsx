import { useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import * as api from '../api/endpoints';
import type { IpoSummary } from '../api/types';
import { PhaseChip } from '../components/Chips';
import { IconArrow } from '../components/Icons';
import { Num } from '../components/Num';
import { Pagination } from '../components/Pagination';
import { Loading, QueryError } from '../components/QueryState';
import { Seg } from '../components/Seg';
import { ipoPhase, IPO_PHASE_LABEL, type IpoPhase } from '../lib/domain';
import { kstCompact, kstSeconds, remaining, sameKstDay, won } from '../lib/format';
import { parsePage } from '../lib/pagination';
import { stagger } from '../lib/ui';
import { useNow } from '../lib/useNow';
import { useAccounts } from './AccountsPage';

type Filter = 'ALL' | IpoPhase;
const FILTERS: Filter[] = ['ALL', 'OPEN_NOW', 'UPCOMING', 'CLOSED', 'ALLOCATED'];

const PAGE_SIZE = 20; // 화면에 보이는 한 쪽 크기
const FETCH_SIZE = 100; // API 최대 크기 (명세 1.4)
const MAX_FETCH_PAGES = 10; // 최대 1,000건까지만 불러온다

/**
 * 공모주 목록 API에는 상태 필터가 없다. 탭 필터와 요약 건수를 정확히 맞추려고
 * 서버 페이지(100건씩)를 모두 받아 화면에서 20건씩 나눈다.
 */
async function fetchAllIpos(): Promise<{ items: IpoSummary[]; totalElements: number; truncated: boolean }> {
  const first = (await api.listIpos({ page: 0, size: FETCH_SIZE })).data;
  const byId = new Map<string, IpoSummary>(first.items.map((i) => [i.ipoId, i]));
  const last = Math.min(first.totalPages, MAX_FETCH_PAGES);
  for (let p = 1; p < last; p++) {
    // 받는 사이 새 종목이 등록돼 같은 종목이 두 번 오면 한 번만 둔다
    (await api.listIpos({ page: p, size: FETCH_SIZE })).data.items.forEach((i) => byId.set(i.ipoId, i));
  }
  return { items: [...byId.values()], totalElements: first.totalElements, truncated: first.totalPages > MAX_FETCH_PAGES };
}

/** 주소에 쓸 값: 전체 필터와 첫 쪽은 생략한다 */
function buildParams(filter: Filter, page: number): URLSearchParams {
  const p = new URLSearchParams();
  if (filter !== 'ALL') p.set('status', filter);
  if (page > 1) p.set('page', String(page));
  return p;
}

function dueText(ipo: IpoSummary, phase: IpoPhase, now: Date): { text: string; urgent: boolean } {
  switch (phase) {
    case 'OPEN_NOW': {
      const end = new Date(ipo.subscriptionEndAt);
      if (sameKstDay(now, end)) return { text: `오늘 ${kstCompact(ipo.subscriptionEndAt).slice(6)} 마감`, urgent: true };
      return { text: `마감까지 ${remaining(end.getTime() - now.getTime())}`, urgent: false };
    }
    case 'UPCOMING':
      return { text: `${kstCompact(ipo.subscriptionStartAt)} 시작`, urgent: false };
    default:
      return { text: `${kstCompact(ipo.subscriptionEndAt)} 마감`, urgent: false };
  }
}

export function IpoListPage() {
  const now = useNow(30_000);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  // 필터와 쪽 번호를 모두 주소에 둔다. 상태와 주소가 따로면 필터를 바꾼 렌더에서 옛 쪽 번호가 남아
  // 범위 보정이 새 이동을 덮어쓴다.
  const statusParam = params.get('status');
  const filter: Filter = FILTERS.includes(statusParam as Filter) ? (statusParam as Filter) : 'ALL';
  const ipos = useQuery({ queryKey: ['ipos'], queryFn: fetchAllIpos });
  const accounts = useAccounts();

  const rows = useMemo(
    () => (ipos.data?.items ?? []).map((ipo) => ({ ipo, phase: ipoPhase(ipo, now) })),
    [ipos.data, now],
  );
  const count = (f: Filter) => (f === 'ALL' ? rows.length : rows.filter((r) => r.phase === f).length);
  const filtered = rows.filter((r) => filter === 'ALL' || r.phase === filter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const wanted = parsePage(params.get('page'));
  const page = Math.min(wanted, totalPages);
  const shown = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // 주소의 page가 범위를 넘으면 마지막 쪽으로 맞춘다
  useEffect(() => {
    if (ipos.data && wanted !== page) setParams(buildParams(filter, page), { replace: true });
  }, [ipos.data, wanted, page, filter, setParams]);

  const goPage = (p: number) => {
    setParams(buildParams(filter, p));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const changeFilter = (f: Filter) => setParams(buildParams(f, 1), { replace: true }); // 필터를 바꾸면 첫 쪽부터

  const todayClosing = rows.filter((r) => r.phase === 'OPEN_NOW' && sameKstDay(now, new Date(r.ipo.subscriptionEndAt)));
  const cash = (accounts.data ?? []).reduce((s, a) => s + a.cashBalance, 0);
  const margin = (accounts.data ?? []).reduce((s, a) => s + a.marginBalance, 0);
  const loaded = !!ipos.data;

  return (
    <main className="main">
      <div className="page-top">
        <div>
          <p className="eyebrow">기준 {kstSeconds(now.toISOString()).slice(0, 11)} KST</p>
          <h1 className="display">공모주 청약</h1>
        </div>
      </div>

      <section className="tiles-scroll" aria-label="요약">
        <div className="tile" data-spot>
          <div className="tile-label">청약 중</div>
          <div className="tile-value">{loaded ? <Num value={count('OPEN_NOW')} fromZero /> : '-'}<span className="unit">종목</span></div>
        </div>
        <div className="tile" data-spot>
          <div className="tile-label">오늘 마감</div>
          <div className={`tile-value${todayClosing.length ? ' warn' : ''}`}>{loaded ? <Num value={todayClosing.length} fromZero /> : '-'}<span className="unit">종목</span></div>
        </div>
        <div className="tile" data-spot>
          <div className="tile-label">청약 예정</div>
          <div className="tile-value">{loaded ? <Num value={count('UPCOMING')} fromZero /> : '-'}<span className="unit">종목</span></div>
        </div>
        <div className="tile" data-spot>
          <div className="tile-label">예수금</div>
          <div className="tile-value">{accounts.data ? <Num value={cash} fromZero /> : '-'}<span className="unit">원</span></div>
        </div>
        <div className="tile" data-spot>
          <div className="tile-label">
            청약증거금 {accounts.data && <Link to="/accounts" className="small" style={{ textDecoration: 'none', fontWeight: 600 }}>계좌 {accounts.data.length}개</Link>}
          </div>
          <div className="tile-value">{accounts.data ? <Num value={margin} fromZero /> : '-'}<span className="unit">원</span></div>
        </div>
      </section>

      <div className="toolbar">
        <Seg label="상태 필터" value={filter} onChange={changeFilter}
          items={FILTERS.map((f) => ({ key: f, label: f === 'ALL' ? '전체' : IPO_PHASE_LABEL[f], count: count(f) }))} />
      </div>

      {ipos.isPending ? (
        <Loading rows={5} height={84} />
      ) : ipos.isError ? (
        <div className="card"><QueryError error={ipos.error} onRetry={() => void ipos.refetch()} /></div>
      ) : (
        <>
          <div className="ipo-head" aria-hidden="true">
            <div>종목</div><div>공모가</div><div>일반청약 물량</div><div>청약 기간 (KST)</div><div>일정</div><div />
          </div>
          <div className="ipo-list">
            {shown.map(({ ipo, phase }, i) => {
              const due = dueText(ipo, phase, now);
              const open = phase === 'OPEN_NOW';
              return (
                <article key={ipo.ipoId} className="ipo-row rise" data-spot style={stagger(i)} onClick={() => navigate(`/ipos/${ipo.ipoId}`)}>
                  <div className="ipo-name">
                    <span className="ipo-title">{ipo.name}</span>
                    <PhaseChip phase={phase} />
                  </div>
                  <div className="cell" data-label="공모가"><span className="tnum">{won(ipo.offerPrice)}</span><span className="unit">원</span></div>
                  <div className="cell" data-label="일반청약 물량"><span className="tnum">{won(ipo.retailQuantity)}</span><span className="unit">주</span></div>
                  <div className="cell cell-period" data-label="청약 기간">{kstCompact(ipo.subscriptionStartAt)} — {kstCompact(ipo.subscriptionEndAt)}</div>
                  <div className={`cell cell-due${due.urgent ? ' urgent' : ''}`} data-label="일정">{due.text}</div>
                  <div className="ipo-cta">
                    <Link to={`/ipos/${ipo.ipoId}`} className={`btn btn-sm ${open ? 'btn-primary' : 'btn-soft'}`} onClick={(e) => e.stopPropagation()}>
                      {open ? '청약하기' : '상세'} <IconArrow size={16} />
                    </Link>
                  </div>
                </article>
              );
            })}
            {shown.length === 0 && <div className="card empty">해당 상태의 공모주가 없습니다.</div>}
          </div>
          <Pagination page={page} totalPages={totalPages} totalElements={filtered.length} pageSize={PAGE_SIZE} onChange={goPage} />
        </>
      )}

      {ipos.data?.truncated && (
        <p className="alert alert-quiet" style={{ marginTop: 16 }}>
          공모주가 {won(ipos.data.totalElements)}건이라 최신 {won(MAX_FETCH_PAGES * FETCH_SIZE)}건만 불러왔습니다.
        </p>
      )}
      <p className="muted small" style={{ marginTop: 20 }}>
        마감 판단은 게이트웨이 도착 시각 기준입니다. 상태가 청약 중이어도 시작 전이거나 마감 시각이 지나면 청약할 수 없습니다.
      </p>
    </main>
  );
}
