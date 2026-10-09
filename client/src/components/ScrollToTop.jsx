import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// SPA tidak reset scroll otomatis; kembalikan ke atas tiap ganti halaman.
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}
