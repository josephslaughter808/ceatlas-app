"use client";

import { useEffect, useRef } from "react";

const destinations = [
  { name: "San Diego", detail: "18 upcoming", lat: 32.72, lng: -117.16 },
  { name: "Chicago", detail: "24 upcoming", lat: 41.88, lng: -87.63 },
  { name: "New York", detail: "31 upcoming", lat: 40.71, lng: -74.0 },
  { name: "Orlando", detail: "16 upcoming", lat: 28.54, lng: -81.38 },
  { name: "London", detail: "12 upcoming", lat: 51.51, lng: -0.13 },
];

export default function AtlasHomeMap() {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    let active = true;
    async function mountMap() {
      if (!elementRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (!active || !elementRef.current) return;
      const map = L.map(elementRef.current, {
        center: [35, -35],
        zoom: 2,
        minZoom: 2,
        scrollWheelZoom: false,
        zoomControl: false,
        worldCopyJump: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      L.control.zoom({ position: "bottomright" }).addTo(map);
      destinations.forEach((destination) => {
        const marker = L.circleMarker([destination.lat, destination.lng], {
          radius: 8,
          color: "#fff",
          weight: 3,
          fillColor: "#e96b3a",
          fillOpacity: 1,
        });
        marker.bindTooltip(`<strong>${destination.name}</strong><br>${destination.detail}`, {
          direction: "top",
          className: "atlas-map-tooltip",
        });
        marker.on("click", () => {
          window.location.href = `/courses?location=${encodeURIComponent(destination.name)}`;
        });
        marker.addTo(map);
      });
      mapRef.current = map;
    }
    mountMap();
    return () => {
      active = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  return <div ref={elementRef} className="atlas-home-map" aria-label="Map of popular continuing education destinations" />;
}
