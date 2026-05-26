import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, AlertCircle, XCircle, TrendingUp } from "lucide-react";
import type { StaffMember, Assignment, Task } from "@/types";

interface SmartAssignmentDialogProps {
  open: boolean;
  onClose: () => void;
  task: Task;
  date: string;
  staff: StaffMember[];
  assignments: Assignment[];
  onAssign: (staffId: string) => void;
}

interface Suggestion {
  staffId: string;
  staffName: string;
  score: number;
  reasons: string[];
  warnings: string[];
  status: "ideal" | "acceptable" | "risky";
}

export function SmartAssignmentDialog({
  open,
  onClose,
  task,
  date,
  staff,
  assignments,
  onAssign,
}: SmartAssignmentDialogProps) {
  const suggestions = useMemo(() => {
    return generateSmartSuggestions(task, date, staff, assignments);
  }, [task, date, staff, assignments]);

  const handleAssign = (staffId: string) => {
    onAssign(staffId);
    // Keep dialog open to allow multiple assignments
  };

  const formatDate = (dateStr: string) => {
    // Parse date string as local date to prevent timezone shifts
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString("en-GB", { 
      weekday: "long", 
      day: "2-digit", 
      month: "short" 
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "ideal":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "acceptable":
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case "risky":
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ideal":
        return "bg-green-50 text-green-700 border-green-200";
      case "acceptable":
        return "bg-yellow-50 text-yellow-700 border-yellow-200";
      case "risky":
        return "bg-red-50 text-red-700 border-red-200";
      default:
        return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-condensed text-xl flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Smart Assignment Suggestions
          </DialogTitle>
          <DialogDescription className="font-sans">
            {task} on {formatDate(date)}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          <div className="space-y-3">
            {suggestions.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <XCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-sans text-sm">
                  No suitable staff available for this assignment
                </p>
              </div>
            )}

            {suggestions.map((suggestion) => (
              <div
                key={suggestion.staffId}
                className={`border-2 rounded-lg p-4 transition-smooth hover:shadow-md ${getStatusColor(suggestion.status)}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {getStatusIcon(suggestion.status)}
                      <h3 className="font-condensed font-semibold text-lg">
                        {suggestion.staffName}
                      </h3>
                      <Badge variant="outline" className="font-mono text-xs">
                        Score: {suggestion.score}
                      </Badge>
                    </div>

                    {/* Positive Reasons */}
                    {suggestion.reasons.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {suggestion.reasons.map((reason, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <CheckCircle className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
                            <span className="font-sans">{reason}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Warnings */}
                    {suggestion.warnings.length > 0 && (
                      <div className="space-y-1">
                        {suggestion.warnings.map((warning, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm">
                            <AlertCircle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                            <span className="font-sans">{warning}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button
                    onClick={() => handleAssign(suggestion.staffId)}
                    size="sm"
                    className="shrink-0"
                  >
                    Assign
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function generateSmartSuggestions(
  task: Task,
  date: string,
  staff: StaffMember[],
  assignments: Assignment[]
): Suggestion[] {
  const dayOfWeek = new Date(date).getDay();

  // Calculate current assignment counts
  const assignmentCounts = new Map<string, number>();
  staff.forEach(s => assignmentCounts.set(s.id, 0));
  assignments.forEach(a => {
    const staffMember = staff.find(s => s.name === a.staffName);
    if (staffMember) {
      assignmentCounts.set(staffMember.id, (assignmentCounts.get(staffMember.id) || 0) + 1);
    }
  });

  const avgAssignments = assignments.length / staff.length;

  const suggestions: Suggestion[] = staff
    .map(s => {
      const reasons: string[] = [];
      const warnings: string[] = [];
      let score = 50; // Base score

      // Check if trained
      if (!s.trainedTasks.includes(task)) {
        return null; // Not eligible
      }
      reasons.push("Trained for this task");
      score += 20;

      // Check availability
      const availability = s.availability?.find(a => a.date === date);
      if (availability && availability.type !== "available") {
        warnings.push(`Marked as ${availability.type}`);
        score -= 30;
      } else {
        reasons.push("Available on this date");
        score += 15;
      }

      // Check rest days
      if (s.restDays?.some(d => Number(d) === dayOfWeek)) {
        warnings.push("Regular rest day");
        score -= 20;
      }

      // Check fairness - prioritize under-assigned staff
      const currentCount = assignmentCounts.get(s.id) || 0;
      if (currentCount < avgAssignments - 1) {
        reasons.push("Needs more assignments for fairness");
        score += 25;
      } else if (currentCount > avgAssignments + 1) {
        warnings.push("Already over-assigned");
        score -= 15;
      }

      // Check for consecutive same task assignments
      const recentAssignments = assignments.filter(a => {
        const staffMatch = staff.find(sm => sm.name === a.staffName);
        return staffMatch?.id === s.id && a.task === task;
      });
      
      if (recentAssignments.length > 0) {
        const lastDate = recentAssignments[recentAssignments.length - 1].date;
        const daysDiff = Math.abs(
          (new Date(date).getTime() - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysDiff === 1) {
          warnings.push("Would create consecutive same-task assignments");
          score -= 25;
        } else if (daysDiff < 7) {
          reasons.push("Varied task rotation");
          score += 10;
        }
      } else {
        reasons.push("Fresh assignment - good variety");
        score += 15;
      }

      // Determine status
      let status: "ideal" | "acceptable" | "risky";
      if (score >= 80) {
        status = "ideal";
      } else if (score >= 50) {
        status = "acceptable";
      } else {
        status = "risky";
      }

      return {
        staffId: s.id,
        staffName: s.name,
        score: Math.min(100, Math.max(0, score)),
        reasons,
        warnings,
        status,
      };
    })
    .filter((s): s is Suggestion => s !== null)
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score || a.staffName.localeCompare(b.staffName));

  return suggestions;
}