import { Link } from 'react-router-dom';
import { useApi } from '../../hooks';
import { useAuth } from '../../auth';
import BackButton from '../../components/BackButton';
import Icon from '../../components/Icon';

export default function DriverActions() {
  const { user } = useAuth();
  const { data } = useApi(`/driver/${user.id}/summary`, { interval: 5000 });
  const siapBerangkat = data?.siapBerangkat;

  const menus = [
    {
      to: '/sopir/inspeksi-form',
      title: 'Inspeksi Pagi Armada',
      desc: 'Checklist 72 item kelayakan teknis & keselamatan K3 kendaraan',
      icon: 'clipboard',
      badge: data?.inspection ? (data.inspection.status_validasi === 'AMAN' ? 'Lolos' : 'Diajukan') : 'Wajib'
    },
    {
      to: '/sopir/permintaan-lpg',
      title: 'Pengajuan Kuota LPG',
      desc: 'Ajukan jumlah tabung gas yang diambil dari depo pangkalan',
      icon: 'cylinder',
      badge: data?.lpg ? data.lpg.status : 'Perlu Diisi'
    },
    {
      to: '/sopir/on-duty',
      title: 'Mulai Pengiriman (On-Duty)',
      desc: 'Antar tabung ke pangkalan tujuan, rekam foto & serah terima',
      icon: 'truck',
      disabled: !siapBerangkat,
      badge: siapBerangkat ? 'Siap Berangkat' : 'Terkunci'
    },
    {
      to: '/sopir/rute-map',
      title: 'Peta Rute Distribusi',
      desc: 'Lihat peta alur pengiriman teroptimasi dari depo ke pangkalan',
      icon: 'map-pin',
      badge: 'Navigasi'
    },
    {
      to: '/sopir/peta',
      title: 'Posisi GPS Real-Time',
      desc: 'Pantau posisi koordinat armada saat ini yang terlacak oleh sistem',
      icon: 'activity',
      badge: 'Live GPS'
    },
    {
      to: '/sopir/sertifikat',
      title: 'Sertifikat K3 Pengemudi',
      desc: 'Lihat atau unggah pembaruan sertifikat keahlian keselamatan K3',
      icon: 'shield',
      badge: 'K3 Resmi'
    }
  ];

  return (
    <div className="menu-page-layout">
      <div className="page-head">
        <div>
          <div className="breadcrumb-nav">
            <BackButton fallback="/sopir" label="Kembali ke Dashboard Utama" />
          </div>
          <h1>Menu Operasional Distribusi</h1>
          <p className="subtitle">
            Pusat aksi cepat sopir armada distribusi gas LPG PT Macan Gading
          </p>
        </div>
      </div>

      {!siapBerangkat && (
        <div className="banner warn mb">
          <div className="banner-title">
            <Icon name="info" size={18} />
            <span>Pemberitahuan Kesiapan Pengiriman</span>
          </div>
          <p>
            Menu <strong>Mulai Pengiriman (On-Duty)</strong> akan terbuka secara otomatis setelah
            inspeksi kendaraan Anda <strong>disetujui (AMAN)</strong> oleh Manager dan pengajuan kuota LPG <strong>disetujui</strong>.
          </p>
        </div>
      )}

      <div className="action-cards-grid">
        {menus.map((item, idx) => (
          <Link
            key={idx}
            to={item.disabled ? '#' : item.to}
            className={`action-card ${item.disabled ? 'disabled-card' : ''}`}
            onClick={(e) => {
              if (item.disabled) e.preventDefault();
            }}
          >
            <div className="action-card-top">
              <span className="action-card-icon">
                <Icon name={item.icon} size={22} />
              </span>
              <span className={`badge ${item.disabled ? 'badge-muted' : 'badge-brand'}`}>
                {item.badge}
              </span>
            </div>
            <div className="action-card-body">
              <strong className="action-title">{item.title}</strong>
              <p className="action-desc">{item.desc}</p>
            </div>
            <div className="action-card-arrow">
              <Icon name="chevron-right" size={16} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
