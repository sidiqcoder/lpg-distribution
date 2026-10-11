export function registerStorageRoutes(app, { database, supabase, media, r2 }) {
  app.get('/api/manager/storage/status', async (_req, res) => {
    const [usage] = await database.unsafe(`SELECT count(*)::int AS videos, coalesce(sum(total_size),0)::text AS bytes FROM lpg_private.r2_files WHERE ready`);
    res.json({ ...r2.status(), r2Videos: usage.videos, r2Bytes: Number(usage.bytes) });
  });

  app.get('/api/manager/storage/source-videos', async (_req, res) => {
    // Source URLs deliberately use Supabase even after an R2 copy is ready, so
    // the migration tool can independently compare both copies before release.
    const rows = await database.unsafe(`SELECT source.*, coalesce(r.ready,false) AS target_ready FROM (
      SELECT name AS filename, (metadata->>'size')::bigint AS size, metadata->>'mimetype' AS type
        FROM storage.objects WHERE bucket_id = 'lpg-uploads' AND metadata->>'mimetype' LIKE 'video/%'
      UNION ALL
      SELECT filename, total_size AS size, content_type AS type FROM lpg_private.media_files WHERE ready AND content_type LIKE 'video/%'
    ) source LEFT JOIN lpg_private.r2_files r USING (filename) ORDER BY source.filename`);
    const urls = await media.sign(rows.map(row => row.filename));
    const ordinary = rows.map(row => row.filename).filter(name => !urls.has(name));
    if (ordinary.length) {
      const { data, error } = await supabase.storage.from('lpg-uploads').createSignedUrls(ordinary, 3600);
      if (error) throw error;
      for (const item of data || []) if (item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    const targets = await r2.sign(rows.filter(row => row.target_ready).map(row => row.filename));
    res.json({ ...r2.status(), videos: rows.map(row => ({ ...row, size: Number(row.size), sourceUrl: urls.get(row.filename), targetUrl: targets.get(row.filename) })) });
  });

  app.post('/api/manager/storage/release-source', async (req, res) => {
    const { filename } = req.body;
    if (typeof filename !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(filename)) throw Object.assign(new Error('Nama file tidak valid.'), { status: 400 });
    const [target] = await database.unsafe(`SELECT * FROM lpg_private.r2_files WHERE filename = $1 AND ready AND purpose = 'migration' AND owner = $2`, [filename, req.user.username]);
    if (!target || !r2.status().r2Configured) throw Object.assign(new Error('Salinan R2 belum siap. Berkas sumber dipertahankan.'), { status: 409 });
    // Revalidate R2 availability and size before releasing the original. Original
    // logical filenames and every operational report reference stay unchanged.
    const targetUrl = (await r2.sign([filename])).get(filename);
    const head = await fetch(targetUrl, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(20000) });
    await head.body?.cancel();
    if (head.status !== 206 || head.headers.get('content-range') !== `bytes 0-0/${target.total_size}`) throw Object.assign(new Error('Salinan R2 belum dapat dibaca. Berkas sumber dipertahankan.'), { status: 409 });
    const [manifest] = await database.unsafe('SELECT parts FROM lpg_private.media_files WHERE filename = $1', [filename]);
    const { error } = await supabase.storage.from('lpg-uploads').remove(manifest?.parts || [filename]);
    if (error) throw error;
    await database.unsafe('DELETE FROM lpg_private.media_files WHERE filename = $1', [filename]);
    res.json({ ok: true, filename });
  });
}
