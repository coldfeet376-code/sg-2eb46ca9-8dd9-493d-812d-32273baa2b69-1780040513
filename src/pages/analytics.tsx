import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useStaff } from "@/hooks/useSupabaseQueries";
import { rotaService } from "@/services/rotaService";
import type { Assignment, Task, StaffMember } from "@/types";
import { TASK_WEIGHTS } from "@/types";
import { BarChart, TrendingUp, Users, Calendar, AlertCircle } from "lucide-react";
import { SEO } from "@/components/SEO";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping", "Equipment"];

interface WeeklySummary {
  weekStart: string;
  totalAssignments: number;
  weightedTotal: number;
  staffDistribution: Record<string, { count: number; weighted: number }>;
  taskDistribution: Record<Task, number>;
}

export default function Analytics() {
  const { data: staff = [] } = useStaff();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weeklySummary, setWeeklySummary] = useState<WeeklySummary | null>(null);
  const [selectedWeek, setSelectedWeek] = useState<Date>(new Date());

  // Get current week start (Saturday)
  const getWeekStart = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 6 ? 0 : day + 1;
    d.setDate(d.getDate() - diff);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const currentWeekStart = getWeekStart(selectedWeek);

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  useEffect(() => {
    if (assignments.length > 0 && staff.length > 0) {
      calculateWeeklySummary();
    }
  }, [assignments, staff]);

  const loadData = async () => {
    try {
      const rota = await rotaService.getRotaForWeek(currentWeekStart);
      if (rota && rota.assignments) {
        setAssignments(rota.assignments as any);
      } else {
        setAssignments([]);
      }
    } catch (error) {
      console.error("Error loading assignments:", error);
      setAssignments([]);
    }
  };

  const calculateWeeklySummary = () => {
    const staffDist: Record<string, { count: number; weighted: number }> = {};
    const taskDist: Record<Task, number> = {
      Frozen: 0,
      Milk: 0,
      TWI: 0,
      Inbound: 0,
      "Inbound Late": 0,
      Outbound: 0,
      Marshaling: 0,
      Housekeeping: 0,
      Equipment: 0,
    };

    let totalWeighted = 0;

    staff.forEach((s) => {
      staffDist[s.id] = { count: 0, weighted: 0 };
    });

    assignments.forEach((a) => {
      if (staffDist[a.staffId]) {
        staffDist[a.staffId].count++;
        const weight = TASK_WEIGHTS[a.task];
        staffDist[a.staffId].weighted += weight;
        totalWeighted += weight;
      }
      taskDist[a.task]++;
    });

    setWeeklySummary({
      weekStart: currentWeekStart.toISOString().split("T")[0],
      totalAssignments: assignments.length,
      weightedTotal: totalWeighted,
      staffDistribution: staffDist,
      taskDistribution: taskDist,
    });
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(selectedWeek);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setSelectedWeek(newDate);
  };

  const getStaffName = (staffId: string): string => {
    return staff.find((s) => s.id === staffId)?.name || "Unknown";
  };

  if (!weeklySummary) {
    return (
      <Layout>
        <SEO title="Analytics - Warehouse Rota" />
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground font-mono">Loading analytics...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const staffSorted = Object.entries(weeklySummary.staffDistribution)
    .map(([id, data]) => ({ id, ...data, name: getStaffName(id) }))
    .sort((a, b) => b.weighted - a.weighted);

  const avgWeighted = weeklySummary.weightedTotal / staff.length;
  const maxWeighted = Math.max(...staffSorted.map((s) => s.weighted));
  const minWeighted = Math.min(...staffSorted.map((s) => s.weighted));

  return (
    <Layout>
      <SEO title="Analytics - Warehouse Rota" />
      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-condensed font-bold">Analytics</h1>
            <p className="text-muted-foreground font-mono text-sm mt-1">
              Weighted task distribution and fairness metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigateWeek("prev")} size="sm">
              ← Prev Week
            </Button>
            <div className="text-sm font-mono font-semibold px-4 py-2 bg-muted rounded">
              {currentWeekStart.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
            </div>
            <Button variant="outline" onClick={() => navigateWeek("next")} size="sm">
              Next Week →
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                TOTAL ASSIGNMENTS
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{weeklySummary.totalAssignments}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                WEIGHTED TOTAL
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{weeklySummary.weightedTotal.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">Inbound Late = 0.5, Others = 1.0</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <Users className="h-4 w-4" />
                AVG PER STAFF
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">{avgWeighted.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground mt-1">Weighted average</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                RANGE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold font-mono">
                {minWeighted.toFixed(1)} - {maxWeighted.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Min to Max weighted</p>
            </CardContent>
          </Card>
        </div>

        {/* Staff Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="font-condensed">Staff Workload Distribution</CardTitle>
            <CardDescription className="font-mono text-xs">
              Weighted task counts (Inbound Late = 0.5 weight)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {staffSorted.map((s) => {
                const percentage = maxWeighted > 0 ? (s.weighted / maxWeighted) * 100 : 0;
                const isAboveAvg = s.weighted > avgWeighted;
                const isBelowAvg = s.weighted < avgWeighted;

                return (
                  <div key={s.id} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-mono font-semibold">{s.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {s.count} tasks ({s.weighted.toFixed(1)} weighted)
                        </span>
                        {isAboveAvg && (
                          <Badge variant="destructive" className="text-xs">
                            +{(s.weighted - avgWeighted).toFixed(1)}
                          </Badge>
                        )}
                        {isBelowAvg && (
                          <Badge variant="secondary" className="text-xs">
                            {(s.weighted - avgWeighted).toFixed(1)}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="h-6 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isAboveAvg ? "bg-red-500" : isBelowAvg ? "bg-blue-500" : "bg-green-500"
                        }`}
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
        <Card>
          <CardHeader>
            <CardTitle className="font-condensed">Task Distribution</CardTitle>
            <CardDescription className="font-mono text-xs">
              Breakdown by task type with weights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {TASKS.map((task) => {
                const count = weeklySummary.taskDistribution[task] || 0;
                const weight = TASK_WEIGHTS[task];
                const weightedCount = count * weight;

                return (
                  <div key={task} className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold text-sm">{task}</span>
                      {weight !== 1.0 && (
                        <Badge variant="outline" className="text-xs">
                          {weight}x
                        </Badge>
                      )}
                    </div>
                    <div className="text-2xl font-bold font-mono">{count}</div>
                    {weight !== 1.0 && (
                      <p className="text-xs text-muted-foreground">
                        = {weightedCount.toFixed(1)} weighted
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Fairness Alert */}
        {maxWeighted - minWeighted > avgWeighted * 0.3 && (
          <Card className="border-orange-500 bg-orange-500/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-400 font-condensed">
                <AlertCircle className="h-5 w-5" />
                Fairness Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-sans">
                Significant workload imbalance detected. Consider using "Suggest Swaps" to redistribute tasks more evenly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}