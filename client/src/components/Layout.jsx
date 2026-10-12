import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';
import { useAuth } from '../auth';
import { useApi } from '../hooks';
import ErrorBoundary from './ErrorBoundary';
import { fmtWaktu } from '../utils';
import { serverNow } from '../clock';

const BRAND = {
  name: 'PT MACAN GADING',
  tagline: 'AGEN & DISTRIBUSI RESMI LPG PERTAMINA',
  systemName: 'Sistem Distribusi LPG'
};

function getNavigationGroups(role) {
  if (role === 'manager') {
    return [
      {
        title: 'Utama',
        items: [
          { to: '/manager', label: 'Ringkasan Operasional', icon: 'grid', end: true }
        ]
      },
      {
        title: 'Manajemen Logistik',
        items: [
          { to: '/manager/stok', label: 'Persediaan & Permintaan LPG', icon: 'cylinder' },
          { to: '/manager/inspeksi', label: 'Laporan Inspeksi Pagi', icon: 'clipboard' },
          { to: '/manager/pengiriman', label: 'Monitoring Pengiriman', icon: 'package' },
          { to: '/manager/pelacakan', label: 'Pelacakan GPS Sopir', icon: 'map-pin' }
        ]
      },
      {
        title: 'Kinerja & Safety',
        items: [
          { to: '/manager/kpi', label: 'Penilaian KPI Sopir', icon: 'chart' },
          { to: '/manager/bahaya', label: 'Laporan Bahaya / Insiden', icon: 'alert' },
          { to: '/manager/aktivitas', label: 'Aktivitas & Fatigue Sopir', icon: 'eye' },
          { to: '/manager/sertifikat', label: 'Sertifikat K3 Sopir', icon: 'shield' }
        ]
      }
    ];
  }

  return [
    {
      title: 'Utama',
      items: [
        { to: '/sopir', label: 'Dashboard Sopir', icon: 'grid', end: true },
        { to: '/sopir/menu', label: 'Menu Operasional', icon: 'layers' }
      ]
    },
    {
      title: 'Pra-Keberangkatan',
      items: [
        { to: '/sopir/inspeksi-form', label: 'Inspeksi Pagi Kendaraan', icon: 'clipboard' },
        { to: '/sopir/status-inspeksi', label: 'Status Validasi Inspeksi', icon: 'check-circle' },
        { to: '/sopir/permintaan-lpg', label: 'Pengajuan Ambil LPG', icon: 'cylinder' },
        { to: '/sopir/status-lpg', label: 'Status Pengajuan LPG', icon: 'flame' }
      ]
    },
    {
      title: 'Tugas Pengiriman',
      items: [
        { to: '/sopir/on-duty', label: 'On-Duty Pengiriman', icon: 'truck' },
        { to: '/sopir/rute-map', label: 'Peta Rute Distribusi', icon: 'map-pin' },
        { to: '/sopir/peta', label: 'Posisi GPS Real-Time', icon: 'activity' }
      ]
    },
    {
      title: 'Profil & K3',
      items: [
        { to: '/sopir/sertifikat', label: 'Sertifikat K3', icon: 'shield' },
        { to: '/sopir/profil', label: 'Profil Saya', icon: 'user' }
      ]
    }
  ];
}

export default function Layout({ role, user, title, children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { logout } = useAuth();
  const groups = getNavigationGroups(role);
  const [clock, setClock] = useState(() => new Date(serverNow()).toISOString());
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date(serverNow()).toISOString()), 1000);
    return () => clearInterval(timer);
  }, []);
  const connection = useApi('/health', { interval: 30000 });
  const connectionText = connection.error ? 'Koneksi terputus' : connection.data?.ok ? 'Terhubung' : 'Menghubungkan...';

  const doLogout = () => {
    logout();
    navigate(role === 'manager' ? '/admin/login' : '/login', { replace: true });
  };

  return (
    <div className="app-shell">
      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />
      )}

      {/* Persistent Enterprise Sidebar */}
      <aside className={`app-sidebar ${mobileOpen ? 'open' : ''}`} aria-label="Navigasi Utama">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <Icon name="cylinder" size={22} />
          </div>
          <div className="brand-text">
            <strong>{BRAND.name}</strong>
            <small>{BRAND.tagline}</small>
          </div>
        </div>

        <div className="sidebar-user-card">
          <div className="user-avatar">
            <Icon name={role === 'manager' ? 'shield' : 'truck'} size={18} />
          </div>
          <div className="user-meta">
            <span className="user-name">{user?.nama || 'Pengguna'}</span>
            <span className="user-role-badge">
              {role === 'manager' ? 'Manager Operasional' : 'Sopir Armada'}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {groups.map((group, gIdx) => (
            <div key={gIdx} className="nav-group">
              <span className="nav-group-title">{group.title}</span>
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                  <span className="nav-text">{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}

          <div className="nav-group mt-auto">
            <button type="button" className="nav-link logout-btn" onClick={doLogout}>
              <span className="nav-icon"><Icon name="logout" size={18} /></span>
              <span className="nav-text">Keluar dari Akun</span>
            </button>
          </div>
        </nav>

        <div className="sidebar-footer">
          <span>{BRAND.systemName} v2.5</span>
          <span className={connection.error ? 'text-red' : 'live-status-dot'} title={connectionText}>{connectionText}</span>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="app-main-wrapper">
        <header className="app-topbar">
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={() => setMobileOpen(true)}
            aria-label="Buka Navigasi"
          >
            <Icon name="menu" size={22} />
          </button>

          <div className="topbar-left">
            <span className="topbar-context-badge">
              {role === 'manager' ? 'DIVISI MANAJEMEN' : 'ARMADA DISTRIBUSI'}
            </span>
            <h1 className="topbar-page-title">{title}</h1>
          </div>

          <div className="topbar-right">
            <span className="operational-clock text-sm" aria-label="Jam operasional WITA">{fmtWaktu(clock)}</span>
            <div className="system-pill">
              <span className={connection.error ? '' : 'pulse-indicator'} />
              <span>{connectionText}</span>
            </div>

            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={doLogout}
              title="Keluar"
            >
              <Icon name="logout" size={15} />
              <span className="hide-mobile">Keluar</span>
            </button>
          </div>
        </header>

        <main className="page-container"><ErrorBoundary key={location.pathname}>{children}</ErrorBoundary></main>
      </div>
    </div>
  );
}
