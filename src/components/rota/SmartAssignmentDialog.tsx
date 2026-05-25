import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, AlertCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function SmartAssignmentDialog({
  open,
  onClose,
  task,
  date,
  staff,
  assignments,
  onAssign,
}: SmartAssignmentDialogProps) {
  const suggestions = generateSuggestions(task, date, staff, assignments);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-condensed">
            Smart Suggestions for {task} on {new Date(date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </DialogTitle>
          <DialogDescription className="font-sans">
            Click to assign. Suggestions ranked by suitability.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {suggestions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground font-sans">
              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No suitable candidates available</p>
            </div>
          ) : (
            suggestions.map((suggestion) => (
              <div
                key={suggestion.staffId}
                className={cn(
                  "p-3 border rounded-lg hover:bg-accent cursor-pointer transition-colors",
                  suggestion.score >= 80 ? "border-green-200 bg-green-50" :
                  suggestion.score >= 60 ? "border-blue-200 bg-blue-50" :
                  "border-amber-200 bg-amber-50"
                )}
                onClick={() => {
                  onAssign(suggestion.staffId);
                  onClose();
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold font-condensed">{suggestion.staffName}</h4>
                      <Badge
                        variant={
                          suggestion.score >= 80 ? "default" :
                          suggestion.score >= 60 ? "secondary" : "outline"
                        }
                        className="font-sans text-xs"
                      >
                        {suggestion.score}% match
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm font-sans">
                      {suggestion.reasons.map((reason, idx) => (
                        <div key={idx} className="flex items-start gap-2">
                          {reason.type === "positive" ? (
                            <Check className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          ) : reason.type === "warning" ? (
                            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                          )}
                          <span className={cn(
                            reason.type === "positive" ? "text-green-700" :
                            reason.type === "warning" ? "text-amber-700" :
                            "text-red-700"
                          )}>
                            {reason.text}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className={cn(
                      "h-5 w-5",
                      suggestion.score >= 80 ? "text-green-600" :
                      suggestion.score >= 60 ? "text-blue-600" :
                      "text-amber-600"
                    )} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button variant="outline" onClick={onClose} className="font-sans">
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface Suggestion {
  staffId: string;
  staffName: string;
  score: number;
  reasons: Array<{
    type: "positive" | "warning" | "negative";
    text: string;
  }>;
}

function generateSuggestions(
  task: Task,
  date: string,
  staff: StaffMember[],
  assignments: Assignment[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];

  for (const s of staff) {
    const reasons: Suggestion["reasons"] = [];
    let score = 0;

    // Check training
    const taskToCheck = task === "Inbound Late" ? "Inbound" : task;
    if (!s.trainedTasks.includes(taskToCheck)) {
      reasons.push({ type: "negative", text: `Not trained on ${task}` });
      continue; // Skip this person entirely
    }
    reasons.push({ type: "positive", text: `Trained on ${task}` });
    score += 30;

    // Check availability
    const availability = s.availability?.find((a) => a.date === date);
    if (availability && availability.type !== "available") {
      reasons.push({ type: "negative", text: `Unavailable (${availability.type.replace("_", " ")})` });
      continue; // Skip
    }
    reasons.push({ type: "positive", text: "Available on this day" });
    score += 20;

    // Check if already assigned
    const alreadyAssigned = assignments.some(
      (a) => a.staffId === s.id && a.date === date
    );
    if (alreadyAssigned) {
      const existingTask = assignments.find((a) => a.staffId === s.id && a.date === date)?.task;
      reasons.push({ type: "negative", text: `Already assigned to ${existingTask}` });
      continue; // Skip
    }
    reasons.push({ type: "positive", text: "Not yet assigned on this day" });
    score += 15;

    // Check shift time match for Inbound tasks
    if (task === "Inbound" && s.shiftStart !== "06:00") {
      reasons.push({ type: "warning", text: `Shift starts at ${s.shiftStart}, not 06:00` });
      score -= 20;
    } else if (task === "Inbound Late" && !["09:00", "10:00", "11:00"].includes(s.shiftStart || "06:00")) {
      reasons.push({ type: "warning", text: `Shift starts at ${s.shiftStart}, best for early Inbound` });
      score -= 20;
    } else if ((task === "Inbound" || task === "Inbound Late")) {
      reasons.push({ type: "positive", text: `Shift time (${s.shiftStart}) matches ${task}` });
      score += 15;
    }

    // Check consecutive same task
    const prevDate = new Date(date);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];
    const hadSameTaskYesterday = assignments.some(
      (a) => a.staffId === s.id && a.date === prevDateStr && a.task === task
    );
    if (hadSameTaskYesterday) {
      reasons.push({ type: "warning", text: `Had ${task} yesterday (consecutive)` });
      score -= 15;
    } else {
      reasons.push({ type: "positive", text: "No consecutive same task" });
      score += 10;
    }

    // Check fairness - how many assignments this week
    const weekStart = new Date(date);
    weekStart.setDate(weekStart.getDate() - new Date(date).getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const weekAssignments = assignments.filter(
      (a) =>
        a.staffId === s.id &&
        a.date >= weekStart.toISOString().split("T")[0] &&
        a.date < weekEnd.toISOString().split("T")[0]
    );

    if (weekAssignments.length < 2) {
      reasons.push({ type: "positive", text: `Only ${weekAssignments.length} assignment(s) this week - needs more` });
      score += 20;
    } else if (weekAssignments.length >= 5) {
      reasons.push({ type: "warning", text: `Already has ${weekAssignments.length} assignments this week` });
      score -= 10;
    } else {
      reasons.push({ type: "positive", text: `${weekAssignments.length} assignments this week (balanced)` });
      score += 10;
    }

    suggestions.push({
      staffId: s.id,
      staffName: s.name,
      score: Math.max(0, Math.min(100, score)),
      reasons,
    });
  }

  // Sort by score descending, then by name
  return suggestions
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.staffName.localeCompare(b.staffName));
}