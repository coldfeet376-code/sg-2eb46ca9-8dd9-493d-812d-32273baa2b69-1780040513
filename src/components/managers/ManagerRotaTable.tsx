import React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";
import type { ManagerAssignment, AvailabilityType } from "@/types";
import type { Manager } from "@/services/managerService";

interface ManagerRotaTableProps {
  weekDays: Array<{ date: Date; dateStr: string; dayOfWeek: number }>;
  managers: Manager[];
  assignments: ManagerAssignment[];
  getAvailabilityForManagerDate: (managerId: string, dateStr: string) => AvailabilityType;
  onDeleteAssignment: (managerId: string, dateStr: string) => void;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function ManagerRotaTable({
  weekDays,
  managers,
  assignments,
  getAvailabilityForManagerDate,
  onDeleteAssignment,
}: ManagerRotaTableProps) {
  const getAssignmentForDay = (managerId: string, dateStr: string) => {
    return assignments.filter(a => a.managerId === managerId && a.date === dateStr);
  };

  const getDutyBadgeColor = (duty: string) => {
    switch (duty) {
      case "Intake":
        return "bg-cyan-500/20 text-cyan-700 border-cyan-500/30";
      case "Out-loading":
        return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case "Admin":
        return "bg-amber-500/20 text-amber-700 border-amber-500/30";
      case "Floor":
        return "bg-slate-500/20 text-slate-700 border-slate-500/30";
      default:
        return "";
    }
  };

  const getAvailabilityBadge = (availability: AvailabilityType) => {
    switch (availability) {
      case "rest":
        return <Badge variant="outline" className="text-xs font-mono">Rest</Badge>;
      case "holiday":
        return <Badge variant="outline" className="text-xs font-mono bg-green-500/10 text-green-700">Holiday</Badge>;
      case "sick":
        return <Badge variant="outline" className="text-xs font-mono bg-red-500/10 text-red-700">Sick</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[140px] font-condensed">Manager</TableHead>
            {weekDays.map(({ date, dateStr, dayOfWeek }) => (
              <TableHead key={dateStr} className="text-center font-condensed min-w-[120px]">
                <div className="text-sm">{DAYS[dayOfWeek]}</div>
                <div className="text-xs text-muted-foreground font-mono">
                  {date.getDate()}/{date.getMonth() + 1}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {managers.map((manager) => (
            <TableRow key={manager.id}>
              <TableCell className="font-mono text-sm font-medium">{manager.name}</TableCell>
              {weekDays.map(({ dateStr }) => {
                const dayAssignments = getAssignmentForDay(manager.id, dateStr);
                const availability = getAvailabilityForManagerDate(manager.id, dateStr);

                return (
                  <TableCell key={dateStr} className="text-center p-2">
                    {availability !== "available" ? (
                      getAvailabilityBadge(availability)
                    ) : dayAssignments.length > 0 ? (
                      <div className="space-y-1">
                        {dayAssignments.map((assignment, idx) => (
                          <div key={idx} className="flex items-center gap-1 justify-center">
                            <Badge
                              variant="outline"
                              className={`text-xs font-mono ${getDutyBadgeColor(assignment.duty)}`}
                            >
                              {assignment.duty}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-5 w-5 p-0"
                              onClick={() => onDeleteAssignment(manager.id, dateStr)}
                            >
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-xs font-mono">-</span>
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}