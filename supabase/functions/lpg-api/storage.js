const bucket = 'lpg-uploads';
const mediaKeys = /^(foto(?:_.*)?|video|sertifikat_k3|tanda_tangan)$/;

export function storage(supabase, media) {
  async function saveUploadedFile(file) {
    if (file?.savedFilename) return file.savedFilename;
    if (!file?.buffer) return null;
    const extension = (file.originalname.match(/\.[a-zA-Z0-9]{1,8}$/)?.[0] || '.bin').toLowerCase();
    const name = `${Date.now()}-${crypto.randomUUID()}${extension}`;
    const { error } = await supabase.storage.from(bucket).upload(name, file.buffer, { contentType: file.mimetype, upsert: false });
    if (error) throw error;
    return name;
  }
  async function signMedia(value) {
    const names = new Set();
    function visit(item, replace) {
      if (Array.isArray(item)) return item.map(v => visit(v, replace));
      if (!item || typeof item !== 'object') return item;
      return Object.fromEntries(Object.entries(item).map(([key, content]) => {
        if (key === 'lampiran_json' && typeof content === 'string') {
          try { return [key, JSON.stringify(visit(JSON.parse(content), replace))]; } catch { return [key, content]; }
        }
        if (mediaKeys.test(key) && typeof content === 'string' && content && !/^https?:\/\//.test(content)) {
          if (!replace) names.add(content);
          return [key, replace?.get(content) || content];
        }
        return [key, visit(content, replace)];
      }));
    }
    visit(value);
    if (!names.size) return value;
    const urls = await media.sign([...names]);
    const ordinary = [...names].filter(name => !urls.has(name));
    if (ordinary.length) {
      const { data, error } = await supabase.storage.from(bucket).createSignedUrls(ordinary, 3600);
      if (error) throw error;
      for (const file of data) urls.set(file.path, file.signedUrl);
    }
    return visit(value, urls);
  }
  return { saveUploadedFile, signMedia };
}
