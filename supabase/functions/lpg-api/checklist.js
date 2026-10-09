// Struktur checklist inspeksi pagi + helper parsing/penghitungan.

const CHECKLIST_SECTIONS = [
  { id: 1, nama: 'Ban dan Roda', items: [
    'Kondisi ban tidak rusak atau sobek',
    'Tekanan angin ban sesuai',
    'Kedalaman alur ban memenuhi ketentuan',
    'Baut/mur roda dalam kondisi baik',
    'Kondisi ban cadangan baik',
    'Tidak terdapat benda asing yang membahayakan pada ban'
  ]},
  { id: 2, nama: 'Rem', items: [
    'Rem utama berfungsi dengan baik',
    'Rem parkir berfungsi',
    'Tidak terdapat kebocoran sistem rem',
    'Pedal rem berfungsi normal'
  ]},
  { id: 3, nama: 'Kemudi', items: [
    'Kemudi berfungsi dengan baik',
    'Tidak terdapat kelonggaran kemudi yang berlebihan',
    'Sistem kemudi tidak mengalami kebocoran atau kerusakan'
  ]},
  { id: 4, nama: 'Lampu dan Sistem Kelistrikan', items: [
    'Lampu utama dalam kondisi baik',
    'Lampu jauh dan dekat dalam kondisi baik',
    'Lampu sein berfungsi normal',
    'Lampu rem berfungsi normal',
    'Lampu mundur berfungsi normal',
    'Lampu hazard berfungsi normal',
    'Lampu rotasi kuning berfungsi normal',
    'Klakson berfungsi normal',
    'Wiper berfungsi normal',
    'Kondisi kaca kendaraan dalam kondisi baik'
  ]},
  { id: 5, nama: 'Mesin dan Sistem Bahan Bakar', items: [
    'Kondisi mesin',
    'Tidak terdapat kebocoran bahan bakar',
    'Tidak terdapat kebocoran oli',
    'Kondisi sistem pembuangan/knalpot normal'
  ]},
  { id: 6, nama: 'Bodi dan Karoseri', items: [
    'Kondisi rangka kendaraan',
    'Kondisi bak muatan baik',
    'Kondisi lantai bak baik',
    'Kondisi dinding bak baik',
    'Kondisi pintu dan engsel berfungsi normal',
    'Kondisi spion baik',
    'Tidak terdapat bagian kendaraan yang tajam atau membahayakan'
  ]},
  { id: 7, nama: 'Identitas Kendaraan Angkutan LPG', items: [
    'Plakat/label barang berbahaya di bagian depan, samping kanan-kiri, belakang',
    'Nama perusahaan terlihat jelas',
    'Nomor telepon darurat/pengaduan tersedia',
    'Nomor identitas kendaraan sesuai dokumen',
    'Reflektor tersedia'
  ]},
  { id: 8, nama: 'Alat Pengaman dan Keadaan Darurat', items: [
    'APAR tersedia',
    'Kotak P3K tersedia',
    'Ganjal roda tersedia',
    'Segitiga pengaman',
    'Kerucut pengaman',
    'Rambu lalu lintas sementara',
    'Pita pembatas',
    'Dongkrak',
    'Sekop yang tidak menimbulkan api',
    'Lampu senter',
    'Alat komunikasi',
    'Panduan tanggap darurat',
    'Pedoman pengoperasian kendaraan'
  ]},
  { id: 9, nama: 'Perlengkapan Keadaan Darurat', items: [
    'Helm keselamatan',
    'Kacamata pengaman',
    'Sarung tangan',
    'Sepatu pengaman',
    'Pakaian kerja',
    'Pelindung mulut dan hidung',
    'Pelindung anggota badan'
  ]},
  { id: 10, nama: 'Sopir/Pengemudi', items: [
    'SIM sesuai dan masih berlaku',
    'Identitas pengemudi ditempatkan pada dashboard',
    'Kondisi fisik pengemudi siap mengemudi',
    'Pengemudi memahami rute perjalanan',
    'Pengemudi mengetahui penggunaan APAR',
    'Pengemudi menggunakan APD',
    'Alat komunikasi yang tersambung dengan admin'
  ]},
  { id: 11, nama: 'Dokumen', items: [
    'STNK masih berlaku',
    'Bukti lulus uji/KIR masih berlaku',
    'Surat Muatan Barang tersedia',
    'Kartu Lisensi K3',
    'Dokumen/panduan tanggap darurat tersedia',
    'Surat jalan'
  ]}
];

const CHECKLIST_TOTAL_ITEMS = CHECKLIST_SECTIONS.reduce((sum, s) => sum + s.items.length, 0);

function parseChecklist(row) {
  if (!row || !row.checklist_json) return null;
  try { return JSON.parse(row.checklist_json); } catch (e) { return null; }
}

function parseLampiran(row) {
  if (!row || !row.lampiran_json) return null;
  try { return JSON.parse(row.lampiran_json); } catch (e) { return null; }
}

function countLolos(row) {
  const checklist = parseChecklist(row);
  if (checklist) {
    const total = checklist.length || CHECKLIST_TOTAL_ITEMS;
    const lolos = checklist.filter((c) => c.status === 'BAIK').length;
    const tidakBaik = checklist.filter((c) => c.status === 'TIDAK').length;
    const belumDicentang = checklist.filter((c) => c.status !== 'BAIK' && c.status !== 'TIDAK').length;
    return { lolos, total, tidakBaik, belumDicentang };
  }
  const legacyItems = [
    row.ban_kondisi, row.rem_berfungsi, row.lampu_hidup, row.tangki_integritas,
    row.tidak_ada_kebocoran, row.pemadam_ada, row.p3k_ada, row.kit_tumpah_ada,
    row.sopir_fit, row.dokumen_lengkap
  ];
  return { lolos: legacyItems.filter(Boolean).length, total: 10, tidakBaik: legacyItems.filter((v) => !v).length, belumDicentang: 0 };
}

export { CHECKLIST_SECTIONS, CHECKLIST_TOTAL_ITEMS, parseChecklist, parseLampiran, countLolos };
