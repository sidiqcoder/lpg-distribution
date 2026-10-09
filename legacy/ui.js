// =====================================================================
// ui.js - Lapisan tampilan bersama (design system) untuk aplikasi LPG
// ---------------------------------------------------------------------
// Menyatukan font, warna, background bertema LPG, ikon SVG (pengganti
// emoticon), sidebar yang konsisten, serta perilaku klien umum:
// toggle sidebar, pemulihan tab, tombol kembali, live refresh, dan
// pengunci tombol submit agar tidak terkirim ganda.
// =====================================================================

const BRAND = {
  name: 'PT Macan Gading',
  product: 'Distribusi LPG',
  title: 'Sistem Distribusi LPG'
};

// ---------------------------------------------------------------------
// Ikon SVG (garis, tanpa emoticon). Ukuran & warna mengikuti currentColor.
// ---------------------------------------------------------------------
const ICON_PATHS = {
  menu: '<line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  'map-pin': '<path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
  clipboard: '<rect x="7" y="4" width="10" height="4" rx="1.5"/><path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/>',
  package: '<path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z"/><path d="M3 7.5 12 12l9-4.5"/><path d="M12 12v9"/>',
  truck: '<path d="M2 6h12v9H2z"/><path d="M14 9h4l3 3v3h-7"/><circle cx="6.5" cy="18" r="1.8"/><circle cx="17.5" cy="18" r="1.8"/>',
  shield: '<path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z"/>',
  alert: '<path d="M12 3 2 20h20L12 3z"/><line x1="12" y1="9" x2="12" y2="14"/><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><line x1="21" y1="12" x2="9" y2="12"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  message: '<path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z"/>',
  phone: '<path d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z"/>',
  chart: '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="6"/><line x1="18" y1="20" x2="18" y2="14"/>',
  download: '<path d="M12 3v12"/><path d="M7 11l5 5 5-5"/><path d="M4 20h16"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8V3"/><circle cx="12" cy="14" r="2"/>',
  'arrow-left': '<line x1="20" y1="12" x2="4" y2="12"/><path d="M10 6l-6 6 6 6"/>',
  camera: '<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3"/>',
  cylinder: '<rect x="7" y="7" width="10" height="14" rx="2.5"/><rect x="10" y="3" width="4" height="3" rx="1"/><line x1="7" y1="11" x2="17" y2="11"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="3" x2="8" y2="6"/><line x1="16" y1="3" x2="16" y2="6"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2-5.3"/><path d="M20 4v4h-4"/>',
  'chevron-right': '<path d="M9 6l6 6-6 6"/>',
  droplet: '<path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z"/>',
  send: '<path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>'
};

function icon(name, opts = {}) {
  const inner = ICON_PATHS[name] || ICON_PATHS.grid;
  const size = opts.size || 18;
  const cls = opts.class ? ` class="${opts.class}"` : '';
  const style = opts.style ? ` style="${opts.style}"` : '';
  return `<svg${cls}${style} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${opts.weight || 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// Watermark silinder LPG sebagai background halus (SVG data-URI).
const CYLINDER_WATERMARK = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140' viewBox='0 0 140 140'%3E%3Cg fill='none' stroke='%23b01d24' stroke-width='2' opacity='0.05'%3E%3Crect x='55' y='40' width='30' height='62' rx='7'/%3E%3Crect x='63' y='28' width='14' height='12' rx='3'/%3E%3Cline x1='55' y1='56' x2='85' y2='56'/%3E%3C/g%3E%3C/svg%3E\")";

// ---------------------------------------------------------------------
// Stylesheet bersama
// ---------------------------------------------------------------------
function baseStyles() {
  return `
  :root{
    --brand:#b01d24; --brand-dark:#7d1116; --brand-soft:#fbebec;
    --ink:#1f2933; --muted:#647485; --bg:#eef2f6; --surface:#ffffff;
    --line:#e2e8f0; --line-strong:#cbd5e1;
    --ok:#15803d; --ok-bg:#e7f6ec; --warn:#b45309; --warn-bg:#fdf1dd;
    --bad:#b91c1c; --bad-bg:#fdeaea; --info:#1d4ed8; --info-bg:#e8effd;
    --radius:12px; --radius-sm:9px; --shadow:0 1px 2px rgba(16,24,40,.06),0 1px 3px rgba(16,24,40,.08);
    --shadow-lg:0 10px 30px rgba(16,24,40,.12);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0}
  body{
    font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;
    color:var(--ink); background-color:var(--bg); background-image:${CYLINDER_WATERMARK};
    font-size:15px; line-height:1.5; -webkit-font-smoothing:antialiased;
  }
  h1,h2,h3,h4{margin:0 0 .4em; line-height:1.25; font-weight:800; letter-spacing:-.01em; color:var(--ink)}
  h1{font-size:22px} h2{font-size:19px} h3{font-size:16px} h4{font-size:14px}
  p{margin:0 0 .6em}
  a{color:var(--brand); text-decoration:none}
  small{color:var(--muted)}
  svg{flex:none}

  /* ---- Topbar ---- */
  .app-topbar{
    position:sticky; top:0; z-index:900; display:flex; align-items:center; gap:14px;
    background:var(--brand); color:#fff; padding:12px 20px 12px 64px; box-shadow:var(--shadow);
  }
  .app-topbar .brand{display:flex; align-items:center; gap:10px; font-weight:800; letter-spacing:.01em}
  .app-topbar .brand small{display:block; font-weight:500; color:rgba(255,255,255,.8); letter-spacing:.04em; text-transform:uppercase; font-size:10px}
  .app-topbar .spacer{flex:1}
  .app-topbar a:not(.btn),.app-topbar button:not(.btn){color:#fff}
  .app-topbar .btn{background:rgba(255,255,255,.16); border-color:rgba(255,255,255,.55); color:#fff}
  .app-topbar .btn:hover{background:rgba(255,255,255,.28); filter:none}
  .topbar-title{font-weight:700; font-size:15px; opacity:.95}

  /* ---- Sidebar ---- */
  .sidebar-toggle{
    position:fixed; top:12px; left:14px; z-index:1400; width:42px; height:42px;
    display:inline-flex; align-items:center; justify-content:center;
    border:0; border-radius:10px; background:#243140; color:#fff; cursor:pointer;
    box-shadow:var(--shadow);
  }
  .app-sidebar{
    position:fixed; inset:0 auto 0 0; z-index:1300; width:272px; padding:22px 16px;
    background:#1b2733; color:#eef2f6; transform:translateX(-105%);
    transition:transform .22s ease; box-shadow:6px 0 24px rgba(16,24,40,.22);
    display:flex; flex-direction:column; overflow-y:auto;
  }
  body.sidebar-open .app-sidebar{transform:translateX(0)}
  .sidebar-backdrop{display:none; position:fixed; inset:0; z-index:1200; background:rgba(15,23,32,.45)}
  .sidebar-backdrop.visible{display:block}
  .sidebar-brand{display:flex; align-items:center; gap:11px; padding:4px 8px 18px; border-bottom:1px solid rgba(255,255,255,.12)}
  .sidebar-brand .mark{display:inline-flex; align-items:center; justify-content:center; width:38px; height:38px; border-radius:10px; background:var(--brand); color:#fff}
  .sidebar-brand strong{display:block; font-size:15px}
  .sidebar-brand small{display:block; color:rgba(255,255,255,.65); font-size:11px; letter-spacing:.05em; text-transform:uppercase}
  .sidebar-nav{display:grid; gap:4px; margin-top:16px}
  .sidebar-nav a{
    display:flex; align-items:center; gap:11px; padding:10px 12px; border-radius:var(--radius-sm);
    color:#dbe3ec; font-weight:600; font-size:14px; cursor:pointer;
  }
  .sidebar-nav a:hover{background:rgba(255,255,255,.08); color:#fff}
  .sidebar-nav a.active{background:var(--brand); color:#fff}
  .sidebar-nav a svg{opacity:.9}
  .sidebar-sep{margin:10px 12px; border-top:1px solid rgba(255,255,255,.12)}
  .sidebar-foot{margin-top:auto; padding:14px 12px 2px; color:rgba(255,255,255,.5); font-size:11px}
  body.sidebar-open{cursor:default}

  /* ---- Layout ---- */
  .page{max-width:1320px; margin:0 auto; padding:22px 18px 56px}
  .page-head{display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; margin-bottom:18px}
  .page-head p{color:var(--muted); margin:2px 0 0}
  .grid{display:grid; gap:16px}
  .grid.cols-2{grid-template-columns:repeat(auto-fit,minmax(300px,1fr))}
  .grid.cols-3{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}
  .stat-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:14px}

  .card{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:20px}
  .card + .card{margin-top:0}
  .stack > * + *{margin-top:16px}
  .stat{background:var(--surface); border:1px solid var(--line); border-radius:var(--radius); box-shadow:var(--shadow); padding:18px}
  .stat .label{display:flex; align-items:center; gap:8px; color:var(--muted); font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:.03em}
  .stat .value{font-size:28px; font-weight:800; margin-top:8px}
  .stat.link{cursor:pointer; transition:border-color .15s, transform .15s}
  .stat.link:hover{border-color:var(--brand); transform:translateY(-1px)}

  /* ---- Buttons ---- */
  .btn{
    display:inline-flex; align-items:center; justify-content:center; gap:8px;
    padding:10px 16px; border:1px solid transparent; border-radius:var(--radius-sm);
    background:var(--brand); color:#fff; font-weight:700; font-size:14px; cursor:pointer;
    text-decoration:none; font-family:inherit; line-height:1.2;
  }
  .btn:hover{filter:brightness(1.05)}
  .btn:disabled{opacity:.6; cursor:not-allowed}
  .btn-block{width:100%}
  .btn.sm{padding:7px 11px; font-size:13px}
  .btn-ok{background:var(--ok)} .btn-warn{background:var(--warn)} .btn-bad{background:var(--bad)}
  .btn-ghost{background:#fff; color:var(--ink); border-color:var(--line-strong)}
  .btn-ghost:hover{background:#f8fafc; filter:none}
  .btn-dark{background:#243140}
  .btn-icon{padding:8px; width:38px; height:38px}

  /* ---- Forms ---- */
  label{display:block; margin:14px 0 6px; font-weight:600; font-size:14px}
  input,select,textarea{
    width:100%; padding:11px 12px; border:1.5px solid var(--line-strong); border-radius:var(--radius-sm);
    font-family:inherit; font-size:14px; color:var(--ink); background:#fff;
  }
  input:focus,select:focus,textarea:focus{outline:0; border-color:var(--brand); box-shadow:0 0 0 3px var(--brand-soft)}
  .hint{color:var(--muted); font-size:12px; margin-top:6px; display:block}
  .field-row{display:grid; grid-template-columns:1fr 1fr; gap:14px}
  @media(max-width:640px){.field-row{grid-template-columns:1fr}}

  /* ---- Tables ---- */
  .table-wrap{overflow-x:auto; border:1px solid var(--line); border-radius:var(--radius); background:#fff}
  table.data{width:100%; border-collapse:collapse; min-width:560px}
  table.data th,table.data td{padding:12px 14px; text-align:left; font-size:13.5px; border-bottom:1px solid var(--line)}
  table.data th{background:#f6f8fb; color:var(--muted); text-transform:uppercase; font-size:11px; letter-spacing:.04em; font-weight:700}
  table.data tr:last-child td{border-bottom:0}
  .empty{padding:26px; text-align:center; color:var(--muted)}

  /* ---- Badges ---- */
  .badge{display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; font-size:11.5px; font-weight:700; white-space:nowrap}
  .badge.ok{background:var(--ok-bg); color:var(--ok)}
  .badge.bad{background:var(--bad-bg); color:var(--bad)}
  .badge.warn{background:var(--warn-bg); color:var(--warn)}
  .badge.info{background:var(--info-bg); color:var(--info)}
  .badge.muted{background:#eef1f5; color:var(--muted)}

  /* ---- Banners ---- */
  .banner{padding:14px 16px; border-radius:var(--radius-sm); border:1px solid var(--line); border-left-width:4px}
  .banner.ok{background:var(--ok-bg); border-color:var(--ok); color:#0f5132}
  .banner.warn{background:var(--warn-bg); border-color:var(--warn); color:#7c4a03}
  .banner.bad{background:var(--bad-bg); border-color:var(--bad); color:#7f1d1d}
  .banner.info{background:var(--info-bg); border-color:var(--info); color:#1e3a8a}
  .banner strong{display:block; margin-bottom:2px}

  /* ---- Progress bars ---- */
  .bar-row{display:grid; grid-template-columns:minmax(110px,160px) 1fr 72px; gap:12px; align-items:center; margin:10px 0; font-size:13px}
  .bar-track{height:10px; background:#e6ebf1; border-radius:999px; overflow:hidden}
  .bar-fill{height:100%; border-radius:999px; background:var(--brand)}
  @media(max-width:640px){.bar-row{grid-template-columns:1fr auto}.bar-row .bar-track{grid-column:1/-1; grid-row:2}}

  /* ---- Dashboard views ---- */
  .dashboard-view{display:none}
  .dashboard-view.active{display:block; animation:fade .18s ease}
  @keyframes fade{from{opacity:0; transform:translateY(3px)} to{opacity:1; transform:none}}

  /* ---- Auth / landing ---- */
  .auth-body{min-height:100vh; display:flex; align-items:center; justify-content:center; padding:22px;
    background:linear-gradient(135deg,#1b2733 0%,#3a1a1c 60%,var(--brand-dark) 100%); background-blend-mode:normal}
  .auth-card{width:100%; max-width:430px; background:#fff; border-radius:16px; box-shadow:var(--shadow-lg); padding:34px 30px}
  .auth-brand{display:flex; align-items:center; gap:12px; margin-bottom:20px}
  .auth-brand .mark{width:46px; height:46px; border-radius:12px; background:var(--brand); color:#fff; display:inline-flex; align-items:center; justify-content:center}
  .auth-brand strong{display:block; font-size:17px}
  .auth-brand small{color:var(--muted); font-size:12px}
  .auth-divider{height:1px; background:var(--line); margin:22px 0}

  .hero{max-width:1000px; margin:0 auto; padding:56px 20px}
  .hero-badge{display:inline-flex; align-items:center; gap:8px; padding:6px 12px; border-radius:999px; background:var(--brand-soft); color:var(--brand); font-weight:700; font-size:12px}
  .choice{display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-top:22px}
  @media(max-width:640px){.choice{grid-template-columns:1fr}}
  .choice a{display:flex; align-items:center; gap:14px; padding:20px; border:1px solid var(--line); border-radius:var(--radius); background:#fff; box-shadow:var(--shadow); color:var(--ink)}
  .choice a:hover{border-color:var(--brand); transform:translateY(-2px)}
  .choice a .mark{width:44px; height:44px; border-radius:12px; display:inline-flex; align-items:center; justify-content:center; background:var(--brand-soft); color:var(--brand)}

  .feature-grid{display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin-top:26px}
  .feature{background:#fff; border:1px solid var(--line); border-radius:var(--radius); padding:18px; box-shadow:var(--shadow)}
  .feature .mark{width:38px; height:38px; border-radius:10px; background:var(--brand-soft); color:var(--brand); display:inline-flex; align-items:center; justify-content:center; margin-bottom:10px}
  .feature h3{margin-bottom:4px}
  .feature p{color:var(--muted); font-size:13px; margin:0}

  .muted{color:var(--muted)}
  .center{text-align:center}
  .row{display:flex; align-items:center; gap:10px; flex-wrap:wrap}
  .row.between{justify-content:space-between}
  .mt{margin-top:16px} .mt-sm{margin-top:8px}
  .modal{display:none; position:fixed; inset:0; background:rgba(15,23,32,.5); align-items:center; justify-content:center; z-index:1000; padding:18px}
  .modal.open{display:flex}
  .modal-card{background:#fff; border-radius:var(--radius); padding:26px; max-width:640px; width:100%; max-height:88vh; overflow-y:auto; box-shadow:var(--shadow-lg)}
  .modal-head{display:flex; align-items:center; justify-content:space-between; margin-bottom:14px}
  #map{width:100%; height:420px; border-radius:var(--radius); border:1px solid var(--line); background:#e9eef3}
  .map-note{color:var(--muted); font-size:12.5px; margin-top:8px}
  .leaflet-container{font-family:inherit}
  @media(max-width:760px){.stat .value{font-size:24px}}
  `;
}

// ---------------------------------------------------------------------
// <head> bersama. leaflet=true untuk halaman dengan peta.
// ---------------------------------------------------------------------
function renderHead(title, opts = {}) {
  const leaflet = opts.leaflet
    ? `<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css">
       <script src="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"></script>`
    : '';
  return `<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${title} - ${BRAND.name}</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='7' fill='%23b01d24'/%3E%3Crect x='11' y='9' width='10' height='15' rx='3' fill='none' stroke='white' stroke-width='2'/%3E%3Crect x='14' y='4' width='4' height='5' rx='1' fill='white'/%3E%3C/svg%3E">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${baseStyles()}${opts.css || ''}</style>
    ${leaflet}
  </head>`;
}

// ---------------------------------------------------------------------
// Topbar halaman (opsional, untuk halaman non-dashboard)
// ---------------------------------------------------------------------
function renderTopbar(title, rightHtml = '') {
  return `<header class="app-topbar">
    <div class="brand">${icon('cylinder', { size: 22 })}<span>${BRAND.name}<small>${BRAND.product}</small></span></div>
    <span class="topbar-title">${title}</span>
    <div class="spacer"></div>
    ${rightHtml}
  </header>`;
}

// ---------------------------------------------------------------------
// Sidebar konsisten untuk dashboard sopir & manager
// ---------------------------------------------------------------------
function sidebarLinks(role, sopirId, standalone) {
  if (role === 'manager') {
    return [
      { view: 'manager-overview', label: 'Ringkasan Utama', icon: 'grid' },
      { view: 'manager-tracking', label: 'Pelacakan Sopir', icon: 'map-pin' },
      { view: 'manager-certificates', label: 'Sertifikat K3', icon: 'shield' },
      { view: 'manager-inspections', label: 'Inspeksi Pagi', icon: 'clipboard' },
      { view: 'manager-deliveries', label: 'Pengiriman', icon: 'package' },
      { view: 'manager-stock', label: 'Persediaan LPG', icon: 'cylinder' },
      { view: 'manager-kpi', label: 'KPI Sopir', icon: 'chart' },
      { view: 'manager-hazards', label: 'Laporan Bahaya', icon: 'alert' },
      { href: '/admin/login', label: 'Keluar', icon: 'logout' }
    ];
  }
  if (standalone) {
    return [
      { href: '/', label: 'Beranda', icon: 'home' },
      { href: `/dashboard?sopir_id=${sopirId}`, label: 'Dashboard', icon: 'grid' },
      { href: `/inspeksi?sopir_id=${sopirId}`, label: 'Inspeksi Pagi', icon: 'clipboard' },
      { href: `/permintaan-lpg?sopir_id=${sopirId}`, label: 'Permintaan LPG', icon: 'cylinder' },
      { href: `/on-duty?sopir_id=${sopirId}`, label: 'Pengiriman', icon: 'truck' },
      { href: `/rute-map?sopir_id=${sopirId}`, label: 'Peta Rute', icon: 'map-pin' },
      { href: `/sertifikat-k3?sopir_id=${sopirId}`, label: 'Sertifikat K3', icon: 'shield' },
      { href: `/logout?sopir_id=${sopirId}`, label: 'Keluar', icon: 'logout' }
    ];
  }
  return [
    { view: 'driver-overview', label: 'Ringkasan Utama', icon: 'grid' },
    { view: 'driver-profile', label: 'Profil Sopir', icon: 'user' },
    { view: 'driver-map', label: 'Posisi Realtime', icon: 'map-pin' },
    { view: 'driver-inspection', label: 'Status Inspeksi', icon: 'clipboard' },
    { view: 'driver-lpg', label: 'Status LPG', icon: 'cylinder' },
    { view: 'driver-actions', label: 'Menu Operasional', icon: 'truck' },
    { href: `/inspeksi?sopir_id=${sopirId}`, label: 'Inspeksi Pagi', icon: 'clipboard' },
    { href: `/permintaan-lpg?sopir_id=${sopirId}`, label: 'Permintaan LPG', icon: 'cylinder' },
    { href: `/on-duty?sopir_id=${sopirId}`, label: 'Mulai Pengiriman', icon: 'send' },
    { href: `/logout?sopir_id=${sopirId}`, label: 'Keluar', icon: 'logout' }
  ];
}

function renderSidebar(role, sopirId, standalone = false, active = '') {
  const links = sidebarLinks(role, sopirId, standalone);
  const brandSub = role === 'manager' ? 'Dashboard Manager' : 'Dashboard Sopir';
  const navHtml = links.map((link, idx) => {
    const isSep = link.label === 'Keluar' && idx > 0;
    const linkPath = link.href ? link.href.split('?')[0] : '';
    const isActive = (link.view && link.view === active) || (linkPath && linkPath === active);
    const cls = isActive ? ' class="active"' : '';
    const attrs = link.view
      ? `href="#${link.view}" data-dashboard-view="${link.view}"`
      : `href="${link.href}"`;
    return `${isSep ? '<div class="sidebar-sep"></div>' : ''}<a${cls} ${attrs}>${icon(link.icon)}<span>${link.label}</span></a>`;
  }).join('');

  return `<button class="sidebar-toggle" type="button" aria-label="Buka menu" onclick="toggleAppSidebar()">${icon('menu', { size: 20 })}</button>
  <div id="sidebarBackdrop" class="sidebar-backdrop" onclick="toggleAppSidebar(false)"></div>
  <aside id="appSidebar" class="app-sidebar" aria-label="Navigasi utama">
    <div class="sidebar-brand">
      <span class="mark">${icon('cylinder', { size: 20 })}</span>
      <span><strong>${BRAND.name}</strong><small>${brandSub}</small></span>
    </div>
    <nav class="sidebar-nav">${navHtml}</nav>
    <div class="sidebar-foot">${BRAND.title} &middot; v1.1</div>
  </aside>`;
}

// ---------------------------------------------------------------------
// Skrip klien bersama: sidebar, tab, tombol kembali, live refresh,
// pengunci tombol submit.
// ---------------------------------------------------------------------
function clientCore() {
  return `<script>
  (function(){
    var AUTH_PATHS = ['/login','/admin/login'];
    var here = location.pathname + location.search;

    window.toggleAppSidebar = function(forceOpen){
      var open = typeof forceOpen === 'boolean' ? forceOpen : !document.body.classList.contains('sidebar-open');
      document.body.classList.toggle('sidebar-open', open);
      var bd = document.getElementById('sidebarBackdrop');
      if (bd) bd.classList.toggle('visible', open);
    };

    function markActive(viewId){
      document.querySelectorAll('.sidebar-nav a[data-dashboard-view]').forEach(function(a){
        a.classList.toggle('active', a.dataset.dashboardView === viewId);
      });
    }

    window.showDashboardView = function(viewId){
      var target = document.getElementById(viewId);
      if (!target) return false;
      document.querySelectorAll('.dashboard-view').forEach(function(v){ v.classList.toggle('active', v === target); });
      markActive(viewId);
      if (history.replaceState) history.replaceState(null, '', '#' + viewId);
      if (typeof window.onViewShown === 'function') { try { window.onViewShown(viewId); } catch(e){} }
      return true;
    };

    document.addEventListener('click', function(e){
      var link = e.target.closest('[data-dashboard-view]');
      if (!link) return;
      e.preventDefault();
      window.showDashboardView(link.dataset.dashboardView);
      window.toggleAppSidebar(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Ikuti perubahan hash (tombol back/forward antar tab, atau ketik manual).
    window.addEventListener('hashchange', function(){
      var h = (location.hash || '').replace('#', '');
      var el = h ? document.getElementById(h) : null;
      if (el && el.classList.contains('dashboard-view')) window.showDashboardView(h);
    });

    // Pulihkan tab dari hash agar tidak "nyangkut" ke Ringkasan setelah reload.
    function restoreView(){
      var views = document.querySelectorAll('.dashboard-view');
      if (!views.length) return;
      var hash = (location.hash || '').replace('#','');
      var target = hash && document.getElementById(hash);
      if (!target || !target.classList.contains('dashboard-view')) {
        target = document.querySelector('.dashboard-view.active') || views[0];
      }
      views.forEach(function(v){ v.classList.toggle('active', v === target); });
      markActive(target.id);
      if (typeof window.onViewShown === 'function') { try { window.onViewShown(target.id); } catch(e){} }
    }

    // Riwayat halaman dalam aplikasi (mengabaikan halaman login) untuk tombol kembali.
    function trackHistory(){
      if (AUTH_PATHS.indexOf(location.pathname) !== -1) return;
      var stack = [];
      try { stack = JSON.parse(sessionStorage.getItem('lpg:stack') || '[]'); } catch(e){ stack = []; }
      if (stack[stack.length - 1] !== here) stack.push(here);
      if (stack.length > 25) stack.shift();
      try { sessionStorage.setItem('lpg:stack', JSON.stringify(stack)); } catch(e){}
    }

    window.goBack = function(fallback){
      var stack = [];
      try { stack = JSON.parse(sessionStorage.getItem('lpg:stack') || '[]'); } catch(e){ stack = []; }
      if (stack[stack.length - 1] === here) stack.pop();
      var prev = stack[stack.length - 1];
      if (prev && prev !== here) {
        try { sessionStorage.setItem('lpg:stack', JSON.stringify(stack)); } catch(e){}
        location.href = prev;
        return false;
      }
      location.href = fallback || '/';
      return false;
    };
    document.addEventListener('click', function(e){
      var back = e.target.closest('[data-back]');
      if (!back) return;
      e.preventDefault();
      window.goBack(back.getAttribute('data-back') || '/');
    });

    // Kunci tombol submit agar klik ganda tidak mengirim dua kali.
    document.addEventListener('submit', function(e){
      var form = e.target;
      if (!form.matches('[data-lock-submit]')) return;
      form.querySelectorAll('button[type=submit],input[type=submit]').forEach(function(b){ b.disabled = true; });
      var first = form.querySelector('button[type=submit]');
      if (first) first.dataset.originalText = first.textContent;
    }, true);

    // Live refresh: poll endpoint versi; reload (mempertahankan tab & posisi) bila berubah.
    window.startLiveRefresh = function(url, intervalMs){
      var last = null;
      var timer = null;
      async function tick(){
        if (document.hidden) return;
        try {
          var res = await fetch(url, { headers: { 'Accept': 'application/json' } });
          var data = await res.json();
          if (last === null) { last = data.version; return; }
          if (data.version !== last) {
            try { sessionStorage.setItem('lpg:scroll', String(window.scrollY)); } catch(e){}
            location.reload();
          }
        } catch(e) {}
      }
      tick();
      timer = setInterval(tick, intervalMs || 8000);
    };

    document.addEventListener('DOMContentLoaded', function(){
      trackHistory();
      restoreView();
      var y = null;
      try { y = sessionStorage.getItem('lpg:scroll'); } catch(e){}
      if (y !== null) { window.scrollTo(0, parseInt(y, 10) || 0); try { sessionStorage.removeItem('lpg:scroll'); } catch(e){} }
    });
  })();
  </script>`;
}

// Halaman pesan/status ringkas (tanpa emoticon).
function messagePage(opts = {}) {
  const tone = opts.tone || 'info';
  const toneIcon = { ok: 'check', bad: 'alert', warn: 'clock', info: 'clock' }[tone] || 'clipboard';
  const actions = (opts.actions || []).join(' ');
  return `<!DOCTYPE html><html lang="id">${renderHead(opts.title || 'Informasi')}
  <body class="auth-body">
    <div class="auth-card center">
      <div class="auth-brand" style="justify-content:center">
        <span class="mark">${icon(toneIcon, { size: 24 })}</span>
        <span style="text-align:left"><strong>${BRAND.name}</strong><small>${BRAND.product}</small></span>
      </div>
      <h2>${opts.heading || ''}</h2>
      <p class="muted">${opts.body || ''}</p>
      ${opts.detail ? `<div class="banner ${tone} mt-sm">${opts.detail}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:18px">${actions}</div>
    </div>
  </body></html>`;
}

module.exports = {
  BRAND,
  icon,
  baseStyles,
  renderHead,
  renderTopbar,
  renderSidebar,
  clientCore,
  sidebarLinks,
  messagePage
};
