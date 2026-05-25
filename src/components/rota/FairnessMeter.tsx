import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, TrendingUp, AlertCircle } from "lucide-react";
import type { StaffMember, Assignment } from "@/types";

interface FairnessMeterProps {
  staff: StaffMember[];
  assignments: Assignment[];
  weekStart: Date;
}

export function FairnessMeter({ staff, assignments, weekStart }: FairnessMeterProps) {
  const [expanded, setExpanded] = useState(false);

  // Calculate fairness score
  const calculateFairness = () => {
    if (staff.length === 0 || assignments.length === 0) {
      return { score: 0, balanced: 0, underAssigned: 0, overAssigned: 0, balancedStaff: [], underStaff: [], overStaff: [] };
    }

    // Count assignments per staff member
    const assignmentCounts = new Map<string, number>();
    staff.forEach(s => assignmentCounts.set(s.id, 0));
    
    assignments.forEach(a => {
      const staffMember = staff.find(s => s.name === a.staffName);
      if (staffMember) {
        assignmentCounts.set(staffMember.id, (assignmentCounts.get(staffMember.id) || 0) + 1);
      }
    });

    const counts = Array.from(assignmentCounts.values());
    const avg = counts.reduce((sum, c) => sum + c, 0) / counts.length;
    const variance = counts.reduce((sum, c) => sum + Math.pow(c - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // Score: 100 = perfect, 0 = very unfair
    const score = Math.max(0, Math.min(100, Math.round(100 - (stdDev * 15))));

    // Categorize staff
    const balancedStaff: Array<{ name: string; count: number }> = [];
    const underStaff: Array<{ name: string; count: number; target: number }> = [];
    const overStaff: Array<{ name: string; count: number; target: number }> = [];

    staff.forEach(s => {
      const count = assignmentCounts.get(s.id) || 0;
      const target = Math.round(avg);
      
      if (Math.abs(count - avg) <= 1) {
        balancedStaff.push({ name: s.name, count });
      } else if (count < avg - 1) {
        underStaff.push({ name: s.name, count, target });
      } else {
        overStaff.push({ name: s.name, count, target });
      }
    });

    return {
      score,
      balanced: balancedStaff.length,
      underAssigned: underStaff.length,
      overAssigned: overStaff.length,
      balancedStaff,
      underStaff,
      overStaff
    };
  };

  const fairness = calculateFairness();

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600";
    if (score >= 70) return "text-blue-600";
    if (score >= 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return "Excellent";
    if (score >= 70) return "Good";
    if (score >= 50) return "Fair";
    return "Needs Balance";
  };

  return (
    <Card className="shadow-enhanced transition-smooth">
      <CardHeader className="border-b border-border/50 bg-muted/30">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-condensed font-bold tracking-tight flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Fairness Meter
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="gap-2 font-sans"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                Show Details
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {/* Score Display */}
        <div className="flex items-center gap-6 mb-4">
          <div className="flex-1">
            <div className={`font-mono text-5xl font-bold tabular-nums ${getScoreColor(fairness.score)}`}>
              {fairness.score}
            </div>
            <p className="text-sm text-muted-foreground mt-1 font-sans">
              {getScoreLabel(fairness.score)}
            </p>
          </div>
          
          <div className="flex gap-4">
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tabular-nums text-green-600">
                {fairness.balanced}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Balanced</p>
            </div>
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tabular-nums text-yellow-600">
                {fairness.underAssigned}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Under</p>
            </div>
            <div className="text-center">
              <div className="font-mono text-2xl font-bold tabular-nums text-red-600">
                {fairness.overAssigned}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Over</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-500 ${
              fairness.score >= 90 ? "bg-green-600" :
              fairness.score >= 70 ? "bg-blue-600" :
              fairness.score >= 50 ? "bg-yellow-600" : "bg-red-600"
            }`}
            style={{ width: `${fairness.score}%` }}
          />
        </div>

        {/* Expanded Details */}
        {expanded && (
          <div className="mt-6 space-y-4 animate-fade-in">
            {/* Balanced Staff */}
            {fairness.balancedStaff.length > 0 && (
              <div>
                <h4 className="text-sm font-condensed font-semibold mb-2 flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-600" />
                  Balanced Staff ({fairness.balancedStaff.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {fairness.balancedStaff.map((s, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="bg-green-50 text-green-700 border-green-200 font-mono"
                    >
                      {s.name} ({s.count})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Under-Assigned Staff */}
            {fairness.underStaff.length > 0 && (
              <div>
                <h4 className="text-sm font-condensed font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  Under-Assigned Staff ({fairness.underStaff.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {fairness.underStaff.map((s, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="bg-yellow-50 text-yellow-700 border-yellow-200 font-mono"
                    >
                      {s.name} ({s.count}/{s.target})
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Over-Assigned Staff */}
            {fairness.overStaff.length > 0 && (
              <div>
                <h4 className="text-sm font-condensed font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-600" />
                  Over-Assigned Staff ({fairness.overStaff.length})
                </h4>
                <div className="flex flex-wrap gap-2">
                  {fairness.overStaff.map((s, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="bg-red-50 text-red-700 border-red-200 font-mono"
                    >
                      {s.name} ({s.count}/{s.target})
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}