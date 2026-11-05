// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../api/endpoints', () => ({ listIpos: vi.fn(), listAccounts: vi.fn() }));
import * as api from '../api/endpoints';
import { IpoListPage } from './IpoListPage';

// 224건: 앞 205건은 청약 중, 뒤 19건은 마감 (실제 DB의 규모와 비슷하게)
const ipos = Array.from({ length: 224 }, (_, i) => ({
  ipoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  name: `종목 ${i + 1}`,
  offerPrice: 10000,
  retailQuantity: 1000,
  subscriptionStartAt: '2026-01-01T00:00:00+09:00',
  subscriptionEndAt: '2099-01-01T00:00:00+09:00',
  status: i < 205 ? 'OPEN' : 'CLOSED',
}));

function Probe() {
  return <output data-testid="search">{useLocation().search}</output>;
}

function renderAt(url: string) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/ipos" element={<><IpoListPage /><Probe /></>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const settle = () => new Promise((r) => setTimeout(r, 60)); // 효과로 주소가 다시 바뀌는지 볼 시간

describe('공모주 목록의 페이지와 필터', () => {
  beforeEach(() => {
    window.scrollTo = vi.fn();
    vi.mocked(api.listIpos).mockImplementation((async ({ page = 0, size = 20 } = {}) => ({
      status: 200,
      data: { items: ipos.slice(page * size, (page + 1) * size), page, size, totalElements: 224, totalPages: Math.ceil(224 / size) },
    })) as never);
    vi.mocked(api.listAccounts).mockResolvedValue({ status: 200, data: { items: [], page: 0, size: 100, totalElements: 0, totalPages: 0 } } as never);
  });
  afterEach(() => cleanup());

  it('마지막 쪽(12쪽)에서 쪽 수가 줄어드는 필터로 바꾸면 첫 쪽부터 보인다', async () => {
    renderAt('/ipos?page=12');
    await screen.findByText('221–224 / 224건');

    fireEvent.click(screen.getByRole('tab', { name: /청약 중/ }));
    await screen.findByText('1–20 / 205건');
    await settle();

    expect(screen.getByText('1–20 / 205건')).toBeTruthy(); // 늦게 도는 보정 효과가 11쪽으로 덮어쓰지 않는다
    expect(screen.getByTestId('search').textContent).toBe('?status=OPEN_NOW');
  });

  it('필터를 켠 채 쪽을 넘기면 필터가 유지된다', async () => {
    renderAt('/ipos?status=OPEN_NOW');
    await screen.findByText('1–20 / 205건');

    fireEvent.click(screen.getByRole('button', { name: '2페이지' }));
    await screen.findByText('21–40 / 205건');
    expect(screen.getByTestId('search').textContent).toBe('?status=OPEN_NOW&page=2');
  });

  it('범위를 넘은 쪽 주소는 마지막 쪽으로 맞춰진다', async () => {
    renderAt('/ipos?page=999');
    await screen.findByText('221–224 / 224건');
    await settle();
    expect(screen.getByTestId('search').textContent).toBe('?page=12');
  });

  it('알 수 없는 status 값은 전체로 본다', async () => {
    renderAt('/ipos?status=NOPE');
    await screen.findByText('1–20 / 224건');
  });
});
