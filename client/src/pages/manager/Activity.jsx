import { useOutletContext } from 'react-router-dom';
import ActivityReports from '../../components/ActivityReports';

export default function ManagerActivity() {
  const { date, setDate } = useOutletContext();
  return <div>
    <div className="page-head"><div><h1>Aktivitas & Fatigue Sopir</h1><p className="subtitle">Riwayat login, rekaman kondisi sopir, dan peninjauan manager.</p></div>
      <label>Tanggal Laporan (WITA)<input type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
    </div>
    <ActivityReports date={date} />
  </div>;
}
