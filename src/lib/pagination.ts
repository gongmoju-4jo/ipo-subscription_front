/** URL의 ?page= 값(1부터)을 읽는다. 숫자가 아니거나 1 미만이면 1 */
export function parsePage(value: string | null): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}

/** 페이지 번호 줄: 처음, 현재 앞뒤, 마지막을 보여주고 건너뛴 구간은 '…' */
export function pageWindow(current: number, total: number): Array<number | '…'> {
  const wanted = new Set<number>([1, total, current - 1, current, current + 1]);
  const pages = [...wanted].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;
  for (const p of pages) {
    if (prev && p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}
