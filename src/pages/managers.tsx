import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import { useNotifications } from "@/contexts/NotificationContext";
import type { ManagerAssignment, ManagerDuty, ManagerShiftStart } from "@/types";
import { Lock, Unlock, Zap, AlertCircle, ChevronLeft, ChevronRight, Download } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DUTIES: ManagerDuty[] = ["Intake", "Out-loading", "Admin", "Floor"];
const SHIFT_STARTS: ManagerShiftStart[] = ["06:00", "08:00"];
const MANAGER_PASSWORD = "manager123"; // TODO: Move to env or config

interface ManagerData {
  id: string;
  name: string;
}

export default function Managers() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [assignments, setAssignments] = useState<ManagerAssignment[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [unlockPasswordInput, setUnlockPasswordInput] = useState("");
  const [unlockError, setUnlockError] = useState(false);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const { addNotification } = useNotifications();

  // Mock manager list - TODO: integrate with staff system
  const [managers, setManagers] = useState<ManagerData[]>([
    { id: "m1", name: "John Smith" },
    { id: "m2", name: "Sarah Jones" },
    { id: "m3", name: "Mike Wilson" },
    { id: "m4", name: "Emma Davis" },
  ]);

  useEffect(() => {
    // Check if already authenticated in session
    const auth = sessionStorage.getItem("manager-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    // Load saved assignments
    const saved = localStorage.getItem("manager-assignments");
    const savedLock = localStorage.getItem("manager-locked");
    if (saved) {
      setAssignments(JSON.parse(saved));
    }
    if (savedLock) {
      setIsLocked(JSON.parse(savedLock));
    }
  }, []);

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === MANAGER_PASSWORD) {
      setIsAuthenticated(true);
      sessionStorage.setItem("manager-auth", "true");
      setPasswordError(false);
      addNotification({
        staffName: "System",
        message: "Manager access granted",
        type: "info",
      });
    } else {
      setPasswordError(true);
    }
  };

  const handleUnlock = () => {
    if (unlockPasswordInput === MANAGER_PASSWORD) {
      setIsLocked(false);
      localStorage.setItem("manager-locked", JSON.stringify(false));
      setShowUnlockPrompt(false);
      setUnlockError(false);
      setUnlockPasswordInput("");
      addNotification({
        staffName: "System",
        message: "Manager rota unlocked",
        type: "info",
      });
    } else {
      setUnlockError(true);
    }
  };

  const generateRota = () => {
    if (isLocked) {
      setShowUnlockPrompt(true);
      return;
    }

    const newAssignments: ManagerAssignment[] = [];
    const managerPool = [...managers];

    // For each day of the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split("T")[0];

      // Shuffle managers for randomization
      const shuffled = [...managerPool].sort(() => Math.random() - 0.5);

      // Assign duties for each shift
      SHIFT_STARTS.forEach((shiftStart, shiftIdx) => {
        DUTIES.forEach((duty, dutyIdx) => {
          const managerIdx = (shiftIdx * DUTIES.length + dutyIdx) % shuffled.length;
          const manager = shuffled[managerIdx];

          newAssignments.push({
            managerId: manager.id,
            managerName: manager.name,
            duty,
            shiftStart,
            date: dateStr,
          });
        });
      });
    }

    setAssignments(newAssignments);
    setIsLocked(true);
    localStorage.setItem("manager-assignments", JSON.stringify(newAssignments));
    localStorage.setItem("manager-locked", JSON.stringify(true));

    addNotification({
      staffName: "System",
      message: "Manager rota generated and locked",
      type: "info",
    });
  };

  const exportPDF = () => {
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
        <title>Manager Duties - Week ${weekDates[0].toLocaleDateString()}</title>
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
          .shift-section {
            margin-bottom: 30px;
          }
          .shift-header {
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 10px;
            padding: 8px;
            background: #f5f5f5;
            border-radius: 4px;
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
          .duty-cell { font-weight: 600; }
          .manager-name { 
            background-color: #e8f0f7; 
            color: #2563a5;
            padding: 4px 6px;
            margin: 2px 0;
            border-radius: 4px;
            display: block;
            font-size: 10px;
          }
          @media print {
            body { padding: 10px; }
            @page { margin: 1cm; }
          }
        </style>
      </head>
      <body>
        <h1>MANAGER DUTIES ROTA</h1>
        <div class="date-range">
          ${weekDates[0].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} - 
          ${weekDates[6].toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
        </div>
        ${SHIFT_STARTS.map(shift => `
          <div class="shift-section">
            <div class="shift-header">${shift} Shift</div>
            <table>
              <thead>
                <tr>
                  <th>Duty</th>
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
                ${DUTIES.map(duty => `
                  <tr>
                    <td class="duty-cell">${duty}</td>
                    ${DAYS.map((_, dayIdx) => {
                      const date = weekDates[dayIdx];
                      const dateStr = date.toISOString().split("T")[0];
                      const assignment = assignments.find(
                        a => a.duty === duty && a.shiftStart === shift && a.date === dateStr
                      );
                      return `
                        <td>
                          ${assignment ? `<span class="manager-name">${assignment.managerName}</span>` : '—'}
                        </td>
                      `;
                    }).join("")}
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        `).join("")}
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

  const handlePrevWeek = () => {
    const prevWeek = new Date(weekStart);
    prevWeek.setDate(prevWeek.getDate() - 7);
    setWeekStart(prevWeek);
  };

  const handleNextWeek = () => {
    const nextWeek = new Date(weekStart);
    nextWeek.setDate(nextWeek.getDate() + 7);
    setWeekStart(nextWeek);
  };

  const getDutyColor = (duty: ManagerDuty): string => {
    const colorMap: Record<ManagerDuty, string> = {
      "Intake": "bg-blue-500/20 text-blue-700 border-blue-500",
      "Out-loading": "bg-green-500/20 text-green-700 border-green-500",
      "Admin": "bg-purple-500/20 text-purple-700 border-purple-500",
      "Floor": "bg-orange-500/20 text-orange-700 border-orange-500",
    };
    return colorMap[duty];
  };

  // Password gate
  if (!isAuthenticated) {
    return (
      <Layout>
        <SEO title="Manager Duties - Access Required" />
        <div className="min-h-[60vh] flex items-center justify-center">
          <Card className="w-full max-w-md shadow-lg">
            <CardHeader>
              <CardTitle className="font-condensed text-2xl flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" />
                Manager Access Required
              </CardTitle>
              <CardDescription>
                Enter password to access manager duties rota
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div>
                  <Input
                    type="password"
                    placeholder="Enter password"
                    value={passwordInput}
                    onChange={(e) => {
                      setPasswordInput(e.target.value);
                      setPasswordError(false);
                    }}
                    className="font-mono"
                  />
                  {passwordError && (
                    <p className="text-sm text-destructive mt-2 font-mono">
                      Incorrect password
                    </p>
                  )}
                </div>
                <Button type="submit" className="w-full gap-2">
                  <Unlock className="h-4 w-4" />
                  Access Manager Duties
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Manager Duties Rota" />
      <div className="space-y-6">
        {/* Unlock Prompt */}
        {showUnlockPrompt && (
          <Alert className="bg-warning/10 border-warning">
            <Lock className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-warning mb-2">
                Rota is Locked
              </h3>
              <p className="text-sm text-warning/90 mb-3">
                Enter password to unlock and regenerate the rota
              </p>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="Enter password"
                  value={unlockPasswordInput}
                  onChange={(e) => {
                    setUnlockPasswordInput(e.target.value);
                    setUnlockError(false);
                  }}
                  className="font-mono max-w-xs"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlock}
                  className="rounded-lg"
                >
                  Unlock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowUnlockPrompt(false);
                    setUnlockPasswordInput("");
                    setUnlockError(false);
                  }}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
              {unlockError && (
                <p className="text-sm text-destructive mt-2 font-mono">
                  Incorrect password
                </p>
              )}
            </div>
          </Alert>
        )}

        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Manager Duties Rota
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
            <Button
              onClick={generateRota}
              size="lg"
              className="gap-2 rounded-lg shadow-md hover:shadow-lg transition-all font-condensed text-base bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Zap className="h-5 w-5" />
              <span>{isLocked ? "Regenerate" : "Generate"} Rota</span>
            </Button>

            <Button variant="outline" size="sm" onClick={handlePrevWeek} className="rounded-lg">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleNextWeek} className="rounded-lg">
              <ChevronRight className="h-4 w-4" />
            </Button>

            {assignments.length > 0 && (
              <>
                {isLocked && (
                  <Badge variant="outline" className="gap-1 font-mono text-xs text-warning border-warning">
                    <Lock className="h-3 w-3" />
                    Locked
                  </Badge>
                )}
                <Button 
                  variant="default" 
                  size="sm" 
                  className="gap-2 rounded-lg shadow-sm hover:shadow-md transition-smooth"
                  onClick={exportPDF}
                >
                  <Download className="h-4 w-4" />
                  <span className="font-mono text-xs">PDF</span>
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Shift Cards */}
        {SHIFT_STARTS.map((shiftStart) => (
          <Card key={shiftStart} className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl flex items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {shiftStart}
                </Badge>
                Shift Duties
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Manager assignments for {shiftStart} shift
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50 rounded-tl-lg">
                        Duty
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
                    {DUTIES.map((duty) => (
                      <tr key={duty} className="border-b border-border hover:bg-muted/30 transition-smooth">
                        <td className="p-4 font-condensed text-sm font-semibold bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div className={`w-3 h-3 rounded ${getDutyColor(duty)}`}></div>
                            {duty}
                          </div>
                        </td>
                        {DAYS.map((_, dayIdx) => {
                          const date = weekDates[dayIdx];
                          const dateStr = date.toISOString().split("T")[0];
                          const assignment = assignments.find(
                            a => a.duty === duty && a.shiftStart === shiftStart && a.date === dateStr
                          );
                          const dutyColorClass = getDutyColor(duty);
                          
                          return (
                            <td key={dayIdx} className="p-4 text-center align-top">
                              {assignment ? (
                                <div
                                  className={`text-xs font-mono px-4 py-2.5 rounded-lg transition-all w-full shadow-sm border-2 ${dutyColorClass}`}
                                >
                                  <span className="font-semibold">{assignment.managerName}</span>
                                </div>
                              ) : (
                                <div className="text-xs font-mono text-muted-foreground">—</div>
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
        ))}

        {assignments.length === 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-8 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-mono text-muted-foreground">
              No manager duties generated yet. Click "Generate Rota" to create the schedule.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}