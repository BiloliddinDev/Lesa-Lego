"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin } from "lucide-react";
import { defaultMapIcon } from "@/lib/map";

interface LocationValue {
  lat: number;
  lng: number;
}

interface MapPickerProps {
  value?: LocationValue | null;
  onChange: (loc: LocationValue) => void;
  height?: number;
}

export default function MapPicker({ value, onChange, height = 260 }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  // Eng so'nggi onChange'ni saqlaymiz — stale closure oldini oladi
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Xaritani faqat bir marta yaratamiz
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initial =
      value?.lat !== undefined && value?.lng !== undefined
        ? [value.lat, value.lng]
        : [41.311081, 69.240562]; // Toshkent
    const map = L.map(containerRef.current, {
      center: initial as [number, number],
      zoom: 13,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // Bosish bilan joy tanlash
    map.on("click", (e: L.LeafletMouseEvent) => {
      onChangeRef.current({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    });

    mapRef.current = map;

    // Dialog ichida ochilganda o'lcham to'g'ri bo'lishi uchun
    const t = window.setTimeout(() => map.invalidateSize(), 150);

    return () => {
      window.clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marker va markazni value bo'yicha yangilash
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (value?.lat !== undefined && value?.lng !== undefined) {
      if (!markerRef.current) {
        markerRef.current = L.marker([value.lat, value.lng], { icon: defaultMapIcon }).addTo(map);
      } else {
        markerRef.current.setLatLng([value.lat, value.lng]);
      }
      map.panTo([value.lat, value.lng]);
    }
  }, [value]);

  return (
    <div className="relative overflow-hidden rounded-lg border">
      <div ref={containerRef} style={{ height: `${height}px`, width: "100%", zIndex: 0 }} />
      <div className="pointer-events-none absolute bottom-2 left-2 right-2 z-[500] flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
        <MapPin className="h-3 w-3 shrink-0" />
        {value?.lat !== undefined && value?.lng !== undefined ? (
          <span>
            Tanlangan: {value.lat.toFixed(5)}, {value.lng.toFixed(5)}
          </span>
        ) : (
          <span>Joylashuvni tanlash uchun xaritani bosing</span>
        )}
      </div>
    </div>
  );
}
