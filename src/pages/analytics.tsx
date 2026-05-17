import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import type { StaffMember, Assignment, Task } from "@/types";
import { Users, Calendar, Clock, TrendingUp, AlertCircle, Download, Trash2, BarChart3, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function AnalyticsPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));

  useEffect(() => {
    const savedStaff = localStorage.getItem("warehouse-staff");
    const savedHistory = localStorage.getItem("warehouse-rota-history");
    
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    }
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Get assignments for the selected week only
  const getWeekAssignments = (): Assignment[] => {
    const weekStartStr = weekStart.toISOString();
    const weekHistory = history.filter(h => h.weekStart === weekStartStr);
    return weekHistory.flatMap(h => h.assignments || []);
  };

  const weekDates = DAYS.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const getStaffWorkload = () => {
    const assignments = getWeekAssignments();
    const workloadMap = new Map<string, number>();

    assignments.forEach(a => {
      workloadMap.set(a.staffName, (workloadMap.get(a.staffName) || 0) + 1);
    });

    return Array.from(workloadMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  };

  const getTaskDistribution = () => {
    const assignments = getWeekAssignments();
    const taskMap = new Map<string, number>();

    TASKS.forEach(task => taskMap.set(task, 0));
    assignments.forEach(a => {
      taskMap.set(a.task, (taskMap.get(a.task) || 0) + 1);
    });

    return Array.from(taskMap.entries()).map(([task, count]) => ({ task, count }));
  };

  const getWorkloadHeatmap = () => {
    const assignments = getWeekAssignments();
    const heatmap: { [staffName: string]: { [task: string]: number } } = {};

    staff.forEach(s => {
      heatmap[s.name] = {};
      TASKS.forEach(task => {
        heatmap[s.name][task] = 0;
      });
    });

    assignments.forEach(a => {
      if (heatmap[a.staffName]) {
        heatmap[a.staffName][a.task] = (heatmap[a.staffName][a.task] || 0) + 1;
      }
    });

    return heatmap;
  };

  const getPreferenceSatisfaction = () => {
    const assignments = getWeekAssignments();
    const satisfaction: { [staffName: string]: { preferred: number; avoided: number; total: number } } = {};

    staff.forEach(s => {
      satisfaction[s.name] = { preferred: 0, avoided: 0, total: 0 };
    });

    assignments.forEach(a => {
      const staffMember = staff.find(s => s.name === a.staffName);
      if (staffMember && satisfaction[a.staffName]) {
        satisfaction[a.staffName].total += 1;
        
        if (staffMember.preferences?.preferredTasks?.includes(a.task as Task)) {
          satisfaction[a.staffName].preferred += 1;
        }
        if (staffMember.preferences?.avoidTasks?.includes(a.task as Task)) {
          satisfaction[a.staffName].avoided += 1;
        }
      }
    });

    return satisfaction;
  };

  const getDayDistribution = () => {
    const assignments = getWeekAssignments();
    const dayMap = new Map<number, number>();

    DAYS.forEach((_, i) => dayMap.set(i, 0));
    
    assignments.forEach(a => {
      const day = new Date(a.date).getDay();
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    });

    return Array.from(dayMap.entries()).map(([day, count]) => ({ day: DAYS[day], count }));
  };

  const getFairnessScore = () => {
    const workload = getStaffWorkload();
    if (workload.length === 0) return 100;

    const counts = workload.map(w => w.count);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
    const stdDev = Math.sqrt(variance);

    // Lower std dev = more fair. Scale to 0-100 where 100 is perfectly fair
    const fairnessScore = Math.max(0, 100 - (stdDev * 10));
    return Math.round(fairnessScore);
  };

  const getUtilizationRate = () => {
    const assignments = getWeekAssignments();
    if (staff.length === 0) return 0;

    const possibleAssignments = staff.length * 7; // staff × 7 days
    
    if (possibleAssignments === 0) return 0;
    return Math.round((assignments.length / possibleAssignments) * 100);
  };

  // Calculate fairness metrics for the current week
  const calculateFairnessMetrics = () => {
    const staffAssignments: Record<string, { total: number; byTask: Record<string, number> }> = {};
    
    // Initialize
    staff.forEach(member => {
      staffAssignments[member.id] = {
        total: 0,
        byTask: {},
      };
    });
    
    // Count assignments for the current week
    const weekAssignments = getWeekAssignments();
    weekAssignments.forEach(assignment => {
      const staffMember = staff.find(s => s.name === assignment.staffName);
      if (staffMember) {
        staffAssignments[staffMember.id].total++;
        staffAssignments[staffMember.id].byTask[assignment.task] = 
          (staffAssignments[staffMember.id].byTask[assignment.task] || 0) + 1;
      }
    });
    
    // Calculate fairness (standard deviation from mean)
    const totals = Object.values(staffAssignments).map(s => s.total);
    const mean = totals.length > 0 ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    const variance = totals.length > 0 
      ? totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length 
      : 0;
    const stdDev = Math.sqrt(variance);
    
    return { staffAssignments, mean, stdDev };
  };
  
  const fairnessData = calculateFairnessMetrics();

  const workload = getStaffWorkload();
  const taskDist = getTaskDistribution();
  const dayDist = getDayDistribution();
  const heatmap = getWorkloadHeatmap();
  const preferenceSat = getPreferenceSatisfaction();
  const fairness = getFairnessScore();
  const utilization = getUtilizationRate();

  const getHeatmapColor = (count: number) => {
    const max = Math.max(...Object.values(heatmap).flatMap(tasks => Object.values(tasks)));
    const intensity = max > 0 ? count / max : 0;
    
    if (intensity === 0) return "bg-muted";
    if (intensity < 0.25) return "bg-primary/20";
    if (intensity < 0.5) return "bg-primary/40";
    if (intensity < 0.75) return "bg-primary/60";
    return "bg-primary/80";
  };

  const handlePrevWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() - 7);
    setWeekStart(newDate);
  };

  const handleNextWeek = () => {
    const newDate = new Date(weekStart);
    newDate.setDate(weekStart.getDate() + 7);
    setWeekStart(newDate);
  };

  return (
    <Layout>
      <SEO title="Analytics - Warehouse Rota" description="View rotation history and task distribution analytics" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">Analytics & Insights</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              Week: {weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - {weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevWeek} className="rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextWeek} className="rounded-lg">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Fairness Metrics Section */}
        <Card className="shadow-sm border-l-4 border-l-accent">
          <CardHeader>
            <CardTitle className="font-condensed text-xl flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-accent" />
              Task Rotation Fairness - Current Week
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Analyze how fairly tasks are distributed across staff members this week
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staff.length === 0 || getWeekAssignments().length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-mono">No assignment data for this week</p>
                <p className="text-xs font-mono mt-1">Generate a rota to see fairness metrics</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card className="bg-muted/30 border-none">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Average Assignments</p>
                        <p className="text-3xl font-bold font-mono">{fairnessData.mean.toFixed(1)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-none">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Standard Deviation</p>
                        <p className="text-3xl font-bold font-mono">{fairnessData.stdDev.toFixed(1)}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-muted/30 border-none">
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-xs font-mono text-muted-foreground mb-1">Fairness Rating</p>
                        <p className={cn(
                          "text-3xl font-bold font-mono",
                          fairnessData.stdDev < 2 ? "text-green-600" : fairnessData.stdDev < 4 ? "text-yellow-600" : "text-red-600"
                        )}>
                          {fairnessData.stdDev < 2 ? "Excellent" : fairnessData.stdDev < 4 ? "Good" : "Needs Balance"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-3">
                  <h3 className="font-condensed font-semibold text-base">Staff Assignment Distribution</h3>
                  {staff
                    .map(member => ({
                      ...member,
                      stats: fairnessData.staffAssignments[member.id] || { total: 0, byTask: {} },
                      deviation: Math.abs((fairnessData.staffAssignments[member.id]?.total || 0) - fairnessData.mean),
                    }))
                    .sort((a, b) => b.stats.total - a.stats.total)
                    .map(member => {
                      const isOverworked = member.stats.total > fairnessData.mean + fairnessData.stdDev;
                      const isUnderworked = member.stats.total < fairnessData.mean - fairnessData.stdDev;
                      
                      return (
                        <Card key={member.id} className={cn(
                          "transition-all",
                          isOverworked && "border-l-4 border-l-red-500",
                          isUnderworked && "border-l-4 border-l-yellow-500"
                        )}>
                          <CardContent className="pt-4">
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <h4 className="font-condensed font-semibold">{member.name}</h4>
                                  {isOverworked && (
                                    <Badge variant="destructive" className="font-mono text-[10px]">
                                      Overworked (+{member.deviation.toFixed(1)})
                                    </Badge>
                                  )}
                                  {isUnderworked && (
                                    <Badge variant="secondary" className="font-mono text-[10px] bg-yellow-500/20 text-yellow-700">
                                      Underutilized (-{member.deviation.toFixed(1)})
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-mono text-lg font-bold">{member.stats.total} total</span>
                              </div>
                              
                              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                                {TASKS.map(task => {
                                  const count = member.stats.byTask[task] || 0;
                                  return (
                                    <div key={task} className="flex flex-col items-center gap-1 p-2 bg-muted/30 rounded-md">
                                      <span className="text-[10px] font-mono text-muted-foreground">{task}</span>
                                      <span className="text-lg font-bold font-mono">{count}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Fairness Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-3xl font-bold tabular-nums ${
                fairness >= 90 ? "text-success" :
                fairness >= 70 ? "text-primary" : "text-warning"
              }`}>
                {fairness}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Distribution equality
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                Utilization Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-accent">
                {utilization}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Staff assignment rate
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-secondary" />
                Total Assignments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-secondary">
                {getWeekAssignments().length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                This week
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Active Staff
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-primary">
                {staff.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                In rotation
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Workload Heatmap */}
        <Card className="shadow-sm hover:shadow-md transition-smooth">
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Workload Heatmap</CardTitle>
            <CardDescription className="font-mono text-xs">
              Task distribution across staff members (darker = more assignments)
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-mono">No data available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-condensed text-xs font-semibold bg-muted/50 rounded-tl-md">
                        Staff
                      </th>
                      {TASKS.map((task, i) => (
                        <th 
                          key={task} 
                          className={`text-center p-2 font-mono text-[10px] font-medium bg-muted/50 ${i === TASKS.length - 1 ? 'rounded-tr-md' : ''}`}
                        >
                          {task}
                        </th>
                      ))}
                      <th className="text-center p-2 font-mono text-[10px] font-medium bg-muted/50">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staff.map((s) => {
                      const total = TASKS.reduce((sum, task) => sum + (heatmap[s.name]?.[task] || 0), 0);
                      return (
                        <tr key={s.id} className="border-b border-border hover:bg-muted/30 transition-smooth">
                          <td className="p-2 font-condensed text-xs font-semibold">
                            {s.name}
                          </td>
                          {TASKS.map((task) => {
                            const count = heatmap[s.name]?.[task] || 0;
                            return (
                              <td 
                                key={task} 
                                className={`p-2 text-center ${getHeatmapColor(count)}`}
                              >
                                <span className="font-mono text-xs font-semibold">
                                  {count > 0 ? count : "—"}
                                </span>
                              </td>
                            );
                          })}
                          <td className="p-2 text-center bg-primary/10">
                            <span className="font-mono text-xs font-bold text-primary">
                              {total}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preference Satisfaction */}
        {staff.some(s => s.preferences?.preferredTasks || s.preferences?.avoidTasks) && (
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl flex items-center gap-2">
                <Heart className="h-5 w-5 text-accent" />
                Preference Satisfaction
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                How often staff receive their preferred tasks vs avoided tasks this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {staff.filter(s => s.preferences?.preferredTasks || s.preferences?.avoidTasks).map(s => {
                  const sat = preferenceSat[s.name];
                  if (!sat || sat.total === 0) return null;

                  const preferredRate = Math.round((sat.preferred / sat.total) * 100);
                  const avoidedRate = Math.round((sat.avoided / sat.total) * 100);

                  return (
                    <Card key={s.id} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <CardTitle className="font-condensed text-sm">{s.name}</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-muted-foreground">Preferred:</span>
                          <span className="font-mono font-semibold text-success">{preferredRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono text-muted-foreground">Avoided:</span>
                          <span className="font-mono font-semibold text-destructive">{avoidedRate}%</span>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <span className="font-mono text-muted-foreground">Total:</span>
                          <span className="font-mono font-semibold">{sat.total}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Staff Workload */}
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl">Staff Workload</CardTitle>
              <CardDescription className="font-mono text-xs">
                Total assignments per staff member this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {workload.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-mono">No assignments this week</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {workload.map((w) => {
                    const max = workload[0].count;
                    const percentage = max > 0 ? (w.count / max) * 100 : 0;
                    return (
                      <div key={w.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold">{w.name}</span>
                          <span className="font-mono text-muted-foreground">{w.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Task Distribution */}
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl">Task Distribution</CardTitle>
              <CardDescription className="font-mono text-xs">
                Total assignments per task type this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taskDist.every(t => t.count === 0) ? (
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p className="text-sm font-mono">No assignments this week</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {taskDist.sort((a, b) => b.count - a.count).map((t) => {
                    const max = taskDist.reduce((m, t) => Math.max(m, t.count), 0);
                    const percentage = max > 0 ? (t.count / max) * 100 : 0;
                    return (
                      <div key={t.task} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-semibold">{t.task}</span>
                          <span className="font-mono text-muted-foreground">{t.count}</span>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-accent to-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Day Distribution */}
          <Card className="shadow-sm hover:shadow-md transition-smooth lg:col-span-2">
            <CardHeader>
              <CardTitle className="font-condensed text-xl">Daily Distribution</CardTitle>
              <CardDescription className="font-mono text-xs">
                Assignments across days of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {dayDist.map((d) => {
                  const max = dayDist.reduce((m, d) => Math.max(m, d.count), 0);
                  const percentage = max > 0 ? (d.count / max) * 100 : 0;
                  return (
                    <div key={d.day} className="text-center space-y-2">
                      <div className="font-mono text-xs font-semibold">{d.day.slice(0, 3)}</div>
                      <div className="h-32 bg-muted rounded-lg flex items-end justify-center overflow-hidden">
                        <div
                          className="w-full bg-gradient-to-t from-primary to-secondary transition-all"
                          style={{ height: `${percentage}%` }}
                        />
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">{d.count}</div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}