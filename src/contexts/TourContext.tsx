import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/router";

interface TourContextType {
  startTour: (tourId: string) => void;
  hasSeenTour: (tourId: string) => boolean;
  markTourAsSeen: (tourId: string) => void;
  resetAllTours: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export function TourProvider({ children }: { children: ReactNode }) {
  const [seenTours, setSeenTours] = useState<Set<string>>(new Set());
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("warehouse-tours-seen");
    if (saved) {
      setSeenTours(new Set(JSON.parse(saved)));
    }
  }, []);

  const startTour = (tourId: string) => {
    // Tour will be started by the component that implements it
    // This is just a placeholder for future functionality
  };

  const hasSeenTour = (tourId: string): boolean => {
    return seenTours.has(tourId);
  };

  const markTourAsSeen = (tourId: string) => {
    const updated = new Set(seenTours);
    updated.add(tourId);
    setSeenTours(updated);
    localStorage.setItem("warehouse-tours-seen", JSON.stringify([...updated]));
  };

  const resetAllTours = () => {
    setSeenTours(new Set());
    localStorage.removeItem("warehouse-tours-seen");
  };

  return (
    <TourContext.Provider value={{ startTour, hasSeenTour, markTourAsSeen, resetAllTours }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}