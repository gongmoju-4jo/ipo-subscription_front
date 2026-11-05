import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/client';
import * as api from '../api/endpoints';
import { IconPlus, IconSpinner } from '../components/Icons';
import { Num } from '../components/Num';
import { Loading, QueryError } from '../components/QueryState';
import { useToast } from '../components/Toast';
import { accountNo, kstDate, won } from '../lib/format';
import { stagger } from '../lib/ui';
import { useRequestId } from '../lib/useRequestId';
import { useSingleFlight } from '../lib/useSingleFlight';

export const ACCOUNTS_KEY = ['accounts'] as const;

/** 내 계좌 전체 (최대 100개). 청약 화면의 계좌 선택에도 쓴다 */
export function useAccounts() {
  return useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async () => (await api.listAccounts({ page: 0, size: 100 })).data.items,
  });
}

export function AccountsPage() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const accounts = useAccounts();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [amountText, setAmountText] = useState('');

  const items = accounts.data ?? [];
  const selected = items.find((a) => a.accountId === selectedId) ?? items[0] ?? null;

  useEffect(() => {
    if (!selectedId && items[0]) setSelectedId(items[0].accountId);
  }, [items, selectedId]);

  // 입금액: 쉼표 제거 뒤 1 이상의 정수만 (명세: 1 이상의 정수, 1회 상한은 미정이라 막지 않는다)
  const raw = amountText.replace(/,/g, '').trim();
  const amount = /^\d+$/.test(raw) ? Number(raw) : NaN;
  const amountError =
    raw === '' ? null
    : !Number.isSafeInteger(amount) || amount < 1 ? '1원 이상의 정수로 입력하세요.'
    : null;
  const canDeposit = selected !== null && raw !== '' && amountError === null;

  // 같은 계좌, 같은 금액이면 같은 requestId (연타, 재시도), 바뀌면 새 값
  const [depositRid, renewDeposit] = useRequestId(`deposit:${selected?.accountId ?? ''}:${raw}`);
  const [openRid, renewOpen] = useRequestId('open-account');

  const depositMut = useMutation({
    mutationFn: () => api.deposit(selected!.accountId, { requestId: depositRid, amount }),
    onSuccess: (res) => {
      toast.show(
        res.status === 200
          ? `이미 처리된 입금입니다 · 예수금 ${won(res.data.cashBalance)}원`
          : `${won(res.data.amount)}원을 입금했습니다`,
      );
      setAmountText('');
      renewDeposit();
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });

  const openMut = useMutation({
    mutationFn: () => api.openAccount(openRid),
    onSuccess: (res) => {
      toast.show(
        res.status === 200
          ? `이미 개설된 계좌입니다 · ${accountNo(res.data.accountNumber)}`
          : `계좌 ${accountNo(res.data.accountNumber)}을(를) 개설했습니다`,
      );
      setSelectedId(res.data.accountId);
      renewOpen();
      void queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY });
    },
  });

  const totals = useMemo(
    () => items.reduce((t, a) => ({ cash: t.cash + a.cashBalance, margin: t.margin + a.marginBalance }), { cash: 0, margin: 0 }),
    [items],
  );

  function addAmount(n: number) {
    const base = Number.isSafeInteger(amount) ? amount : 0;
    setAmountText(won(base + n));
    depositMut.reset();
  }

  const depositFlight = useSingleFlight();
  const openFlight = useSingleFlight();

  function onDeposit(e: FormEvent) {
    e.preventDefault();
    if (!canDeposit) return;
    void depositFlight(() => depositMut.mutateAsync().catch(() => undefined)); // 오류는 mutation 상태로 표시한다
  }

  const depositError = depositMut.error instanceof ApiError ? depositMut.error : null;
  const openError = openMut.error instanceof ApiError ? openMut.error : null;

  return (
    <main className="main">
      <div className="page-top">
        <div>
          <p className="eyebrow">계좌</p>
          <h1 className="display">내 계좌</h1>
        </div>
        <button type="button" className="btn btn-ink" data-magnetic disabled={openMut.isPending}
          onClick={() => void openFlight(() => openMut.mutateAsync().catch(() => undefined))}>
          {openMut.isPending ? <IconSpinner size={16} /> : <IconPlus size={16} />} 계좌 개설
        </button>
      </div>
      {openError && <p role="alert" className="alert alert-warn" style={{ marginBottom: 16 }}>{openError.message}</p>}

      <div className="tiles">
        <div className="tile" data-spot><div className="tile-label">예수금 합계</div><div className="tile-value"><Num value={totals.cash} fromZero /><span className="unit">원</span></div></div>
        <div className="tile" data-spot><div className="tile-label">청약증거금 합계</div><div className="tile-value"><Num value={totals.margin} fromZero /><span className="unit">원</span></div></div>
        <div className="tile" data-spot><div className="tile-label">전체</div><div className="tile-value"><Num value={totals.cash + totals.margin} fromZero /><span className="unit">원</span></div></div>
      </div>

      <div className="split" style={{ marginTop: 36 }}>
        <section className="grow" aria-label="계좌 목록">
          {accounts.isPending ? (
            <Loading rows={2} height={150} />
          ) : accounts.isError ? (
            <QueryError error={accounts.error} onRetry={() => void accounts.refetch()} />
          ) : items.length === 0 ? (
            <div className="card empty">개설된 계좌가 없습니다.<br />계좌를 개설한 뒤 입금해 청약을 시작하세요.</div>
          ) : (
            <>
              <div className="account-grid">
                {items.map((a, i) => (
                  <button key={a.accountId} type="button" className="account-card rise" data-spot style={stagger(i)}
                    aria-pressed={a.accountId === selected?.accountId}
                    onClick={() => { setSelectedId(a.accountId); depositMut.reset(); }}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <span className="no">{accountNo(a.accountNumber)}</span>
                      <span className="tag">선택됨</span>
                    </span>
                    <span className="muted small" style={{ display: 'block', marginTop: 20 }}>예수금</span>
                    <span className="cash" style={{ display: 'block' }}><Num value={a.cashBalance} fromZero /><span className="unit">원</span></span>
                    <span className="meta"><span>청약증거금 <span className="tnum">{won(a.marginBalance)}</span>원</span><span>개설 {kstDate(a.createdAt)}</span></span>
                  </button>
                ))}
              </div>
              <p className="muted small" style={{ marginTop: 16 }}>
                청약증거금은 청약에 잡혀 있는 금액입니다. 배정 후 배정 대금만큼 정산되고 나머지는 예수금으로 환불됩니다.
              </p>
            </>
          )}
        </section>

        <aside className="side sticky">
          <form className="panel" onSubmit={onDeposit}>
            <div className="panel-head">
              <h2>입금</h2>
              <p className="tnum">{selected ? accountNo(selected.accountNumber) : '계좌를 선택하세요'}</p>
            </div>
            <div className="block">
              <label htmlFor="amt" className="label">입금액</label>
              <div className="amount">
                <input id="amt" inputMode="numeric" placeholder="0" value={amountText}
                  onChange={(e) => { setAmountText(e.target.value); depositMut.reset(); }} />
                <span className="suffix">원</span>
              </div>
              <div className="quick" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => addAmount(100_000)}>+10만</button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => addAmount(1_000_000)}>+100만</button>
                <button type="button" className="btn btn-soft btn-sm" onClick={() => addAmount(10_000_000)}>+1,000만</button>
              </div>
              {amountError && <p role="alert" className="help bad">{amountError}</p>}
              {depositError && (
                <p role="alert" className="help bad">
                  {depositError.code === 'DUPLICATE_RESOURCE'
                    ? '같은 요청 ID로 다른 금액이나 계좌가 전송됐습니다. 금액을 다시 입력해 주세요.'
                    : depositError.message}
                </p>
              )}
            </div>
            <dl className="block receipt">
              <div className="kv"><dt>현재 예수금</dt><dd>{selected ? won(selected.cashBalance) : '-'} 원</dd></div>
              <div className="kv total"><dt>입금 후 예수금</dt><dd>{selected && canDeposit ? <><Num value={selected.cashBalance + amount} duration={350} /> 원</> : '-'}</dd></div>
            </dl>
            <div className="block">
              <button type="submit" className="btn btn-primary btn-lg btn-block" data-magnetic disabled={!canDeposit || depositMut.isPending}>
                {depositMut.isPending ? <><IconSpinner size={18} /> 입금 중</> : '입금하기'}
              </button>
              <p className="muted small" style={{ marginTop: 10 }}>가상 계좌 입금입니다. 실제 돈은 오가지 않습니다.</p>
            </div>
          </form>
        </aside>
      </div>
    </main>
  );
}
