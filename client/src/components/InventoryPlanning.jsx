import { useApi } from '../hooks';
const number=v=>v==null?'Belum tersedia':Number(v).toLocaleString('id-ID',{maximumFractionDigits:2});
export default function InventoryPlanning({date}) {
  const {data,error,reload}=useApi('/manager/inventory-planning',{params:{date},interval:15000});
  return <section className="card mb"><h2>Safety Stock &amp; Reorder Point</h2>
    {error&&<p role="alert">{error.message}<button onClick={reload}>Coba Lagi</button></p>}
    {!data&&!error&&<p>Memuat perhitungan persediaan...</p>}
    {data&&<>
      {data.reorder&&<p className="banner bad" role="alert"><strong>Segera order LPG lagi.</strong> Stok {data.stock} tabung sudah mencapai atau di bawah reorder point {data.reorderPoint} tabung.</p>}
      {!data.dayCount?<p className="banner warn">Isi dan simpan permintaan seluruh 20 lokasi terlebih dahulu. Safety stock dan reorder point menunggu data permintaan manager.</p>:data.provisional?<p className="banner warn">Perhitungan sementara memakai {data.dayCount} dari 6 hari data lengkap. Nilai otomatis diperbarui ketika permintaan harian berikutnya disimpan.</p>:<p>Perhitungan memakai 6 hari terakhir dengan input lengkap 20 lokasi, sampai tanggal {date}.</p>}
      <div className="stat-grid mt"><div className="stat-card"><h3>Safety Stock</h3><strong>{number(data.safetyStock)}{data.safetyStock!=null?' tabung':''}</strong></div><div className="stat-card"><h3>Reorder Point</h3><strong>{number(data.reorderPoint)}{data.reorderPoint!=null?' tabung':''}</strong></div><div className="stat-card"><h3>Rata-rata Permintaan (D)</h3><strong>{number(data.averageDemand)} tabung/hari</strong></div></div>
      <p className="mt">SS = 1,645 × D × σL. ROP = (D × L) + SS. Hasil dibulatkan ke atas ke tabung utuh.</p>
      <p className="muted">Asumsi lead time enam hari: {data.leadTimes?.join(', ')} hari. Rata-rata L = {number(data.leadMean)} hari; standar deviasi populasi σL = {number(data.leadStd)} hari. Sampel ini merupakan asumsi sesuai dokumen, bukan riwayat pasokan aktual.</p>
      <div className="table-wrap mt"><table className="data"><thead><tr><th>Tanggal input lengkap</th><th>Total 20 lokasi (tabung)</th></tr></thead><tbody>{data.days?.map(d=><tr key={d.tanggal}><td>{d.tanggal}</td><td>{number(d.total)}</td></tr>)}</tbody></table></div>
      <p className="muted text-sm">Peringatan membandingkan ROP dengan stok gudang saat ini. Riwayat tanggal tanpa input lengkap tidak dihitung sebagai permintaan nol.</p>
    </>}
  </section>;
}
