# Revisi kedua — 14 November 2026

Sumber kebutuhan: `revisi/update perbaikan web 1.docx` poin 4 dan `revisi/update perbaikan web 2.docx`.

- Menu **Permintaan per Lokasi** mencantumkan 20 lokasi. Simpan mengonfirmasi seluruh angka untuk tanggal pilihan, termasuk nol. Angka awal dari penugasan lama ditandai belum dikonfirmasi. Input manual disimpan berdasarkan tanggal dan nomor lokasi, terpisah dari urutan rute. Sopir melihat jumlah per tujuan di On-Duty, daftar tujuan, dan popup peta. Permintaan yang melebihi kapasitas 543 tabung per kendaraan diberi keterangan kebutuhan pengaturan ritase.
- Saving Matrix dihitung dari matriks jalan 21 titik (gudang + 20 lokasi). Penggabungan memakai penghematan terbesar, endpoint rute, dan batas 10 tujuan per kendaraan dengan pembagian 10/10 yang tetap mungkin. Nearest Neighbor menyusun ulang masing-masing kelompok mulai dari gudang, memakai jarak asli, lalu menambahkan jarak kembali ke gudang. Metode ini heuristik; tidak menjamin optimum global.
- **Google Maps belum diaktifkan**, sesuai arahan pemilik karena API key belum tersedia. Matriks contoh gambar pertama dokumen ditranskripsi di `logistics.js`. Hasilnya sama dengan contoh dokumen: Budi G–9–1–2–8–15–12–10–3–17–20–G (137,6 km); Ahmad G–11–18–19–5–14–7–4–13–6–16–G (95,6 km). Sumber contoh ditampilkan kepada manager dan sopir. Matriks dan saving matrix dapat dibuka pada menu Permintaan.
- Rute baru berlaku mulai 14 November 2026. Rute pada hari yang sudah memiliki pengiriman atau alokasi LPG disetujui dibekukan. Riwayat tanggal lama dipertahankan. Peta manager, peta rute sopir, dan tracking membaca penugasan harian yang sama. Garis peta menghubungkan titik secara langsung, bukan geometri jalan.
- Persediaan menampilkan SS = 1,645 × D × σL dan ROP = D × L + SS. D memakai rata-rata total 20 lokasi pada enam tanggal terakhir yang inputnya lengkap sampai tanggal pilihan. Hari kosong/tidak lengkap tidak dianggap permintaan nol. Jika baru 1–5 hari lengkap, nilai ditandai sementara; sebelum ada data lengkap nilai belum tersedia. Tidak ada permintaan historis fiktif yang dimasukkan.
- Sampel lead time enam hari adalah [2,3,2,3,3,2], sesuai izin asumsi dokumen. Sampel ditetapkan sekali agar perhitungan tidak berubah setiap refresh, dengan L = 2,5 dan standar deviasi populasi σL = 0,5 hari. Angka ini dilabeli asumsi, bukan riwayat pasokan aktual. SS dibulatkan ke atas; ROP memakai SS tersebut dan dibulatkan ke atas. Peringatan order muncul ketika stok gudang saat ini ≤ ROP.
- Manager dapat menghapus foto/video pada **Aktivitas & Fatigue Sopir**. Konfirmasi di aplikasi mencegah klik tidak sengaja. File di Storage/R2 dihapus bila tidak direferensikan data lain. Metadata laporan, hasil review, dan capture ID dipertahankan agar retry kamera tidak memunculkan rekaman lama kembali. Bila Storage gagal, tombol penghapusan tetap tersedia untuk retry.

## Mengaktifkan jarak Google nanti

1. Siapkan Google Routes API dengan billing dan pembatasan API key yang sesuai. Simpan key hanya sebagai secret backend Supabase bernama `GOOGLE_ROUTES_API_KEY`; jangan taruh pada variabel `VITE_*`.
2. Buka Permintaan per Lokasi, pilih hari yang belum berjalan, lalu **Hitung Ulang dengan Google Maps**. Endpoint manager meminta `computeRouteMatrix` untuk 21 × 21 titik dengan DRIVE / TRAFFIC_AWARE; elemen yang tidak lengkap/gagal membatalkan perubahan.
3. Sistem menyimpan snapshot matriks Google, saving matrix, dan rute terhitung di tabel privat. Snapshot berlaku mulai tanggal pilihan untuk penugasan berikutnya. Tidak ada polling ke Google atau biaya API tersembunyi setiap refresh. Pengambilan jarak dilakukan saat manager menekan hitung ulang.

Referensi implementasi: [Google Compute Route Matrix](https://developers.google.com/maps/documentation/routes/compute_route_matrix), [deploy Supabase Edge Functions](https://supabase.com/docs/guides/functions/deploy).

## Validasi

`npm run check:backend`, `npm run build`, `npm run test:backend`, `npm run test:migration`, dan `npm --prefix client run test:e2e`. Uji browser menutup input 20 lokasi hingga tampil pada dashboard sopir, rumus/pengingat stok, pembatalan/konfirmasi penghapusan rekaman, dan tujuan pada peta manager tanpa GPS.

Migrasi `20261114144307_revision_two_logistics.sql` sudah diterapkan ke project `nwqnzhegnejtffqsoalx`; Edge Function `lpg-api` versi 2 sudah aktif. Verifikasi cloud mencakup penyimpanan 20 input pada tanggal uji terpisah, nilai nol, rumus SS/ROP dari input tersebut, larangan akses tanpa peran manager, dan penolakan hitung Google sebelum key tersedia. Data tanggal uji sudah dibersihkan. Tabel baru memakai RLS dan menolak akses langsung `anon`/`authenticated`, mengikuti arsitektur API yang sudah ada.
