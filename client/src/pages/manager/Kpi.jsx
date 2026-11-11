import { useOutletContext } from 'react-router-dom';
import { useApi } from '../../hooks';
import BackButton from '../../components/BackButton';
import RefreshNotice from '../../components/RefreshNotice';

const number = n => Number(n).toLocaleString('id-ID', { maximumFractionDigits: 2 });
export default function ManagerKpi() {
  const { date } = useOutletContext();
  const { data, error, reload } = useApi('/manager/performance', { params: { date }, interval: 10000 });
  return <div><div className="page-head"><div><BackButton fallback="/manager" /><h1>Penilaian Kinerja Sopir (KPI)</h1><p>Tanggal {date} · Perhitungan otomatis dari aktivitas sopir.</p></div><button className="btn btn-outline" onClick={reload}>Perbarui KPI</button></div>
    <RefreshNotice error={error} />
    {!data && <p>{error?.message || 'Menghitung KPI...'}</p>}
    <div className="card mb"><p>Skor = realisasi ÷ target × 100. Skor akhir = skor × bobot ÷ 100. Total merupakan jumlah keenam skor akhir.</p><p>Ketepatan dan penyelesaian dihitung terhadap seluruh tujuan penugasan. Batas tiba pertama 09.00 WITA, tujuan selanjutnya setiap satu jam. Kepatuhan menggunakan sampel GPS berakurasi maksimal 100 meter pada koridor 500 meter dari rute saat pengiriman diizinkan. Tanpa bukti aktivitas, realisasi bernilai 0. Skor dapat melebihi 100 ketika realisasi melampaui target 95%.</p></div>
    {data?.drivers?.map(driver => <section key={driver.sopirId} className="card mb"><h2>{driver.nama}</h2><p>{driver.completed}/{driver.assigned} tujuan selesai · {driver.overdue.length} tujuan melewati deadline · {driver.gpsSamples} sampel GPS</p>
      <div className="table-wrap"><table className="data"><thead><tr>{['No','Area Kinerja Utama','Key Performance Indicators','Bobot KPI','Target','Realisasi','Skor','Skor Akhir'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>
        {driver.items.map(item => <tr key={item.no}><td>{item.no}</td><td>{item.area}</td><td>{item.indicator}</td><td>{item.weight}%</td><td>{item.target === 95 ? '≥' : ''}{item.target}%</td><td>{number(item.realization)}%</td><td>{number(item.score)}</td><td>{number(item.finalScore)}</td></tr>)}
      </tbody><tfoot><tr><th colSpan="3">Total</th><th>100%</th><td colSpan="3" /><th>{number(driver.total)}</th></tr></tfoot></table></div>
    </section>)}
  </div>;
}
