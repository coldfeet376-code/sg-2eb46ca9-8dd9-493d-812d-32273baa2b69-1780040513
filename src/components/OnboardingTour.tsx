import { useEffect, useRef } from "react";
import { useRouter } from "next/router";
import Shepherd from "shepherd.js";
import "shepherd.js/dist/css/shepherd.css";
import { useTour } from "@/contexts/TourContext";

const tourSteps = {
  main: [
    {
      id: "welcome",
      text: [
        "<h3 class='font-condensed text-lg font-bold mb-2'>Welcome to Warehouse Rota! 👋</h3>",
        "<p class='text-sm mb-3'>Let's take a quick tour of the key features to get you started.</p>",
        "<p class='text-xs text-muted-foreground'>You can restart this tour anytime from the settings.</p>",
      ].join(""),
      buttons: [
        {
          text: "Skip Tour",
          action: function(this: Shepherd.Tour) {
            this.complete();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Start Tour",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "generate-rota",
      attachTo: {
        element: "[data-tour='generate-button']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Generate Rotas</h3>",
        "<p class='text-sm'>Click here to automatically generate fair staff assignments based on your configuration.</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "week-navigation",
      attachTo: {
        element: "[data-tour='week-nav']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Navigate Weeks</h3>",
        "<p class='text-sm'>Use these arrows to move between weeks, or select a specific year to view annually.</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "rota-table",
      attachTo: {
        element: "[data-tour='rota-table']",
        on: "top",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Weekly Schedule</h3>",
        "<p class='text-sm mb-2'>View staff assignments by task and day. Click any cell to lock assignments for manual control.</p>",
        "<p class='text-xs text-muted-foreground'>Locked assignments have an orange border and won't be changed when regenerating.</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "staff-nav",
      attachTo: {
        element: "a[href='/staff']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Manage Staff</h3>",
        "<p class='text-sm'>Add staff members, set their trained tasks, and manage availability (rest days, holidays, sick leave).</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "config-nav",
      attachTo: {
        element: "a[href='/config']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Task Configuration</h3>",
        "<p class='text-sm'>Set how many staff are needed for each task on each day of the week. Save configurations as templates!</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "analytics-nav",
      attachTo: {
        element: "a[href='/analytics']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Analytics & Insights</h3>",
        "<p class='text-sm'>View fairness metrics, workload heatmaps, utilization rates, and preference satisfaction.</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "notifications",
      attachTo: {
        element: "[data-tour='notifications']",
        on: "bottom",
      },
      text: [
        "<h3 class='font-condensed text-base font-bold mb-2'>Notifications</h3>",
        "<p class='text-sm'>Stay updated on rota changes, swap requests, and certification expiries.</p>",
      ].join(""),
      buttons: [
        {
          text: "Back",
          action: function(this: Shepherd.Tour) {
            this.back();
          },
          classes: "shepherd-button-secondary",
        },
        {
          text: "Next",
          action: function(this: Shepherd.Tour) {
            this.next();
          },
        },
      ],
    },
    {
      id: "complete",
      text: [
        "<h3 class='font-condensed text-lg font-bold mb-2'>You're All Set! 🎉</h3>",
        "<p class='text-sm mb-3'>You now know the basics of the Warehouse Rota system.</p>",
        "<div class='text-xs text-muted-foreground space-y-1'>",
        "<p><strong>Quick Tips:</strong></p>",
        "<p>• Use Ctrl+Z to undo changes</p>",
        "<p>• Export rotas as PDF or CSV</p>",
        "<p>• Set recurring availability patterns</p>",
        "<p>• Track certifications with expiry alerts</p>",
        "</div>",
      ].join(""),
      buttons: [
        {
          text: "Finish Tour",
          action: function(this: Shepherd.Tour) {
            this.complete();
          },
        },
      ],
    },
  ],
};

export function OnboardingTour() {
  const { hasSeenTour, markTourAsSeen } = useTour();
  const router = useRouter();
  const tourRef = useRef<Shepherd.Tour | null>(null);

  useEffect(() => {
    // Only run tour on main page
    if (router.pathname !== "/") return;

    // Check if user has seen the tour
    if (hasSeenTour("main-onboarding")) return;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      startMainTour();
    }, 1000);

    return () => {
      clearTimeout(timer);
      if (tourRef.current) {
        tourRef.current.complete();
      }
    };
  }, [router.pathname]);

  const startMainTour = () => {
    const tour = new Shepherd.Tour({
      useModalOverlay: true,
      defaultStepOptions: {
        cancelIcon: {
          enabled: true,
        },
        classes: "shepherd-theme-custom",
        scrollTo: { behavior: "smooth", block: "center" },
      },
    });

    tourSteps.main.forEach((step) => {
      tour.addStep(step);
    });

    tour.on("complete", () => {
      markTourAsSeen("main-onboarding");
    });

    tour.on("cancel", () => {
      markTourAsSeen("main-onboarding");
    });

    tourRef.current = tour;
    tour.start();
  };

  // Expose restart function globally
  useEffect(() => {
    (window as any).restartTour = () => {
      if (router.pathname === "/") {
        startMainTour();
      }
    };
  }, [router.pathname]);

  return null;
}