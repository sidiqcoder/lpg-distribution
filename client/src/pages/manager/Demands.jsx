import { useOutletContext } from 'react-router-dom';
import LocationDemands from '../../components/LocationDemands';
import RoutePlanning from '../../components/RoutePlanning';
import BackButton from '../../components/BackButton';

export default function ManagerDemands() {
  const {date,setDate}=useOutletContext();
  return <div>
    <div className="page-head"><div><BackButton fallback="/manager" label="Kembali ke Ringkasan"/><h1>Permintaan per Lokasi</h1><p className="subtitle">Permintaan harian 20 lokasi dan pembagian rute Budi / Ahmad</p></div>
      <label>Tanggal permintaan <input aria-label="Tanggal permintaan" type="date" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/></label>
    </div>
    <LocationDemands key={date} date={date}/>
    <RoutePlanning date={date}/>
  </div>;
}
