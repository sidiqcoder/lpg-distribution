# Sistem Distribusi LPG — PT Macan Gading

Frontend React/Vite siap di-host sebagai website statis di Vercel. Seluruh API berjalan di Supabase Edge Functions; data operasional disimpan di PostgreSQL Supabase. Video menggunakan Cloudflare R2 privat setelah dikonfigurasi; foto/PDF dan lampiran lama tetap dapat dibaca dari Supabase Storage. Frontend lokal terhubung langsung ke project cloud yang sama.

Project: [lpg di Supabase](https://supabase.com/dashboard/project/nwqnzhegnejtffqsoalx). Region: Tokyo (`ap-northeast-1`). Backend: `supabase/functions/lpg-api/index.ts`. Frontend: `client/src/main.jsx`.

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
| `VITE_SUPABASE_URL` | `https://nwqnzhegnejtffqsoalx.supabase.co` |
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

Keputusan LPG memakai transaksi dan penguncian baris. Persetujuan berulang tidak memotong stok berulang; perubahan pengajuan mengembalikan alokasi sebelumnya sebelum menunggu keputusan baru. Mulai 12 Oktober 2026, rute Budi dan Ahmad mengikuti koordinat dan urutan PDF yang diberikan pengguna: titik keberangkatan bersama dan masing-masing 10 tujuan. Tujuan baru ditambahkan setelah penugasan yang sudah ada pada hari berjalan; hari berikutnya memakai urutan PDF. Riwayat pengiriman dan rute lama dipertahankan. Mulai revisi 4 November 2026, nama 20 tujuan mengikuti tabel dalam `revisi/update perbaikan web 1.docx`, dicocokkan berdasarkan koordinat. Permintaan awal 56 tabung dapat diubah manager per tujuan. Batas tiba dimulai 09.00 WITA dan bertambah satu jam sesuai urutan penugasan. Data GPS disimpan di database sehingga tidak bergantung pada proses server yang tetap hidup.

## Akses dan lampiran

API mempertahankan login username/password dengan sesi opaque selama tujuh hari. Password memakai bcrypt PostgreSQL; database menyimpan hash token sesi, bukan token mentah. Akun dan sesi berada di skema privat `lpg_private`. Logout menghapus sesi server. Gagal masuk berulang membatasi akun selama 15 menit.

Setiap endpoint memeriksa sesi dan peran. Sopir hanya dapat membaca atau mengubah datanya sendiri dan melihat posisi GPS sendiri. Manager mendapat akses operasional perusahaan. Semua tabel mempunyai RLS; akses tabel langsung dari `anon` dan `authenticated` dicabut. API mengakses database melalui koneksi server yang tersedia otomatis di Edge Functions. RLS tanpa policy adalah penolakan akses browser yang disengaja dalam arsitektur ini; [penjelasan advisor Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Bucket `lpg-uploads` privat. API mengembalikan URL lampiran bertanda tangan dengan masa berlaku satu jam hanya setelah data terkait lolos pemeriksaan akses. Ekspor Excel diunduh dengan header autentikasi. Foto, video, dan PDF didukung. File besar diunggah otomatis dalam bagian 16 MB; registry privat menyimpan ukuran, tipe, dan urutan bagian. Pengguna tetap memilih file dan mengirim form seperti biasa. API menyajikan video utuh dengan HTTP Range sehingga pemutaran dan pencarian posisi video tetap bekerja. Batas ukuran logis per file 2 GB. GPS meminta izin lokasi dari browser, sesuai workflow lama.

## Migrasi dan sumber lama

Integrasi video Cloudflare R2 tersedia, termasuk unggahan langsung, verifikasi server, URL menonton sementara, dan alat migrasi dengan pemeriksaan SHA-256. **R2 belum aktif tanpa bucket, secret backend, dan CORS**; instalasi tanpa konfigurasi tetap menggunakan Supabase. Ikuti [panduan Cloudflare R2](docs/cloudflare-r2.md) untuk aktivasi, verifikasi, serta pemindahan/release video lama. Penghapusan otomatis video operasional belum diaktifkan.

690 baris dari 11 tabel SQLite dipindahkan, termasuk 104 riwayat optimasi rute. Data awal persediaan 520 tabung dipertahankan. Semua 219 file yang tersedia di `uploads/` dipindahkan dengan nama logis aslinya, termasuk dua video 72 MB yang disimpan sebagai beberapa objek Storage. Referensi lampiran yang sudah tidak mempunyai file pada sumber lokal tidak dapat dipulihkan oleh migrasi.

Tiga pengiriman lama memiliki `waktu_selesai` berupa `Inval`. Nilai aslinya dipertahankan di `pengiriman.legacy_waktu_json`; kolom TIME yang bersangkutan bernilai NULL. Kolom inspeksi versi lama ikut dipertahankan. Password plaintext hanya ada di sumber SQLite asli dan tidak dipindahkan ke tabel publik Supabase.

`legacy/` berisi kode sebelum rebuild sebagai referensi. `lpg_database.db` dan `uploads/` tetap disimpan sebagai sumber dan tidak dimodifikasi. `.vercelignore` mengecualikan sumber lama, data lokal, alat migrasi, dan file test dari frontend Vercel.

Migration SQL yang sudah diterapkan ada di `supabase/migrations/`. `npm run migrate:prepare` hanya membaca sumber lokal dan menyiapkan SQL impor privat di `.local/import-data.sql`; tidak menerapkan SQL otomatis. `npm run migrate:uploads` adalah alat manager untuk memindahkan lampiran lama, dengan pemeriksaan nama file, retry jaringan, dan dukungan melanjutkan berdasarkan `.local/upload-migrations/<hostname-project>/storage-existing.json`. Progres disimpan per project tujuan setelah setiap batch agar pergantian project tidak melewatkan file yang baru tersedia di project lama. Alat ini memerlukan `curl`, yang sudah tersedia pada Windows di workspace ini.

Untuk perubahan backend berikutnya, gunakan Supabase CLI/MCP yang sudah terautentikasi. Jalankan `npx supabase functions deploy --help` untuk memeriksa opsi CLI yang terpasang; deploy function `lpg-api` ke project yang sama. Konfigurasi `verify_jwt = false` diperlukan karena login username/password memakai autentikasi sesi custom di dalam function, bukan JWT Supabase Auth.

## Validasi

```powershell
npm run check:backend
npm run build
npm test
```

Browser test memakai Playwright/Chromium dan backend cloud. Bila belum tersedia, jalankan `npm exec --prefix client -- playwright install chromium`. Test pembacaan mencakup login lama, seluruh halaman sopir/manager, pemulihan sesi, batas akses, unduh Excel, tampilan mobile, dan video besar. Uji video membandingkan byte awal, akhir, dan range yang melintasi dua bagian dengan file sumber. Test penulisan membutuhkan kredensial sopir uji terisolasi di `.local/e2e-credentials.json`; tanpa fixture, test tersebut dilewati. Jangan membuat fixture memakai akun operasional. Pengujian penulisan yang dilakukan saat rebuild memakai akun sementara dan dibersihkan setelahnya.

Screenshot verifikasi serta laporan migrasi lokal disimpan di `.local/`, yang tidak ikut Git/deployment.

## Pelacakan, laporan WITA, dan pemantauan fatigue

Username manager adalah `manager`. Semua jam, filter hari operasional, timestamp laporan, dan ekspor memakai WITA (`Asia/Makassar`). Jam operasional dan waktu capture disinkronkan dengan header waktu server, termasuk setelah tab aktif kembali, sehingga pengaturan jam perangkat yang keliru tidak menggeser laporan. Respons sesi kedaluwarsa hanya menghapus token yang digunakan permintaan tersebut; perubahan login/logout disinkronkan antar-tab. Tanggal bisnis historis tetap dipertahankan; jam submit sertifikat lama yang tidak pernah dicatat ditampilkan sebagai `-`. Identitas kendaraan ditampilkan sebagai **Truk Engkel**; nama kolom lama `tipe_tangki` dipertahankan untuk kompatibilitas.

GPS berjalan di seluruh dashboard sopir setelah izin lokasi diberikan. Browser meminta posisi baru setiap 15 detik dan mengirim perubahan maksimal sekali per 5 detik. Dashboard manager memperbarui lokasi setiap 5 detik, mencantumkan login terakhir dan jam GPS, serta mempertahankan lokasi terakhir saat pembaruan lebih dari 2 menit. Sopir yang belum memberikan izin GPS tetap terdaftar dengan status menunggu lokasi. Pergeseran dan zoom peta dipertahankan saat polling; tombol lihat posisi / semua sopir memusatkan peta bila dipilih. Penyimpangan diperiksa terhadap segmen antara pangkalan dengan toleransi 500 meter; GPS dengan akurasi lebih buruk dari 100 meter dan lokasi lama tidak diberi peringatan keluar jalur.

Tombol WhatsApp tersedia pada kartu sopir. Untuk posisi yang keluar jalur, tombol peringatan membuka WhatsApp dengan pesan kembali ke jalur yang sudah terisi. Manager menekan kirim di WhatsApp. Pengiriman tanpa interaksi memerlukan integrasi WhatsApp Business tersendiri.

Sopir dapat mengaktifkan pemantauan kamera depan dari dashboard, memilih foto atau video 7 detik, lalu memberikan izin kamera. Rekaman pertama diambil saat aktivasi jika sudah jatuh tempo; berikutnya setiap 30 menit. Perangkat yang tidak mendukung perekaman video memakai foto. Monitoring tetap berjalan saat berpindah menu sopir. Setelah reload atau login baru, sopir mengaktifkan kamera kembali; jadwal terakhir dipulihkan dari server. Perekaman memerlukan HTTPS dan aplikasi aktif; browser/OS dapat menghentikan kamera serta GPS saat layar terkunci. Jadwal yang terlewat dilanjutkan saat aplikasi kembali aktif, tanpa membuat rekaman palsu untuk interval yang terlewat.

Satu rekaman yang belum terkirim disimpan di IndexedDB perangkat dan dicoba ulang saat koneksi tersedia. Capture ID menjaga retry agar tidak mencatat laporan ganda. Video kamera maksimal 12 MB memiliki jalur unggah cadangan melalui API jika unggahan langsung ke R2 gagal; kepemilikan, ukuran, dan capture ID tetap diperiksa. Kesalahan validasi dibedakan dari masalah koneksi dan menyediakan tombol **Kirim Ulang Rekaman**. Waktu rekaman lama yang masih di depan server karena jam perangkat diperbaiki sebelum retry, tanpa menghapus rekaman. Rekaman masuk ke Storage privat dan halaman `/manager/aktivitas`, dengan jam rekam, jam submit aktual, status kamera, dan hasil peninjauan manager. Rekaman tertunda muncul pada tanggal rekam maupun tanggal submit di dashboard dan Excel. Manager memberi penilaian **Fit** atau **Perlu Istirahat** beserta catatan. Penilaian dilakukan manager berdasarkan rekaman; belum ada model pendeteksi fatigue otomatis. Histori login berasal dari login berhasil setelah fitur diterapkan dan sesi lama yang masih tersedia saat migrasi.

`npm test` mencakup regression test backend, mock browser untuk dua perangkat, peta, gangguan koneksi, antrean rekaman, jadwal 30 menit, video 7 detik, dan WITA, serta test cloud yang tersedia. Uji penulisan kamera ke cloud memakai fixture sementara terpisah di `.local/monitoring-credentials.json`; tanpa fixture, test tersebut dilewati. Kredensial, akun, laporan, dan objek Storage sementara dibersihkan setelah verifikasi. Frontend perlu di-deploy ulang ke Vercel agar perubahan UI muncul pada website publik.


## Revisi operasional 4 November 2026

- Halaman login mengarahkan sesi yang masih aktif langsung ke dashboard sesuai peran. Logout atau sesi kedaluwarsa tetap memerlukan login kembali.
- Manager mengatur permintaan tabung setiap lokasi melalui menu **Pengiriman**. Sopir melihat permintaan dan batas tiba pada daftar pengiriman serta popup peta. Draf manager tetap tersimpan saat polling.
- Pemberitahuan tujuan yang melewati deadline tampil di seluruh halaman dashboard sopir dan diperbarui setiap 15 detik. KPI ketepatan menggunakan waktu pencatatan bukti pengiriman di server, termasuk pengiriman yang belum dilakukan.
- KPI otomatis terdiri dari ketepatan (25%, target 95%), penyelesaian tugas (20%, target 100%), kepatuhan rute (15%, target 95%), penyelesaian inspeksi kendaraan (15%, target 100%), bukti pengiriman (10%, target 100%), dan pemeriksaan kondisi sopir (15%, target 100%). Skor = realisasi / target ? 100; skor akhir = skor ? bobot / 100. Total menjumlahkan skor akhir tanpa pembatasan 100 karena target 95% dapat dilampaui.
- Kepatuhan rute menggunakan proporsi sampel GPS dalam koridor 500 meter dari segmen rute, dengan akurasi GPS maksimal 100 meter, setelah inspeksi dan kuota disetujui hingga tujuan selesai. Data yang belum ada menghasilkan realisasi 0. Ini merupakan ukuran berdasarkan sampel GPS, bukan rekonstruksi jarak perjalanan.
- Penyelesaian checklist kendaraan menghitung jawaban BAIK/TIDAK pada bagian selain bagian pengemudi. Form inspeksi merekam konfirmasi pemeriksaan fisik dan tingkat kelelahan. Inspeksi yang dicatat setelah pengiriman pertama tidak mendapat skor pra-keberangkatan. Pemeriksaan ini berupa catatan pengisian sopir, bukan diagnosis otomatis dari kamera.
- Ikon kendaraan memakai SVG dan aset marker Leaflet disertakan dalam build. Nama tujuan tampil sebagai label peta.
- Menu **Laporkan Bahaya & MSDS LPG** tersedia sebelum persetujuan berangkat. Lokasi GPS disertakan jika tersedia; koordinat yang belum tersedia tidak diganti dengan lokasi contoh. Kontak internal dalam dokumen revisi belum diverifikasi dan ditandai pada panduan.

Pada 11 November 2026, seluruh 10 migrasi termasuk `supabase/migrations/20261104000000_document_revisions.sql` sudah diterapkan ke project baru `nwqnzhegnejtffqsoalx`, dan function `lpg-api` sudah aktif. Sesuai pilihan pemilik, data awal memakai salinan lokal SQLite yang disiapkan 9 Oktober 2026: 690 baris operasional serta 3 akun login. Data tambahan di project cloud lama setelah salinan tersebut tidak otomatis ikut. Seluruh 219 lampiran lokal sudah dipindahkan ke Storage privat, berukuran total 323.655.774 byte; dua video besar disimpan sebagai bagian sehingga jumlah objek Storage adalah 227. R2 belum diaktifkan pada project baru. Riwayat lokasi sebelum 4 November 2026 tidak diubah oleh migrasi. Frontend Vercel masih perlu diperbarui dengan URL dan publishable key project baru, lalu di-deploy ulang.
