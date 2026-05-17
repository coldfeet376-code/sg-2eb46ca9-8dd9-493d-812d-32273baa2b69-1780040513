import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { calculateFairnessMetrics } from "@/lib/fairnessCalculator";
import { useStaff } from "@/hooks/useSupabaseQueries";
import { getWeekStart, navigateWeek } from "@/lib/rotaGenerator";
import type { Assignment, FairnessMetrics } from "@/types";
import { 
  TrendingUp, 
  Users, 
  Calendar, 
  BarChart3, 
  AlertCircle, 
  ChevronLeft, 
  ChevronRight 
} from "lucide-react";

const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

export default function AnalyticsPage() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [fairnessMetrics, setFairnessMetrics] = useState<FairnessMetrics | null>(null);
  
  const { data: staff = [] } = useStaff();

  useEffect(() => {
    // Load assignments from localStorage for the selected week
    const savedAssignments = localStorage.getItem("warehouse-assignments");
    if (savedAssignments) {
      const parsed = JSON.parse(savedAssignments);
      const weekStartStr = weekStart.toISOString().split("T")[0];
      
      // Filter assignments for current week
      const weekAssignments = parsed.filter((a: Assignment) => {
        const assignmentDate = new Date(a.date);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        return assignmentDate >= weekStart && assignmentDate < weekEnd;
      });
      
      setAssignments(weekAssignments);
    }
  }, [weekStart]);

  useEffect(() => {
    // Calculate fairness metrics
    if (assignments.length > 0 && staff.length > 0) {
      const metrics = calculateFairnessMetrics(assignments, staff);
      setFairnessMetrics(metrics);
    } else {
      setFairnessMetrics(null);
    }
  }, [assignments, staff]);

  const handlePrevWeek = () => {
    setWeekStart(navigateWeek(weekStart, "prev"));
  };

  const handleNextWeek = () => {
    setWeekStart(navigateWeek(weekStart, "next"));
  };

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  return (
    <Layout>
      <SEO
        title="Analytics - Warehouse Rota"
        description="View workload distribution and fairness metrics"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Analytics & Metrics
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {weekStart.toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })} - {weekEnd.toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })}
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

        {/* Fairness Score Card */}
        <Card className="shadow-sm hover:shadow-md transition-smooth">
          <CardHeader>
            <CardTitle className="font-condensed text-xl flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Fairness Score
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Measures how evenly work is distributed across all staff members
            </CardDescription>
          </CardHeader>
          <CardContent>
            {fairnessMetrics ? (
              <div className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex-1">
                    <div className={`font-mono text-5xl font-bold tabular-nums ${
                      fairnessMetrics.overallScore >= 90 ? "text-success" : 
                      fairnessMetrics.overallScore >= 70 ? "text-primary" : "text-warning"
                    }`}>
                      {fairnessMetrics.overallScore}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      {fairnessMetrics.overallScore >= 90 ? "Excellent distribution" :
                       fairnessMetrics.overallScore >= 70 ? "Good distribution" :
                       fairnessMetrics.overallScore >= 50 ? "Fair distribution" :
                       "Uneven distribution"}
                    </p>
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="text-sm">
                      <span className="font-condensed font-semibold">Standard Deviation:</span>
                      <span className="font-mono ml-2 tabular-nums">{fairnessMetrics.standardDeviation}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lower values indicate more even distribution
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono text-muted-foreground">
                    <span>0</span>
                    <span>50</span>
                    <span>100</span>
                  </div>
                  <div className="h-3 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all rounded-full ${
                        fairnessMetrics.overallScore >= 90 ? "bg-success" : 
                        fairnessMetrics.overallScore >= 70 ? "bg-primary" : "bg-warning"
                      }`}
                      style={{ width: `${fairnessMetrics.overallScore}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-mono text-xs">
                  No data for this week. Generate a rota to see fairness metrics.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Workload Distribution */}
        {fairnessMetrics && (
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Workload Distribution
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Total assignments per staff member this week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {fairnessMetrics.staffWorkload
                  .sort((a, b) => b.totalAssignments - a.totalAssignments)
                  .map((sw) => (
                    <div key={sw.staffId} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-condensed font-semibold text-sm">
                          {sw.staffName}
                        </span>
                        <span className="font-mono text-sm tabular-nums">
                          {sw.totalAssignments} shifts
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{
                            width: `${
                              (sw.totalAssignments /
                                Math.max(...fairnessMetrics.staffWorkload.map((s) => s.totalAssignments))) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(sw.taskBreakdown)
                          .filter(([_, count]) => count > 0)
                          .map(([task, count]) => (
                            <Badge
                              key={task}
                              variant="outline"
                              className="text-[10px] font-mono"
                            >
                              {task}: {count}
                            </Badge>
                          ))}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Summary Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="shadow-sm card-hover">
            <CardHeader>
              <CardTitle className="font-condensed text-base">Total Assignments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-primary">
                {assignments.length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader>
              <CardTitle className="font-condensed text-base">Active Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-accent">
                {staff.length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader>
              <CardTitle className="font-condensed text-base">Avg per Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-primary">
                {staff.length > 0 ? Math.round(assignments.length / staff.length) : 0}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader>
              <CardTitle className="font-condensed text-base">Tasks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-accent">
                {TASKS.length}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}