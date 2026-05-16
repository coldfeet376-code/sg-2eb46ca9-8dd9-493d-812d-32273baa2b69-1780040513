import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import { useTour } from "@/contexts/TourContext";

// Lazy load Shepherd.js only when needed
let ShepherdImport: any = null;

const loadShepherd = async () => {
  if (!ShepherdImport) {
    const mod = await import("shepherd.js");
    ShepherdImport = mod.default || mod;
  }
  return ShepherdImport;
};

export function OnboardingTour() {
  const router = useRouter();
  const { hasSeenTour, markTourAsSeen } = useTour();
  const tourRef = useRef<any>(null);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (tourRef.current) {
        tourRef.current.complete();
        tourRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const startMainTour = async () => {
      if (hasSeenTour("main") || router.pathname !== "/") return;

      const Shepherd = await loadShepherd();
      const tour = new Shepherd.Tour({
        useModalOverlay: true,
        defaultStepOptions: {
          classes: "shepherd-theme-custom",
          scrollTo: { behavior: "smooth", block: "center" },
          cancelIcon: {
            enabled: true,
          },
        },
      });

      tour.addStep({
        id: "welcome",
        text: `
          <h3>Welcome to Warehouse Rota! 👋</h3>
          <p>Let's take a quick tour of the key features. This will only take 2 minutes.</p>
        `,
        buttons: [
          {
            text: "Skip Tour",
            secondary: true,
            action: () => {
              tour.complete();
              markTourAsSeen("main");
            },
          },
          {
            text: "Start Tour",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "generate-button",
        text: `
          <h3>Generate Rota</h3>
          <p>Click here to automatically generate a fair work schedule. The algorithm ensures no consecutive same tasks and balanced distribution.</p>
        `,
        attachTo: {
          element: "[data-tour='generate-button']",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "week-nav",
        text: `
          <h3>Navigate Weeks</h3>
          <p>Use these controls to move between weeks or jump to a specific date. You can also switch to yearly view to see the entire year at once.</p>
        `,
        attachTo: {
          element: "[data-tour='week-nav']",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "rota-table",
        text: `
          <h3>Rota Table</h3>
          <p>View all assignments here. Click the lock icon 🔒 to lock specific assignments and prevent them from changing during regeneration.</p>
        `,
        attachTo: {
          element: "[data-tour='rota-table']",
          on: "top",
        },
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "staff-page",
        text: `
          <h3>Staff Management</h3>
          <p>Navigate to the <strong>Staff</strong> page to add team members, set their trained tasks, and manage their availability.</p>
        `,
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "config-page",
        text: `
          <h3>Task Configuration</h3>
          <p>The <strong>Config</strong> page lets you set how many staff are needed for each task on each day. Save configurations as templates for quick reuse!</p>
        `,
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "analytics",
        text: `
          <h3>Analytics Dashboard</h3>
          <p>Track fairness scores, workload distribution, and preference satisfaction. See heatmaps showing who's doing what tasks.</p>
        `,
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "notifications",
        text: `
          <h3>Notifications</h3>
          <p>Stay updated on new assignments, swap requests, and system alerts. Click the bell icon to view all notifications.</p>
        `,
        attachTo: {
          element: "[data-tour='notifications']",
          on: "bottom",
        },
        buttons: [
          {
            text: "Back",
            secondary: true,
            action: tour.back,
          },
          {
            text: "Next",
            action: tour.next,
          },
        ],
      });

      tour.addStep({
        id: "complete",
        text: `
          <h3>You're All Set! 🎉</h3>
          <p>Quick tips:</p>
          <ul style="margin: 0.5rem 0; padding-left: 1.5rem;">
            <li>Use <strong>Ctrl+Z</strong> to undo changes</li>
            <li>Lock assignments before regenerating to keep them</li>
            <li>Set recurring availability patterns to save time</li>
            <li>Check coverage warnings before generating rotas</li>
          </ul>
          <p>Click the help icon (❓) in the header anytime to restart this tour.</p>
        `,
        buttons: [
          {
            text: "Finish",
            action: () => {
              tour.complete();
              markTourAsSeen("main");
            },
          },
        ],
      });

      tour.on("complete", () => {
        markTourAsSeen("main");
        if (tourRef.current === tour) {
          tourRef.current = null;
        }
      });

      tour.on("cancel", () => {
        markTourAsSeen("main");
        if (tourRef.current === tour) {
          tourRef.current = null;
        }
      });

      tourRef.current = tour;
      tour.start();

      // Expose restart function
      (window as any).restartTour = () => {
        if (tourRef.current) {
          tourRef.current.complete();
        }
        startMainTour();
      };
    };

    if (router.pathname === "/") {
      startMainTour();
    }
  }, [router.pathname, hasSeenTour, markTourAsSeen]);

  return null;
}