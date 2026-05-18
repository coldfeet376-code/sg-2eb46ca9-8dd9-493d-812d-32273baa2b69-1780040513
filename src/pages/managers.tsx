"use client";

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
import { Lock, Unlock, Zap, AlertCircle, ChevronLeft, ChevronRight, Download, Plus, Pencil, Trash2, Users, Check, X } from "lucide-react";
import { getAllManagers, createManager, updateManager, deleteManager, getManagersForDuty, type Manager } from "@/services/managerService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DUTIES: ManagerDuty[] = ["Intake", "Out-loading", "Admin", "Floor"];
const SHIFT_STARTS: ManagerShiftStart[] = ["06:00", "08:00"];
const MANAGER_PASSWORD = "manager123"; // TODO: Move to env or config

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

  // Manager management state
  const [managers, setManagers] = useState<Manager[]>([]);
  const [showManagerDialog, setShowManagerDialog] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);
  const [managerForm, setManagerForm] = useState({
    name: "",
    can_intake: true,
    can_out_loading: true,
    can_admin: true,
    can_floor: true,
    preferred_shift: null as "06:00" | "08:00" | null,
  });
  const [showManageSection, setShowManageSection] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const auth = sessionStorage.getItem("manager-auth");
    if (auth === "true") {
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("manager-assignments");
    const savedLock = localStorage.getItem("manager-locked");
    if (saved) {
      setAssignments(JSON.parse(saved));
    }
    if (savedLock) {
      setIsLocked(JSON.parse(savedLock));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadManagers();
    }
  }, [isAuthenticated]);

  const loadManagers = async () => {
    try {
      setLoading(true);
      const data = await getAllManagers();
      setManagers(data);
    } catch (error) {
      console.error("Failed to load managers:", error);
      addNotification({
        staffName: "System",
        message: "Failed to load managers",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

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

  const generateRota = async () => {
    if (isLocked) {
      setShowUnlockPrompt(true);
      return;
    }

    if (managers.length === 0) {
      addNotification({
        staffName: "System",
        message: "No managers available. Add managers first.",
        type: "error",
      });
      return;
    }

    const newAssignments: ManagerAssignment[] = [];

    // For each day of the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split("T")[0];

      // For each shift
      for (const shiftStart of SHIFT_STARTS) {
        // For each duty, get managers who can do it
        for (const duty of DUTIES) {
          try {
            const availableManagers = await getManagersForDuty(duty);
            
            if (availableManagers.length === 0) {
              console.warn(`No managers available for duty: ${duty}`);
              continue;
            }

            // Prefer managers with matching shift preference, but allow any if needed
            let eligibleManagers = availableManagers.filter(m => 
              !m.preferred_shift || m.preferred_shift === shiftStart
            );

            // If no one with matching preference, use anyone trained for this duty
            if (eligibleManagers.length === 0) {
              eligibleManagers = availableManagers;
            }

            // Check who hasn't been assigned this duty recently (fairness)
            const recentAssignments = newAssignments.filter(a => 
              a.duty === duty && 
              eligibleManagers.some(m => m.id === a.managerId)
            );

            const recentManagerIds = new Set(recentAssignments.map(a => a.managerId));
            const freshManagers = eligibleManagers.filter(m => !recentManagerIds.has(m.id));

            // Pick from fresh managers if available, otherwise from all eligible
            const poolToUse = freshManagers.length > 0 ? freshManagers : eligibleManagers;
            const selectedManager = poolToUse[Math.floor(Math.random() * poolToUse.length)];

            newAssignments.push({
              managerId: selectedManager.id,
              managerName: selectedManager.name,
              duty,
              shiftStart,
              date: dateStr,
            });
          } catch (error) {
            console.error(`Error assigning duty ${duty}:`, error);
          }
        }
      }
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

  const openCreateDialog = () => {
    setEditingManager(null);
    setManagerForm({
      name: "",
      can_intake: true,
      can_out_loading: true,
      can_admin: true,
      can_floor: true,
      preferred_shift: null,
    });
    setShowManagerDialog(true);
  };

  const openEditDialog = (manager: Manager) => {
    setEditingManager(manager);
    setManagerForm({
      name: manager.name,
      can_intake: manager.can_intake,
      can_out_loading: manager.can_out_loading,
      can_admin: manager.can_admin,
      can_floor: manager.can_floor,
      preferred_shift: manager.preferred_shift,
    });
    setShowManagerDialog(true);
  };

  const handleSaveManager = async () => {
    try {
      if (!managerForm.name.trim()) {
        addNotification({
          staffName: "System",
          message: "Manager name is required",
          type: "error",
        });
        return;
      }

      if (editingManager) {
        await updateManager({
          id: editingManager.id,
          ...managerForm,
        });
        addNotification({
          staffName: "System",
          message: `Updated ${managerForm.name}`,
          type: "info",
        });
      } else {
        await createManager(managerForm);
        addNotification({
          staffName: "System",
          message: `Added ${managerForm.name}`,
          type: "info",
        });
      }

      setShowManagerDialog(false);
      loadManagers();
    } catch (error) {
      console.error("Error saving manager:", error);
      addNotification({
        staffName: "System",
        message: "Failed to save manager",
        type: "error",
      });
    }
  };

  const handleDeleteManager = async (manager: Manager) => {
    if (!confirm(`Delete ${manager.name}?`)) return;

    try {
      await deleteManager(manager.id);
      addNotification({
        staffName: "System",
        message: `Deleted ${manager.name}`,
        type: "info",
      });
      loadManagers();
    } catch (error) {
      console.error("Error deleting manager:", error);
      addNotification({
        staffName: "System",
        message: "Failed to delete manager",
        type: "error",
      });
    }
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
              variant="outline"
              size="sm"
              onClick={() => setShowManageSection(!showManageSection)}
              className="gap-2 rounded-lg"
            >
              <Users className="h-4 w-4" />
              <span className="font-mono text-xs">
                {showManageSection ? "Hide" : "Manage"} Managers
              </span>
            </Button>

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

        {/* Manager Management Section */}
        {showManageSection && (
          <Card className="shadow-sm border-primary/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-condensed text-xl flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Manage Managers
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    Configure managers and their trained duties
                  </CardDescription>
                </div>
                <Button
                  onClick={openCreateDialog}
                  size="sm"
                  className="gap-2 rounded-lg"
                >
                  <Plus className="h-4 w-4" />
                  Add Manager
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <p className="text-sm text-muted-foreground font-mono text-center py-4">
                  Loading managers...
                </p>
              ) : managers.length === 0 ? (
                <p className="text-sm text-muted-foreground font-mono text-center py-4">
                  No managers yet. Click "Add Manager" to get started.
                </p>
              ) : (
                <div className="space-y-2">
                  {managers.map((manager) => (
                    <div
                      key={manager.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/30 transition-smooth"
                    >
                      <div className="flex-1">
                        <div className="font-condensed font-semibold text-sm mb-2">
                          {manager.name}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {manager.can_intake && (
                            <Badge variant="outline" className="text-xs font-mono bg-blue-500/10 text-blue-700 border-blue-500">
                              Intake
                            </Badge>
                          )}
                          {manager.can_out_loading && (
                            <Badge variant="outline" className="text-xs font-mono bg-green-500/10 text-green-700 border-green-500">
                              Out-loading
                            </Badge>
                          )}
                          {manager.can_admin && (
                            <Badge variant="outline" className="text-xs font-mono bg-purple-500/10 text-purple-700 border-purple-500">
                              Admin
                            </Badge>
                          )}
                          {manager.can_floor && (
                            <Badge variant="outline" className="text-xs font-mono bg-orange-500/10 text-orange-700 border-orange-500">
                              Floor
                            </Badge>
                          )}
                          {manager.preferred_shift && (
                            <Badge variant="outline" className="text-xs font-mono bg-accent/10 text-accent-foreground border-accent">
                              Prefers {manager.preferred_shift}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(manager)}
                          className="rounded-lg"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteManager(manager)}
                          className="rounded-lg text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Manager Dialog */}
        <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="font-condensed text-xl">
                {editingManager ? "Edit Manager" : "Add Manager"}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Configure manager details and trained duties
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="name" className="font-mono text-xs">Name</Label>
                <Input
                  id="name"
                  value={managerForm.name}
                  onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })}
                  placeholder="Manager name"
                  className="font-mono mt-1.5"
                />
              </div>

              <div>
                <Label className="font-mono text-xs mb-3 block">Trained Duties</Label>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="can_intake" className="font-mono text-xs cursor-pointer">
                      Intake
                    </Label>
                    <Switch
                      id="can_intake"
                      checked={managerForm.can_intake}
                      onCheckedChange={(checked) =>
                        setManagerForm({ ...managerForm, can_intake: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="can_out_loading" className="font-mono text-xs cursor-pointer">
                      Out-loading
                    </Label>
                    <Switch
                      id="can_out_loading"
                      checked={managerForm.can_out_loading}
                      onCheckedChange={(checked) =>
                        setManagerForm({ ...managerForm, can_out_loading: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="can_admin" className="font-mono text-xs cursor-pointer">
                      Admin
                    </Label>
                    <Switch
                      id="can_admin"
                      checked={managerForm.can_admin}
                      onCheckedChange={(checked) =>
                        setManagerForm({ ...managerForm, can_admin: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="can_floor" className="font-mono text-xs cursor-pointer">
                      Floor
                    </Label>
                    <Switch
                      id="can_floor"
                      checked={managerForm.can_floor}
                      onCheckedChange={(checked) =>
                        setManagerForm({ ...managerForm, can_floor: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="preferred_shift" className="font-mono text-xs">
                  Preferred Shift (Optional)
                </Label>
                <Select
                  value={managerForm.preferred_shift || "none"}
                  onValueChange={(value) =>
                    setManagerForm({
                      ...managerForm,
                      preferred_shift: value === "none" ? null : (value as "06:00" | "08:00"),
                    })
                  }
                >
                  <SelectTrigger className="font-mono mt-1.5">
                    <SelectValue placeholder="No preference" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No preference</SelectItem>
                    <SelectItem value="06:00">06:00</SelectItem>
                    <SelectItem value="08:00">08:00</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowManagerDialog(false)}
                className="rounded-lg"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button onClick={handleSaveManager} className="rounded-lg gap-2">
                <Check className="h-4 w-4" />
                {editingManager ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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