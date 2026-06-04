import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "lucide-react";
import type { StaffMember, AvailabilityType } from "@/types";

interface StaffWeekCalendarProps {
  staff: StaffMember;
  weekDates: Date[];
  onStatusChange?: (staffId: string, date: string, status: AvailabilityType) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function StaffWeekCalendar({ staff, weekDates, onStatusChange }: StaffWeekCalendarProps) {
  const [open, setOpen] = useState(false);

  const getStatusForDate = (date: Date): AvailabilityType => {
    const dateStr = date.toISOString().split("T")[0];
    const availability = staff.availability?.find(a => a.date === dateStr);
    return availability?.type || "available";
  };

  const getStatusColor = (status: AvailabilityType): string => {
    switch (status) {
      case "rest":
        return "bg-blue-500 hover:bg-blue-600";
      case "holiday":
        return "bg-purple-500 hover:bg-purple-600";
      case "sick":
        return "bg-red-500 hover:bg-red-600";
      case "available":
        return "bg-green-500 hover:bg-green-600";
      default:
        return "bg-gray-500 hover:bg-gray-600";
    }
  };

  const getStatusLabel = (status: AvailabilityType): string => {
    switch (status) {
      case "rest":
        return "Rest";
      case "holiday":
        return "Holiday";
      case "sick":
        return "Sick";
      case "available":
        return "Available";
      default:
        return "Unknown";
    }
  };

  const cycleStatus = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const currentStatus = getStatusForDate(date);
    const statuses: AvailabilityType[] = ["available", "rest", "holiday", "sick"];
    const currentIndex = statuses.indexOf(currentStatus);
    const nextStatus = statuses[(currentIndex + 1) % statuses.length];
    
    if (onStatusChange) {
      onStatusChange(staff.id, dateStr, nextStatus);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <Calendar className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-condensed font-semibold text-sm">{staff.name}</h4>
            <span className="text-xs text-muted-foreground font-mono">Week Status</span>
          </div>
          
          <div className="grid grid-cols-7 gap-1">
            {weekDates.map((date, idx) => {
              const status = getStatusForDate(date);
              const color = getStatusColor(status);
              
              return (
                <button
                  key={idx}
                  onClick={() => cycleStatus(date)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg ${color} text-white transition-all hover:scale-105`}
                  title={`${DAYS[idx]} - ${getStatusLabel(status)} (click to change)`}
                >
                  <span className="text-xs font-semibold">{DAYS[idx]}</span>
                  <span className="text-[10px] font-mono">{date.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="font-mono">Available</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-blue-500"></div>
              <span className="font-mono">Rest</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-purple-500"></div>
              <span className="font-mono">Holiday</span>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="font-mono">Sick</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground font-sans">
            Click a day to cycle through statuses
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}