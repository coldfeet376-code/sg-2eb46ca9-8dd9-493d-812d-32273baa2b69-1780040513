import React, { createContext, useContext, useState, useEffect } from "react";

interface TourContextType {
  isTourActive: boolean;
  currentStep: number;
  startTour: () => void;
  completeTour: () => void;
  setCurrentStep: (step: number) => void;
  resetAllTours: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

const TOUR_STORAGE_KEY = "gist-rota-tour-completed";

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    // Check if tour has been completed before
    const tourCompleted = localStorage.getItem(TOUR_STORAGE_KEY);
    
    // Auto-start tour for new users
    if (!tourCompleted) {
      // Delay to ensure page is fully loaded
      setTimeout(() => {
        setIsTourActive(true);
      }, 1000);
    }
  }, []);

  const startTour = () => {
    setCurrentStep(0);
    setIsTourActive(true);
  };

  const completeTour = () => {
    setIsTourActive(false);
    setCurrentStep(0);
    if (mounted) {
      localStorage.setItem(TOUR_STORAGE_KEY, "true");
    }
  };

  const resetAllTours = () => {
    localStorage.removeItem(TOUR_STORAGE_KEY);
    setCurrentStep(0);
    setIsTourActive(true);
  };

  return (
    <TourContext.Provider
      value={{
        isTourActive,
        currentStep,
        startTour,
        completeTour,
        setCurrentStep,
        resetAllTours,
      }}
    >
      {children}
    </TourContext.Provider>
  );
}

export function useTour() {
  const context = useContext(TourContext);
  if (!context) {
    throw new Error("useTour must be used within TourProvider");
  }
  return context;
}