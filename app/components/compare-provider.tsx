"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type CompareItem = {
  id: string;
  kind: "course" | "cruise" | "flight" | "hotel" | "car";
  title: string;
  providerName?: string | null;
  topic?: string | null;
  description?: string | null;
  location?: string | null;
  dateText?: string | null;
  priceText?: string | null;
  ratingAverage?: number | null;
  ratingCount?: number | null;
  details?: string[];
  href?: string | null;
};

type CompareContextValue = {
  items: CompareItem[];
  isCompared: (id: string, kind: CompareItem["kind"]) => boolean;
  toggleItem: (item: CompareItem) => void;
  clearKind: (kind: CompareItem["kind"]) => void;
  clearAll: () => void;
};

const STORAGE_KEY = "ceatlas:compare-items";
const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CompareItem[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CompareContextValue>(() => ({
    items,
    isCompared: (id, kind) => items.some((item) => item.id === id && item.kind === kind),
    toggleItem: (item) => {
      setItems((current) => {
        const exists = current.some((entry) => entry.id === item.id && entry.kind === item.kind);
        if (exists) {
          return current.filter((entry) => !(entry.id === item.id && entry.kind === item.kind));
        }

        const sameKind = current.filter((entry) => entry.kind === item.kind);
        const otherKinds = current.filter((entry) => entry.kind !== item.kind);
        const cappedKind = [...sameKind, item].slice(-4);
        return [...otherKinds, ...cappedKind];
      });
    },
    clearKind: (kind) => {
      setItems((current) => current.filter((item) => item.kind !== kind));
    },
    clearAll: () => setItems([]),
  }), [items]);

  return (
    <CompareContext.Provider value={value}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);

  if (!context) {
    throw new Error("useCompare must be used inside CompareProvider");
  }

  return context;
}
