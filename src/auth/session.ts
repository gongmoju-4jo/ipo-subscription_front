// 로그인 세션 저장소. React와 무관하게 읽을 수 있어야 한다:
// 새로고침 직후 첫 요청이 AuthProvider의 effect보다 먼저 나가기 때문이다.
// 토큰은 탭을 닫으면 사라지게 sessionStorage에 둔다 (만료 1시간). localStorage에 오래 남기지 않는다.
const KEY = 'ipo.session';

export interface Session {
  accessToken: string;
  loginId: string;
  expiresAt: number; // epoch ms
}

export function loadSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s.expiresAt > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export function saveSession(s: Session | null): void {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    // 저장할 수 없는 환경이면 새로고침 때 다시 로그인한다
  }
}
