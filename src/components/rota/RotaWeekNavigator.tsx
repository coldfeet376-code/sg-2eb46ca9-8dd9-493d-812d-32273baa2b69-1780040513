import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface RotaWeekNavigatorProps {
  weekStart: Date;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  onTodayClick: () => void;
}

export function RotaWeekNavigator({
  weekStart,
  onPreviousWeek,
  onNextWeek,
  onTodayClick,
}: RotaWeekNavigatorProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={onPreviousWeek}
        className="rounded-lg"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      
      <Button
        variant="outline"
        size="sm"
        onClick={onTodayClick}
        className="rounded-lg gap-2 font-mono text-xs"
      >
        <Calendar className="h-4 w-4" />
        Today
      </Button>

      <div className="text-sm font-condensed font-semibold min-w-[200px] text-center">
        {weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} -{" "}
        {weekEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={onNextWeek}
        className="rounded-lg"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}