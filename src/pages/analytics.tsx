import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useStaff } from "@/hooks/useSupabaseQueries";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download, TrendingUp, Users, Target, Calendar, BarChart3, PieChart, Activity } from "lucide-react";
import type { StaffMember, Assignment } from "@/types";

const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Equipment"];

// Task weights for fairness calculation - matches fairnessCalculator.ts
const TASK_WEIGHTS: Record<Task, number> = {
  "Frozen": 1.2,
  "Milk": 1.1,
  "TWI": 1.0,
  "Inbound": 1.3,
  "Inbound Late": 1.4,
  "Outbound": 1.2,
  "Marshaling": 1.1,
  "Equipment": 1.0,
};

function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const daysToSubtract = day;
  d.setDate(d.getDate() - daysToSubtract);
  return d;
}

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"week" | "month" | "quarter">("month");
  const { data: staff = [], isLoading: staffLoading } = useStaff();

  // Fetch all rotas within time range
  const { data: rotas = [], isLoading: rotasLoading } = useQuery({
    queryKey: ["rotas-analytics", timeRange],
    queryFn: async () => {
      const end = new Date();
      const start = new Date();
      
      if (timeRange === "week") {
        start.setDate(end.getDate() - 7);
      } else if (timeRange === "month") {
        start.setMonth(end.getMonth() - 1);
      } else {
        start.setMonth(end.getMonth() - 3);
      }
      
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .gte("week_start", start.toISOString().split('T')[0])
        .lte("week_start", end.toISOString().split('T')[0]);

      if (error) throw error;

      const grouped = new Map<string, Assignment[]>();
      (data || []).forEach((row: any) => {
        const weekStart = row.week_start;
        const assignment: Assignment = {
          staffId: row.staff_id,
          staffName: row.staff_name,
          task: row.task,
          date: row.date,
          shiftPattern: row.shift_pattern || "All",
        };
        grouped.set(weekStart, [...(grouped.get(weekStart) || []), assignment]);
      });

      return Array.from(grouped.entries()).map(([weekStart, assignments]) => ({
        weekStart,
        assignments,
      }));
    },
  });

  // Aggregate all assignments from all rotas
  const allAssignments: Assignment[] = useMemo(() => {
    return rotas.flatMap(r => r.assignments);
  }, [rotas]);

  // Staff utilization metrics
  const staffUtilization = useMemo(() => {
    const utilization: Record<string, { name: string; shifts: number; weightedShifts: number; tasks: Record<string, number> }> = {};
    
    staff.forEach(s => {
      utilization[s.id] = {
        name: s.name,
        shifts: 0,
        weightedShifts: 0,
        tasks: {},
      };
    });
    
    allAssignments.forEach(a => {
      if (utilization[a.staffId]) {
        utilization[a.staffId].shifts++;
        
        // Add weighted shift count
        const taskWeight = TASK_WEIGHTS[a.task] || 1.0;
        utilization[a.staffId].weightedShifts += taskWeight;
        
        utilization[a.staffId].tasks[a.task] = (utilization[a.staffId].tasks[a.task] || 0) + 1;
      }
    });
    
    return Object.values(utilization).sort((a, b) => b.weightedShifts - a.weightedShifts);
  }, [staff, allAssignments]);

  // Task distribution
  const taskDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    
    allAssignments.forEach(a => {
      distribution[a.task] = (distribution[a.task] || 0) + 1;
    });
    
    return Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  }, [allAssignments]);

  // Fairness score
  const fairnessScore = useMemo(() => {
    if (staffUtilization.length === 0) return 0;
    
    const shifts = staffUtilization.map(s => s.shifts);
    const avg = shifts.reduce((a, b) => a + b, 0) / shifts.length;
    const variance = shifts.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / shifts.length;
    const stdDev = Math.sqrt(variance);
    
    return Math.max(0, Math.min(100, 100 - stdDev * 10));
  }, [staffUtilization]);

  // Rest day compliance
  const restDayCompliance = useMemo(() => {
    let totalRestDays = 0;
    let compliantRestDays = 0;
    
    staff.forEach(s => {
      const restDays = s.availability?.filter(a => a.type === "rest") || [];
      totalRestDays += restDays.length;
      
      restDays.forEach(rest => {
        const assignedOnRestDay = allAssignments.some(
          a => a.staffId === s.id && a.date === rest.date
        );
        if (!assignedOnRestDay) {
          compliantRestDays++;
        }
      });
    });
    
    return totalRestDays > 0 ? Math.round((compliantRestDays / totalRestDays) * 100) : 100;
  }, [staff, allAssignments]);

  // Export to CSV
  const exportCSV = () => {
    let csv = "Staff Name,Total Shifts,";
    csv += TASKS.join(",") + "\n";
    
    staffUtilization.forEach(s => {
      csv += `"${s.name}",${s.shifts},`;
      csv += TASKS.map(task => s.tasks[task] || 0).join(",");
      csv += "\n";
    });
    
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  // Loading state
  if (staffLoading || rotasLoading) {
    return (
      <Layout>
        <SEO title="Analytics Dashboard" description="Workforce analytics and insights" />
        <div className="space-y-6 animate-in fade-in duration-500">
          <div className="h-8 bg-muted animate-pulse rounded w-1/3" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader>
                  <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
                </CardHeader>
                <CardContent>
                  <div className="h-10 bg-muted animate-pulse rounded w-1/2" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Analytics Dashboard" description="Workforce analytics and insights" />
      
      <div className="space-y-6 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-condensed font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm font-sans text-muted-foreground mt-1">
              Workforce metrics and performance insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
                <SelectItem value="quarter">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={exportCSV} variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Shifts</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{allAssignments.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {rotas.length} weeks
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Fairness Score</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${
                fairnessScore >= 90 ? "text-success" : 
                fairnessScore >= 70 ? "text-primary" : "text-warning"
              }`}>
                {Math.round(fairnessScore)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Distribution balance
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tabular-nums">{staff.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {staffUtilization.filter(s => s.shifts > 0).length} working
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Rest Day Compliance</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold tabular-nums ${
                restDayCompliance >= 95 ? "text-success" : 
                restDayCompliance >= 80 ? "text-primary" : "text-warning"
              }`}>
                {restDayCompliance}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Rest days honored
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Staff Utilization */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Staff Utilization
            </CardTitle>
            <CardDescription>
              Shift distribution per staff member (raw count / weighted fairness total)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staffUtilization.slice(0, 15).map((s, idx) => {
                const maxWeighted = Math.max(...staffUtilization.map(u => u.weightedShifts));
                const percentage = maxWeighted > 0 ? (s.weightedShifts / maxWeighted) * 100 : 0;
                
                return (
                  <div key={idx} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{s.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-muted-foreground">{s.shifts} raw</span>
                        <span className="font-mono text-primary font-semibold">{s.weightedShifts.toFixed(1)} weighted</span>
                      </div>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Task Distribution */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Task Distribution
            </CardTitle>
            <CardDescription>
              Total assignments per task type
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {taskDistribution.map(([task, count]) => {
                const maxCount = Math.max(...taskDistribution.map(([_, c]) => c));
                const percentage = maxCount > 0 ? (count / maxCount) * 100 : 0;
                
                return (
                  <div key={task} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{task}</span>
                      <span className="font-mono text-muted-foreground">{count} assignments</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div
                        className="bg-accent h-2 rounded-full transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Staff Breakdown */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Detailed Task Breakdown
            </CardTitle>
            <CardDescription>
              Individual staff task assignments (Inbound Late counts as 0.5 for fairness)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-medium">Staff Member</th>
                    <th className="text-center p-2 font-medium">Raw Total</th>
                    <th className="text-center p-2 font-medium text-primary">Weighted</th>
                    {TASKS.map(task => (
                      <th key={task} className="text-center p-2 font-medium text-xs">{task}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {staffUtilization.map((s, idx) => (
                    <tr key={idx} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{s.name}</td>
                      <td className="p-2 text-center font-mono">{s.shifts}</td>
                      <td className="p-2 text-center font-mono text-primary font-semibold">
                        {s.weightedShifts.toFixed(1)}
                      </td>
                      {TASKS.map(task => (
                        <td key={task} className="p-2 text-center font-mono text-sm">
                          {s.tasks[task] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}