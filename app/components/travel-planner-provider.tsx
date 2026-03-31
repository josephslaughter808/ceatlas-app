"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export type TravelPlanRecord = {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  destination: string;
  destinationCode: string;
  startDate: string | null;
  endDate: string | null;
  departureAirport: string;
  travelers: number;
  budget: string;
  hotelStyle: string;
  needsCar: boolean;
  notes: string;
  createdAt: string;
};

type TravelPlannerContextValue = {
  plans: TravelPlanRecord[];
  addPlan: (plan: Omit<TravelPlanRecord, "id" | "createdAt">) => void;
  removePlan: (planId: string) => void;
};

const STORAGE_KEY = "ceatlas:travel-plans";
const TravelPlannerContext = createContext<TravelPlannerContextValue | null>(null);

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `plan-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function TravelPlannerProvider({ children }: { children: React.ReactNode }) {
  const [plans, setPlans] = useState<TravelPlanRecord[]>(() => {
    if (typeof window === "undefined") return [];

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
  }, [plans]);

  const value = useMemo<TravelPlannerContextValue>(() => ({
    plans,
    addPlan: (plan) => {
      setPlans((current) => [
        {
          ...plan,
          id: createId(),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);
    },
    removePlan: (planId) => {
      setPlans((current) => current.filter((plan) => plan.id !== planId));
    },
  }), [plans]);

  return (
    <TravelPlannerContext.Provider value={value}>
      {children}
    </TravelPlannerContext.Provider>
  );
}

export function useTravelPlanner() {
  const context = useContext(TravelPlannerContext);

  if (!context) {
    throw new Error("useTravelPlanner must be used inside TravelPlannerProvider");
  }

  return context;
}
