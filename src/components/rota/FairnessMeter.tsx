import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, TrendingUp, AlertCircle, ArrowRightLeft, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { StaffMember, Assignment } from "@/types";
import { calculateFairnessMetrics } from "@/lib/fairnessCalculator";
import { suggestSwaps, type SwapSuggestion } from "@/lib/swapSuggester";

interface FairnessMeterProps {
  staff: StaffMember[];
  assignments: Assignment[];
  weekStart: Date;
  onSwapApply?: (fromStaffId: string, toStaffId: string, task: string, date: string) => void;
}

export function FairnessMeter({ staff, assignments, weekStart, onSwapApply }: FairnessMeterProps) {
  const [expanded, setExpanded] = useState(false);
  const [showSwapDialog, setShowSwapDialog] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([]);

  // Calculate fairness metrics using the corrected algorithm
  const metrics = calculateFairnessMetrics(assignments, staff);
  
  // Categorize staff based on assignment rates (not raw counts)
  const categorizeStaff = () => {
    if (metrics.staffWorkload.length === 0) {
      return { balanced: 0, underAssigned: 0, overAssigned: 0, balancedStaff: [], underStaff: [], overStaff: [] };
    }

    // Calculate assignment rates for staff with available days
    const workloadWithRates = metrics.staffWorkload
      .filter(w => w.availableDays > 0)
      .map(w => ({
        ...w,
        rate: w.totalAssignments / w.availableDays
      }));

    if (workloadWithRates.length === 0) {
      return { balanced: 0, underAssigned: 0, overAssigned: 0, balancedStaff: [], underStaff: [], overStaff: [] };
    }

    const avgRate = workloadWithRates.reduce((sum, w) => sum + w.rate, 0) / workloadWithRates.length;

    const balancedStaff: Array<{ name: string; count: number }> = [];
    const underStaff: Array<{ name: string; count: number; target: number }> = [];
    const overStaff: Array<{ name: string; count: number; target: number }> = [];

    workloadWithRates.forEach(w => {
      const targetAssignments = Math.round(avgRate * w.availableDays);
      
      // Within 1 assignment of target = balanced
      if (Math.abs(w.totalAssignments - targetAssignments) <= 1) {
        balancedStaff.push({ name: w.staffName, count: w.totalAssignments });
      } else if (w.totalAssignments < targetAssignments - 1) {
        underStaff.push({ name: w.staffName, count: w.totalAssignments, target: targetAssignments });
      } else {
        overStaff.push({ name: w.staffName, count: w.totalAssignments, target: targetAssignments });
      }
    });

    return {
      balanced: balancedStaff.length,
      underAssigned: underStaff.length,
      overAssigned: overStaff.length,
      balancedStaff,
      underStaff,
      overStaff
    };
  };

  const fairness = {
    score: metrics.overallScore,
    ...categorizeStaff()
  };

  const handleSuggestSwaps = () => {
    const suggestions = suggestSwaps(assignments, staff, 10);
    setSwapSuggestions(suggestions);
    setShowSwapDialog(true);
  };

  const handleApplySwap = (suggestion: SwapSuggestion) => {
    if (onSwapApply) {
      onSwapApply(suggestion.fromStaffId, suggestion.toStaffId, suggestion.task, suggestion.date);
      setShowSwapDialog(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString("en-GB", { 
      weekday: "short", 
      day: "2-digit", 
      month: "short" 
    });
  };

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
          <div className="flex gap-2">
            {fairness.score < 90 && assignments.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSuggestSwaps}
                className="gap-2 font-sans"
              >
                <ArrowRightLeft className="h-4 w-4" />
                Suggest Swaps
              </Button>
            )}
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

      {/* Swap Suggestions Dialog */}
      <Dialog open={showSwapDialog} onOpenChange={setShowSwapDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-condensed text-xl flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-primary" />
              Suggested Shift Swaps
            </DialogTitle>
            <DialogDescription className="font-sans">
              These swaps would improve fairness by balancing workload across staff
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[500px] pr-4">
            {swapSuggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p className="font-sans text-sm">
                  No beneficial swaps found. The rota is already well-balanced!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {swapSuggestions.map((suggestion) => (
                  <div
                    key={suggestion.id}
                    className="border-2 rounded-lg p-4 transition-smooth hover:shadow-md bg-background"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className="font-mono text-xs bg-green-50 text-green-700 border-green-200">
                            +{suggestion.improvement.toFixed(1)} points
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {suggestion.currentFairness.toFixed(0)} → {suggestion.predictedFairness.toFixed(0)}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 mb-2 font-condensed">
                          <span className="font-semibold">{suggestion.fromStaffName}</span>
                          <ArrowRightLeft className="h-4 w-4 text-primary" />
                          <span className="font-semibold">{suggestion.toStaffName}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm mb-2">
                          <Badge className="font-mono">{suggestion.task}</Badge>
                          <span className="text-muted-foreground">on {formatDate(suggestion.date)}</span>
                        </div>

                        <p className="text-sm text-muted-foreground font-sans">
                          {suggestion.reason}
                        </p>

                        {suggestion.warnings.length > 0 && (
                          <div className="mt-2 space-y-1">
                            {suggestion.warnings.map((warning, idx) => (
                              <div key={idx} className="flex items-start gap-2 text-sm">
                                <AlertCircle className="h-3.5 w-3.5 text-yellow-600 mt-0.5 shrink-0" />
                                <span className="text-yellow-700 font-sans">{warning}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <Button
                        onClick={() => handleApplySwap(suggestion)}
                        size="sm"
                        className="shrink-0"
                        disabled={!onSwapApply}
                      >
                        Apply Swap
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setShowSwapDialog(false)} variant="outline">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}