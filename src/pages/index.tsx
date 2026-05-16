import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, RefreshCw } from "lucide-react";
import { SEO } from "@/components/SEO";
import type { StaffMember, Assignment } from "@/types";
import { generateWeeklyRota, getWeekStart, navigateWeek } from "@/lib/rotaGenerator";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

export default function Home() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [taskConfig, setTaskConfig] = useState<any>(null);

  useEffect(() => {
    // Load staff and config
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
    // Generate rota when data is available
    if (staff.length > 0 && taskConfig) {
      generateRota();
    }
  }, [staff, taskConfig, weekStart]);

  const generateRota = () => {
    if (!staff.length || !taskConfig) return;

    const newAssignments = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
    });
    setAssignments(newAssignments);
  };

  const weekDates = DAYS.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  const getAssignmentsForTaskAndDay = (task: string, dateIndex: number): Assignment[] => {
    const date = weekDates[dateIndex];
    const dateStr = date.toISOString().split("T")[0];
    
    return assignments.filter(a => a.task === task && a.date === dateStr);
  };

  const getTotalStaff = (): number => {
    return staff.length;
  };

  const getCoveragePercentage = (): number => {
    if (!taskConfig) return 0;
    
    let requiredTotal = 0;
    TASKS.forEach(task => {
      taskConfig[task].forEach((count: number) => {
        requiredTotal += count;
      });
    });
    
    if (requiredTotal === 0) return 100;
    
    return Math.round((assignments.length / requiredTotal) * 100);
  };

  const handlePrevWeek = () => {
    setWeekStart(navigateWeek(weekStart, "prev"));
  };

  const handleNextWeek = () => {
    setWeekStart(navigateWeek(weekStart, "next"));
  };

  return (
    <Layout>
      <SEO
        title="Warehouse Rota System"
        description="Fair distribution work rotation system for warehouse operations"
      />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Weekly Rota
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {weekDates[0].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })} - {weekDates[6].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrevWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={generateRota}
              className="gap-2 ml-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="font-mono text-xs">Regenerate</span>
            </Button>
            <Button variant="default" size="sm" className="gap-2">
              <Download className="h-4 w-4" />
              <span className="font-mono text-xs">Export PDF</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Current Week Schedule</CardTitle>
            <CardDescription className="font-mono text-xs">
              Staff assignments by task and day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50">
                      Task
                    </th>
                    {weekDates.map((date, i) => (
                      <th 
                        key={i} 
                        className="text-center p-3 font-mono text-xs font-medium bg-muted/50"
                      >
                        <div>{DAYS[i]}</div>
                        <div className="text-muted-foreground mt-1">
                          {date.getDate()}/{date.getMonth() + 1}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((task) => (
                    <tr key={task} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-condensed text-sm font-semibold">
                        {task}
                      </td>
                      {DAYS.map((_, dayIdx) => {
                        const dayAssignments = getAssignmentsForTaskAndDay(task, dayIdx);
                        return (
                          <td 
                            key={dayIdx} 
                            className="p-3 text-center align-top"
                          >
                            {dayAssignments.length > 0 ? (
                              <div className="space-y-1">
                                {dayAssignments.map((assignment, idx) => (
                                  <div 
                                    key={idx}
                                    className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded"
                                  >
                                    {assignment.staffName}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-xs font-mono text-muted-foreground">
                                —
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Total Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums">
                {getTotalStaff()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Tasks Configured</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums">6</div>
              <p className="text-xs text-muted-foreground mt-1">
                Warehouse tasks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Week Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-3xl font-bold tabular-nums ${
                getCoveragePercentage() === 100 ? "text-accent" : 
                getCoveragePercentage() >= 80 ? "text-primary" : "text-warning"
              }`}>
                {getCoveragePercentage()}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Assignments complete
              </p>
            </CardContent>
          </Card>
        </div>

        {staff.length === 0 && (
          <div className="bg-warning/10 border border-warning rounded-md p-4">
            <p className="text-sm font-mono text-warning-foreground">
              No staff members configured. Visit the <a href="/staff" className="underline font-semibold">Staff page</a> to add employees.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}