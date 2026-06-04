import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, CheckCircle, XCircle, AlertCircle, Plane } from "lucide-react";
import type { StaffMember, AvailabilityType } from "@/types";
import { cn } from "@/lib/utils";

interface StaffWeekCalendarProps {
  staff: StaffMember;
  weekDates: Date[];
  onStatusChange: (staffId: string, date: string, status: AvailabilityType) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getStatusIcon = (status: AvailabilityType) => {
  switch (status) {
    case "available":
      return <CheckCircle className="h-3 w-3 text-success" />;
    case "rest":
      return <XCircle className="h-3 w-3 text-muted-foreground" />;
    case "sick":
      return <AlertCircle className="h-3 w-3 text-warning" />;
    case "holiday":
      return <Plane className="h-3 w-3 text-primary" />;
  }
};

const getStatusColor = (status: AvailabilityType) => {
  switch (status) {
    case "available":
      return "bg-success/20 border-success/40 hover:bg-success/30";
    case "rest":
      return "bg-muted border-border hover:bg-muted/70";
    case "sick":
      return "bg-warning/20 border-warning/40 hover:bg-warning/30";
    case "holiday":
      return "bg-primary/20 border-primary/40 hover:bg-primary/30";
  }
};

const getStatusLabel = (status: AvailabilityType) => {
  switch (status) {
    case "available":
      return "Available";
    case "rest":
      return "Rest Day";
    case "sick":
      return "Sick";
    case "holiday":
      return "Holiday";
  }
};

export function StaffWeekCalendar({ staff, weekDates, onStatusChange }: StaffWeekCalendarProps) {
  const [open, setOpen] = useState(false);

  const getDateStatus = (date: Date): AvailabilityType => {
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();

    // Check specific date availability first
    const dateAvailability = staff.availability?.find((a) => a.date === dateStr);
    if (dateAvailability) {
      return dateAvailability.type;
    }

    // Check if it's a rest day
    if (staff.restDays && staff.restDays.includes(dayOfWeek)) {
      return "rest";
    }

    return "available";
  };

  const cycleStatus = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const currentStatus = getDateStatus(date);

    const statusCycle: AvailabilityType[] = ["available", "rest", "holiday", "sick"];
    const currentIndex = statusCycle.indexOf(currentStatus);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    onStatusChange(staff.id, dateStr, nextStatus);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-xs">Week</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="p-3 space-y-2">
          <div className="flex items-center justify-between pb-2 border-b">
            <div className="font-mono font-semibold text-sm">{staff.name}</div>
            <div className="text-xs text-muted-foreground">
              {weekDates[0].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} - {weekDates[6].toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, i) => {
              const status = getDateStatus(date);
              return (
                <button
                  key={i}
                  onClick={() => cycleStatus(date)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-md border transition-colors",
                    getStatusColor(status)
                  )}
                  title={`${DAYS[i]} - ${getStatusLabel(status)} (click to change)`}
                >
                  <div className="text-[10px] font-mono font-semibold text-muted-foreground">
                    {DAYS[i]}
                  </div>
                  <div className="text-xs font-mono font-bold">
                    {date.getDate()}
                  </div>
                  {getStatusIcon(status)}
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t space-y-1">
            <div className="text-xs text-muted-foreground font-mono">Legend:</div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>Available</span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle className="h-3 w-3 text-muted-foreground" />
                <span>Rest</span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertCircle className="h-3 w-3 text-warning" />
                <span>Sick</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Plane className="h-3 w-3 text-primary" />
                <span>Holiday</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground text-center pt-1 border-t">
            Click any day to cycle through statuses
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}