import { useAuth } from '../auth';
import { useApi } from '../hooks';
import { fmtSubmit } from '../utils';

export default function DeliveryAnnouncements() {
  const { user } = useAuth();
  const { data, error } = useApi(`/driver/${user.id}/announcements`, { interval: 15000 });
  if (error) return <p className="banner warn" role="status">Pemberitahuan deadline belum diperbarui: {error.message}</p>;
  if (!data?.overdue?.length) return null;
  return <div className="banner bad mb" role="alert" aria-live="polite">
    <strong>Pengiriman melewati batas waktu</strong>
    <p>Segera lakukan pengiriman dengan tetap mengikuti prosedur keselamatan. Keterlambatan tercatat dalam KPI ketepatan pengiriman.</p>
    <ul>{data.overdue.map(r => <li key={r.id}>{r.pangkalan_nama} — batas tiba {fmtSubmit(r.deadline_at)}, permintaan {r.permintaan_tabung} tabung.</li>)}</ul>
  </div>;
}
