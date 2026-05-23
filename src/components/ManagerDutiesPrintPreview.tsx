import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Printer, X } from "lucide-react";
import type { ManagerAssignment } from "@/types";

interface ManagerDutiesPrintPreviewProps {
  open: boolean;
  onClose: () => void;
  weekStart: Date;
  assignments: ManagerAssignment[];
  managers: { id: string; name: string }[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DUTIES = ["Intake", "Out-loading", "Admin", "Floor"];

export function ManagerDutiesPrintPreview({
  open,
  onClose,
  weekStart,
  assignments,
  managers,
}: ManagerDutiesPrintPreviewProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const handlePrint = () => {
    window.print();
  };

  const getAssignment = (date: Date, duty: string) => {
    const dateStr = date.toISOString().split("T")[0];
    const assignment = assignments.find(
      (a) => a.date === dateStr && a.duty === duty
    );
    if (!assignment) return "—";
    
    const manager = managers.find((m) => m.id === assignment.managerId);
    const shiftLabel = assignment.shiftStart === "06:00" ? " (6AM)" : " (8AM)";
    return manager ? `${manager.name}${shiftLabel}` : "—";
  };

  const weekDates = DAYS.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  const getManagerStats = () => {
    return managers.map((manager) => {
      const managerAssignments = assignments.filter((a) => a.managerId === manager.id);
      const dutyCount = managerAssignments.reduce((acc, a) => {
        acc[a.duty] = (acc[a.duty] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        name: manager.name,
        totalShifts: managerAssignments.length,
        duties: dutyCount,
        coverage: Math.round((managerAssignments.length / assignments.length) * 100),
      };
    });
  };

  const totalShifts = assignments.length;
  const uniqueDuties = new Set(assignments.map((a) => a.duty)).size;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] p-0 print:max-w-none print:h-auto print:p-8">
        <div className="print:hidden sticky top-0 bg-background border-b border-border z-10 px-6 py-4 flex items-center justify-between">
          <DialogTitle className="font-condensed text-xl">Manager Duties - Print Preview</DialogTitle>
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
                  Manager Duty Schedule
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
              <div className="text-2xl font-mono font-bold text-primary">{managers.length}</div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Active Managers</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-2xl font-mono font-bold">{totalShifts}</div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Total Shifts</div>
            </div>
            <div className="bg-muted/50 border border-border rounded-lg p-4">
              <div className="text-2xl font-mono font-bold">{uniqueDuties}</div>
              <div className="text-sm font-sans text-muted-foreground mt-1">Duties Covered</div>
            </div>
          </div>

          {/* Weekly Schedule Table */}
          <div className="mb-6 print:mb-8">
            <h3 className="text-lg font-condensed font-bold mb-3 print:text-xl">Weekly Schedule</h3>
            <div className="border border-border rounded-lg overflow-hidden print:border-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-primary/10 border-b border-border">
                    <th className="px-3 py-2 text-left font-condensed font-bold">Duty</th>
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
                  {DUTIES.map((duty, dutyIdx) => (
                    <tr key={duty} className={dutyIdx % 2 === 0 ? "bg-muted/30" : ""}>
                      <td className="px-3 py-2 font-condensed font-semibold border-b border-border">
                        {duty}
                      </td>
                      {weekDates.map((date, dayIdx) => (
                        <td
                          key={dayIdx}
                          className="px-3 py-2 text-center font-mono text-xs border-l border-b border-border"
                        >
                          {getAssignment(date, duty)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Manager Statistics */}
          <div>
            <h3 className="text-lg font-condensed font-bold mb-3 print:text-xl">Manager Assignment Summary</h3>
            <div className="grid grid-cols-2 gap-4 print:gap-6">
              {getManagerStats().map((stat) => (
                <div key={stat.name} className="border border-border rounded-lg p-4 print:break-inside-avoid">
                  <div className="font-condensed font-bold text-base mb-2">{stat.name}</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Shifts:</span>
                      <span className="font-mono font-semibold">{stat.totalShifts}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Coverage:</span>
                      <span className="font-mono">{stat.coverage}%</span>
                    </div>
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="text-muted-foreground mb-1">Duty Breakdown:</div>
                      <div className="grid grid-cols-2 gap-1 text-xs">
                        {Object.entries(stat.duties).map(([duty, count]) => (
                          <div key={duty} className="flex justify-between">
                            <span className="text-muted-foreground">{duty}:</span>
                            <span className="font-mono">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Notes Section */}
          <div className="mt-6 print:mt-8 print:break-before-page">
            <h3 className="text-lg font-condensed font-bold mb-3 print:text-xl">Notes</h3>
            <div className="border border-border rounded-lg p-4 min-h-32 print:min-h-48">
              <p className="text-xs text-muted-foreground italic">
                Space for manual notes and adjustments...
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-border text-center text-xs text-muted-foreground font-mono print:fixed print:bottom-8 print:left-0 print:right-0">
            GIST Warehouse Manager Schedule • Page 1 of 1
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}