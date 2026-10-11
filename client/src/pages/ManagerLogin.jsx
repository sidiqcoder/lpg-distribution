import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import { apiJson } from '../api';
import { useAuth } from '../auth';

export default function ManagerLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const location = useLocation();

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await apiJson('/login', { role: 'manager', username, password });
      login(res.user);
      const target = (location.state?.from && !location.state.from.includes('login')) ? location.state.from : '/manager';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Username atau password manager tidak sesuai.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page-container manager-theme">
      <div className="auth-panel-card">
        <div className="auth-brand-header">
          <div className="auth-brand-logo logo-manager">
            <Icon name="shield" size={28} />
          </div>
          <div>
            <h1 className="auth-company-name">PT MACAN GADING</h1>
            <span className="auth-company-sub">PANEL KONTROL MANAJEMEN DEPO</span>
          </div>
        </div>

        <div className="auth-card-title-box">
          <h2>Portal Masuk Manager Operasional</h2>
          <p className="auth-card-desc">
            Akses otorisasi untuk pengawasan persediaan LPG, validasi inspeksi K3, dan evaluasi KPI armada.
          </p>
        </div>

        {error && (
          <div className="banner bad mb">
            <div className="banner-title">
              <Icon name="alert" size={16} />
              <span>Autentikasi Manager Gagal</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username Manager</label>
            <div className="input-with-icon">
              <span className="input-icon">
                <Icon name="user" size={16} />
              </span>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="manager"
                required
                autoComplete="username"
              />
            </div>
            <small className="muted">Username akun manager: manager</small>
          </div>

          <div className="form-group">
            <label htmlFor="password">Kata Sandi (Password)</label>
            <div className="input-with-icon">
              <span className="input-icon">
                <Icon name="shield" size={16} />
              </span>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata sandi"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block btn-lg mt" type="submit" disabled={busy}>
            <Icon name="shield" size={18} />
            <span>{busy ? 'Memverifikasi...' : 'Masuk ke Dashboard Manager'}</span>
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Login untuk sopir armada?</span>
          <Link to="/login" className="auth-switch-link">
            Masuk sebagai Sopir Pengemudi &rarr;
          </Link>
          <div className="mt-sm">
            <Link to="/" className="auth-home-link">
              &larr; Kembali ke Halaman Utama
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
