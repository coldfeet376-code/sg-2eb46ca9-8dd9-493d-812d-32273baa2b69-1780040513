import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { SEO } from "@/components/SEO";
import { AlertCircle, CheckCircle2, TrendingUp } from "lucide-react";
import type { StaffMember, Assignment } from "@/types";
import { generateWeeklyRota, getWeekStart, getYearWeeks } from "@/lib/rotaGenerator";

const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

interface TaskDistribution {
  staffName: string;
  taskCounts: { [task: string]: number };
  totalAssignments: number;
}

interface ConsecutiveViolation {
  staffName: string;
  task: string;
  dates: string[];
}

export default function Analytics() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [taskConfig, setTaskConfig] = useState<any>(null);
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [distribution, setDistribution] = useState<TaskDistribution[]>([]);
  const [violations, setViolations] = useState<ConsecutiveViolation[]>([]);

  useEffect(() => {
    const savedStaff = localStorage.getItem("warehouse-staff");
    const savedConfig = localStorage.getItem("warehouse-task-config");
    
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    }
    if (savedConfig) {
      setTaskConfig(JSON.parse(savedConfig));
    }
  }, []);

  useEffect(() => {
    if (staff.length > 0 && taskConfig) {
      generateAnalytics();
    }
  }, [staff, taskConfig, period, selectedYear]);

  const generateAnalytics = () => {
    if (!staff.length || !taskConfig) return;

    // Generate assignments for the period
    let allAssignments: Assignment[] = [];

    if (period === "week") {
      const weekStart = getWeekStart(new Date());
      allAssignments = generateWeeklyRota({ staff, taskConfig, weekStart });
    } else if (period === "month") {
      // Get 4 weeks
      const today = new Date();
      const weekStart = getWeekStart(today);
      for (let i = 0; i < 4; i++) {
        const currentWeek = new Date(weekStart);
        currentWeek.setDate(currentWeek.getDate() + (i * 7));
        const weekAssignments = generateWeeklyRota({ 
          staff, 
          taskConfig, 
          weekStart: currentWeek 
        });
        allAssignments = [...allAssignments, ...weekAssignments];
      }
    } else {
      // Full year
      const weeks = getYearWeeks(selectedYear);
      weeks.forEach(weekStartDate => {
        const weekAssignments = generateWeeklyRota({
          staff,
          taskConfig,
          weekStart: weekStartDate,
        });
        allAssignments = [...allAssignments, ...weekAssignments];
      });
    }

    setAssignments(allAssignments);
    calculateDistribution(allAssignments);
    checkConsecutiveViolations(allAssignments);
  };

  const calculateDistribution = (allAssignments: Assignment[]) => {
    const dist: { [staffName: string]: TaskDistribution } = {};

    // Initialize
    staff.forEach(s => {
      dist[s.name] = {
        staffName: s.name,
        taskCounts: {},
        totalAssignments: 0,
      };
      TASKS.forEach(task => {
        dist[s.name].taskCounts[task] = 0;
      });
    });

    // Count assignments
    allAssignments.forEach(assignment => {
      if (dist[assignment.staffName]) {
        dist[assignment.staffName].taskCounts[assignment.task]++;
        dist[assignment.staffName].totalAssignments++;
      }
    });

    setDistribution(Object.values(dist));
  };

  const checkConsecutiveViolations = (allAssignments: Assignment[]) => {
    const violationsMap: { [key: string]: ConsecutiveViolation } = {};

    // Group by staff
    const staffAssignments: { [staffName: string]: Assignment[] } = {};
    allAssignments.forEach(a => {
      if (!staffAssignments[a.staffName]) {
        staffAssignments[a.staffName] = [];
      }
      staffAssignments[a.staffName].push(a);
    });

    // Check each staff member
    Object.entries(staffAssignments).forEach(([staffName, assignments]) => {
      // Sort by date
      const sorted = assignments.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Check consecutive days
      for (let i = 0; i < sorted.length - 1; i++) {
        const current = sorted[i];
        const next = sorted[i + 1];

        const currentDate = new Date(current.date);
        const nextDate = new Date(next.date);
        const dayDiff = Math.floor((nextDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24));

        if (dayDiff === 1 && current.task === next.task) {
          const key = `${staffName}-${current.task}-${current.date}`;
          if (!violationsMap[key]) {
            violationsMap[key] = {
              staffName,
              task: current.task,
              dates: [current.date, next.date],
            };
          } else {
            violationsMap[key].dates.push(next.date);
          }
        }
      }
    });

    setViolations(Object.values(violationsMap));
  };

  const getFairnessScore = (): number => {
    if (distribution.length === 0) return 100;

    const totalAssignments = distribution.reduce((sum, d) => sum + d.totalAssignments, 0);
    const avgAssignments = totalAssignments / distribution.length;

    if (avgAssignments === 0) return 100;

    // Calculate standard deviation
    const variance = distribution.reduce((sum, d) => {
      return sum + Math.pow(d.totalAssignments - avgAssignments, 2);
    }, 0) / distribution.length;

    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = (stdDev / avgAssignments) * 100;

    // Convert to fairness score (0-100, where 100 is perfectly fair)
    return Math.max(0, Math.min(100, 100 - coefficientOfVariation));
  };

  const getTaskVariance = (staffDist: TaskDistribution): number => {
    const counts = Object.values(staffDist.taskCounts);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variance = counts.reduce((sum, count) => sum + Math.pow(count - avg, 2), 0) / counts.length;
    return Math.sqrt(variance);
  };

  const fairnessScore = getFairnessScore();

  return (
    <Layout>
      <SEO
        title="Analytics - Warehouse Rota"
        description="Workload distribution and fairness analytics"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Analytics Dashboard
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              Workload distribution and fairness metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as "week" | "month" | "year")}>
              <SelectTrigger className="w-32 font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week" className="font-mono text-xs">This Week</SelectItem>
                <SelectItem value="month" className="font-mono text-xs">This Month</SelectItem>
                <SelectItem value="year" className="font-mono text-xs">Full Year</SelectItem>
              </SelectContent>
            </Select>

            {period === "year" && (
              <Select value={selectedYear.toString()} onValueChange={(y) => setSelectedYear(parseInt(y))}>
                <SelectTrigger className="w-24 font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027, 2028].map(year => (
                    <SelectItem key={year} value={year.toString()} className="font-mono text-xs">
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Fairness Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-3xl font-bold tabular-nums ${
                fairnessScore >= 90 ? "text-accent" :
                fairnessScore >= 70 ? "text-primary" : "text-warning"
              }`}>
                {fairnessScore.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Distribution balance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Total Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums">
                {assignments.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Across {period}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Violations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-3xl font-bold tabular-nums ${
                violations.length === 0 ? "text-accent" : "text-destructive"
              }`}>
                {violations.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Consecutive task issues
              </p>
            </CardContent>
          </Card>
        </div>

        {violations.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">
              {violations.length} consecutive task violation(s) detected. Review algorithm constraints.
            </AlertDescription>
          </Alert>
        )}

        {violations.length === 0 && assignments.length > 0 && (
          <Alert className="bg-accent/10 border-accent text-accent">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="font-mono text-xs">
              No consecutive task violations detected. Algorithm working as expected.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Task Distribution Matrix</CardTitle>
            <CardDescription className="font-mono text-xs">
              Assignment count per staff member per task
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50">
                      Staff Member
                    </th>
                    {TASKS.map(task => (
                      <th key={task} className="text-center p-3 font-mono text-xs font-medium bg-muted/50">
                        {task}
                      </th>
                    ))}
                    <th className="text-center p-3 font-mono text-xs font-medium bg-muted/50">
                      Total
                    </th>
                    <th className="text-center p-3 font-mono text-xs font-medium bg-muted/50">
                      Variance
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {distribution.map((dist) => (
                    <tr key={dist.staffName} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-condensed text-sm font-semibold">
                        {dist.staffName}
                      </td>
                      {TASKS.map(task => (
                        <td key={task} className="p-3 text-center">
                          <span className={`font-mono text-xs tabular-nums ${
                            dist.taskCounts[task] > 0 ? "text-foreground" : "text-muted-foreground"
                          }`}>
                            {dist.taskCounts[task]}
                          </span>
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <Badge variant="outline" className="font-mono text-xs tabular-nums">
                          {dist.totalAssignments}
                        </Badge>
                      </td>
                      <td className="p-3 text-center">
                        <span className={`font-mono text-xs tabular-nums ${
                          getTaskVariance(dist) < 1.5 ? "text-accent" : "text-muted-foreground"
                        }`}>
                          {getTaskVariance(dist).toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Workload Balance</CardTitle>
            <CardDescription className="font-mono text-xs">
              Visual representation of assignment distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {distribution.map((dist) => {
                const maxAssignments = Math.max(...distribution.map(d => d.totalAssignments));
                const percentage = maxAssignments > 0 ? (dist.totalAssignments / maxAssignments) * 100 : 0;
                
                return (
                  <div key={dist.staffName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-condensed font-semibold">{dist.staffName}</span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {dist.totalAssignments} assignments
                      </span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {violations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-xl text-destructive">
                Consecutive Task Violations
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Staff members with same task on consecutive days
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {violations.map((violation, idx) => (
                  <div key={idx} className="border border-destructive/20 rounded-md p-3 bg-destructive/5">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div className="flex-1">
                        <div className="font-condensed font-semibold text-sm">
                          {violation.staffName} - {violation.task}
                        </div>
                        <div className="font-mono text-xs text-muted-foreground mt-1">
                          Consecutive days: {violation.dates.map(d => 
                            new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
                          ).join(", ")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {staff.length === 0 && (
          <div className="bg-warning/10 border border-warning rounded-md p-4">
            <p className="text-sm font-mono text-warning-foreground">
              No data available. Configure staff and task requirements first.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}