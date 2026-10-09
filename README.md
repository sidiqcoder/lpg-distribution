# Sistem Distribusi LPG — PT Macan Gading

Frontend React/Vite siap di-host sebagai website statis di Vercel. Seluruh API berjalan di Supabase Edge Functions; data operasional disimpan di PostgreSQL Supabase dan lampiran di Storage privat. Frontend lokal terhubung langsung ke project cloud yang sama.

Project: [lpg-distribution-app di Supabase](https://supabase.com/dashboard/project/lvrxcxskroskkeifjyry). Region: Singapore. Backend: `supabase/functions/lpg-api/index.ts`. Frontend: `client/src/main.jsx`.

## Menjalankan lokal

```powershell
npm ci
npm ci --prefix client
npm run dev
```

Buka **http://127.0.0.1:5173**. `client/.env.local` sudah dikonfigurasi di workspace ini dan diabaikan oleh Git. Pada checkout baru, salin `client/.env.example` ke `client/.env.local`, lalu isi URL project dan publishable key.

Login dan password lama tetap berlaku. URL `/login`, `/admin/login`, `/sopir/*`, dan `/manager/*` tetap sama. Aplikasi tidak memerlukan server Express atau database SQLite saat digunakan.

## Deploy frontend ke Vercel

Deploy dilakukan oleh pemilik project. Gunakan **`client`** sebagai Root Directory dan framework **Vite**. Biarkan override install/build/output nonaktif; `client/vercel.json` sudah mengatur perintah untuk direktori ini:

| Setting | Nilai |
| --- | --- |
| Root Directory | `client` |
| Install Command | `npm ci` |
| Build Command | `npm run build` |
| Output Directory | `dist` |
| `VITE_SUPABASE_URL` | `https://lvrxcxskroskkeifjyry.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key dari `client/.env.local` atau dashboard Supabase |

Isi kedua environment variable pada environment Vercel yang dipakai, kemudian build/deploy. Environment variable tidak otomatis diambil dari `.env.local` laptop karena file tersebut tidak masuk Git. URL halaman dalam aplikasi memakai SPA rewrite. Backend sudah aktif di Supabase dan tidak perlu di-deploy ke Vercel. Tidak ada service role key atau password database di frontend.

Untuk project Vercel yang memakai root repository, `vercel.json` di root tetap tersedia dengan install `npm ci --prefix client`, build `npm run build`, dan output `client/dist`. Jangan memakai perintah dengan `--prefix client` apabila Root Directory sudah `client`, karena perintah itu mencari direktori `client/client`.

## Workflow yang dipertahankan

1. Sopir masuk dengan username/password.
2. Sopir memilih kendaraan, mengisi checklist inspeksi, dan melampirkan foto/video.
3. Manager melakukan review dan memberi keputusan AMAN/TIDAK_AMAN beserta catatan.
4. Sopir mengajukan LPG dengan kapasitas maksimum 543 tabung; manager menyetujui atau menolak.
5. On-Duty tersedia setelah inspeksi AMAN dan LPG DISETUJUI. Sopir memilih pangkalan di rute, mengisi penerima dan jumlah tabung, serta mengunggah bukti pengiriman.
6. Tracking, laporan bahaya, sertifikat K3, penilaian/rekomendasi KPI, filter tanggal, dan ekspor Excel tersedia melalui menu semula.

Keputusan LPG memakai transaksi dan penguncian baris. Persetujuan berulang tidak memotong stok berulang; perubahan pengajuan mengembalikan alokasi sebelumnya sebelum menunggu keputusan baru. Rute harian memakai algoritma optimasi dan pembagian zona semula, dibuat ketika API dipakai dan mengisi tanggal yang belum ada hingga 14 hari terakhir. Data GPS disimpan di database sehingga tidak bergantung pada proses server yang tetap hidup. Tampilan memperbarui data dengan interval polling yang sudah ada.

## Akses dan lampiran

API mempertahankan login username/password dengan sesi opaque selama tujuh hari. Password memakai bcrypt PostgreSQL; database menyimpan hash token sesi, bukan token mentah. Akun dan sesi berada di skema privat `lpg_private`. Logout menghapus sesi server. Gagal masuk berulang membatasi akun selama 15 menit.

Setiap endpoint memeriksa sesi dan peran. Sopir hanya dapat membaca atau mengubah datanya sendiri dan melihat posisi GPS sendiri. Manager mendapat akses operasional perusahaan. Semua tabel mempunyai RLS; akses tabel langsung dari `anon` dan `authenticated` dicabut. API mengakses database melalui koneksi server yang tersedia otomatis di Edge Functions. RLS tanpa policy adalah penolakan akses browser yang disengaja dalam arsitektur ini; [penjelasan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Bucket `lpg-uploads` privat. API mengembalikan URL lampiran bertanda tangan dengan masa berlaku satu jam hanya setelah data terkait lolos pemeriksaan akses. Ekspor Excel diunduh dengan header autentikasi. Foto, video, dan PDF didukung. File besar diunggah otomatis dalam bagian 16 MB; registry privat menyimpan ukuran, tipe, dan urutan bagian. Pengguna tetap memilih file dan mengirim form seperti biasa. API menyajikan video utuh dengan HTTP Range sehingga pemutaran dan pencarian posisi video tetap bekerja. Batas ukuran logis per file 2 GB. GPS meminta izin lokasi dari browser, sesuai workflow lama.

## Migrasi dan sumber lama

690 baris dari 11 tabel SQLite dipindahkan, termasuk 104 riwayat optimasi rute. Data awal persediaan 520 tabung dipertahankan. Semua 219 file yang tersedia di `uploads/` dipindahkan dengan nama logis aslinya, termasuk dua video 72 MB yang disimpan sebagai beberapa objek Storage. Referensi lampiran yang sudah tidak mempunyai file pada sumber lokal tidak dapat dipulihkan oleh migrasi.

Tiga pengiriman lama memiliki `waktu_selesai` berupa `Inval`. Nilai aslinya dipertahankan di `pengiriman.legacy_waktu_json`; kolom TIME yang bersangkutan bernilai NULL. Kolom inspeksi versi lama ikut dipertahankan. Password plaintext hanya ada di sumber SQLite asli dan tidak dipindahkan ke tabel publik Supabase.

`legacy/` berisi kode sebelum rebuild sebagai referensi. `lpg_database.db` dan `uploads/` tetap disimpan sebagai sumber dan tidak dimodifikasi. `.vercelignore` mengecualikan sumber lama, data lokal, alat migrasi, dan file test dari frontend Vercel.

Migration SQL yang sudah diterapkan ada di `supabase/migrations/`. `npm run migrate:prepare` hanya membaca sumber lokal dan menyiapkan SQL impor privat di `.local/import-data.sql`; tidak menerapkan SQL otomatis. `npm run migrate:uploads` adalah alat manager untuk memindahkan lampiran lama, dengan pemeriksaan nama file, retry jaringan, dan dukungan melanjutkan berdasarkan `.local/storage-existing.json` yang diperoleh dari daftar objek project. Alat ini memerlukan `curl`, yang sudah tersedia pada Windows di workspace ini.

Untuk perubahan backend berikutnya, gunakan Supabase CLI/MCP yang sudah terautentikasi. Jalankan `npx supabase functions deploy --help` untuk memeriksa opsi CLI yang terpasang; deploy function `lpg-api` ke project yang sama. Konfigurasi `verify_jwt = false` diperlukan karena login username/password memakai autentikasi sesi custom di dalam function, bukan JWT Supabase Auth.

## Validasi

```powershell
npm run check:backend
npm run build
npm test
```

Browser test memakai Playwright/Chromium dan backend cloud. Bila belum tersedia, jalankan `npm exec --prefix client -- playwright install chromium`. Test pembacaan mencakup login lama, seluruh halaman sopir/manager, pemulihan sesi, batas akses, unduh Excel, tampilan mobile, dan video besar. Uji video membandingkan byte awal, akhir, dan range yang melintasi dua bagian dengan file sumber. Test penulisan membutuhkan kredensial sopir uji terisolasi di `.local/e2e-credentials.json`; tanpa fixture, test tersebut dilewati. Jangan membuat fixture memakai akun operasional. Pengujian penulisan yang dilakukan saat rebuild memakai akun sementara dan dibersihkan setelahnya.

Screenshot verifikasi serta laporan migrasi lokal disimpan di `.local/`, yang tidak ikut Git/deployment.
