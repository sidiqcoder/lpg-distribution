import { useState } from 'react';
import { useApi } from '../hooks';
import { apiJson } from '../api';
import { notifyDataChanged } from '../events';
import { todayWITA } from '../utils';

export default function LocationDemands({ date }) {
  const { data, error, reload } = useApi('/manager/demands', { params: { date }, interval: 15000 });
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const readonly = date < todayWITA();
  const keyFor = r => r.location_no ?? r.id;
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const entries = (data?.routes || []).map(r => ({ ...(r.location_no ? { location_no: r.location_no } : { id: Number(r.id) }), quantity: Number(draft[keyFor(r)] ?? r.permintaan_tabung) }));
      if (!entries.length) { setMessage('Belum ada perubahan permintaan.'); return; }
      await apiJson('/manager/demands', { date, entries });
      setDraft({}); notifyDataChanged({ type: 'location-demands', date });
      setMessage('Permintaan disimpan dan dapat dilihat oleh sopir.'); await reload();
    } catch (err) { setMessage(err.message); } finally { setBusy(false); }
  };
  return <section className="card mb"><h2>Permintaan Tabung per Lokasi</h2>
    <p>Isi permintaan harian untuk seluruh 20 lokasi, termasuk 0 jika tidak ada permintaan. Tombol simpan mengonfirmasi semua angka pada tanggal {date}. Sopir melihat jumlah pada tujuan dan peta. Jadwal dimulai 09.00 WITA dengan jeda satu jam.</p>
    {readonly && <p className="banner warn">Riwayat permintaan hanya dapat dilihat.</p>}
    {error && <p role="alert">{error.message}<button type="button" onClick={reload}>Coba Lagi</button></p>}
    {message && <p role="status">{message}</p>}
    {!data && !error && <p>Memuat permintaan...</p>}
    <form onSubmit={submit}><div className="table-wrap"><table className="data"><thead><tr><th>Sopir</th><th>Lokasi</th><th>Batas Tiba (WITA)</th><th>Permintaan (Tabung)</th></tr></thead>
      <tbody>{data?.routes?.map(r => <tr key={keyFor(r)}><td>{r.sopir_nama}</td><td>{r.pangkalan_nama}<small className="demand-location-status">{r.entered ? 'Sudah diisi manager' : 'Belum dikonfirmasi hari ini'}</small></td><td>{r.estimasi_waktu_tiba || '-'}</td><td><input aria-label={`Permintaan ${r.pangkalan_nama} untuk ${r.sopir_nama}`} type="number" min="0" max="100000" step="1" required disabled={busy || readonly} value={draft[keyFor(r)] ?? r.permintaan_tabung} onChange={e => setDraft(v => ({ ...v, [keyFor(r)]: e.target.value }))} /></td></tr>)}</tbody></table></div>
      <p className="mt">Total permintaan: <strong>{(data?.routes || []).reduce((sum,r)=>sum+Number(draft[keyFor(r)] ?? r.permintaan_tabung),0)} tabung</strong></p>
      {[...new Set((data?.routes||[]).map(r=>r.sopir_nama))].map(name=>{
        const total=data.routes.filter(r=>r.sopir_nama===name).reduce((sum,r)=>sum+Number(draft[keyFor(r)]??r.permintaan_tabung),0);
        return <p className={total>543?'text-red':'muted'} key={name}>{name}: {total} tabung{total>543?' — melebihi kapasitas 543 tabung sekali muat; perlu pengaturan ritase.':''}</p>;
      })}
      <button className="btn btn-primary mt" disabled={busy || readonly || !data?.routes?.length}>{busy ? 'Menyimpan...' : 'Simpan Permintaan Lokasi'}</button>
    </form>
  </section>;
}
