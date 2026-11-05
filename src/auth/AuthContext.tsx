import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { configureClient } from '../api/client';
import * as api from '../api/endpoints';
import { loadSession, saveSession, type Session } from './session';

interface AuthValue {
  loginId: string | null;
  isLoggedIn: boolean;
  /** 401 TOKEN_EXPIRED 등으로 세션이 끝났을 때 로그인 화면에 보여줄 안내 */
  sessionNotice: string | null;
  login: (loginId: string, password: string) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(loadSession);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const clear = useCallback(
    (notice: string | null) => {
      saveSession(null);
      setSession(null);
      setSessionNotice(notice);
      queryClient.clear(); // 이전 사용자의 계좌, 청약 캐시가 남지 않게
    },
    [queryClient],
  );

  // API 클라이언트에 401 처리를 연결한다 (토큰은 클라이언트가 세션 저장소에서 직접 읽는다)
  useEffect(() => {
    configureClient((code) => clear(code === 'TOKEN_EXPIRED' ? '로그인이 만료됐습니다. 다시 로그인해 주세요.' : '로그인이 필요합니다.'));
  }, [clear]);

  // 만료 시각이 되면 자동으로 로그아웃
  useEffect(() => {
    if (!session) return;
    const ms = session.expiresAt - Date.now();
    const t = setTimeout(() => clear('로그인이 만료됐습니다. 다시 로그인해 주세요.'), Math.max(ms, 0));
    return () => clearTimeout(t);
  }, [session, clear]);

  const login = useCallback(async (loginId: string, password: string) => {
    const res = await api.login({ loginId, password });
    const next: Session = {
      accessToken: res.data.accessToken,
      loginId,
      expiresAt: Date.now() + res.data.expiresIn * 1000,
    };
    saveSession(next);
    setSessionNotice(null);
    setSession(next);
  }, []);

  const logout = useCallback(() => clear(null), [clear]);

  const value = useMemo<AuthValue>(
    () => ({ loginId: session?.loginId ?? null, isLoggedIn: session !== null, sessionNotice, login, logout }),
    [session, sessionNotice, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider 안에서만 쓸 수 있습니다.');
  return v;
}
