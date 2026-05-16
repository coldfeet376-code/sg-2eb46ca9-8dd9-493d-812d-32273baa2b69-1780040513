import { useState, useEffect } from "react";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download, RefreshCw, Lock, Unlock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { StaffMember, Assignment } from "@/types";
import { generateWeeklyRota, getWeekStart, navigateWeek, getYearWeeks } from "@/lib/rotaGenerator";
import { useNotifications } from "@/contexts/NotificationContext";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

interface LockedAssignment {
  task: string;
  date: string;
  staffName: string;
}

export default function Home() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [taskConfig, setTaskConfig] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"week" | "year">("week");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearRotas, setYearRotas] = useState<Map<string, Assignment[]>>(new Map());
  const [lockedAssignments, setLockedAssignments] = useState<LockedAssignment[]>([]);
  const { addNotification } = useNotifications();

  useEffect(() => {
    // Load staff and config
    const savedStaff = localStorage.getItem("warehouse-staff");
    const savedConfig = localStorage.getItem("warehouse-task-config");
    const savedLocked = localStorage.getItem("warehouse-locked-assignments");
    
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    }
    if (savedConfig) {
      setTaskConfig(JSON.parse(savedConfig));
    }
    if (savedLocked) {
      setLockedAssignments(JSON.parse(savedLocked));
    }
  }, []);

  useEffect(() => {
    // Save locked assignments
    localStorage.setItem("warehouse-locked-assignments", JSON.stringify(lockedAssignments));
  }, [lockedAssignments]);

  useEffect(() => {
    // Generate rota when data is available
    if (staff.length > 0 && taskConfig) {
      if (viewMode === "week") {
        generateRota();
      } else {
        generateYearRota();
      }
    }
  }, [staff, taskConfig, weekStart, viewMode, selectedYear]);

  const generateRota = () => {
    if (!staff.length || !taskConfig) return;

    const newAssignments = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
      lockedAssignments,
    });
    setAssignments(newAssignments);

    // Generate notifications for each staff member
    const staffAssignments = new Map<string, Assignment[]>();
    newAssignments.forEach(assignment => {
      if (!staffAssignments.has(assignment.staffName)) {
        staffAssignments.set(assignment.staffName, []);
      }
      staffAssignments.get(assignment.staffName)?.push(assignment);
    });

    staffAssignments.forEach((assignments, staffName) => {
      const taskList = [...new Set(assignments.map(a => a.task))].join(", ");
      addNotification({
        staffName,
        message: `New assignments: ${taskList}`,
        type: "assignment",
        weekStart: weekStart.toISOString(),
      });
    });
  };

  const generateYearRota = () => {
    if (!staff.length || !taskConfig) return;

    const weeks = getYearWeeks(selectedYear);
    const newYearRotas = new Map<string, Assignment[]>();

    weeks.forEach(weekStartDate => {
      const weekAssignments = generateWeeklyRota({
        staff,
        taskConfig,
        weekStart: weekStartDate,
      });
      newYearRotas.set(weekStartDate.toISOString(), weekAssignments);
    });

    setYearRotas(newYearRotas);

    // Notify about year-long rota generation
    addNotification({
      staffName: "System",
      message: `Year ${selectedYear} rota generated for all staff`,
      type: "info",
    });
  };

  const toggleLockAssignment = (task: string, dateIndex: number, staffName: string) => {
    const date = weekDates[dateIndex];
    const dateStr = date.toISOString().split("T")[0];
    
    const lockKey = `${task}-${dateStr}-${staffName}`;
    const existingLockIndex = lockedAssignments.findIndex(
      lock => lock.task === task && lock.date === dateStr && lock.staffName === staffName
    );

    if (existingLockIndex >= 0) {
      // Unlock
      setLockedAssignments(lockedAssignments.filter((_, i) => i !== existingLockIndex));
    } else {
      // Lock
      setLockedAssignments([...lockedAssignments, { task, date: dateStr, staffName }]);
    }
  };

  const isAssignmentLocked = (task: string, dateIndex: number, staffName: string): boolean => {
    const date = weekDates[dateIndex];
    const dateStr = date.toISOString().split("T")[0];
    
    return lockedAssignments.some(
      lock => lock.task === task && lock.date === dateStr && lock.staffName === staffName
    );
  };

  const unlockAll = () => {
    setLockedAssignments([]);
    addNotification({
      staffName: "System",
      message: "All assignments unlocked",
      type: "info",
    });
  };

  const exportPDF = () => {
    if (viewMode === "week") {
      exportWeekPDF();
    } else {
      exportYearPDF();
    }
  };

  const exportWeekPDF = () => {
    const weekDates = DAYS.map((_, i) => {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      return date;
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Warehouse Rota - Week ${weekDates[0].toLocaleDateString()}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'IBM Plex Mono', monospace; 
            padding: 20px; 
            font-size: 11px;
            color: #1a1a1a;
          }
          h1 { 
            font-family: 'IBM Plex Sans Condensed', sans-serif; 
            font-size: 24px; 
            font-weight: 700;
            margin-bottom: 8px;
          }
          .date-range { 
            font-size: 10px; 
            color: #666; 
            margin-bottom: 20px;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 8px; 
            text-align: left;
          }
          th { 
            background-color: #f5f5f5; 
            font-weight: 600;
            font-size: 10px;
          }
          .task-cell { font-weight: 600; }
          .staff-name { 
            background-color: #e8f0f7; 
            color: #2563a5;
            padding: 4px 6px;
            margin: 2px 0;
            border-radius: 4px;
            display: block;
            font-size: 10px;
          }
          .staff-name.locked {
            background-color: #fef3c7;
            color: #92400e;
            border: 1px solid #fbbf24;
          }
          .empty-cell { 
            color: #999; 
            text-align: center;
          }
          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>WAREHOUSE ROTA</h1>
        <div class="date-range">
          ${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - 
          ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
        <table>
          <thead>
            <tr>
              <th>Task</th>
              ${DAYS.map((day, i) => `
                <th style="text-align: center;">
                  ${day}<br>
                  <span style="font-weight: 400; color: #666;">
                    ${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}
                  </span>
                </th>
              `).join("")}
            </tr>
          </thead>
          <tbody>
            ${TASKS.map(task => `
              <tr>
                <td class="task-cell">${task}</td>
                ${DAYS.map((_, dayIdx) => {
                  const date = weekDates[dayIdx];
                  const dateStr = date.toISOString().split("T")[0];
                  const dayAssignments = assignments.filter(a => a.task === task && a.date === dateStr);
                  
                  if (dayAssignments.length === 0) {
                    return `<td class="empty-cell">—</td>`;
                  }
                  
                  return `
                    <td>
                      ${dayAssignments.map(a => {
                        const locked = isAssignmentLocked(task, dayIdx, a.staffName);
                        return `<span class="staff-name ${locked ? 'locked' : ''}">${a.staffName}${locked ? ' 🔒' : ''}</span>`;
                      }).join("")}
                    </td>
                  `;
                }).join("")}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
  };

  const exportYearPDF = () => {
    const weeks = getYearWeeks(selectedYear);
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Warehouse Rota - Year ${selectedYear}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'IBM Plex Mono', monospace; 
            padding: 20px; 
            font-size: 10px;
            color: #1a1a1a;
          }
          h1 { 
            font-family: 'IBM Plex Sans Condensed', sans-serif; 
            font-size: 20px; 
            font-weight: 700;
            margin-bottom: 20px;
          }
          .week-section {
            page-break-inside: avoid;
            margin-bottom: 30px;
          }
          h2 {
            font-family: 'IBM Plex Sans Condensed', sans-serif;
            font-size: 14px;
            font-weight: 600;
            margin-bottom: 8px;
            color: #2563a5;
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-bottom: 20px;
            font-size: 9px;
          }
          th, td { 
            border: 1px solid #ddd; 
            padding: 4px; 
            text-align: left;
          }
          th { 
            background-color: #f5f5f5; 
            font-weight: 600;
          }
          .staff-name { 
            background-color: #e8f0f7; 
            color: #2563a5;
            padding: 2px 4px;
            margin: 1px 0;
            border-radius: 2px;
            display: block;
          }
          .empty-cell { color: #999; text-align: center; }
          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; size: landscape; }
          }
        </style>
      </head>
      <body>
        <h1>WAREHOUSE ROTA - ${selectedYear}</h1>
        ${weeks.map(weekStartDate => {
          const weekDates = DAYS.map((_, i) => {
            const date = new Date(weekStartDate);
            date.setDate(weekStartDate.getDate() + i);
            return date;
          });
          const weekKey = weekStartDate.toISOString();
          const weekAssignments = yearRotas.get(weekKey) || [];

          return `
            <div class="week-section">
              <h2>
                Week: ${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} - 
                ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
              </h2>
              <table>
                <thead>
                  <tr>
                    <th style="width: 80px;">Task</th>
                    ${DAYS.map((day, i) => `
                      <th style="text-align: center; width: 100px;">
                        ${day} ${weekDates[i].getDate()}/${weekDates[i].getMonth() + 1}
                      </th>
                    `).join("")}
                  </tr>
                </thead>
                <tbody>
                  ${TASKS.map(task => `
                    <tr>
                      <td style="font-weight: 600;">${task}</td>
                      ${DAYS.map((_, dayIdx) => {
                        const date = weekDates[dayIdx];
                        const dateStr = date.toISOString().split("T")[0];
                        const dayAssignments = weekAssignments.filter(a => a.task === task && a.date === dateStr);
                        
                        if (dayAssignments.length === 0) {
                          return `<td class="empty-cell">—</td>`;
                        }
                        
                        return `
                          <td>
                            ${dayAssignments.map(a => `<span class="staff-name">${a.staffName}</span>`).join("")}
                          </td>
                        `;
                      }).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          `;
        }).join("")}
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const printWindow = window.open(url, "_blank");
    
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };
    }
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

  const getLockedCount = (): number => {
    return lockedAssignments.length;
  };

  const handlePrevWeek = () => {
    setWeekStart(navigateWeek(weekStart, "prev"));
  };

  const handleNextWeek = () => {
    setWeekStart(navigateWeek(weekStart, "next"));
  };

  const handleYearChange = (year: string) => {
    setSelectedYear(parseInt(year));
  };

  const renderYearView = () => {
    const weeks = getYearWeeks(selectedYear);
    
    return (
      <div className="space-y-6">
        {weeks.map(weekStartDate => {
          const weekKey = weekStartDate.toISOString();
          const weekAssignments = yearRotas.get(weekKey) || [];
          const weekDatesLocal = DAYS.map((_, i) => {
            const date = new Date(weekStartDate);
            date.setDate(weekStartDate.getDate() + i);
            return date;
          });

          return (
            <Card key={weekKey} className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-lg">
                  Week: {weekDatesLocal[0].toLocaleDateString("en-GB", { 
                    day: "2-digit", 
                    month: "short" 
                  })} - {weekDatesLocal[6].toLocaleDateString("en-GB", { 
                    day: "2-digit", 
                    month: "short", 
                    year: "numeric" 
                  })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-2 font-condensed text-xs font-semibold bg-muted/50 w-24 rounded-tl-md">
                          Task
                        </th>
                        {weekDatesLocal.map((date, i) => (
                          <th 
                            key={i} 
                            className={`text-center p-2 font-mono text-[10px] font-medium bg-muted/50 ${i === 6 ? 'rounded-tr-md' : ''}`}
                          >
                            <div>{DAYS[i]}</div>
                            <div className="text-muted-foreground mt-0.5">
                              {date.getDate()}/{date.getMonth() + 1}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TASKS.map((task) => (
                        <tr key={task} className="border-b border-border hover:bg-muted/30 transition-smooth">
                          <td className="p-2 font-condensed text-xs font-semibold">
                            {task}
                          </td>
                          {DAYS.map((_, dayIdx) => {
                            const date = weekDatesLocal[dayIdx];
                            const dateStr = date.toISOString().split("T")[0];
                            const dayAssignments = weekAssignments.filter(
                              a => a.task === task && a.date === dateStr
                            );
                            return (
                              <td 
                                key={dayIdx} 
                                className="p-2 text-center align-top"
                              >
                                {dayAssignments.length > 0 ? (
                                  <div className="space-y-0.5">
                                    {dayAssignments.map((assignment, idx) => (
                                      <div 
                                        key={idx}
                                        className="text-[10px] font-mono bg-primary/10 text-primary px-2 py-1 rounded-md"
                                      >
                                        {assignment.staffName}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-[10px] font-mono text-muted-foreground">
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
          );
        })}
      </div>
    );
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
              {viewMode === "week" ? "Weekly Rota" : `Year ${selectedYear} Rota`}
            </h1>
            {viewMode === "week" ? (
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
            ) : (
              <p className="text-sm text-muted-foreground font-mono mt-1">
                {getYearWeeks(selectedYear).length} weeks
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Select value={viewMode} onValueChange={(v) => setViewMode(v as "week" | "year")}>
              <SelectTrigger className="w-32 font-mono text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week" className="font-mono text-xs">Week View</SelectItem>
                <SelectItem value="year" className="font-mono text-xs">Year View</SelectItem>
              </SelectContent>
            </Select>

            {viewMode === "year" && (
              <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                <SelectTrigger className="w-24 font-mono text-xs rounded-lg">
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

            {viewMode === "week" && (
              <>
                <Button variant="outline" size="sm" onClick={handlePrevWeek} className="rounded-lg">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleNextWeek} className="rounded-lg">
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateRota}
                  className="gap-2 ml-2 rounded-lg"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="font-mono text-xs">Regenerate</span>
                </Button>
                {lockedAssignments.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={unlockAll}
                    className="gap-2 rounded-lg text-warning hover:text-warning"
                  >
                    <Unlock className="h-4 w-4" />
                    <span className="font-mono text-xs">Unlock All ({getLockedCount()})</span>
                  </Button>
                )}
              </>
            )}
            
            <Button 
              variant="default" 
              size="sm" 
              className="gap-2 rounded-lg shadow-sm hover:shadow-md transition-smooth"
              onClick={exportPDF}
              disabled={staff.length === 0 || !taskConfig}
            >
              <Download className="h-4 w-4" />
              <span className="font-mono text-xs">Export PDF</span>
            </Button>
          </div>
        </div>

        {viewMode === "week" ? (
          <>
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Current Week Schedule</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Click assignments to lock/unlock them during regeneration
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50 rounded-tl-lg">
                          Task
                        </th>
                        {weekDates.map((date, i) => (
                          <th 
                            key={i} 
                            className={`text-center p-3 font-mono text-xs font-medium bg-muted/50 ${i === 6 ? 'rounded-tr-lg' : ''}`}
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
                        <tr key={task} className="border-b border-border hover:bg-muted/30 transition-smooth">
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
                                  <div className="space-y-1.5">
                                    {dayAssignments.map((assignment, idx) => {
                                      const locked = isAssignmentLocked(task, dayIdx, assignment.staffName);
                                      return (
                                        <button
                                          key={idx}
                                          onClick={() => toggleLockAssignment(task, dayIdx, assignment.staffName)}
                                          className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-smooth cursor-pointer group relative ${
                                            locked 
                                              ? 'bg-warning/20 text-warning-foreground border-2 border-warning hover:bg-warning/30' 
                                              : 'bg-primary/10 text-primary hover:bg-primary/20 border-2 border-transparent hover:border-primary/30'
                                          }`}
                                        >
                                          <span className="flex items-center gap-1.5">
                                            {locked ? (
                                              <Lock className="h-3 w-3" />
                                            ) : (
                                              <Unlock className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                            )}
                                            {assignment.staffName}
                                          </span>
                                        </button>
                                      );
                                    })}
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

            <div className="grid gap-4 md:grid-cols-4">
              <Card className="shadow-sm card-hover">
                <CardHeader>
                  <CardTitle className="font-condensed text-base">Total Staff</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-3xl font-bold tabular-nums text-primary">
                    {getTotalStaff()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Active employees
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm card-hover">
                <CardHeader>
                  <CardTitle className="font-condensed text-base">Tasks Configured</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-3xl font-bold tabular-nums text-accent">6</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Warehouse tasks
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm card-hover">
                <CardHeader>
                  <CardTitle className="font-condensed text-base">Week Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`font-mono text-3xl font-bold tabular-nums ${
                    getCoveragePercentage() === 100 ? "text-success" : 
                    getCoveragePercentage() >= 80 ? "text-primary" : "text-warning"
                  }`}>
                    {getCoveragePercentage()}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assignments complete
                  </p>
                </CardContent>
              </Card>

              <Card className="shadow-sm card-hover">
                <CardHeader>
                  <CardTitle className="font-condensed text-base">Locked Assignments</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="font-mono text-3xl font-bold tabular-nums text-warning">
                    {getLockedCount()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Protected from changes
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          renderYearView()
        )}

        {staff.length === 0 && (
          <div className="bg-warning/10 border border-warning rounded-lg p-4 shadow-sm">
            <p className="text-sm font-mono text-warning-foreground">
              No staff members configured. Visit the <Link href="/staff" className="underline font-semibold hover:text-warning transition-smooth">Staff page</Link> to add employees.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}