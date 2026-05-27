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
  const [tourActive, setTourActive] = useState(false);
  const [run, setRun] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    console.log("🎓 TourContext initialized");
    
    // Check if tour has been completed
    const tourCompleted = localStorage.getItem("tourCompleted");
    console.log("   Tour completed status:", tourCompleted);
    
    if (!tourCompleted) {
      console.log("   ✅ Tour not completed - will show tour");
      // Small delay to ensure DOM elements are ready
      const timer = setTimeout(() => {
        console.log("   🚀 Starting tour after delay");
        setTourActive(true);
        setRun(true);
      }, 1000);
      
      return () => clearTimeout(timer);
    } else {
      console.log("   ⏭️ Tour already completed - skipping");
    }
  }, []);

  const startTour = () => {
    console.log("🎬 Manual tour start requested");
    setStepIndex(0);
    setTourActive(true);
    setRun(true);
  };

  const endTour = () => {
    console.log("🏁 Tour ended");
    setRun(false);
    setTourActive(false);
    localStorage.setItem("tourCompleted", "true");
  };

  const resetTour = () => {
    console.log("🔄 Tour reset");
    localStorage.removeItem("tourCompleted");
    setStepIndex(0);
    setTourActive(true);
    setRun(true);
  };

  return (
    <TourContext.Provider
      value={{
        isTourActive: tourActive,
        currentStep: stepIndex,
        startTour,
        completeTour: endTour,
        setCurrentStep: setStepIndex,
        resetAllTours: resetTour,
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