import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Pagination } from './Pagination';
import { pageWindow, parsePage } from '../lib/pagination';

describe('pageWindow', () => {
  it('처음, 현재 앞뒤, 마지막만 보이고 건너뛴 곳은 …', () => {
    expect(pageWindow(1, 12)).toEqual([1, 2, '…', 12]);
    expect(pageWindow(6, 12)).toEqual([1, '…', 5, 6, 7, '…', 12]);
    expect(pageWindow(12, 12)).toEqual([1, '…', 11, 12]);
  });
  it('적은 페이지는 모두 보인다', () => {
    expect(pageWindow(2, 3)).toEqual([1, 2, 3]);
    expect(pageWindow(1, 1)).toEqual([1]);
  });
});

describe('parsePage', () => {
  it('1 이상의 정수만 받고 그 외는 1', () => {
    expect(parsePage('3')).toBe(3);
    expect(parsePage(null)).toBe(1);
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-2')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('1.5')).toBe(1);
  });
});

describe('Pagination', () => {
  const html = (page: number, totalPages = 12) =>
    renderToStaticMarkup(<Pagination page={page} totalPages={totalPages} totalElements={224} pageSize={20} onChange={() => {}} />);

  it('현재 페이지에 aria-current, 건수 범위를 표시한다', () => {
    const h = html(2);
    expect(h).toContain('aria-current="page"');
    expect(h).toContain('21–40 / 224건');
  });
  it('첫 페이지에서는 이전이, 마지막 페이지에서는 다음이 비활성화된다', () => {
    expect(html(1)).toMatch(/aria-label="이전 페이지" disabled/);
    expect(html(12)).toMatch(/aria-label="다음 페이지" disabled/);
    expect(html(12)).toContain('221–224 / 224건');
  });
  it('페이지가 한 쪽뿐이면 그리지 않는다', () => {
    expect(html(1, 1)).toBe('');
  });
});
