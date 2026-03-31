"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "ceatlas:saved-courses";

type SavedCoursesContextValue = {
  savedCourseIds: string[];
  isSaved: (courseId: string) => boolean;
  toggleSavedCourse: (courseId: string) => void;
};

const SavedCoursesContext = createContext<SavedCoursesContextValue | null>(null);

export function SavedCoursesProvider({ children }: { children: React.ReactNode }) {
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>(() => {
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
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(savedCourseIds));
  }, [savedCourseIds]);

  const value: SavedCoursesContextValue = {
    savedCourseIds,
    isSaved: (courseId) => savedCourseIds.includes(courseId),
    toggleSavedCourse: (courseId) => {
      setSavedCourseIds((current) => (
        current.includes(courseId)
          ? current.filter((id) => id !== courseId)
          : [...current, courseId]
      ));
    },
  };

  return (
    <SavedCoursesContext.Provider value={value}>
      {children}
    </SavedCoursesContext.Provider>
  );
}

export function useSavedCourses() {
  const context = useContext(SavedCoursesContext);

  if (!context) {
    throw new Error("useSavedCourses must be used inside SavedCoursesProvider");
  }

  return context;
}
