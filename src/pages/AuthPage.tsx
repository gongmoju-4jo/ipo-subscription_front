import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ApiError } from '../api/client';
import * as api from '../api/endpoints';
import { IconSpinner } from '../components/Icons';
import { Seg } from '../components/Seg';

type Tab = 'login' | 'sign';

// API 명세 3.1: loginId 4~20자 영문 소문자·숫자, password 8~20자, name 1~20자
const ID_RE = /^[a-z0-9]{4,20}$/;

export function AuthPage() {
  const { login, sessionNotice } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;

  const [tab, setTab] = useState<Tab>('login');
  const [notice, setNotice] = useState<string | null>(null);

  // 로그인
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);

  // 회원가입
  const [sId, setSId] = useState('');
  const [sPw, setSPw] = useState('');
  const [sName, setSName] = useState('');
  const [signErrors, setSignErrors] = useState<Record<string, string>>({});
  const [signError, setSignError] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);

  const idBad = sId !== '' && !ID_RE.test(sId);
  const pwBad = sPw !== '' && (sPw.length < 8 || sPw.length > 20);
  const nameBad = sName.length > 20;
  const signValid = ID_RE.test(sId) && sPw.length >= 8 && sPw.length <= 20 && sName.trim().length >= 1 && sName.length <= 20;

  async function onLogin(e: FormEvent) {
    e.preventDefault();
    if (busy || !loginId.trim() || !password) return;
    setBusy(true);
    setLoginError(null);
    try {
      await login(loginId.trim(), password);
      navigate(from && from !== '/login' ? from : '/ipos', { replace: true });
    } catch (err) {
      setLoginError(err instanceof ApiError ? err.message : '로그인하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function onSignUp(e: FormEvent) {
    e.preventDefault();
    if (busy || !signValid) return;
    setBusy(true);
    setSignErrors({});
    setSignError(null);
    try {
      await api.signUp({ loginId: sId, password: sPw, name: sName.trim() });
      setLoginId(sId);
      setPassword('');
      setSPw('');
      setSName('');
      setNotice('가입했습니다. 로그인해 주세요.');
      setTab('login');
    } catch (err) {
      if (err instanceof ApiError) {
        // 409 DUPLICATE_RESOURCE: 이미 사용 중인 로그인 ID, 400 VALIDATION_ERROR: details에 필드별 사유
        const fields: Record<string, string> = {};
        err.details.forEach((d) => (fields[d.field] = d.reason));
        if (err.code === 'DUPLICATE_RESOURCE') fields.loginId = '이미 사용 중인 로그인 ID입니다.';
        setSignErrors(fields);
        if (Object.keys(fields).length === 0) setSignError(err.message);
      } else {
        setSignError('가입하지 못했습니다.');
      }
    } finally {
      setBusy(false);
    }
  }

  const switchTab = (t: Tab) => {
    setTab(t);
    setNotice(null);
  };
  const shownNotice = notice ?? sessionNotice;

  return (
    <div className="auth-wrap">
      <main className="auth-col">
        <div className="brand" style={{ justifyContent: 'center' }}>
          <span className="brand-mark" aria-hidden="true"><i /></span>
          <span className="brand-name">GONGMOJU</span>
        </div>

        <div className="auth-card">
          <h1 className="sr-only">공모주 청약 로그인과 회원가입</h1>
          <div style={{ paddingTop: 20 }}>
            <Seg full label="로그인 또는 회원가입" value={tab} onChange={switchTab}
              items={[{ key: 'login', label: '로그인' }, { key: 'sign', label: '회원가입' }]} />
          </div>

          {shownNotice && <div role="status" className="alert alert-info" style={{ marginTop: 20 }}>{shownNotice}</div>}

          {tab === 'login' ? (
            <form key="login" className="stack rise" style={{ gap: 18, marginTop: 24 }} onSubmit={onLogin}>
              <div className="field">
                <label htmlFor="lid">로그인 ID</label>
                <input id="lid" className="input" autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value)} />
              </div>
              <div className="field">
                <label htmlFor="lpw">비밀번호</label>
                <input id="lpw" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              {loginError && <p role="alert" className="alert alert-warn">{loginError}</p>}
              <button type="submit" className="btn btn-ink btn-lg btn-block" data-magnetic disabled={busy || !loginId.trim() || !password}>
                {busy ? <><IconSpinner size={18} /> 로그인 중</> : '로그인'}
              </button>
              <p className="muted small" style={{ textAlign: 'center' }}>
                처음이신가요? <button type="button" className="btn-link" onClick={() => switchTab('sign')}>회원가입</button>
              </p>
            </form>
          ) : (
            <form key="sign" className="stack rise" style={{ gap: 18, marginTop: 24 }} onSubmit={onSignUp}>
              <div className="field">
                <label htmlFor="sid">로그인 ID</label>
                <input id="sid" className={`input${idBad || signErrors.loginId ? ' bad' : ''}`} autoComplete="username" aria-describedby="sid-h" value={sId} onChange={(e) => setSId(e.target.value)} />
                <p id="sid-h" className={`help${idBad || signErrors.loginId ? ' bad' : ''}`}>{signErrors.loginId ?? '4~20자, 영문 소문자와 숫자'}</p>
              </div>
              <div className="field">
                <label htmlFor="spw">비밀번호</label>
                <input id="spw" type="password" className={`input${pwBad || signErrors.password ? ' bad' : ''}`} autoComplete="new-password" aria-describedby="spw-h" value={sPw} onChange={(e) => setSPw(e.target.value)} />
                <p id="spw-h" className={`help${pwBad || signErrors.password ? ' bad' : ''}`}>{signErrors.password ?? '8~20자'}</p>
              </div>
              <div className="field">
                <label htmlFor="snm">이름</label>
                <input id="snm" className={`input${nameBad || signErrors.name ? ' bad' : ''}`} autoComplete="name" aria-describedby="snm-h" value={sName} onChange={(e) => setSName(e.target.value)} />
                <p id="snm-h" className={`help${nameBad || signErrors.name ? ' bad' : ''}`}>{signErrors.name ?? '1~20자'}</p>
              </div>
              {signError && <p role="alert" className="alert alert-warn">{signError}</p>}
              <button type="submit" className="btn btn-ink btn-lg btn-block" data-magnetic disabled={busy || !signValid}>
                {busy ? <><IconSpinner size={18} /> 가입 중</> : '가입하기'}
              </button>
            </form>
          )}
        </div>
        <p className="muted small" style={{ textAlign: 'center' }}>모의 투자 서비스 · 가상 계좌</p>
      </main>
    </div>
  );
}
