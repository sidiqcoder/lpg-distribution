import { createContext, useContext, useEffect, useState } from 'react';
import { apiJson } from '../api';
import { fmtWaktu } from '../utils';

const LocationContext = createContext({ position: null });
export const useDriverLocation = () => useContext(LocationContext);

export default function DriverTelemetry({ user, children }) {
  const [position, setPosition] = useState(null);
  const [status, setStatus] = useState('Meminta lokasi GPS...');
  const [retry, setRetry] = useState(0);
  const [submitted, setSubmitted] = useState(null);

  useEffect(() => {
    let active = true, sending = false, lastSent = 0;
    if (!navigator.geolocation) { setStatus('Perangkat tidak mendukung GPS.'); return; }
    const failure = error => {
      if (active) setStatus(error.code === 1 ? 'Izin lokasi ditolak. Izinkan lokasi di pengaturan browser.' : 'Lokasi belum tersedia. Pastikan GPS dan koneksi aktif.');
    };
    const receive = async result => {
      if (!active) return;
      const { latitude, longitude, accuracy } = result.coords;
      setPosition({ latitude, longitude, accuracy });
      if (sending || Date.now() - lastSent < 5000) return;
      sending = true;
      try {
        await apiJson('/tracking', { sopir_id: user.id, latitude, longitude, accuracy });
        lastSent = Date.now();
        if (active) { setStatus('GPS tersinkron ke manager'); setSubmitted(new Date().toISOString()); }
      } catch (error) { if (active) setStatus(`GPS belum terkirim: ${error.message}`); }
      finally { sending = false; }
    };
    const options = { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 };
    const acquire = () => navigator.geolocation.getCurrentPosition(receive, failure, options);
    const resume = () => { if (document.visibilityState === 'visible') acquire(); };
    const watch = navigator.geolocation.watchPosition(receive, failure, options);
    acquire();
    const timer = setInterval(acquire, 15000);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', acquire);
    return () => {
      active = false; clearInterval(timer); navigator.geolocation.clearWatch(watch);
      document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', acquire);
    };
  }, [user.id, retry]);

  return <LocationContext.Provider value={{ position }}>
    <div className="banner info mb" role="status">
      <strong>{status}</strong>{submitted && <span> · Terakhir terkirim {fmtWaktu(submitted)}</span>}
      <button type="button" className="btn btn-sm btn-outline ml" onClick={() => setRetry(value => value + 1)}>Coba GPS Lagi</button>
      <small className="muted block">Lokasi dikirim selama dashboard sopir terbuka. Izinkan lokasi dan biarkan aplikasi aktif selama bertugas.</small>
    </div>
    {children}
  </LocationContext.Provider>;
}
