import { Link } from 'react-router-dom';
import Icon from '../components/Icon';

export default function Home() {
  return (
    <div className="landing-page-wrap">
      {/* Top Navbar */}
      <header className="landing-topbar">
        <div className="landing-brand">
          <div className="brand-logo-glow">
            <Icon name="cylinder" size={24} />
          </div>
          <div>
            <strong className="brand-title">PT MACAN GADING</strong>
            <span className="brand-subtitle">DISTRIBUSI &amp; LOGISTIK LPG PERTAMINA</span>
          </div>
        </div>
        <div className="topbar-actions">
          <Link className="btn btn-outline-light btn-sm" to="/login">
            <Icon name="truck" size={15} />
            <span>Login Sopir Armada</span>
          </Link>
          <Link className="btn btn-primary btn-sm ml-xs" to="/admin/login">
            <Icon name="shield" size={15} />
            <span>Login Manager Depo</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="landing-hero-section">
        <div className="hero-content-box">
          <div className="hero-tag-badge">
            <Icon name="flame" size={14} />
            <span>PORTAL LOGISTIK ENERGI NASIONAL</span>
          </div>
          <h1 className="hero-main-title">
            Sistem Manajemen &amp; Distribusi Tabung Gas LPG
          </h1>
          <p className="hero-desc">
            Sistem terpadu operasional armada PT Macan Gading. Menjamin standar keselamatan kerja (K3),
            inspeksi pra-keberangkatan, optimasi rute pangkalan, dan pelacakan GPS real-time.
          </p>

          <div className="portal-choice-cards mt-lg">
            <Link to="/login" className="portal-card driver-portal-card">
              <div className="portal-card-icon">
                <Icon name="truck" size={28} />
              </div>
              <div className="portal-card-text">
                <span className="portal-badge">PORTAL OPERASIONAL</span>
                <h3>Login Sopir Armada</h3>
                <p>Checklist inspeksi pagi 72 item, permintaan kuota tabung, dan konfirmasi serah terima pangkalan.</p>
                <div className="portal-enter-link">
                  <span>Masuk Sebagai Sopir</span>
                  <Icon name="chevron-right" size={16} />
                </div>
              </div>
            </Link>

            <Link to="/admin/login" className="portal-card manager-portal-card">
              <div className="portal-card-icon">
                <Icon name="shield" size={28} />
              </div>
              <div className="portal-card-text">
                <span className="portal-badge">PORTAL MANAJEMEN</span>
                <h3>Login Manager Operasional</h3>
                <p>Validasi kelayakan armada K3, kontrol kuota persediaan depo, pelacakan GPS, dan evaluasi KPI sopir.</p>
                <div className="portal-enter-link">
                  <span>Masuk Sebagai Manager</span>
                  <Icon name="chevron-right" size={16} />
                </div>
              </div>
            </Link>
          </div>

          {/* Feature Highlights */}
          <div className="landing-features-grid mt-xl">
            <div className="feature-item-card">
              <div className="feature-icon">
                <Icon name="clipboard" size={20} />
              </div>
              <h4>Inspeksi Fisik K3 Ketat</h4>
              <p>Pemeriksaan standar keselamatan 72 poin sebelum armada diizinkan keluar depo.</p>
            </div>

            <div className="feature-item-card">
              <div className="feature-icon">
                <Icon name="cylinder" size={20} />
              </div>
              <h4>Kontrol Stok &amp; Otorisasi</h4>
              <p>Pengawasan real-time sisa tabung LPG di depo dan persetujuan pengisian armada.</p>
            </div>

            <div className="feature-item-card">
              <div className="feature-icon">
                <Icon name="map-pin" size={20} />
              </div>
              <h4>Rute Teroptimasi &amp; GPS</h4>
              <p>Urutan pangkalan terpendek dengan deteksi deviasi jalur dan peringatan otomatis.</p>
            </div>

            <div className="feature-item-card">
              <div className="feature-icon">
                <Icon name="chart" size={20} />
              </div>
              <h4>Penilaian KPI Objektif</h4>
              <p>Metodologi pembobotan transparan berbasis keselamatan, ritase, dan kepatuhan SOP.</p>
            </div>
          </div>
        </div>
      </main>

      <footer className="landing-footer">
        <div>&copy; PT Macan Gading &middot; Agen &amp; Distributor Resmi LPG Pertamina</div>
        <div className="muted">Sistem Manajemen Distribusi v2.5 &middot; Berbasis React &amp; Node.js</div>
      </footer>
    </div>
  );
}
