"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "ceatlas:trip-cart";

type TripCartContextValue = {
  tripCourseIds: string[];
  isInTripCart: (courseId: string) => boolean;
  toggleTripCourse: (courseId: string) => void;
  clearTripCart: () => void;
};

const TripCartContext = createContext<TripCartContextValue | null>(null);

export function TripCartProvider({ children }: { children: React.ReactNode }) {
  const [tripCourseIds, setTripCourseIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];

    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === "string")
        : [];
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tripCourseIds));
  }, [tripCourseIds]);

  const value: TripCartContextValue = {
    tripCourseIds,
    isInTripCart: (courseId) => tripCourseIds.includes(courseId),
    toggleTripCourse: (courseId) => {
      setTripCourseIds((current) => (
        current.includes(courseId)
          ? current.filter((id) => id !== courseId)
          : [...current, courseId]
      ));
    },
    clearTripCart: () => setTripCourseIds([]),
  };

  return (
    <TripCartContext.Provider value={value}>
      {children}
    </TripCartContext.Provider>
  );
}

export function useTripCart() {
  const context = useContext(TripCartContext);

  if (!context) {
    throw new Error("useTripCart must be used inside TripCartProvider");
  }

  return context;
}
