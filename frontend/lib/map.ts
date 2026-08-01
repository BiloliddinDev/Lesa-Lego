import L from "leaflet";

// Leaflet marker rasmlari Next.js build'ida ishlamay qoladi — maxsus icon beramiz
// Ikkala xarita komponentida (MapPicker, MapView) bir xil pin uslubi ishlatiladi
export const defaultMapIcon = L.divIcon({
  className: "",
  html: `<div style="width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:#2563eb;box-shadow:0 2px 8px rgba(37,99,235,0.5);color:#fff;border:2px solid #fff;">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
  </div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
