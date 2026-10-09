// =====================================================================
// lib/storage.js
// Penanganan upload berkas: Supabase Storage (Cloud) & Disk Lokal (Fallback)
// =====================================================================

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'lpg-uploads';

const isSupabaseStorage = Boolean(SUPABASE_URL && SUPABASE_KEY);
const supabase = isSupabaseStorage ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const localUploadDir = path.join(__dirname, '..', 'uploads');
if (!isSupabaseStorage && !fs.existsSync(localUploadDir)) {
  fs.mkdirSync(localUploadDir, { recursive: true });
}

/**
 * Menyimpan satu file (buffer) ke Supabase Storage atau disk lokal
 * @param {Object} file - Objek file dari multer (memoryStorage)
 * @returns {Promise<string>} Nama file unik yang tersimpan
 */
async function saveUploadedFile(file) {
  if (!file || !file.buffer) return null;

  const ext = path.extname(file.originalname || '') || '.jpg';
  const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  if (isSupabaseStorage && supabase) {
    const { error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(filename, file.buffer, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: true
      });

    if (error) {
      console.error('[Storage] Gagal upload ke Supabase Storage:', error);
      throw error;
    }
    return filename;
  }

  // Fallback ke penyimpanan disk lokal
  const filePath = path.join(localUploadDir, filename);
  fs.writeFileSync(filePath, file.buffer);
  return filename;
}

/**
 * Mendapatkan URL publik untuk file
 * @param {string} filename
 * @returns {string}
 */
function getFileUrl(filename) {
  if (!filename) return '';
  if (filename.startsWith('http://') || filename.startsWith('https://')) return filename;
  if (isSupabaseStorage && SUPABASE_URL) {
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET_NAME}/${filename}`;
  }
  return `/uploads/${filename}`;
}

module.exports = {
  isSupabaseStorage,
  saveUploadedFile,
  getFileUrl,
  BUCKET_NAME,
  SUPABASE_URL
};
