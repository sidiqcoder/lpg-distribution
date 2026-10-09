import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Icon from '../components/Icon';
import { apiJson } from '../api';
import { useAuth } from '../auth';

export default function DriverLogin() {
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
      const res = await apiJson('/login', { role: 'driver', username, password });
      login(res.user);
      const target = (location.state?.from && !location.state.from.includes('login')) ? location.state.from : '/sopir';
      navigate(target, { replace: true });
    } catch (err) {
      setError(err.message || 'Username atau password tidak sesuai.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-panel-card">
        <div className="auth-brand-header">
          <div className="auth-brand-logo">
            <Icon name="cylinder" size={28} />
          </div>
          <div>
            <h1 className="auth-company-name">PT MACAN GADING</h1>
            <span className="auth-company-sub">DISTRIBUSI &amp; LOGISTIK TABUNG LPG</span>
          </div>
        </div>

        <div className="auth-card-title-box">
          <h2>Portal Masuk Sopir Armada</h2>
          <p className="auth-card-desc">
            Masukkan kredensial akun pengemudi yang terdaftar di database perusahaan.
          </p>
        </div>

        {error && (
          <div className="banner bad mb">
            <div className="banner-title">
              <Icon name="alert" size={16} />
              <span>Autentikasi Gagal</span>
            </div>
            <p>{error}</p>
          </div>
        )}

        <form onSubmit={submit} className="auth-form">
          <div className="form-group">
            <label htmlFor="username">Username Sopir</label>
            <div className="input-with-icon">
              <span className="input-icon">
                <Icon name="user" size={16} />
              </span>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Contoh: budi / ahmad"
                required
                autoComplete="username"
              />
            </div>
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
                placeholder="Masukkan kata sandi"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button className="btn btn-primary btn-block btn-lg mt" type="submit" disabled={busy}>
            <Icon name="truck" size={18} />
            <span>{busy ? 'Memverifikasi...' : 'Masuk ke Dashboard Sopir'}</span>
          </button>
        </form>

        <div className="auth-footer-links">
          <span>Bukan pengemudi armada?</span>
          <Link to="/admin/login" className="auth-switch-link">
            Masuk sebagai Manager Operasional &rarr;
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
