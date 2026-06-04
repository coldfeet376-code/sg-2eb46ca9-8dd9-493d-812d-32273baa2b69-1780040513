import type { Task, Assignment } from "@/types";
import { Sparkles } from "lucide-react";

interface RotaTableRowProps {
  task: Task;
  weekDates: Date[];
  assignments: Assignment[];
  lockedAssignments: Assignment[];
  onToggleLock: (task: Task, dayIdx: number, staffName: string) => void;
  onOpenSmartAssign: (task: Task, date: string) => void;
  onStaffClick: (staffId: string, staffName: string, date: string, task: string) => void;
}

const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function RotaTableRow({
  task,
  weekDates,
  assignments,
  lockedAssignments,
  onToggleLock,
  onOpenSmartAssign,
  onStaffClick,
}: RotaTableRowProps) {
  const taskColorClass = "bg-primary/10 text-primary border-primary/30 hover:bg-primary/20";

  return (
    <tr className="border-b border-border/50 hover:bg-muted/30 transition-smooth">
      <td className="p-3 font-mono text-sm font-semibold bg-muted/20">
        {task}
      </td>
      {weekDates.map((date, dayIdx) => {
        const dateStr = getLocalDateString(date);
        
        // Get day and night assignments separately
        const dayAssignments = assignments.filter(
          (a) => a.task === task && a.date === dateStr && (!a.shift || a.shift === "Day")
        );
        const nightAssignments = assignments.filter(
          (a) => a.task === task && a.date === dateStr && a.shift === "Night"
        );

        return (
          <td key={dayIdx} className="p-0 align-top">
            <div className="grid grid-cols-2 divide-x min-h-[60px]">
              {/* Day Shift Column */}
              <div className="p-2 space-y-1">
                {dayAssignments.length > 0 ? (
                  dayAssignments.map((assignment, idx) => {
                    const locked = lockedAssignments.some(
                      (la) =>
                        la.staffId === assignment.staffId &&
                        la.date === dateStr &&
                        la.task === task &&
                        (!la.shift || la.shift === "Day")
                    );

                    return (
                      <button
                        key={idx}
                        onClick={() => onToggleLock(task, dayIdx, assignment.staffName)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onStaffClick(assignment.staffId, assignment.staffName, dateStr, task);
                        }}
                        className={`text-xs font-mono px-2 py-1.5 rounded transition-all cursor-pointer group relative w-full shadow-sm hover:shadow-md border ${
                          locked
                            ? "bg-warning/20 text-warning-foreground border-warning hover:bg-warning/30"
                            : `${taskColorClass}`
                        }`}
                        title="Left-click to lock/unlock • Right-click to mark sick/holiday"
                      >
                        {assignment.staffName}
                      </button>
                    );
                  })
                ) : (
                  <button
                    onClick={() => onOpenSmartAssign(task, dateStr)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 w-full py-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="text-[10px]">Assign</span>
                  </button>
                )}
              </div>

              {/* Night Shift Column */}
              <div className="p-2 space-y-1 bg-slate-900/5 dark:bg-slate-100/5">
                {nightAssignments.length > 0 ? (
                  nightAssignments.map((assignment, idx) => {
                    const locked = lockedAssignments.some(
                      (la) =>
                        la.staffId === assignment.staffId &&
                        la.date === dateStr &&
                        la.task === task &&
                        la.shift === "Night"
                    );

                    return (
                      <button
                        key={idx}
                        onClick={() => onToggleLock(task, dayIdx, assignment.staffName)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          onStaffClick(assignment.staffId, assignment.staffName, dateStr, task);
                        }}
                        className={`text-xs font-mono px-2 py-1.5 rounded transition-all cursor-pointer group relative w-full shadow-sm hover:shadow-md border ${
                          locked
                            ? "bg-warning/20 text-warning-foreground border-warning hover:bg-warning/30"
                            : `${taskColorClass}`
                        }`}
                        title="Left-click to lock/unlock • Right-click to mark sick/holiday"
                      >
                        {assignment.staffName}
                      </button>
                    );
                  })
                ) : (
                  <button
                    onClick={() => onOpenSmartAssign(task, dateStr)}
                    className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1 w-full py-1"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span className="text-[10px]">Assign</span>
                  </button>
                )}
              </div>
            </div>
          </td>
        );
      })}
    </tr>
  );
}