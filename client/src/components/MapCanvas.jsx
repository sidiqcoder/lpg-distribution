import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerUrl from 'leaflet/dist/images/marker-icon.png';
import markerRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png';
L.Icon.Default.mergeOptions({ iconUrl: markerUrl, iconRetinaUrl: markerRetinaUrl, shadowUrl: markerShadowUrl });
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));


export default function MapCanvas({ height = 420, center = [-8.17, 113.7], zoom = 12, onReady, onInteraction }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const readyRef = useRef(onReady);
  const initialView = useRef({ center, zoom });
  const interactionRef = useRef(onInteraction);
  const [mapLoading, setMapLoading] = useState(true);
  readyRef.current = onReady;
  interactionRef.current = onInteraction;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      center: initialView.current.center,
      zoom: initialView.current.zoom,
      zoomControl: true,
      fadeAnimation: true,
      markerZoomAnimation: true
    });

    // Gunakan OpenStreetMap tile server dengan subdomains dan keepBuffer optimal
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap kontributor',
      subdomains: ['a', 'b', 'c'],
      maxZoom: 19,
      keepBuffer: 6,
      updateWhenIdle: false,
      updateWhenZooming: true
    }).addTo(map);

    tileLayer.on('load', () => {
      setMapLoading(false);
    });

    mapRef.current = map;
    const interacted = () => { map.lpgUserMoved = true; interactionRef.current?.(); };
    map.on('dragstart', interacted);
    const element = containerRef.current;
    element.addEventListener('wheel', interacted, { passive: true });
    element.addEventListener('touchstart', interacted, { passive: true });
    element.addEventListener('mousedown', interacted);
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(element);

    // Paksa map menghitung ukuran kontainer secara cepat
    requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const timer = setTimeout(() => {
      map.invalidateSize();
      setMapLoading(false);
    }, 300);

    if (readyRef.current) {
      readyRef.current(map);
    }

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      element.removeEventListener('wheel', interacted);
      element.removeEventListener('touchstart', interacted);
      element.removeEventListener('mousedown', interacted);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height }}>
      <div ref={containerRef} className="map" style={{ height: '100%', width: '100%' }} />
      {mapLoading && (
        <div className="map-loader-overlay">
          <div className="spinner-sm" />
          <span>Memuat peta rute...</span>
        </div>
      )}
    </div>
  );
}

export function dotIcon(color, size = 18) {
  return L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:3px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.35)"></div>`,
    iconSize: [size + 6, size + 6],
    iconAnchor: [(size + 6) / 2, (size + 6) / 2]
  });
}

export function numberIcon(color, text) {
  return L.divIcon({
    className: '',
    html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};border:2px solid #ffffff;box-shadow:0 2px 6px rgba(0,0,0,.35);color:#ffffff;font-weight:800;font-size:12px;display:flex;align-items:center;justify-content:center">${escapeHtml(text)}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });
}

export { L };

export function truckIcon(color = '#b91c1c') {
  return L.divIcon({ className: '', iconSize: [40,40], iconAnchor: [20,20], html: `<div style="width:40px;height:40px;background:${color};border:2px solid white;border-radius:50%;display:grid;place-items:center;box-shadow:0 2px 6px #0006"><svg xmlns="http://www.w3.org/2000/svg" width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M2 5h12v12H2zM14 9h4l4 4v4h-8"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg></div>` });
}
export function locationIcon(color = '#b91c1c') {
  return L.divIcon({ className: '', iconSize: [32,40], iconAnchor: [16,40], html: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 39C10 30 1 22 1 16a15 15 0 1 1 30 0c0 6-9 14-15 23Z" fill="${color}" stroke="white" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="white"/></svg>` });
}
