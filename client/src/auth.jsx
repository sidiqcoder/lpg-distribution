import { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { apiGet, apiJson, getToken, clearSession } from './api';

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('lpg:user')); } catch { return null; }
  });
  const [restoring, setRestoring] = useState(Boolean(getToken()));
  const [sessionError, setSessionError] = useState(null);
  useEffect(() => {
    const expired = () => { setUser(null); setSessionError(null); setRestoring(false); };
    window.addEventListener('lpg:session-expired', expired);
    let active = true;
    let generation = 0;
    const restore = () => {
      const token = getToken();
      const version = ++generation;
      if (!token) { expired(); return; }
      setRestoring(true);
      apiGet('/session').then(result => {
        if (active && version === generation && token === getToken()) {
          setUser(result.user); setSessionError(null);
          localStorage.setItem('lpg:user', JSON.stringify(result.user));
        }
      }).catch(error => {
        if (active && version === generation && token === getToken() && error.code !== 'SESSION_EXPIRED') setSessionError(error);
      }).finally(() => { if (active && version === generation) setRestoring(false); });
    };
    const storageChanged = event => { if (event.key === 'lpg:session' || event.key === null) restore(); };
    window.addEventListener('storage', storageChanged);
    restore();
    return () => { active = false; window.removeEventListener('lpg:session-expired', expired); window.removeEventListener('storage', storageChanged); };
  }, []);
  const value = useMemo(() => ({
    user,
    restoring,
    sessionError,
    login: (u) => { setUser(u); setSessionError(null); localStorage.setItem('lpg:user', JSON.stringify(u)); },
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
  if (sessionError && !user) return <div className="card"><p>{sessionError.message || 'Koneksi terputus.'}</p><button className="btn btn-primary" onClick={() => window.location.reload()}>Coba Lagi</button></div>;
  if (!user || !getToken() || user.role !== role) {
    return <Navigate to={role === 'manager' ? '/admin/login' : '/login'} state={{ from: location.pathname }} replace />;
  }
  return children;
}
