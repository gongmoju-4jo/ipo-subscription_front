import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { useIndicator } from '../lib/useIndicator';
import { IconIpo, IconReceipt, IconWallet } from './Icons';

const NAV = [
  { to: '/ipos', label: '공모주', Icon: IconIpo },
  { to: '/subscriptions', label: '내 청약', Icon: IconReceipt },
  { to: '/accounts', label: '계좌', Icon: IconWallet },
];

export function Layout({ children }: { children: ReactNode }) {
  const { loginId, logout } = useAuth();
  const { pathname } = useLocation();
  const section = pathname.split('/')[1] ?? '';
  const [navRef, pos] = useIndicator<HTMLElement>(section, 'a[aria-current="page"]');

  return (
    <>
      <header className="header">
        <div className="header-inner">
          <Link to="/ipos" className="brand">
            <span className="brand-mark" aria-hidden="true"><i /></span>
            <span className="brand-name">GONGMOJU</span>
          </Link>

          <nav className="nav" aria-label="주 메뉴" ref={navRef}>
            {pos.ready && <span className="nav-ind" aria-hidden="true" style={{ transform: `translateX(${pos.x}px)`, width: pos.w }} />}
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => (isActive ? 'active' : '')}>{n.label}</NavLink>
            ))}
          </nav>

          <div className="header-user">
            <span className="avatar" aria-hidden="true">{loginId?.[0]?.toUpperCase() ?? ''}</span>
            <span className="user-id">{loginId}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>로그아웃</button>
          </div>
        </div>
      </header>

      <div key={pathname} className="page-enter">{children}</div>

      <nav className="tabbar" aria-label="하단 메뉴">
        <div className="tabbar-inner">
          {NAV.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `tab-link${isActive ? ' active' : ''}`}>
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
