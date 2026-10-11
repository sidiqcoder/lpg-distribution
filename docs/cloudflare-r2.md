# Video Cloudflare R2

Video baru (fatigue, inspeksi, dan lampiran video lain) menggunakan R2 Standard setelah konfigurasi backend aktif. Foto dan PDF tetap di Supabase Storage. Database Supabase menyimpan lokasi objek dan metadata; tidak menyimpan URL sementara sebagai alamat permanen. Frontend mengunggah video langsung ke R2 dan mengirim referensinya ke API. Pemutaran menggunakan URL R2 privat yang berlaku satu jam.

## Membuat bucket dan kunci

1. Buka [Cloudflare Dashboard](https://dash.cloudflare.com/), pilih akun, lalu **Storage & databases > R2 > Overview**. Aktifkan R2 jika belum aktif; aktivasi melalui checkout Cloudflare dan biaya mengikuti pemakaian.
2. Pilih **Create bucket**, gunakan nama `lpg-videos`, dan storage class **Standard**. Biarkan **Public Development URL** dan akses publik lain nonaktif.
3. Salin **Account ID** pada halaman R2 Overview. Nama bucket terlihat di daftar bucket.
4. Pada R2 Overview, buka **Manage R2 API Tokens** (Account API Tokens), kemudian buat token **Object Read & Write** khusus bucket `lpg-videos`. Simpan **Access Key ID** dan **Secret Access Key** langsung sebagai secret backend. Jangan kirim kunci ke chat, commit Git, atau environment `VITE_`.

Referensi: [memulai R2](https://developers.cloudflare.com/r2/get-started/), [kunci API](https://developers.cloudflare.com/r2/api/tokens/), dan [harga R2](https://developers.cloudflare.com/r2/pricing/).

## Mengaktifkan backend

Buka [Supabase > Edge Functions > Secrets](https://supabase.com/dashboard/project/lvrxcxskroskkeifjyry/functions/secrets), lalu tambahkan lima nilai berikut:

| Secret | Nilai |
| --- | --- |
| `VIDEO_STORAGE_PROVIDER` | `r2` |
| `R2_ACCOUNT_ID` | Account ID Cloudflare |
| `R2_BUCKET_NAME` | `lpg-videos` atau nama bucket Anda |
| `R2_ACCESS_KEY_ID` | Access Key ID token bucket |
| `R2_SECRET_ACCESS_KEY` | Secret Access Key token bucket |

Template tersedia di `supabase/r2-secrets.example.env`. Alternatif jika Supabase CLI sudah login: salin template ke `supabase/r2-secrets.env` (diabaikan Git), isi nilainya, lalu jalankan:

```powershell
npx supabase secrets set --project-ref lvrxcxskroskkeifjyry --env-file supabase/r2-secrets.env
```

Tanpa konfigurasi R2, instalasi yang sudah ada tetap memakai Supabase. Jika `VIDEO_STORAGE_PROVIDER=r2` dipilih tetapi kredensial belum lengkap, unggahan video ditolak dengan pesan konfigurasi; aplikasi tidak diam-diam mengisi Storage Supabase.

Pada bucket R2 > Settings > CORS Policy, gunakan `supabase/r2-cors.example.json`, ganti domain contoh dengan domain frontend Vercel yang sebenarnya. Origin harus sama persis, termasuk protokol dan port. Tidak perlu mengaktifkan bucket publik. Setelah itu deploy ulang frontend Vercel untuk memakai unggahan langsung. Backend juga melayani frontend lama dengan mengunggah video multipart ke R2 melalui server, tetapi jalur ini tetap melewati Edge Function.

Pada bucket > Settings > Object lifecycle rules, tambahkan aturan untuk prefix **`staging/`** dengan penghapusan setelah **1 hari**. Aturan ini hanya membersihkan unggahan sementara yang terputus. Jangan memberi aturan penghapusan seluruh `videos/`: folder tersebut juga berisi bukti inspeksi dan kejadian yang masih dipakai. Retensi otomatis rekaman operasional belum diaktifkan; kapasitas R2 tetap perlu dipantau.

## Verifikasi

Setelah login manager, endpoint `/api/manager/storage/status` menampilkan provider, kelengkapan konfigurasi, jumlah video R2 yang selesai, dan total byte terdaftar. Kelengkapan secret bukan bukti koneksi berhasil: unggah rekaman dari dashboard sopir, buka di dashboard manager, dan pastikan objek final berada pada prefix `videos/` di R2.

API memeriksa ukuran, tipe, serta pemilik sebelum menerima referensi file. Rekaman fatigue R2 juga harus memiliki capture ID yang cocok, ukuran maksimum 12 MB, dan durasi metadata 5–10 detik. Kegagalan laporan setelah unggahan selesai menggunakan file yang sama saat retry. File final disalin dari staging dengan kondisi ETag agar tautan unggah lama tidak dapat menimpa bukti yang sudah selesai. Signed URL tetap merupakan akses sementara bagi pemegang tautan; jangan membagikannya kepada pihak lain.

## Memindahkan video lama

Alat berikut membaca sumber dari Supabase, menyalin ke R2, lalu membandingkan ukuran dan SHA-256 seluruh isi kedua salinan. Nama logis dipertahankan sehingga laporan lama tidak perlu diubah. Video besar yang sebelumnya terpecah di Supabase dibaca sebagai video utuh. Download migrasi memakai kuota transfer Supabase; menjalankan ulang verifikasi juga memakai transfer.

Isi `MANAGER_USERNAME` dan `MANAGER_PASSWORD` pada `.env` privat di root. Lalu:

```powershell
# Pratinjau jumlah video dan ukuran; tidak menyalin atau menghapus.
npm run migrate:videos:r2

# Salin dan verifikasi; sumber Supabase tetap ada.
node scripts/migrate-videos-r2.js --apply

# Salin/verifikasi dan lepaskan sumber setelah hash cocok.
node scripts/migrate-videos-r2.js --apply --release-source
```

Jika proses terputus, jalankan ulang perintah yang sama. Sumber yang belum diverifikasi tetap disimpan. Laporan verifikasi berada di `.local/r2-migration/report.json`; file sementara lokal dibersihkan setelah masing-masing video. Supabase tidak lebih ringan sampai sumber yang sudah terverifikasi dilepas. Migrasi belum dapat dijalankan sebelum R2 dikonfigurasi.

## Pengujian lokal

```powershell
npm run check:backend
npm run test:backend
npm run test:migration
npm run build
node client/node_modules/@playwright/test/cli.js test --config client/playwright.config.js
```

Uji backend mencakup penandatanganan, pemilik, ukuran, tipe, finalisasi, retry, dan pembacaan campuran. Mock browser membuktikan byte video dikirim ke R2 tanpa token aplikasi dan laporan tetap bisa diulang tanpa unggahan ganda. Uji R2 nyata membutuhkan kredensial dan CORS aktif; hasil mock tidak membuktikan koneksi Cloudflare nyata.
