const PATHS = {
  menu: <><line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></>,
  'map-pin': <><path d="M12 22s7-6.4 7-12a7 7 0 1 0-14 0c0 5.6 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></>,
  clipboard: <><rect x="7" y="4" width="10" height="4" rx="1.5" /><path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3" /></>,
  package: <><path d="M12 3 3 7.5v9L12 21l9-4.5v-9L12 3z" /><path d="M3 7.5 12 12l9-4.5" /><path d="M12 12v9" /></>,
  truck: <><path d="M2 6h12v9H2z" /><path d="M14 9h4l3 3v3h-7" /><circle cx="6.5" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></>,
  shield: <><path d="M12 3l7 3v5c0 4.4-3 8-7 10-4-2-7-5.6-7-10V6l7-3z" /></>,
  alert: <><path d="M12 3 2 20h20L12 3z" /><line x1="12" y1="9" x2="12" y2="14" /><circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" /></>,
  logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><line x1="21" y1="12" x2="9" y2="12" /></>,
  home: <><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  message: <path d="M21 12a8 8 0 0 1-8 8H7l-4 3V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8z" />,
  phone: <path d="M5 4h4l2 5-2 1a12 12 0 0 0 5 5l1-2 5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1z" />,
  chart: <><line x1="6" y1="20" x2="6" y2="12" /><line x1="12" y1="20" x2="12" y2="6" /><line x1="18" y1="20" x2="18" y2="14" /></>,
  download: <><path d="M12 3v12" /><path d="M7 11l5 5 5-5" /><path d="M4 20h16" /></>,
  save: <><path d="M5 3h11l3 3v15H5z" /><path d="M8 3v6h8V3" /><circle cx="12" cy="14" r="2" /></>,
  'arrow-left': <><line x1="20" y1="12" x2="4" y2="12" /><path d="M10 6l-6 6 6 6" /></>,
  camera: <><path d="M4 8h3l2-2h6l2 2h3v11H4z" /><circle cx="12" cy="13" r="3" /></>,
  cylinder: <><rect x="7" y="7" width="10" height="14" rx="2.5" /><rect x="10" y="3" width="4" height="3" rx="1" /><line x1="7" y1="11" x2="17" y2="11" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="8" y1="3" x2="8" y2="6" /><line x1="16" y1="3" x2="16" y2="6" /></>,
  refresh: <><path d="M20 12a8 8 0 1 1-2-5.3" /><path d="M20 4v4h-4" /></>,
  'chevron-right': <path d="M9 6l6 6-6 6" />,
  droplet: <path d="M12 3s6 6.5 6 10a6 6 0 0 1-12 0c0-3.5 6-10 6-10z" />,
  send: <><path d="M22 2 11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
  edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></>,
  flame: <><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></>,
  calculator: <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="16" y1="14" x2="16" y2="18" /><path d="M16 10h.01" /><path d="M12 10h.01" /><path d="M8 10h.01" /><path d="M12 14h.01" /><path d="M8 14h.01" /><path d="M12 18h.01" /><path d="M8 18h.01" /></>,
  info: <><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></>,
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  'check-circle': <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></>,
  'x-circle': <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  activity: <><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></>
};

export default function Icon({ name, size = 18, weight = 2, className, style }) {
  const inner = PATHS[name] || PATHS.grid;
  return (
    <svg className={className} style={style} width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {inner}
    </svg>
  );
}
