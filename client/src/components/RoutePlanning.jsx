import { useEffect, useRef, useState } from 'react';
import { useApi } from '../hooks';
import { apiJson } from '../api';
import { notifyDataChanged } from '../events';
import { todayWITA } from '../utils';
import MapCanvas,{ L,locationIcon,numberIcon,escapeHtml } from './MapCanvas';

export default function RoutePlanning({date}) {
  const {data,error,reload}=useApi('/manager/route-planning',{params:{date},interval:30000});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[map,setMap]=useState(null);
  const layer=useRef(null),fitted=useRef(false);
  useEffect(()=>{
    if(!map||!data?.routes)return;
    if(layer.current)map.removeLayer(layer.current);
    layer.current=L.layerGroup().addTo(map);
    L.marker([-8.511797322884732,115.10983104232992],{icon:numberIcon('#15803d','G')}).addTo(layer.current).bindPopup('Gudang: titik awal dan akhir rute');
    const all=[];
    data.routes.forEach((route,index)=>{
      const color=index===0?'#b91c1c':'#2563eb';
      const origin=[-8.511797322884732,115.10983104232992];
      const points=[origin];
      route.sequence.forEach((no,order)=>{
        const location=data.locations.find(p=>p.no===no); if(!location)return;
        const point=[location.latitude,location.longitude]; points.push(point); all.push(point);
        L.marker(point,{icon:locationIcon(color)}).addTo(layer.current).bindTooltip(`${order+1}. ${escapeHtml(location.nama)}`).bindPopup(`${route.driver==='budi'?'Budi':'Ahmad'} · ${order+1}. ${escapeHtml(location.nama)}`);
      });
      L.polyline([...points,origin],{color,weight:3,dashArray:'6 6'}).addTo(layer.current);
    });
    if(all.length&&!fitted.current&&!map.lpgUserMoved){map.fitBounds(all,{padding:[25,25]});fitted.current=true;}
  },[map,data]);
  const calculate=async()=>{
    setBusy(true);setMessage('');
    try{await apiJson('/manager/route-planning',{date});notifyDataChanged({type:'route-plan'});await reload();setMessage('Rute Google disimpan dan diterapkan pada tanggal yang dipilih.');}
    catch(err){setMessage(err.message);}finally{setBusy(false);}
  };
  const name=no=>no===0?'Gudang':data.locations?.find(p=>p.no===no)?.nama||no;
  return <section className="card mt"><h2>Perencanaan Rute Dua Kendaraan</h2>
    {error&&<p role="alert">{error.message}<button onClick={reload}>Coba Lagi</button></p>}
    {!data&&!error&&<p>Memuat perhitungan rute...</p>}
    {data&&<>
      <p className="banner warn">{data.source_label}. {data.googleConfigured?'Google Routes tersedia untuk hitung ulang.':'Integrasi jarak Google Maps menunggu API key; saat ini menggunakan matriks contoh dokumen revisi kedua.'}</p>
      <p>Saving Matrix: S(i,j) = d(i,Gudang) + d(Gudang,j) − d(i,j). Penggabungan berdasarkan penghematan terbesar dibatasi dua kelompok, masing-masing 10 lokasi. Urutan tiap kelompok dihitung dengan Nearest Neighbor dari gudang memakai matriks jarak jalan.</p>
      <div className="grid cols-2 mt">{data.routes?.map((route,index)=><div className="card" key={route.driver}>
        <h3>Rute {index+1} — {route.driver==='budi'?'Budi':'Ahmad'}</h3><p>{route.sequence.length} lokasi · {route.km} km termasuk kembali ke gudang</p>
        <ol>{route.sequence.map(no=><li key={no}>{name(no)}</li>)}</ol>
      </div>)}</div>
      <div className="mt"><MapCanvas height={400} onReady={setMap}/><p className="muted text-sm">Merah: Budi · Biru: Ahmad. Garis menghubungkan urutan lokasi; bukan geometri jalan.</p></div>
      <details className="mt"><summary>Matriks jarak 21 titik (km)</summary><div className="table-wrap"><table className="data"><thead><tr><th>Lokasi</th>{data.matrix?.map((_,i)=><th key={i} title={name(i)}>{i===0?'G':i}</th>)}</tr></thead><tbody>{data.matrix?.map((row,i)=><tr key={i}><th>{i===0?'G':i}. {name(i)}</th>{row.map((km,j)=><td key={j}>{km}</td>)}</tr>)}</tbody></table></div></details>
      <details className="mt"><summary>Saving matrix — penghematan terbesar</summary><div className="table-wrap"><table className="data"><thead><tr><th>Dari</th><th>Ke</th><th>Penghematan (km)</th></tr></thead><tbody>{data.savings?.map(edge=><tr key={`${edge.from}-${edge.to}`}><td>{name(edge.from)}</td><td>{name(edge.to)}</td><td>{edge.km.toFixed(2)}</td></tr>)}</tbody></table></div></details>
      <p className="muted mt">Rute yang sudah dipakai untuk pengiriman atau alokasi LPG dikunci. Perubahan rute diterapkan sebelum keberangkatan atau pada tanggal berikutnya.</p>
      <button className="btn btn-outline mt" disabled={busy||!data.googleConfigured||date<todayWITA()} onClick={calculate}>{busy?'Menghitung...':'Hitung Ulang dengan Google Maps'}</button>
    </>}
    {message&&<p role="status">{message}</p>}
  </section>;
}
