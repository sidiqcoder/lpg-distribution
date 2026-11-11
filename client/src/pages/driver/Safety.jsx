import { useRef, useState } from 'react';
import { useAuth } from '../../auth';
import { apiForm } from '../../api';
import { notifyDataChanged } from '../../events';
import { useDriverLocation } from '../../components/DriverTelemetry';
import MsdsGuide from '../../components/MsdsGuide';
import BackButton from '../../components/BackButton';

export default function DriverSafety() {
  const { user } = useAuth();
  const { position } = useDriverLocation();
  const form = useRef(null);
  const submitting = useRef(false);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  const submit = async event => {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current=true; setBusy(true); setMessage('');
    try {
      const body=new FormData(form.current);
      body.set('sopir_id',String(user.id));
      if (position) { body.set('latitude',String(position.latitude)); body.set('longitude',String(position.longitude)); }
      await apiForm('/driver/hazard',body);
      form.current.reset(); notifyDataChanged({type:'hazard',driverId:user.id});
      setMessage('Laporan bahaya berhasil dikirim ke manager.');
    } catch(error) { setMessage(error.message); } finally { submitting.current=false; setBusy(false); }
  };
  return <div><div className="page-head"><div><BackButton fallback="/sopir/menu" /><h1>Laporkan Bahaya &amp; MSDS LPG</h1><p>Utamakan keselamatan. Kirim laporan dari tempat yang aman.</p></div></div>
    <MsdsGuide />
    <form ref={form} onSubmit={submit} className="card"><h2>Laporkan Bahaya</h2>
      {message && <p role="status">{message}</p>}
      <div className="form-group"><label htmlFor="hazard-type">Jenis Bahaya</label><select id="hazard-type" name="jenis_bahaya" required defaultValue=""><option value="" disabled>Pilih jenis bahaya</option>{['Kebocoran LPG','Kerusakan Kendaraan','Kecelakaan','Bencana Alam','Masalah Lainnya'].map(value=><option key={value}>{value}</option>)}</select></div>
      <div className="form-group"><label htmlFor="hazard-description">Deskripsi dan Lokasi Kejadian</label><textarea id="hazard-description" name="deskripsi" rows="4" required /></div>
      <div className="form-group"><label htmlFor="hazard-proof">Foto Bukti Kejadian</label><input id="hazard-proof" name="foto_bukti" type="file" accept="image/*" required /></div>
      <p>{position ? 'Lokasi GPS perangkat akan disertakan.' : 'GPS belum tersedia. Jelaskan lokasi kejadian dalam deskripsi.'}</p>
      <button className="btn btn-bad" disabled={busy}>{busy?'Mengirim...':'Kirim Laporan Bahaya'}</button>
    </form>
  </div>;
}
