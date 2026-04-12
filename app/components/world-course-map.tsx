"use client";

import { useEffect, useRef } from "react";
import type { CourseRecord } from "@/lib/courses";

export type WorldCourseMapPoint = {
  location: string;
  latitude: number;
  longitude: number;
  count: number;
  label: string;
};

type WorldCourseMapProps = {
  points: WorldCourseMapPoint[];
  activeLocation: string;
  activeCourses: CourseRecord[];
  onSelectLocation: (location: string) => void;
};

function createCourseOffsets(total: number, index: number) {
  if (total <= 1) {
    return { lat: 0, lng: 0 };
  }

  const ring = Math.max(1, Math.ceil(Math.sqrt(total)));
  const angle = (Math.PI * 2 * index) / total;
  const radius = 0.12 + (Math.floor(index / ring) * 0.035);
  return {
    lat: Math.sin(angle) * radius,
    lng: Math.cos(angle) * radius,
  };
}

export default function WorldCourseMap({
  points,
  activeLocation,
  activeCourses,
  onSelectLocation,
}: WorldCourseMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<{
    map: import("leaflet").Map;
    layerGroup: import("leaflet").LayerGroup;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      if (!mapRef.current || instanceRef.current) return;

      const L = await import("leaflet");
      if (!mounted || !mapRef.current) return;

      const map = L.map(mapRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        worldCopyJump: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      instanceRef.current = { map, layerGroup };
    }

    setup();

    return () => {
      mounted = false;
      if (instanceRef.current) {
        instanceRef.current.map.remove();
        instanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    async function renderMarkers() {
      const current = instanceRef.current;
      if (!current) return;

      const L = await import("leaflet");
      current.layerGroup.clearLayers();

      if (!points.length) {
        current.map.setView([20, 0], 2);
        return;
      }

      const activePoint = points.find((point) => point.location === activeLocation) || null;

      if (activePoint && activeCourses.length) {
        const courseCoordinates: [number, number][] = [];

        activeCourses.forEach((course, index) => {
          const hasExactCoordinates = typeof course.next_session_latitude === "number" && typeof course.next_session_longitude === "number";
          const offset = createCourseOffsets(activeCourses.length, index);
          const latitude = hasExactCoordinates ? course.next_session_latitude as number : activePoint.latitude + offset.lat;
          const longitude = hasExactCoordinates ? course.next_session_longitude as number : activePoint.longitude + offset.lng;
          courseCoordinates.push([latitude, longitude]);

          const marker = L.circleMarker([latitude, longitude], {
            radius: 7,
            weight: 2,
            color: "#b96d2d",
            fillColor: "#f4c17e",
            fillOpacity: 0.94,
          });

          marker.bindTooltip(
            `${course.title || "Untitled course"}${course.next_session_address ? ` • ${course.next_session_address}` : ""}${course.next_start_date ? ` • ${course.next_start_date}` : ""}`,
            { direction: "top" }
          );
          marker.addTo(current.layerGroup);
        });

        const cityMarker = L.circleMarker([activePoint.latitude, activePoint.longitude], {
          radius: 12,
          weight: 3,
          color: "#123b4a",
          fillColor: "#1f5b70",
          fillOpacity: 0.95,
        });

        cityMarker.bindTooltip(activePoint.label, { direction: "top" });
        cityMarker.addTo(current.layerGroup);

        current.map.fitBounds(L.latLngBounds(courseCoordinates).pad(0.7));
        return;
      }

      const bounds = L.latLngBounds(points.map((point) => [point.latitude, point.longitude] as [number, number]));

      for (const point of points) {
        const marker = L.circleMarker([point.latitude, point.longitude], {
          radius: 8,
          weight: 2,
          color: "#123b4a",
          fillColor: "#1f5b70",
          fillOpacity: 0.88,
        });

        marker.bindTooltip(`${point.label} • ${point.count} course${point.count === 1 ? "" : "s"}`, {
          direction: "top",
        });
        marker.on("click", () => onSelectLocation(point.location));
        marker.addTo(current.layerGroup);
      }

      current.map.fitBounds(bounds.pad(0.35));
    }

    renderMarkers();
  }, [points, activeLocation, onSelectLocation]);

  return <div ref={mapRef} className="world-course-map" />;
}
