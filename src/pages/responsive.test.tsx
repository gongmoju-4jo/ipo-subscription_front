// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/endpoints', () => ({
  listSubscriptions: vi.fn(),
  getSubscription: vi.fn(),
  getAllocation: vi.fn(),
  listAccounts: vi.fn(),
  getIpo: vi.fn(),
}));
import * as api from '../api/endpoints';
import { stubViewport } from '../test/matchMedia';
import { IpoDetailPage } from './IpoDetailPage';
import { SubscriptionsPage } from './SubscriptionsPage';

const IPO_ID = '8b2d0000-0000-4000-8000-000000000001';
const SUB_A = '74b6514c-c1eb-3837-968b-8425f63cb692';
const SUB_B = 'e8bd1887-fe8e-378c-8f04-13d9d406e984';
const ACCOUNT_ID = '9d4e0000-0000-4000-8000-000000000002';

const sub = (id: string, name: string) => ({
  subscriptionId: id, requestId: id, ipoId: IPO_ID, ipoName: name, accountId: ACCOUNT_ID,
  requestedQuantity: 100, marginAmount: 1_500_000, status: 'CONFIRMED',
  rejectReason: null, cancelReason: null, allocatedQuantity: null, allocatedAmount: null, refundAmount: null,
  receivedAt: '2026-11-03T10:00:00+09:00', confirmedAt: '2026-11-03T10:00:02+09:00',
});

function renderRoutes(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/subscriptions" element={<SubscriptionsPage />} />
          <Route path="/ipos/:ipoId" element={<IpoDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  window.scrollTo = vi.fn();
  vi.mocked(api.listAccounts).mockResolvedValue({
    status: 200,
    data: { items: [{ accountId: ACCOUNT_ID, accountNumber: '483920175364', cashBalance: 2_000_000, marginBalance: 0, createdAt: '2026-11-03T10:05:00+09:00' }], page: 0, size: 100, totalElements: 1, totalPages: 1 },
  } as never);
  vi.mocked(api.listSubscriptions).mockResolvedValue({
    status: 200,
    data: { items: [sub(SUB_A, '종목 가'), sub(SUB_B, '종목 나')], page: 0, size: 20, totalElements: 2, totalPages: 1 },
  } as never);
  vi.mocked(api.getSubscription).mockImplementation((async (id: string) => ({ status: 200, data: sub(id, id === SUB_A ? '종목 가' : '종목 나') })) as never);
  vi.mocked(api.getIpo).mockResolvedValue({
    status: 200,
    data: {
      ipoId: IPO_ID, name: '종목 가', offerPrice: 15000, retailQuantity: 100000, equalQuantity: 50000, minQuantity: 10, maxQuantity: 10000,
      marginRate: 1, subscriptionStartAt: '2026-01-01T00:00:00+09:00', subscriptionEndAt: '2099-01-01T00:00:00+09:00', refundDate: '2099-01-03', status: 'OPEN',
    },
  } as never);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('내 청약: 화면 크기에 따라 구성이 달라진다', () => {
  it('넓은 화면은 목록과 상세가 나란히, 첫 청약이 기본 선택된다', async () => {
    stubViewport(false);
    renderRoutes('/subscriptions');
    expect(await screen.findByRole('region', { name: '청약 목록' })).toBeTruthy();
    expect(await screen.findByRole('region', { name: '청약 상세' })).toBeTruthy();
    await waitFor(() => expect(vi.mocked(api.getSubscription)).toHaveBeenCalledWith(SUB_A));
    expect(screen.queryByRole('button', { name: /내 청약/ })).toBeNull(); // 뒤로 가기 없음
  });

  it('좁은 화면에서 선택이 없으면 목록만 보인다 (상세는 요청하지도 않는다)', async () => {
    stubViewport(true);
    renderRoutes('/subscriptions');
    expect(await screen.findByRole('region', { name: '청약 목록' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '청약 상세' })).toBeNull();
    expect(vi.mocked(api.getSubscription)).not.toHaveBeenCalled();
  });

  it('좁은 화면에서 목록 항목을 누르면 상세 화면으로 바뀌고, 뒤로 가기로 목록에 돌아온다', async () => {
    stubViewport(true);
    renderRoutes('/subscriptions');
    fireEvent.click(await screen.findByRole('button', { name: /종목 나/ }));

    expect(await screen.findByRole('region', { name: '청약 상세' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '청약 목록' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /내 청약/ }));
    expect(await screen.findByRole('region', { name: '청약 목록' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '청약 상세' })).toBeNull();
  });

  it('좁은 화면에서 주소에 id가 있으면(접수 직후 이동) 바로 상세가 보인다', async () => {
    stubViewport(true);
    renderRoutes(`/subscriptions?id=${SUB_B}`);
    expect(await screen.findByRole('region', { name: '청약 상세' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '청약 목록' })).toBeNull();
    await waitFor(() => expect(vi.mocked(api.getSubscription)).toHaveBeenCalledWith(SUB_B));
  });
});

describe('종목 상세: 청약 입력이 화면 크기에 따라 패널 또는 하단 시트가 된다', () => {
  it('넓은 화면은 옆 패널에 바로 입력 폼이 있다 (시트, 하단 바 없음)', async () => {
    stubViewport(false);
    renderRoutes(`/ipos/${IPO_ID}`);
    expect(await screen.findByRole('heading', { name: '청약 신청' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.querySelector('.cta-bar')).toBeNull();
  });

  it('좁은 화면은 하단 청약 바만 있고, 누르면 시트가 열리고 Esc로 닫힌다', async () => {
    stubViewport(true);
    renderRoutes(`/ipos/${IPO_ID}`);

    const cta = await screen.findByRole('button', { name: '청약하기' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('heading', { name: '청약 신청' })).toBeNull(); // 폼은 시트 안에만 있다
    expect(document.body.dataset.cta).toBe('1'); // 하단 탭 바를 숨기는 표시

    fireEvent.click(cta);
    const dialog = await screen.findByRole('dialog', { name: '청약 신청' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(await screen.findByRole('heading', { name: '청약 신청' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull(), { timeout: 1500 });
  });

  it('화면을 벗어나면(언마운트) 하단 탭 바 숨김 표시가 지워진다', async () => {
    stubViewport(true);
    const view = renderRoutes(`/ipos/${IPO_ID}`);
    await screen.findByRole('button', { name: '청약하기' });
    expect(document.body.dataset.cta).toBe('1');
    view.unmount();
    expect(document.body.dataset.cta).toBeUndefined();
  });
});
