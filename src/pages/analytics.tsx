import React, { useState, useEffect } from "react";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Users, Target } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { staffService } from "@/services/staffService";
import type { StaffMember, Assignment } from "@/types";

interface WeeklySummary {
  staffName: string;
  staffId: string;
  assignmentCount: number;
  tasks: string[];
  lastAssigned: string | null;
}

interface TurnHistory {
  staffName: string;
  staffId: string;
  totalTurns: number;
  weeklyBreakdown: { week: string; count: number }[];
  fairnessScore: number;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [missedStaff, setMissedStaff] = useState<StaffMember[]>([]);
  const [turnHistory, setTurnHistory] = useState<TurnHistory[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load staff
      const staffData = await staffService.getAllStaff();

      setStaff(staffData);

      // Get assignments from localStorage for current week
      const weekStart = getWeekStart(new Date());
      const weekKey = weekStart.toISOString().split("T")[0];
      const stored = localStorage.getItem(`rota_${weekKey}`);
      
      if (stored) {
        const { assignments } = JSON.parse(stored);
        calculateWeeklySummary(staffData, assignments);
      } else {
        calculateWeeklySummary(staffData, []);
      }

      // Calculate turn history from all stored weeks
      calculateTurnHistory(staffData);

      toast({
        title: "Data refreshed",
        description: "Analytics updated successfully",
      });
    } catch (error) {
      console.error("Error loading analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getWeekStart = (date: Date): Date => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    const saturday = new Date(d);
    saturday.setDate(d.getDate() + diff);
    saturday.setHours(0, 0, 0, 0);
    return saturday;
  };

  const calculateWeeklySummary = (staffData: StaffMember[], assignments: Assignment[]) => {
    const summaryMap = new Map<string, WeeklySummary>();
    const assignedIds = new Set<string>();

    // Count assignments per staff
    assignments.forEach((assignment) => {
      if (!summaryMap.has(assignment.staffId)) {
        const staffMember = staffData.find(s => s.id === assignment.staffId);
        summaryMap.set(assignment.staffId, {
          staffId: assignment.staffId,
          staffName: assignment.staffName || staffMember?.name || "Unknown",
          assignmentCount: 0,
          tasks: [],
          lastAssigned: null,
        });
      }

      const summary = summaryMap.get(assignment.staffId)!;
      summary.assignmentCount++;
      if (!summary.tasks.includes(assignment.task)) {
        summary.tasks.push(assignment.task);
      }
      if (!summary.lastAssigned || assignment.date > summary.lastAssigned) {
        summary.lastAssigned = assignment.date;
      }
      assignedIds.add(assignment.staffId);
    });

    // Find missed staff (not assigned this week)
    const missed = staffData.filter(s => {
      if (assignedIds.has(s.id)) return false;
      
      // Check if they are on rest for the entire week
      const weekStart = getWeekStart(new Date());
      const isAvailable = Array.from({ length: 7 }).some((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        
        // Return true if they don't have a 'rest', 'holiday', or 'sick' entry for this date
        const entry = s.availability?.find(a => a.date === dateStr);
        return !entry || entry.type === "available";
      });
      
      return isAvailable;
    });

    setWeeklySummary(Array.from(summaryMap.values()).sort((a, b) => b.assignmentCount - a.assignmentCount));
    setMissedStaff(missed);
  };

  const calculateTurnHistory = (staffData: StaffMember[]) => {
    const historyMap = new Map<string, TurnHistory>();

    // Get all stored weeks from localStorage
    const allKeys = Object.keys(localStorage).filter(k => k.startsWith("rota_"));
    
    staffData.forEach(staff => {
      historyMap.set(staff.id, {
        staffId: staff.id,
        staffName: staff.name,
        totalTurns: 0,
        weeklyBreakdown: [],
        fairnessScore: 100,
      });
    });

    // Count assignments across all weeks
    allKeys.forEach(key => {
      const stored = localStorage.getItem(key);
      if (stored) {
        try {
          const { assignments } = JSON.parse(stored);
          const weekDate = key.replace("rota_", "");
          
          assignments.forEach((assignment: Assignment) => {
            const history = historyMap.get(assignment.staffId);
            if (history) {
              history.totalTurns++;
              const weekEntry = history.weeklyBreakdown.find(w => w.week === weekDate);
              if (weekEntry) {
                weekEntry.count++;
              } else {
                history.weeklyBreakdown.push({ week: weekDate, count: 1 });
              }
            }
          });
        } catch (e) {
          console.error("Error parsing stored rota:", e);
        }
      }
    });

    // Calculate fairness scores
    const avgTurns = Array.from(historyMap.values()).reduce((sum, h) => sum + h.totalTurns, 0) / historyMap.size;
    historyMap.forEach(history => {
      const variance = Math.abs(history.totalTurns - avgTurns);
      history.fairnessScore = Math.max(0, Math.round(100 - (variance / avgTurns) * 100));
    });

    setTurnHistory(
      Array.from(historyMap.values())
        .sort((a, b) => b.totalTurns - a.totalTurns)
    );
  };

  const getExpectedTurns = (): number => {
    if (turnHistory.length === 0) return 0;
    return Math.round(turnHistory.reduce((sum, h) => sum + h.totalTurns, 0) / turnHistory.length);
  };

  return (
    <>
      <Head>
        <title>Analytics | GIST Rota</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-sm font-sans text-muted-foreground">
                Track assignments, fairness, and team distribution
              </p>
            </div>
            <Button
              onClick={loadData}
              disabled={loading}
              className="font-sans font-medium"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>

          <Tabs defaultValue="summary" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="summary" className="font-sans font-medium">
                This Week
              </TabsTrigger>
              <TabsTrigger value="history" className="font-sans font-medium">
                Turn History
              </TabsTrigger>
              <TabsTrigger value="fairness" className="font-sans font-medium">
                Fairness Tracker
              </TabsTrigger>
            </TabsList>

            {/* This Week Summary */}
            <TabsContent value="summary" className="space-y-6">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border/50 bg-muted/30">
                    <CardTitle className="text-xl font-condensed font-bold tracking-tight flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary" />
                      Assignments This Week
                    </CardTitle>
                    <CardDescription className="text-sm font-sans">
                      {weeklySummary.length} staff members assigned, {weeklySummary.reduce((sum, s) => sum + s.assignmentCount, 0)} total shifts
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {weeklySummary.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="font-sans text-sm">No assignments yet for this week</p>
                        <p className="font-sans text-xs mt-1">Generate a rota to see analytics</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {weeklySummary.map((summary) => (
                          <div key={summary.staffId} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-smooth">
                            <div>
                              <p className="font-sans font-semibold text-sm">{summary.staffName}</p>
                              <div className="flex gap-1 mt-1">
                                {summary.tasks.map(task => (
                                  <Badge key={task} variant="secondary" className="text-xs font-mono">
                                    {task}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-mono font-bold text-primary">
                                {summary.assignmentCount}
                              </div>
                              <p className="text-xs font-sans text-muted-foreground">shifts</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border/50 bg-muted/30">
                    <CardTitle className="text-xl font-condensed font-bold tracking-tight flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                      Missed Assignments
                    </CardTitle>
                    <CardDescription className="text-sm font-sans">
                      {missedStaff.length} staff members not assigned this week
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {missedStaff.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Target className="h-8 w-8 mx-auto mb-2 text-green-500 opacity-50" />
                        <p className="font-sans font-semibold text-sm text-green-600">Perfect Coverage!</p>
                        <p className="font-sans text-xs mt-1">All available staff have been assigned</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {missedStaff.map((staff) => (
                          <div key={staff.id} className="flex items-center justify-between p-3 rounded-lg border border-amber-500/20 bg-amber-500/5">
                            <p className="font-sans font-medium text-sm">{staff.name}</p>
                            <Badge variant="outline" className="text-xs font-mono border-amber-500/50 text-amber-600">
                              0 shifts
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Turn History */}
            <TabsContent value="history" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
                    Cumulative Turn Counts
                  </CardTitle>
                  <CardDescription className="text-sm font-sans">
                    Total duties assigned to each staff member across all weeks
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {turnHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-sans text-sm">No historical data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {turnHistory.map((history) => {
                        const expected = getExpectedTurns();
                        const diff = history.totalTurns - expected;
                        const isOver = diff > 0;
                        
                        return (
                          <div key={history.staffId} className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-smooth">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <p className="font-sans font-semibold text-base">{history.staffName}</p>
                                {Math.abs(diff) > expected * 0.2 && (
                                  <Badge variant={isOver ? "destructive" : "secondary"} className="text-xs font-mono">
                                    {isOver ? "+" : ""}{diff} vs avg
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs font-sans text-muted-foreground mt-1">
                                Across {history.weeklyBreakdown.length} weeks
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                <div className="text-3xl font-mono font-bold text-primary">
                                  {history.totalTurns}
                                </div>
                                {isOver ? (
                                  <TrendingUp className="h-5 w-5 text-destructive" />
                                ) : diff < -expected * 0.2 ? (
                                  <TrendingDown className="h-5 w-5 text-amber-500" />
                                ) : (
                                  <Target className="h-5 w-5 text-green-500" />
                                )}
                              </div>
                              <p className="text-xs font-sans text-muted-foreground">total turns</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Fairness Tracker */}
            <TabsContent value="fairness" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
                    Distribution Fairness
                  </CardTitle>
                  <CardDescription className="text-sm font-sans">
                    How evenly duties are distributed across the team (Expected: {getExpectedTurns()} turns each)
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {turnHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="font-sans text-sm">No data to analyze fairness</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {turnHistory.map((history) => {
                        const expected = getExpectedTurns();
                        const variance = Math.abs(history.totalTurns - expected);
                        const percentDiff = expected > 0 ? (variance / expected) * 100 : 0;
                        
                        return (
                          <div key={history.staffId} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-sans font-semibold text-sm">{history.staffName}</p>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">
                                  {history.totalTurns} / {expected}
                                </span>
                                <Badge variant={percentDiff < 20 ? "default" : percentDiff < 40 ? "secondary" : "destructive"} className="text-xs font-mono">
                                  {percentDiff < 20 ? "Fair" : percentDiff < 40 ? "Uneven" : "Skewed"}
                                </Badge>
                              </div>
                            </div>
                            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  percentDiff < 20 ? "bg-green-500" : percentDiff < 40 ? "bg-amber-500" : "bg-destructive"
                                }`}
                                style={{ width: `${Math.min(100, (history.totalTurns / (expected * 1.5)) * 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}