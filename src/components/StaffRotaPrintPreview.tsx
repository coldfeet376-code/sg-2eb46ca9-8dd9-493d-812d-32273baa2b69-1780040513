import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";
import type { StaffMember, Assignment } from "@/types";

interface StaffRotaPrintPreviewProps {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  assignments: Assignment[];
  staff: StaffMember[];
  fairnessMetrics: any;
  lockedCount: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

// Get local date string without timezone conversion
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function StaffRotaPrintPreview({
  open,
  onClose,
  weekStart,
  assignments,
  staff,
  fairnessMetrics,
  lockedCount,
}: StaffRotaPrintPreviewProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const handlePrint = () => {
    window.print();
  };

  const getAssignment = (date: Date, task: string) => {
    const dateStr = getLocalDateString(date);
    const assignment = assignments.find(
      (a) => a.date === dateStr && a.task === task
    );
    return assignment ? staff.find((s) => s.id === assignment.staffId)?.name || "—" : "—";
  };

  const weekDates = DAYS.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getStaffRestDays = (staffMember: StaffMember) => {
    return weekDates
      .filter((date) => {
        const dateStr = getLocalDateString(date);
        const availability = staffMember.availability?.find((a) => a.date === dateStr);
        return availability && availability.type !== "available";
      })
      .map((date) => DAYS[date.getDay()])
      .join(", ") || "None";
  };

  const coveragePercentage = Math.round((assignments.length / (7 * 6)) * 100);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0 print:max-w-none print:h-auto print:p-8">
        <div className="print:hidden sticky top-0 bg-background border-b border-border z-10 px-6 py-4 flex items-center justify-between">
          <DialogTitle className="font-condensed text-xl">Staff Rota - Print Preview</DialogTitle>
          <div className="flex items-center gap-2">
            <Button onClick={handlePrint} className="gap-2 font-sans font-medium">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-auto p-6 print:p-0 print-content">
          {/* Header */}
          <div className="mb-6 print:mb-8">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1 className="text-3xl font-condensed font-bold tracking-tight print:text-4xl">
                  GIST Warehouse
                </h1>
                <h2 className="text-xl font-condensed font-semibold text-primary mt-1 print:text-2xl">
                  Weekly Staff Rota
                </h2>
              </div>
              <div className="text-right">
                <p className="text-sm font-mono text-muted-foreground">
                  Week: {weekStart.toLocaleDateString("en-GB")} - {weekEnd.toLocaleDateString("en-GB")}
                </p>
                <p className="text-xs font-mono text-muted-foreground mt-1">
                  Generated: {new Date().toLocaleString("en-GB")}
                </p>
              </div>
            </div>
          </div>

          {/* Metrics Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6 print:mb-8">
            <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
              <div className="text-2xl font-mono font-bold text-primary">
                {Math.max(0, 100 - Math.round((fairnessMetrics?.standardDeviation || 0) * 10))}%
              </div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Fairness Score</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-2xl font-mono font-bold">{lockedCount}</div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Locked Assignments</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-2xl font-mono font-bold">{coveragePercentage}%</div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Week Coverage</div>
            </div>
          </div>

          {/* Weekly Schedule Table */}
          <div className="mb-6 print:mb-8">
            <h3 className="text-lg font-condensed font-bold mb-3 print:text-xl">Weekly Schedule</h3>
            <div className="border border-border rounded-lg overflow-hidden print:border-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/10 border-b border-border">
                    <th className="px-3 py-2 text-left font-condensed font-bold">Task</th>
                    {weekDates.map((date, i) => (
                      <th key={i} className="px-3 py-2 text-center font-condensed font-bold border-l border-border">
                        <div className="font-bold">{DAYS[date.getDay()]}</div>
                        <div className="text-xs font-normal text-muted-foreground">
                          {date.getDate()}/{date.getMonth() + 1}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((task, taskIdx) => (
                    <tr key={task} className={taskIdx % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="px-3 py-2 font-condensed font-semibold border-b border-border">
                        {task}
                      </td>
                      {weekDates.map((date, dayIdx) => (
                        <td
                          key={dayIdx}
                          className="px-3 py-2 text-center font-mono text-sm border-l border-b border-border"
                        >
                          {getAssignment(date, task)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Staff Information */}
          <div className="print:break-before-page">
            <h3 className="text-lg font-condensed font-bold mb-3 print:text-xl">Staff Information</h3>
            <div className="grid grid-cols-2 gap-4 print:gap-6">
              {staff.map((member) => (
                <div key={member.id} className="border border-border rounded-lg p-4 print:break-inside-avoid">
                  <div className="font-condensed font-bold text-base mb-2">{member.name}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Trained Tasks:</span>
                      <span className="font-mono font-semibold">{member.trainedTasks?.join(", ") || "None"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rest Days:</span>
                      <span className="font-mono">{getStaffRestDays(member)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground font-mono print:fixed print:bottom-8 print:left-0 print:right-0">
            GIST Warehouse Rota System • Page 1 of 1
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}