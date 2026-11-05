const KST = 'Asia/Seoul';

export const won = (n: number) => n.toLocaleString('ko-KR');

/** 계좌번호 12자리를 4자리씩 띄워 보여준다 (표시만, 값은 그대로) */
export const accountNo = (s: string) => (/^\d{12}$/.test(s) ? `${s.slice(0, 4)} ${s.slice(4, 8)} ${s.slice(8)}` : s);

const dtf = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ko-KR', { timeZone: KST, hour12: false, ...opts });

function parts(iso: string, opts: Intl.DateTimeFormatOptions) {
  const map: Record<string, string> = {};
  for (const p of dtf(opts).formatToParts(new Date(iso))) map[p.type] = p.value;
  return map;
}

/** 11.05 (목) 10:00 */
export function kstShort(iso: string): string {
  const p = parts(iso, { month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  return `${p.month}.${p.day} (${p.weekday}) ${p.hour}:${p.minute}`;
}

/** 11.05 10:00 */
export function kstCompact(iso: string): string {
  const p = parts(iso, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  return `${p.month}.${p.day} ${p.hour}:${p.minute}`;
}

/** 11.05 11:47:21 */
export function kstSeconds(iso: string): string {
  const p = parts(iso, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return `${p.month}.${p.day} ${p.hour}:${p.minute}:${p.second}`;
}

/** 2026.11.03 */
export function kstDate(iso: string): string {
  const p = parts(iso, { year: 'numeric', month: '2-digit', day: '2-digit' });
  return `${p.year}.${p.month}.${p.day}`;
}

/** refundDate(LocalDate "2026-11-06") → 11.06 (금). 날짜만 있는 값이라 KST 자정으로 본다 */
export function localDateShort(date: string): string {
  const p = parts(`${date}T00:00:00+09:00`, { month: '2-digit', day: '2-digit', weekday: 'short' });
  return `${p.month}.${p.day} (${p.weekday})`;
}

/** 남은 시간: 1일 04:12:36 / 04:12:36 */
export function remaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const hh = String(Math.floor((s % 86400) / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return d > 0 ? `${d}일 ${hh}:${mm}:${ss}` : `${hh}:${mm}:${ss}`;
}

/** 같은 KST 날짜인지 */
export function sameKstDay(a: Date, b: Date): boolean {
  const f = dtf({ year: 'numeric', month: '2-digit', day: '2-digit' });
  return f.format(a) === f.format(b);
}
