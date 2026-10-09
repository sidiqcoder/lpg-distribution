import { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePersistentState } from './hooks';
import { apiGet, apiJson, getToken, clearSession } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = usePersistentState('lpg:user', null);
  const [restoring, setRestoring] = useState(Boolean(getToken()));
  const [sessionError, setSessionError] = useState(null);
  useEffect(() => {
    const expired = () => { setUser(null); setSessionError(null); };
    window.addEventListener('lpg:session-expired', expired);
    let active = true;
    if (getToken()) apiGet('/session').then(result => {
      if (active) { setUser(result.user); setSessionError(null); }
    }).catch(error => {
      if (active && error.status !== 401) setSessionError(error);
    }).finally(() => { if (active) setRestoring(false); });
    else setUser(null);
    return () => { active = false; window.removeEventListener('lpg:session-expired', expired); };
  }, [setUser]);
  const value = useMemo(() => ({
    user,
    restoring,
    sessionError,
    login: (u) => setUser(u),
    logout: () => {
      const pending = apiJson('/logout', {});
      clearSession();
      setUser(null);
      pending.catch(() => {});
    }
  }), [user, setUser, restoring, sessionError]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  return useContext(AuthCtx);
}

// Bungkus halaman yang butuh login + role tertentu.
export function RequireRole({ role, children }) {
  const { user, restoring, sessionError } = useAuth();
  const location = useLocation();
  if (restoring) return <div className="card loading-card"><div className="spinner" /><p>Memuat sesi...</p></div>;
  if (sessionError) return <div className="card"><p>{sessionError.message || 'Koneksi terputus.'}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Coba Lagi</button></div>;
  if (!user || !getToken() || user.role !== role) {
    return <Navigate to={role === 'manager' ? '/admin/login' : '/login'} state={{ from: location.pathname }} replace />;
  }
  return children;
}
