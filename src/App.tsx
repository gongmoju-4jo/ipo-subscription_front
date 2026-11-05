import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { usePointerEffects } from './lib/usePointerEffects';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { AccountsPage } from './pages/AccountsPage';
import { IpoListPage } from './pages/IpoListPage';
import { IpoDetailPage } from './pages/IpoDetailPage';
import { SubscriptionsPage } from './pages/SubscriptionsPage';

function RequireAuth() {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}

export function App() {
  const { isLoggedIn } = useAuth();
  usePointerEffects();
  return (
    <Routes>
      <Route path="/login" element={isLoggedIn ? <Navigate to="/ipos" replace /> : <AuthPage />} />
      <Route element={<RequireAuth />}>
        <Route path="/accounts" element={<AccountsPage />} />
        <Route path="/ipos" element={<IpoListPage />} />
        <Route path="/ipos/:ipoId" element={<IpoDetailPage />} />
        <Route path="/subscriptions" element={<SubscriptionsPage />} />
      </Route>
      <Route path="*" element={<Navigate to={isLoggedIn ? '/ipos' : '/login'} replace />} />
    </Routes>
  );
}
