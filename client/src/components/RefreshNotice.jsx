export default function RefreshNotice({ error, reload }) {
  if (!error) return null;
  return <div className="banner warn mb" role="alert">
    Pembaruan data gagal. Menampilkan data terakhir. {error.message}
    {reload && <button type="button" className="btn btn-sm btn-outline ml" onClick={reload}>Coba Lagi</button>}
  </div>;
}
