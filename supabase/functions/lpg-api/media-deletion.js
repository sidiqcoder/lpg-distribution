// Remove only unreferenced objects, supporting inline Storage, multipart and R2.
export function mediaDeletion(database,supabase,r2,isR2Name) {
  return async function removeMedia(filenames) {
    if(!filenames.length) return;
    for(const name of filenames) {
      const [references]=await database.unsafe(`SELECT EXISTS (
        SELECT 1 FROM sopir WHERE sertifikat_k3=$1
        UNION ALL SELECT 1 FROM pengiriman WHERE $1 IN (foto_sebelum,foto_proses,foto_sesudah,tanda_tangan)
        UNION ALL SELECT 1 FROM laporan_bahaya WHERE foto_bukti=$1
        UNION ALL SELECT 1 FROM fatigue_reports WHERE $1 IN (foto,video)
        UNION ALL SELECT 1 FROM inspeksi_pagi WHERE position($1 IN coalesce(lampiran_json,''))>0
          OR $1 IN (foto_kendaraan,foto_ban,foto_rem,foto_lampu,foto_bak,foto_kebocoran,foto_pemadam,foto_p3k,
          foto_kit,foto_dokumen,foto_tangki,foto_integritas_bak,foto_kit_tumpah,foto_sopir_fit)
      ) AS found`,[name]);
      if(references.found) continue;
      const removed=await r2.remove([name]);
      if(!removed.includes(name)||!isR2Name(name)) {
        const [manifest]=await database.unsafe('SELECT parts FROM lpg_private.media_files WHERE filename=$1',[name]);
        const {error}=await supabase.storage.from('lpg-uploads').remove(manifest?.parts||[name]);
        if(error) throw error;
      }
      await database.unsafe('DELETE FROM lpg_private.media_files WHERE filename=$1',[name]);
    }
  };
}
