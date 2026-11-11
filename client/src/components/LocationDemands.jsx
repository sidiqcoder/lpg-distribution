import { useState } from 'react';
import { useApi } from '../hooks';
import { apiJson } from '../api';
import { notifyDataChanged } from '../events';

export default function LocationDemands({ date }) {
  const { data, error, reload } = useApi('/manager/demands', { params: { date }, interval: 15000 });
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const entries = (data?.routes || []).filter(r => draft[r.id] !== undefined).map(r => ({ id: Number(r.id), quantity: Number(draft[r.id]) }));
      if (!entries.length) { setMessage('Belum ada perubahan permintaan.'); return; }
      await apiJson('/manager/demands', { date, entries });
      setDraft({}); notifyDataChanged({ type: 'location-demands', date });
      setMessage('Permintaan disimpan dan dapat dilihat oleh sopir.'); await reload();
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };
  return <section className="card mb"><h2>Permintaan Tabung per Lokasi</h2>
    <p>Isi jumlah tabung untuk setiap tujuan. Jadwal dimulai 09.00 WITA dengan jeda satu jam.</p>
    {error && <p role="alert">{error.message}<button type="button" onClick={reload}>Coba Lagi</button></p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p>Memuat permintaan...</p>}
    <form onSubmit={submit}><div className="table-wrap"><table className="data"><thead><tr><th>Sopir</th><th>Lokasi</th><th>Batas Tiba (WITA)</th><th>Permintaan (Tabung)</th></tr></thead>
      <tbody>{data?.routes?.map(r => <tr key={r.id}><td>{r.sopir_nama}</td><td>{r.pangkalan_nama}</td><td>{r.estimasi_waktu_tiba}</td><td><input aria-label={`Permintaan ${r.pangkalan_nama} untuk ${r.sopir_nama}`} type="number" min="0" max="100000" step="1" required disabled={busy} value={draft[r.id] ?? r.permintaan_tabung} onChange={e => setDraft(v => ({ ...v, [r.id]: e.target.value }))} /></td></tr>)}</tbody></table></div>
      <button className="btn btn-primary mt" disabled={busy || !data?.routes?.length}>{busy ? 'Menyimpan...' : 'Simpan Permintaan Lokasi'}</button>
    </form>
  </section>;
}
