import { memo } from "react";
import { Lock, Unlock } from "lucide-react";
import type { Assignment, Task } from "@/types";

interface RotaTableRowProps {
  task: Task;
  dayIndex: number;
  dayAssignments: Assignment[];
  unavailableStaff: Array<{ name: string; reason: string; color: string }>;
  showUnavailableStaff: boolean;
  isAssignmentLocked: (task: string, dayIndex: number, staffName: string) => boolean;
  getStaffAvailability: (staffName: string, dateIndex: number) => { type: string; color: string; label: string } | null;
  getTaskColor: (task: string) => string;
  toggleLockAssignment: (task: string, dayIndex: number, staffName: string) => void;
  onSuggestClick: () => void;
}

export const RotaTableRow = memo(function RotaTableRow({
  task,
  dayIndex,
  dayAssignments,
  unavailableStaff,
  showUnavailableStaff,
  isAssignmentLocked,
  getStaffAvailability,
  getTaskColor,
  toggleLockAssignment,
  onSuggestClick,
}: RotaTableRowProps) {
  const taskColorClass = getTaskColor(task);

  return (
    <td className="p-4 text-center align-top">
      <div className="space-y-2">
        {/* Assigned staff */}
        {dayAssignments.map((assignment, idx) => {
          const locked = isAssignmentLocked(task, dayIndex, assignment.staffName);
          const availability = getStaffAvailability(assignment.staffName, dayIndex);
          
          return (
            <button
              key={idx}
              onClick={() => toggleLockAssignment(task, dayIndex, assignment.staffName)}
              className={`text-xs font-mono px-4 py-2.5 rounded-lg transition-all cursor-pointer group relative no-print w-full shadow-sm hover:shadow-md border-2 ${
                locked 
                  ? 'bg-warning/20 text-warning-foreground border-warning hover:bg-warning/30 hover:scale-105 locked-assignment' 
                  : `${taskColorClass} hover:scale-105 hover:shadow-lg`
              }`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="flex items-center gap-2 font-semibold">
                  {locked ? (
                    <Lock className="h-3.5 w-3.5 no-print" />
                  ) : (
                    <Unlock className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity no-print" />
                  )}
                  {assignment.staffName}
                </span>
                {availability && availability.type !== 'available' && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${availability.color}`}>
                    {availability.label}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        
        {/* Unavailable staff */}
        {showUnavailableStaff && unavailableStaff.map((unavailable, idx) => (
          <div
            key={`unavail-${idx}`}
            className="text-xs font-mono px-4 py-2.5 rounded-lg opacity-50 no-print border-2 border-dashed border-muted-foreground/20 bg-muted/20"
            title={`${unavailable.name} - ${unavailable.reason}`}
          >
            <div className="flex flex-col items-center gap-1">
              <span className="line-through text-muted-foreground font-medium">
                {unavailable.name}
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-md border ${unavailable.color}`}>
                {unavailable.reason}
              </span>
            </div>
          </div>
        ))}
        
        {/* Empty state */}
        {dayAssignments.length === 0 && (
          <div
            className="text-center text-muted-foreground text-xs py-2 font-sans hover:bg-accent/50 cursor-pointer rounded-lg transition-smooth border-2 border-dashed border-muted-foreground/20 hover:border-primary/50"
            onClick={onSuggestClick}
            title="Click for smart assignment suggestions"
          >
            + Suggest
          </div>
        )}
        
        {/* Print-only version */}
        <div className="hidden print:block space-y-1">
          {dayAssignments.map((assignment, idx) => {
            const locked = isAssignmentLocked(task, dayIndex, assignment.staffName);
            const availability = getStaffAvailability(assignment.staffName, dayIndex);
            return (
              <div key={idx} className={locked ? 'locked-assignment' : ''}>
                {assignment.staffName}
                {availability && availability.type !== 'available' && ` (${availability.label})`}
                {locked ? ' 🔒' : ''}
              </div>
            );
          })}
        </div>
      </div>
    </td>
  );
});