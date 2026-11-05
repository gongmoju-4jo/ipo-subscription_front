import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import * as api from '../api/endpoints';
import type { Ipo, Subscription } from '../api/types';
import { PhaseChip } from '../components/Chips';
import { IconArrow, IconBack, IconCheck, IconClose, IconMinus, IconPlus, IconSpinner } from '../components/Icons';
import { Num } from '../components/Num';
import { Loading, QueryError } from '../components/QueryState';
import { Sheet } from '../components/Sheet';
import { CANCEL_REASON_LABEL, ipoPhase, IN_FLIGHT, IPO_PHASE_LABEL, REJECT_REASON_LABEL, requiredMargin } from '../lib/domain';
import { accountNo, kstCompact, kstShort, localDateShort, remaining, won } from '../lib/format';
import { UUID_PATTERN } from '../lib/requestId';
import { useIsCompact } from '../lib/useMediaQuery';
import { useNow } from '../lib/useNow';
import { useRequestId } from '../lib/useRequestId';
import { useSingleFlight } from '../lib/useSingleFlight';
import { ACCOUNTS_KEY, useAccounts } from './AccountsPage';

const POLL_MS = 1500;
const POLL_MAX = 40; // 약 60초. 그 뒤에는 내 청약에서 확인하도록 안내

interface Accepted { subscriptionId: string; accountId: string; quantity: number }

export function IpoDetailPage() {
  const { ipoId = '' } = useParams();
  const validId = UUID_PATTERN.test(ipoId);
  const ipoQuery = useQuery({
    queryKey: ['ipo', ipoId],
    queryFn: async () => (await api.getIpo(ipoId)).data,
    enabled: validId,
  });

  return (
    <main className="main">
      <nav aria-label="경로" style={{ marginBottom: 12 }}>
        <Link to="/ipos" className="btn btn-ghost btn-sm" style={{ marginLeft: -12 }}><IconBack size={16} /> 공모주</Link>
      </nav>
      {!validId ? (
        <div className="alert alert-warn" role="alert">공모주 ID 형식이 올바르지 않습니다.</div>
      ) : ipoQuery.isPending ? (
        <Loading rows={3} height={110} />
      ) : ipoQuery.isError ? (
        <QueryError error={ipoQuery.error} onRetry={() => void ipoQuery.refetch()} />
      ) : (
        <IpoDetail ipo={ipoQuery.data} />
      )}
    </main>
  );
}

function IpoDetail({ ipo }: { ipo: Ipo }) {
  const now = useNow(1000);
  const phase = ipoPhase(ipo, now);
  const compact = useIsCompact();
  const [accepted, setAccepted] = useState<Accepted | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  // 좁은 화면에서는 하단 청약 바가 아래를 차지하므로 하단 탭 바를 숨긴다
  useEffect(() => {
    if (!compact) return;
    document.body.dataset.cta = '1';
    return () => { delete document.body.dataset.cta; };
  }, [compact]);

  const start = Date.parse(ipo.subscriptionStartAt);
  const end = Date.parse(ipo.subscriptionEndAt);
  const pct = Math.max(0, Math.min(100, ((now.getTime() - start) / (end - start)) * 100));
  const refundAt = Date.parse(`${ipo.refundDate}T00:00:00+09:00`);
  const steps = [
    { k: '청약 시작', v: kstShort(ipo.subscriptionStartAt), done: now.getTime() >= start },
    { k: '청약 마감', v: kstShort(ipo.subscriptionEndAt), done: now.getTime() >= end },
    { k: '배정', v: ipo.status === 'ALLOCATED' ? '완료' : '마감 후 자동', done: ipo.status === 'ALLOCATED' },
    { k: '환불 예정일', v: localDateShort(ipo.refundDate), done: now.getTime() >= refundAt },
  ];
  const currentStep = steps.findIndex((s) => !s.done);

  const open = phase === 'OPEN_NOW';
  const minMargin = requiredMargin(ipo.minQuantity, ipo.offerPrice, ipo.marginRate);
  const panelContent = accepted
    ? <AcceptedPanel ipo={ipo} accepted={accepted} />
    : <SubscribeForm ipo={ipo} phase={phase} onAccepted={setAccepted} />;

  return (
    <div className="split">
      <section className="grow stack" style={{ gap: 24 }}>
        <div>
          <div className="detail-hero">
            <div className="stack" style={{ gap: 12, alignItems: 'flex-start' }}>
              <PhaseChip phase={phase} />
              <h1 className="display">{ipo.name}</h1>
            </div>
            {open && (
              <div className="countdown">
                <div className="eyebrow">마감까지</div>
                <div className="v">{remaining(end - now.getTime())}</div>
              </div>
            )}
          </div>
          <div className="progress">
            <div className="progress-track" role="progressbar" aria-label="청약 기간 경과" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="progress-meta"><span>{kstCompact(ipo.subscriptionStartAt)}</span><span>{Math.round(pct)}%</span><span>{kstCompact(ipo.subscriptionEndAt)}</span></div>
          </div>
        </div>

        <div className="tiles">
          <div className="tile tile-lg" data-spot><div className="tile-label">공모가</div><div className="tile-value"><Num value={ipo.offerPrice} fromZero /><span className="unit">원</span></div></div>
          <div className="tile tile-lg" data-spot><div className="tile-label">일반청약 물량</div><div className="tile-value"><Num value={ipo.retailQuantity} fromZero /><span className="unit">주</span></div></div>
          <div className="tile tile-lg" data-spot><div className="tile-label">균등배정 물량</div><div className="tile-value"><Num value={ipo.equalQuantity} fromZero /><span className="unit">주</span></div></div>
        </div>

        <div className="card" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>일정 <span className="muted" style={{ fontWeight: 400, fontSize: 13 }}>KST</span></h2>
          <ol className="timeline">
            {steps.map((s, i) => (
              <li key={s.k} className={`tl${s.done ? ' done' : i === currentStep ? ' now' : ''}`}>
                <div className="k">{s.k}</div>
                <div className="v">{s.v}</div>
              </li>
            ))}
          </ol>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <h2 className="section-title">청약 조건</h2>
          <dl className="rows">
            <div><dt>최소 청약 수량</dt><dd>{won(ipo.minQuantity)} 주</dd></div>
            <div><dt>청약 한도 (1인)</dt><dd>{won(ipo.maxQuantity)} 주</dd></div>
            <div><dt>증거금률</dt><dd>{Math.round(ipo.marginRate * 100)} %</dd></div>
          </dl>
          <div className="explain">
            <div><b>균등배정</b>최소 수량 이상 신청한 청약에 금액과 관계없이 똑같이 나눕니다. 대상이 물량보다 많으면 추첨합니다.</div>
            <div><b>비례배정</b>나머지 물량을 신청 수량에 비례해 나눕니다. 1주 미만 끝수는 소수점이 큰 청약부터 1주씩 배정합니다.</div>
          </div>
        </div>
      </section>

      {compact ? (
        <>
          {/* 페이지 진입 애니메이션(transform) 안에 두면 fixed 기준이 화면이 아니라 페이지가 되어 튀므로 body로 옮긴다 */}
          {createPortal(
            <div className="cta-bar" inert={sheetOpen ? true : undefined}>
              <div className="cta-bar-inner">
                <div className="sum">
                  {accepted ? (<><b>청약이 접수됐어요</b><span>결과를 확인해 보세요</span></>)
                    : open ? (<><b>{won(ipo.offerPrice)}원</b><span>최소 {won(ipo.minQuantity)}주 · {won(minMargin)}원부터</span></>)
                    : (<><b>{IPO_PHASE_LABEL[phase]}</b><span>지금은 청약할 수 있는 시간이 아닙니다</span></>)}
                </div>
                <button type="button" className="btn btn-primary btn-lg" data-magnetic disabled={!accepted && !open} onClick={() => setSheetOpen(true)}>
                  {accepted ? '결과 보기' : '청약하기'}
                </button>
              </div>
            </div>,
            document.body,
          )}
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} label="청약 신청">
            <div className="panel">{panelContent}</div>
          </Sheet>
        </>
      ) : (
        <aside className="side sticky">
          <div className="panel">{panelContent}</div>
        </aside>
      )}
    </div>
  );
}

function SubscribeForm({ ipo, phase, onAccepted }: {
  ipo: Ipo;
  phase: ReturnType<typeof ipoPhase>;
  onAccepted: (a: Accepted) => void;
}) {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const items = accounts.data ?? [];
  const [accountId, setAccountId] = useState<string | null>(null);
  const [qtyText, setQtyText] = useState(String(ipo.minQuantity));

  const account = items.find((a) => a.accountId === accountId) ?? items[0] ?? null;

  const raw = qtyText.replace(/,/g, '').trim();
  const qty = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const margin = Number.isSafeInteger(qty) ? requiredMargin(qty, ipo.offerPrice, ipo.marginRate) : 0;

  let qtyError = '';
  if (!Number.isSafeInteger(qty)) qtyError = '청약 수량을 숫자로 입력하세요.';
  else if (qty < ipo.minQuantity) qtyError = `최소 ${won(ipo.minQuantity)}주부터 청약할 수 있습니다.`;
  else if (qty > ipo.maxQuantity) qtyError = `1인 청약 한도는 ${won(ipo.maxQuantity)}주입니다.`;

  const cash = account?.cashBalance ?? 0;
  const short = !qtyError && account !== null && margin > cash;
  const closed = phase !== 'OPEN_NOW';
  const invalid = closed || account === null || !!qtyError || short;

  // 수량, 계좌가 같으면 같은 requestId (연타, 타임아웃 뒤 재시도). 바뀌면 새 값
  const [requestId, renew] = useRequestId(`sub:${ipo.ipoId}:${account?.accountId ?? ''}:${qty}`);

  const mut = useMutation({
    mutationFn: () => api.createSubscription({ requestId, ipoId: ipo.ipoId, accountId: account!.accountId, requestedQuantity: qty }),
    onSuccess: (res) => {
      renew();
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
      onAccepted({ subscriptionId: res.data.subscriptionId, accountId: account!.accountId, quantity: qty });
    },
  });

  const flight = useSingleFlight();
  function submit(e: FormEvent) {
    e.preventDefault();
    if (invalid) return;
    void flight(() => mut.mutateAsync().catch(() => undefined)); // 오류는 mutation 상태로 표시한다
  }

  const submitError = mut.error instanceof ApiError ? mut.error : null;
  const setQty = (n: number) => { setQtyText(String(Math.max(0, n))); mut.reset(); };
  const cur = Number.isSafeInteger(qty) ? qty : 0;
  const maxAfford = account ? Math.min(ipo.maxQuantity, Math.floor(cash / (ipo.offerPrice * ipo.marginRate))) : 0;

  return (
    <form onSubmit={submit}>
      <div className="panel-head" style={{ paddingRight: 64 }}>
        <h2>청약 신청</h2>
        <p>같은 종목은 1인 1건 (다른 계좌 포함)</p>
      </div>

      <fieldset className="block">
        <legend className="label">청약 계좌</legend>
        {accounts.isPending ? (
          <Loading rows={2} height={60} />
        ) : accounts.isError ? (
          <QueryError error={accounts.error} onRetry={() => void accounts.refetch()} />
        ) : items.length === 0 ? (
          <p className="alert alert-warn">계좌가 없습니다. <Link to="/accounts">계좌 개설하러 가기 →</Link></p>
        ) : (
          <div className="stack" style={{ gap: 8 }}>
            {items.map((a) => (
              <button key={a.accountId} type="button" className="pick" aria-pressed={a.accountId === account?.accountId}
                onClick={() => { setAccountId(a.accountId); mut.reset(); }}>
                <span className="stack" style={{ alignItems: 'flex-start', gap: 2 }}>
                  <span className="tnum" style={{ fontWeight: 650 }}>{accountNo(a.accountNumber)}</span>
                  <span className="muted small">예수금 {won(a.cashBalance)}원</span>
                </span>
                <span className="radio"><IconCheck size={14} strokeWidth={3} /></span>
              </button>
            ))}
          </div>
        )}
      </fieldset>

      <div className="block">
        <label htmlFor="qty" className="label">청약 수량</label>
        <div className="amount">
          <button type="button" className="step-btn" aria-label="10주 줄이기" onClick={() => setQty(cur - 10)}><IconMinus size={18} /></button>
          <input id="qty" inputMode="numeric" value={qtyText} onChange={(e) => { setQtyText(e.target.value); mut.reset(); }} />
          <span className="suffix">주</span>
          <button type="button" className="step-btn" aria-label="10주 늘리기" onClick={() => setQty(cur + 10)}><IconPlus size={18} /></button>
        </div>
        <div className="quick" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setQty(ipo.minQuantity)}>최소</button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setQty(cur + 100)}>+100</button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setQty(cur + 1000)}>+1,000</button>
          <button type="button" className="btn btn-soft btn-sm" onClick={() => setQty(maxAfford)}>가능 최대</button>
        </div>
        {qtyError && <p role="alert" className="help bad">{qtyError}</p>}
        {!qtyError && !short && account && <p className="help" style={{ color: 'var(--accent-ink)' }}>균등배정 대상입니다.</p>}
      </div>

      <dl className="block receipt">
        <div className="kv"><dt>청약 금액</dt><dd><Num value={margin} duration={350} /> 원</dd></div>
        <div className="kv"><dt>필요 증거금 ({Math.round(ipo.marginRate * 100)}%)</dt><dd><Num value={margin} duration={350} /> 원</dd></div>
        <div className="kv total">
          <dt>청약 후 예수금</dt>
          <dd style={short ? { color: 'var(--warn)' } : undefined}>{account ? <Num value={cash - margin} duration={350} /> : '-'} 원</dd>
        </div>
      </dl>

      {(short || closed || submitError) && (
        <div className="block stack" style={{ gap: 10 }}>
          {short && <Link to="/accounts" className="alert alert-warn" style={{ textDecoration: 'none' }}>예수금이 {won(margin - cash)}원 부족합니다. 입금하러 가기 →</Link>}
          {closed && <p className="alert alert-quiet">지금은 청약할 수 있는 시간이 아닙니다.</p>}
          {submitError && (
            <p role="alert" className="alert alert-warn">
              {submitError.fieldError('requestedQuantity') ?? submitError.message}
              {submitError.retryable && ' 같은 내용으로 다시 누르면 중복 접수되지 않습니다.'}
            </p>
          )}
        </div>
      )}

      <div className="block">
        <button type="submit" className="btn btn-primary btn-lg btn-block" data-magnetic disabled={invalid || mut.isPending}>
          {mut.isPending ? <><IconSpinner size={18} /> 접수 중</> : <>{won(margin)}원 청약하기 <IconArrow size={18} /></>}
        </button>
        <p className="muted small" style={{ marginTop: 10 }}>신청하면 필요 증거금이 예수금에서 청약증거금으로 옮겨집니다.</p>
      </div>
    </form>
  );
}

/** 202 접수 뒤 상태 조회. 접수 직후에는 404일 수 있어 최종 거절로 보지 않고 다시 조회한다 (명세 3.4) */
function AcceptedPanel({ ipo, accepted }: { ipo: Ipo; accepted: Accepted }) {
  const queryClient = useQueryClient();
  const accounts = useAccounts();
  const account = accounts.data?.find((a) => a.accountId === accepted.accountId);

  const polls = useRef(0); // 조회 횟수. 너무 오래 걸리면 폴링을 멈추고 안내한다
  const sub = useQuery({
    queryKey: ['subscription', accepted.subscriptionId],
    queryFn: async (): Promise<Subscription | null> => {
      polls.current += 1;
      try {
        return (await api.getSubscription(accepted.subscriptionId)).data;
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null; // 아직 저장 전
        throw e;
      }
    },
    retry: false,
    refetchInterval: (q) => {
      const d = q.state.data;
      const inFlight = d === null || d === undefined || IN_FLIGHT.includes(d.status);
      return inFlight && polls.current < POLL_MAX ? POLL_MS : false;
    },
  });

  const status = sub.data?.status;
  const settled = status !== undefined && !IN_FLIGHT.includes(status);
  const gaveUp = !settled && polls.current >= POLL_MAX;
  const failed = status === 'REJECTED' || status === 'CANCELLED' || status === 'COMPENSATING';

  // 확정, 거절로 바뀌면 잔고가 달라지므로 계좌를 다시 불러온다
  useEffect(() => {
    if (settled) {
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
      void queryClient.invalidateQueries({ queryKey: ['subscriptions'] });
    }
  }, [settled, queryClient]);

  const margin = sub.data?.marginAmount ?? requiredMargin(accepted.quantity, ipo.offerPrice, ipo.marginRate);
  const headline = useMemo(() => {
    if (status === 'CONFIRMED') return '청약이 확정됐어요';
    if (status === 'REJECTED') return '청약이 거절됐어요';
    if (status === 'CANCELLED' || status === 'COMPENSATING') return '청약이 취소됐어요';
    return '청약이 접수됐어요';
  }, [status]);

  return (
    <div className="block stack" style={{ gap: 22, paddingTop: 32, paddingBottom: 26 }}>
      <div className="stack" style={{ gap: 16, alignItems: 'flex-start' }}>
        {status === 'CONFIRMED' && (
          <div className="big-check"><svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></div>
        )}
        {failed && <div className="big-x"><IconClose size={28} strokeWidth={3} /></div>}
        {!settled && <div className="big-wait"><IconSpinner size={30} /></div>}
        <div>
          <p className="eyebrow mono">{settled ? status : '202 ACCEPTED'}</p>
          <h2 style={{ marginTop: 4, fontSize: 26, fontWeight: 750, letterSpacing: '-0.03em' }}>{headline}</h2>
          <p className="muted" style={{ marginTop: 6, fontSize: 14 }}>
            {settled ? '' : gaveUp ? '처리가 평소보다 오래 걸립니다. 내 청약에서 확인해 주세요.' : '증거금 인출이 끝나면 확정 또는 거절로 바뀝니다. 보통 몇 초 걸립니다.'}
          </p>
        </div>
      </div>

      <ol className="flow">
        <li><b>접수됨</b> <span className="muted small mono">ACCEPTED</span></li>
        <li className={status === 'CONFIRMED' ? '' : failed ? 'bad' : 'wait'}>
          {status === 'CONFIRMED' && (<><b style={{ color: 'var(--accent-ink)' }}>확정</b> <span className="muted small mono">CONFIRMED</span><div className="muted small">증거금 {won(margin)}원 인출 완료</div></>)}
          {status === 'REJECTED' && (<div className="alert alert-warn">{sub.data?.rejectReason ? REJECT_REASON_LABEL[sub.data.rejectReason] : '거절됐습니다.'}<br />증거금을 옮기기 전에 실패해 빠져나간 돈은 없습니다.</div>)}
          {(status === 'CANCELLED' || status === 'COMPENSATING') && (<div className="alert alert-quiet">{sub.data?.cancelReason ? CANCEL_REASON_LABEL[sub.data.cancelReason] : '취소됐습니다.'}</div>)}
          {!settled && <span className="muted">{gaveUp ? '확인 지연' : '증거금 인출 중…'}</span>}
        </li>
      </ol>

      <dl className="receipt" style={{ paddingTop: 16, borderTop: '1px solid var(--line)' }}>
        <div className="kv"><dt>청약 수량</dt><dd>{won(accepted.quantity)} 주</dd></div>
        <div className="kv"><dt>계좌</dt><dd>{account ? accountNo(account.accountNumber) : '-'}</dd></div>
      </dl>
      <Link to={`/subscriptions?id=${accepted.subscriptionId}`} className="btn btn-ink btn-lg btn-block" data-magnetic>내 청약에서 보기 <IconArrow size={18} /></Link>
      <Link to="/ipos" className="btn btn-ghost btn-block">공모주 목록으로</Link>
    </div>
  );
}
