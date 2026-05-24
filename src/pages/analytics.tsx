import React, { useState, useEffect } from "react";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, TrendingUp, TrendingDown, AlertCircle, Users, Target, Printer, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { staffService } from "@/services/staffService";
import { rotaService } from "@/services/rotaService";
import { supabase } from "@/integrations/supabase/client";
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

interface WeekData {
  weekKey: string;
  weekStart: Date;
  assignments: Assignment[];
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [allWeeks, setAllWeeks] = useState<WeekData[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary[]>([]);
  const [missedStaff, setMissedStaff] = useState<StaffMember[]>([]);
  const [turnHistory, setTurnHistory] = useState<TurnHistory[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 1.5cm; }
        body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        .no-print { display: none !important; }
        .print-break-before { page-break-before: always; }
        .print-break-inside-avoid { page-break-inside: avoid; }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedWeek && staff.length > 0) {
      const weekData = allWeeks.find(w => w.weekKey === selectedWeek);
      if (weekData) {
        calculateWeeklySummary(staff, weekData.assignments);
      }
    }
  }, [selectedWeek, staff, allWeeks]);

  const loadData = async () => {
    setLoading(true);
    try {
      const staffData = await staffService.getAllStaff();
      setStaff(staffData);

      const { data: rotasData, error: rotasError } = await supabase
        .from("rotas")
        .select("*")
        .order("week_start", { ascending: false });

      if (rotasError) throw rotasError;

      if (rotasData && rotasData.length > 0) {
        const weekMap = new Map<string, WeekData>();
        
        rotasData.forEach((rota: any) => {
          const weekKey = rota.week_start;
          if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, {
              weekKey,
              weekStart: new Date(weekKey),
              assignments: [],
            });
          }
          
          if (rota.assignments && Array.isArray(rota.assignments)) {
            rota.assignments.forEach((a: any) => {
              weekMap.get(weekKey)!.assignments.push({
                staffId: a.staffId || a.staff_id,
                staffName: a.staffName || a.staff_name,
                task: a.task,
                date: a.date,
                shiftPattern: a.shiftPattern || a.shift_pattern,
              });
            });
          }
        });

        const weeks = Array.from(weekMap.values()).sort(
          (a, b) => b.weekStart.getTime() - a.weekStart.getTime()
        );

        setAllWeeks(weeks);

        if (weeks.length > 0 && !selectedWeek) {
          const mostRecent = weeks[0].weekKey;
          setSelectedWeek(mostRecent);
          calculateWeeklySummary(staffData, weeks[0].assignments);
        } else if (weeks.length === 0) {
          calculateWeeklySummary(staffData, []);
        }

        calculateTurnHistory(staffData, weeks);

        toast({
          title: "Data refreshed",
          description: `Loaded ${weeks.length} week(s) of data`,
        });
      } else {
        setAllWeeks([]);
      }
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

    const missed = staffData.filter(s => {
      if (assignedIds.has(s.id)) return false;
      
      const weekStart = getWeekStart(new Date());
      const isAvailable = Array.from({ length: 7 }).some((_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split("T")[0];
        
        const entry = s.availability?.find(a => a.date === dateStr);
        return !entry || entry.type === "available";
      });
      
      return isAvailable;
    });

    setWeeklySummary(Array.from(summaryMap.values()).sort((a, b) => b.assignmentCount - a.assignmentCount));
    setMissedStaff(missed);
  };

  const calculateTurnHistory = (staffData: StaffMember[], weeks: WeekData[]) => {
    const historyMap = new Map<string, TurnHistory>();

    staffData.forEach(staff => {
      historyMap.set(staff.id, {
        staffId: staff.id,
        staffName: staff.name,
        totalTurns: 0,
        weeklyBreakdown: [],
        fairnessScore: 100,
      });
    });

    weeks.forEach((week) => {
      week.assignments.forEach((assignment) => {
        const history = historyMap.get(assignment.staffId);
        if (history) {
          history.totalTurns++;
          const weekEntry = history.weeklyBreakdown.find(w => w.week === week.weekKey);
          if (weekEntry) {
            weekEntry.count++;
          } else {
            history.weeklyBreakdown.push({ week: week.weekKey, count: 1 });
          }
        }
      });
    });

    const avgTurns = Array.from(historyMap.values()).reduce((sum, h) => sum + h.totalTurns, 0) / historyMap.size;
    historyMap.forEach(history => {
      const variance = Math.abs(history.totalTurns - avgTurns);
      history.fairnessScore = Math.max(0, Math.round(100 - (variance / avgTurns) * 100));
    });

    setTurnHistory(
      Array.from(historyMap.values()).sort((a, b) => b.totalTurns - a.totalTurns)
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
          <div className="hidden print:block mb-6">
            <h1 className="font-condensed text-3xl font-bold mb-2">
              WAREHOUSE ANALYTICS REPORT
            </h1>
            {selectedWeek && (
              <p className="font-mono text-sm text-muted-foreground">
                Week Starting: {allWeeks.find(w => w.weekKey === selectedWeek)?.weekStart.toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric"
                })}
              </p>
            )}
            <p className="font-mono text-xs text-muted-foreground mt-1">
              Generated: {new Date().toLocaleString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
            <hr className="mt-4 border-border" />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 no-print">
            <div>
              <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-sm font-sans text-muted-foreground">
                Track assignments, fairness, and team distribution
              </p>
            </div>
            <div className="flex gap-2">
              {allWeeks.length > 0 && (
                <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select week" />
                  </SelectTrigger>
                  <SelectContent>
                    {allWeeks.map((week) => (
                      <SelectItem key={week.weekKey} value={week.weekKey}>
                        Week of {week.weekStart.toLocaleDateString("en-GB", { 
                          day: "2-digit", 
                          month: "short",
                          year: "numeric"
                        })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                onClick={() => window.print()}
                disabled={weeklySummary.length === 0}
                variant="outline"
                className="font-sans font-medium gap-2"
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <Button
                onClick={loadData}
                disabled={loading}
                className="font-sans font-medium"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          {allWeeks.length === 0 && !loading && (
            <Card className="shadow-sm">
              <CardContent className="pt-12 pb-12 text-center">
                <div className="max-w-md mx-auto space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Calendar className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-condensed font-bold tracking-tight mb-2">
                      No Rota Data Found
                    </h3>
                    <p className="text-sm font-sans text-muted-foreground">
                      Generate a rota on the main page to see analytics
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {allWeeks.length > 0 && (
          <Tabs defaultValue="summary" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50 no-print">
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

            <TabsContent value="fairness" className="space-y-6">
              <Card className="shadow-sm border-primary/30 bg-primary/5">
                <CardHeader className="border-b border-primary/20 bg-primary/10">
                  <CardTitle className="text-xl font-condensed font-bold tracking-tight flex items-center gap-2">
                    <Target className="h-5 w-5 text-primary" />
                    Priority Assignments
                  </CardTitle>
                  <CardDescription className="text-sm font-sans">
                    Staff members who should be assigned next to balance the rotation
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  {turnHistory.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground">
                      <p className="font-sans text-sm">No data available</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {turnHistory
                        .filter(h => h.fairnessScore < 100)
                        .sort((a, b) => a.fairnessScore - b.fairnessScore)
                        .slice(0, 5)
                        .map((history, index) => {
                          const expected = getExpectedTurns();
                          const needed = expected - history.totalTurns;
                          
                          return (
                            <div key={history.staffId} className="flex items-center gap-4 p-4 rounded-lg border border-primary/20 bg-card hover:bg-primary/5 transition-smooth">
                              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-sm">
                                {index + 1}
                              </div>
                              <div className="flex-1">
                                <p className="font-sans font-semibold text-base">{history.staffName}</p>
                                <p className="text-xs font-sans text-muted-foreground mt-1">
                                  Currently {history.totalTurns} turns • Needs {needed > 0 ? `+${needed}` : needed} to balance
                                </p>
                              </div>
                              <div className="text-right">
                                <div className="text-xl font-mono font-bold text-primary">
                                  {history.fairnessScore}
                                </div>
                                <p className="text-xs font-sans text-muted-foreground">score</p>
                              </div>
                            </div>
                          );
                        })}
                      {turnHistory.every(h => h.fairnessScore === 100) && (
                        <div className="text-center py-8">
                          <Target className="h-12 w-12 mx-auto mb-3 text-green-500" />
                          <p className="font-sans font-semibold text-base text-green-600">
                            Perfect Balance Achieved!
                          </p>
                          <p className="font-sans text-sm text-muted-foreground mt-1">
                            All staff members have equal assignments
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="shadow-sm">
            </TabsContent>
          </Tabs>
          )}
        </div>
      </Layout>
    </>
  );
}