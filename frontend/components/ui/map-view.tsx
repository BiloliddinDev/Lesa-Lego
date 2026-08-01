"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { defaultMapIcon } from "@/lib/map";

interface MapViewProps {
  lat: number;
  lng: number;
  height?: number;
}

export default function MapView({ lat, lng, height = 220 }: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom: 14,
      scrollWheelZoom: false,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    L.marker([lat, lng], { icon: defaultMapIcon }).addTo(map);

    mapRef.current = map;

    const t = window.setTimeout(() => map.invalidateSize(), 150);
    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border">
      <div ref={containerRef} style={{ height: `${height}px`, width: "100%", zIndex: 0 }} />
    </div>
  );
}
