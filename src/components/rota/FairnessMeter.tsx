import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, TrendingUp, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { StaffMember, Assignment } from "@/types";

interface FairnessMeterProps {
  staff: StaffMember[];
  assignments: Assignment[];
  weekStart: Date;
}

export function FairnessMeter({ staff, assignments, weekStart }: FairnessMeterProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate fairness metrics
  const fairnessData = calculateFairness(staff, assignments, weekStart);

  return (
    <Card className="mb-4 border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-condensed">Fairness Score</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="font-sans"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {expanded ? "Hide Details" : "Show Details"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Main fairness score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold font-condensed">
              {fairnessData.score}%
            </span>
            <Badge
              variant={
                fairnessData.score >= 85 ? "default" :
                fairnessData.score >= 70 ? "secondary" : "destructive"
              }
              className="font-sans"
            >
              {fairnessData.score >= 85 ? "Excellent" :
               fairnessData.score >= 70 ? "Good" : "Needs Balance"}
            </Badge>
          </div>
          <Progress value={fairnessData.score} className="h-2" />
          <p className="text-xs text-muted-foreground font-sans">
            {fairnessData.balanced} balanced · {fairnessData.overAssigned} over · {fairnessData.underAssigned} under
          </p>
        </div>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-4 space-y-2">
            <div className="grid gap-2">
              {/* Over-assigned staff */}
              {fairnessData.overStaff.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold font-condensed text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Over-Assigned ({fairnessData.overStaff.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {fairnessData.overStaff.map((s) => (
                      <Badge key={s.name} variant="destructive" className="text-xs font-sans">
                        {s.name}: {s.count} shifts (+{s.diff})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Under-assigned staff */}
              {fairnessData.underStaff.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold font-condensed text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Under-Assigned ({fairnessData.underStaff.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {fairnessData.underStaff.map((s) => (
                      <Badge key={s.name} variant="secondary" className="text-xs font-sans bg-amber-100 text-amber-800">
                        {s.name}: {s.count} shifts ({s.diff})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Balanced staff */}
              {fairnessData.balancedStaff.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold font-condensed text-green-600 flex items-center gap-1">
                    Balanced ({fairnessData.balancedStaff.length})
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {fairnessData.balancedStaff.map((s) => (
                      <Badge key={s.name} variant="secondary" className="text-xs font-sans bg-green-100 text-green-800">
                        {s.name}: {s.count} shifts
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function calculateFairness(staff: StaffMember[], assignments: Assignment[], weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];

  // Count assignments per staff member this week
  const staffCounts = staff.map((s) => {
    const weekAssignments = assignments.filter(
      (a) => a.staffId === s.id && a.date >= weekStartStr && a.date < weekEndStr
    );
    
    // Calculate expected assignments based on availability
    const weekDates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d.toISOString().split('T')[0];
    });
    
    const availableDays = weekDates.filter((date) => {
      const avail = s.availability?.find((a) => a.date === date);
      return !avail || avail.type === "available";
    }).length;

    const expected = Math.floor(availableDays * 0.7); // Expect ~70% of available days to be assigned
    const actual = weekAssignments.length;
    const diff = actual - expected;

    return {
      name: s.name,
      count: actual,
      expected,
      diff,
      status: Math.abs(diff) <= 1 ? "balanced" : diff > 1 ? "over" : "under"
    };
  });

  const overStaff = staffCounts.filter((s) => s.status === "over");
  const underStaff = staffCounts.filter((s) => s.status === "under");
  const balancedStaff = staffCounts.filter((s) => s.status === "balanced");

  // Calculate overall fairness score (0-100)
  const totalStaff = staff.length;
  const balancedRatio = balancedStaff.length / totalStaff;
  const overPenalty = overStaff.reduce((sum, s) => sum + Math.abs(s.diff), 0) / totalStaff;
  const underPenalty = underStaff.reduce((sum, s) => sum + Math.abs(s.diff), 0) / totalStaff;
  
  const score = Math.max(0, Math.min(100, 
    Math.round((balancedRatio * 100) - (overPenalty * 5) - (underPenalty * 3))
  ));

  return {
    score,
    balanced: balancedStaff.length,
    overAssigned: overStaff.length,
    underAssigned: underStaff.length,
    overStaff,
    underStaff,
    balancedStaff
  };
}