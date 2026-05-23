import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { X, ArrowRight, ArrowLeft, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTour } from "@/contexts/TourContext";

interface TourStep {
  target: string;
  title: string;
  content: string;
  position: "top" | "bottom" | "left" | "right";
  action?: {
    label: string;
    onClick: () => void;
  };
  route?: string;
}

const tourSteps: TourStep[] = [
  {
    target: "body",
    title: "Welcome to GIST Rota System! 👋",
    content: "Let's take a quick tour to help you get started with managing your warehouse staff schedules efficiently. This will only take 2 minutes.",
    position: "bottom",
    route: "/",
  },
  {
    target: "[data-tour='generate-controls']",
    title: "Generate Your First Rota",
    content: "Click 'Generate Rota' to create a fair distribution schedule. The system automatically assigns staff to tasks while balancing workload and respecting training constraints.",
    position: "bottom",
    route: "/",
  },
  {
    target: "[data-tour='week-navigator']",
    title: "Navigate Between Weeks",
    content: "Use these controls to move between weeks, jump to today, or select a specific date. Each week runs Saturday to Friday.",
    position: "bottom",
    route: "/",
  },
  {
    target: "[data-tour='fairness-metrics']",
    title: "Track Fairness & Balance",
    content: "Monitor how evenly work is distributed. The fairness score shows if tasks are balanced across your team (100% = perfectly fair distribution).",
    position: "top",
    route: "/",
  },
  {
    target: "[data-tour='staff-nav']",
    title: "Manage Your Team",
    content: "Navigate to Staff Management to add team members, configure training, and set availability (rest days, holidays, sick leave).",
    position: "bottom",
    route: "/",
  },
  {
    target: "[data-tour='staff-table']",
    title: "Staff Configuration",
    content: "Add staff members here. Set their training for different tasks (Frozen, Milk, TWI, etc.). The rota generator only assigns trained staff to matching tasks.",
    position: "top",
    route: "/staff",
  },
  {
    target: "[data-tour='bulk-operations']",
    title: "Bulk Operations",
    content: "Use bulk operations to quickly update multiple staff members at once - perfect for setting team-wide rest days or holidays.",
    position: "top",
    route: "/staff",
  },
  {
    target: "[data-tour='managers-nav']",
    title: "Manager Duty Scheduling",
    content: "The Manager Rota handles shift supervisor assignments across Intake, Out-loading, Admin, and Floor duties.",
    position: "bottom",
    route: "/staff",
  },
  {
    target: "[data-tour='manager-rota']",
    title: "Manager Constraints",
    content: "Generate manager schedules with smart constraints: no duplicate assignments per day, floor auto-assignment, and availability tracking.",
    position: "top",
    route: "/managers",
  },
  {
    target: "[data-tour='analytics-nav']",
    title: "Analytics & Insights",
    content: "View analytics to see who's been assigned, track turn counts, and monitor fairness over time.",
    position: "bottom",
    route: "/managers",
  },
  {
    target: "[data-tour='notifications']",
    title: "Stay Updated",
    content: "Check notifications here for system alerts, assignment conflicts, and important updates.",
    position: "left",
    route: "/",
  },
  {
    target: "body",
    title: "You're All Set! 🎉",
    content: "You've completed the tour! Start by adding your staff members, then generate your first rota. Need help? Click the '?' icon in the header to restart this tour anytime.",
    position: "bottom",
    route: "/",
  },
];

export function OnboardingTour() {
  const router = useRouter();
  const { isTourActive, currentStep, setCurrentStep, completeTour } = useTour();
  const [mounted, setMounted] = useState(false);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [highlightPosition, setHighlightPosition] = useState({ top: 0, left: 0, width: 0, height: 0 });

  const currentTourStep = tourSteps[currentStep];
  const isLastStep = currentStep === tourSteps.length - 1;
  const isFirstStep = currentStep === 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  // Navigate to correct route for current step
  useEffect(() => {
    if (!isTourActive || !currentTourStep?.route) return;
    
    if (router.pathname !== currentTourStep.route) {
      router.push(currentTourStep.route);
    }
  }, [currentStep, isTourActive, currentTourStep?.route, router]);

  // Calculate positions
  useEffect(() => {
    if (!isTourActive || !mounted) return;

    const updatePositions = () => {
      const target = document.querySelector(currentTourStep.target);
      if (!target || !(target instanceof HTMLElement)) {
        setTargetElement(null);
        return;
      }

      setTargetElement(target);
      const rect = target.getBoundingClientRect();
      
      // Highlight position
      setHighlightPosition({
        top: rect.top + window.scrollY - 8,
        left: rect.left + window.scrollX - 8,
        width: rect.width + 16,
        height: rect.height + 16,
      });

      // Tooltip position based on position prop
      const tooltipWidth = 400;
      const tooltipHeight = 200;
      let top = 0;
      let left = 0;

      switch (currentTourStep.position) {
        case "bottom":
          top = rect.bottom + window.scrollY + 20;
          left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
          break;
        case "top":
          top = rect.top + window.scrollY - tooltipHeight - 20;
          left = rect.left + window.scrollX + rect.width / 2 - tooltipWidth / 2;
          break;
        case "left":
          top = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
          left = rect.left + window.scrollX - tooltipWidth - 20;
          break;
        case "right":
          top = rect.top + window.scrollY + rect.height / 2 - tooltipHeight / 2;
          left = rect.right + window.scrollX + 20;
          break;
      }

      // Keep tooltip on screen
      if (left < 20) left = 20;
      if (left + tooltipWidth > window.innerWidth - 20) {
        left = window.innerWidth - tooltipWidth - 20;
      }
      if (top < 20) top = 20;

      setTooltipPosition({ top, left });
    };

    // Initial update
    setTimeout(updatePositions, 100);

    // Update on scroll and resize
    window.addEventListener("scroll", updatePositions);
    window.addEventListener("resize", updatePositions);

    return () => {
      window.removeEventListener("scroll", updatePositions);
      window.removeEventListener("resize", updatePositions);
    };
  }, [isTourActive, currentStep, mounted, currentTourStep]);

  const handleNext = () => {
    if (isLastStep) {
      completeTour();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    completeTour();
  };

  if (!isTourActive || !mounted) return null;

  return (
    <>
      {/* Backdrop overlay */}
      <div className="fixed inset-0 bg-black/60 z-[9998] pointer-events-auto" onClick={handleSkip} />

      {/* Highlight box around target element */}
      {targetElement && currentTourStep.target !== "body" && (
        <div
          className="fixed z-[9999] border-4 border-primary rounded-lg pointer-events-none animate-pulse"
          style={{
            top: `${highlightPosition.top}px`,
            left: `${highlightPosition.left}px`,
            width: `${highlightPosition.width}px`,
            height: `${highlightPosition.height}px`,
            transition: "all 0.3s ease-in-out",
          }}
        />
      )}

      {/* Tooltip card */}
      <Card
        className={cn(
          "fixed z-[10000] w-[400px] shadow-2xl pointer-events-auto",
          currentTourStep.target === "body" ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : ""
        )}
        style={
          currentTourStep.target !== "body"
            ? {
                top: `${tooltipPosition.top}px`,
                left: `${tooltipPosition.left}px`,
                transition: "all 0.3s ease-in-out",
              }
            : undefined
        }
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-xl font-condensed font-bold tracking-tight pr-8">
                {currentTourStep.title}
              </CardTitle>
              <CardDescription className="text-xs font-mono mt-2">
                Step {currentStep + 1} of {tourSteps.length}
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm font-sans leading-relaxed text-muted-foreground">
            {currentTourStep.content}
          </p>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentStep + 1) / tourSteps.length) * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs font-mono text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(((currentStep + 1) / tourSteps.length) * 100)}%</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="font-sans text-xs"
            >
              Skip Tour
            </Button>

            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrevious}
                  className="gap-2 font-sans"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleNext}
                className="gap-2 font-sans font-medium"
              >
                {isLastStep ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="h-3 w-3" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  );
}