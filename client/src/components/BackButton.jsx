import { useNavigate, useLocation } from 'react-router-dom';
import Icon from './Icon';

export default function BackButton({ fallback = '/sopir', label = 'Kembali', className = 'btn btn-ghost' }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleBack = () => {
    // 1. Jika ada 'from' di state navigasi dan bukan login, gunakan itu
    const from = location.state?.from;
    if (from && !from.includes('/login')) {
      navigate(from);
      return;
    }

    // 2. Jika history browser aman (panjang > 2), kembali ke halaman sebelumnya
    if (window.history.state && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }

    // 3. Fallback ke menu induk
    navigate(fallback);
  };

  return (
    <button type="button" className={className} onClick={handleBack} title={label}>
      <Icon name="arrow-left" size={16} />
      <span>{label}</span>
    </button>
  );
}
