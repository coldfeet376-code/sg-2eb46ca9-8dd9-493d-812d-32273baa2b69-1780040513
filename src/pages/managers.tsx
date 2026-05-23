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
import { generateManagerDutiesPDF } from "@/lib/pdfGenerator";
import { ManagerDutiesPrintPreview } from "@/components/ManagerDutiesPrintPreview";
import type { ManagerAssignment, ManagerDuty, ManagerShiftStart } from "@/types";
import { Plus, Lock, Unlock, Download, Calendar, RefreshCw, X, Printer, Users, Zap, ChevronLeft, ChevronRight, Pencil, Trash2, AlertCircle } from "lucide-react";
import { getAllManagers, createManager, updateManager, deleteManager, getManagersForDuty, type Manager, getManagerAvailability, setManagerAvailability, getAvailabilityForDate, type ManagerAvailability } from "@/services/managerService";
import { ManagerForm } from "@/components/managers/ManagerForm";
import { ManagerAvailabilityDialog } from "@/components/managers/ManagerAvailabilityDialog";
import { ManagerRotaTable } from "@/components/managers/ManagerRotaTable";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DUTIES: ManagerDuty[] = ["Intake", "Out-loading", "Admin", "Floor"];
const MANAGER_PASSWORD = "manager123"; // TODO: Move to env or config

function formatDateRange(start: Date, end: Date): string {
  if (!start || !end) return "";
  return `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
}

function getWeekNumber(d: Date): number {
  if (!d) return 0;
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

type AvailabilityType = "available" | "rest" | "holiday" | "sick";

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
    recurring_rest_days: [] as number[],
  });
  const [showManageSection, setShowManageSection] = useState(false);
  const [loading, setLoading] = useState(true);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, ManagerAvailability>>({});
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [selectedManagerForCalendar, setSelectedManagerForCalendar] = useState<Manager | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedAvailabilityType, setSelectedAvailabilityType] = useState<AvailabilityType>("rest");
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedManager, setSelectedManager] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

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

  useEffect(() => {
    if (isAuthenticated && managers.length > 0) {
      loadAvailability();
    }
  }, [isAuthenticated, managers, weekStart]);

  const loadAvailability = async () => {
    try {
      const startDate = weekStart.toISOString().split("T")[0];
      const endDate = new Date(weekStart);
      endDate.setDate(endDate.getDate() + 6);
      const endDateStr = endDate.toISOString().split("T")[0];

      const availMap: Record<string, ManagerAvailability> = {};
      
      for (const manager of managers) {
        const availData = await getManagerAvailability(manager.id, startDate, endDateStr);
        availData.forEach(avail => {
          const key = `${manager.id}-${avail.date}`;
          availMap[key] = avail;
        });
      }
      
      setAvailabilityMap(availMap);
    } catch (error) {
      console.error("Failed to load availability:", error);
    }
  };

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
        type: "info",
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
        type: "info",
      });
      return;
    }

    const newAssignments: ManagerAssignment[] = [];

    // For each day of the week
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split("T")[0];
      const dayOfWeek = currentDate.getDay(); // 0=Sunday, 1=Monday, etc.

      // Check if this day requires same manager for Out-loading and Intake
      // Saturday=6, Sunday=0, Monday=1, Tuesday=2, Wednesday=3
      // Thu/Fri (4,5) need DIFFERENT managers for Intake and Out-loading
      const requiresSameManager = [0, 1, 2, 3, 6].includes(dayOfWeek);

      // Get availability for this date
      const dayAvailability = await getAvailabilityForDate(dateStr);
      const unavailableManagerIds = new Set(
        dayAvailability
          .filter(a => a.type !== "available")
          .map(a => a.manager_id)
      );

      // Add managers with recurring rest days for this day of week
      managers.forEach(manager => {
        if (manager.recurring_rest_days && manager.recurring_rest_days.includes(dayOfWeek)) {
          unavailableManagerIds.add(manager.id);
        }
      });

      // Get list of available managers for this day
      const availableManagers = managers.filter(m => !unavailableManagerIds.has(m.id));
      const assignedManagerIdsThisDay = new Set<string>();
      let outloadingIntakeManager: Manager | null = null;

      // If this day requires same manager for Out-loading and Intake, assign them first
      if (requiresSameManager) {
        try {
          // Get managers who can do BOTH Out-loading and Intake
          const outloadingManagers = await getManagersForDuty("Out-loading");
          const intakeManagers = await getManagersForDuty("Intake");
          
          // Find managers who can do both
          const bothDutiesManagers = outloadingManagers.filter(om =>
            intakeManagers.some(im => im.id === om.id) &&
            !unavailableManagerIds.has(om.id)
          );

          if (bothDutiesManagers.length === 0) {
          } else {
            // Check who hasn't been assigned these duties recently (fairness)
            const recentOutloading = newAssignments.filter(a => 
              a.duty === "Out-loading" && 
              bothDutiesManagers.some(m => m.id === a.managerId)
            );
            const recentIntake = newAssignments.filter(a => 
              a.duty === "Intake" && 
              bothDutiesManagers.some(m => m.id === a.managerId)
            );

            const recentIds = new Set([
              ...recentOutloading.map(a => a.managerId),
              ...recentIntake.map(a => a.managerId)
            ]);

            const freshManagers = bothDutiesManagers.filter(m => !recentIds.has(m.id));
            const poolToUse = freshManagers.length > 0 ? freshManagers : bothDutiesManagers;
            
            outloadingIntakeManager = poolToUse[Math.floor(Math.random() * poolToUse.length)];

            // Assign to both Out-loading and Intake (no shiftStart anymore)
            newAssignments.push({
              managerId: outloadingIntakeManager.id,
              managerName: outloadingIntakeManager.name,
              duty: "Out-loading",
              shiftStart: "06:00", // Keep for type compatibility, but not displayed
              date: dateStr,
            });
            newAssignments.push({
              managerId: outloadingIntakeManager.id,
              managerName: outloadingIntakeManager.name,
              duty: "Intake",
              shiftStart: "06:00",
              date: dateStr,
            });
            assignedManagerIdsThisDay.add(outloadingIntakeManager.id);
          }
        } catch (error) {
          console.error(`Error assigning Out-loading/Intake pair on ${dateStr}:`, error);
        }
      }

      // For Thu/Fri, assign Intake and Out-loading to DIFFERENT managers
      if (!requiresSameManager) {
        try {
          // Assign Out-loading first
          const outloadingManagers = await getManagersForDuty("Out-loading");
          const availableOutloading = outloadingManagers.filter(m => 
            !unavailableManagerIds.has(m.id)
          );

          if (availableOutloading.length > 0) {
            const recentOutloading = newAssignments.filter(a => 
              a.duty === "Out-loading" && 
              availableOutloading.some(m => m.id === a.managerId)
            );
            const recentIds = new Set(recentOutloading.map(a => a.managerId));
            const freshManagers = availableOutloading.filter(m => !recentIds.has(m.id));
            const poolToUse = freshManagers.length > 0 ? freshManagers : availableOutloading;
            
            const selectedOutloading = poolToUse[Math.floor(Math.random() * poolToUse.length)];
            
            newAssignments.push({
              managerId: selectedOutloading.id,
              managerName: selectedOutloading.name,
              duty: "Out-loading",
              shiftStart: "06:00",
              date: dateStr,
            });
            assignedManagerIdsThisDay.add(selectedOutloading.id);
          }

          // Assign Intake to a DIFFERENT manager
          const intakeManagers = await getManagersForDuty("Intake");
          const availableIntake = intakeManagers.filter(m => 
            !unavailableManagerIds.has(m.id) &&
            !assignedManagerIdsThisDay.has(m.id) // CRITICAL: exclude already assigned
          );

          if (availableIntake.length > 0) {
            const recentIntake = newAssignments.filter(a => 
              a.duty === "Intake" && 
              availableIntake.some(m => m.id === a.managerId)
            );
            const recentIds = new Set(recentIntake.map(a => a.managerId));
            const freshManagers = availableIntake.filter(m => !recentIds.has(m.id));
            const poolToUse = freshManagers.length > 0 ? freshManagers : availableIntake;
            
            const selectedIntake = poolToUse[Math.floor(Math.random() * poolToUse.length)];
            
            newAssignments.push({
              managerId: selectedIntake.id,
              managerName: selectedIntake.name,
              duty: "Intake",
              shiftStart: "06:00",
              date: dateStr,
            });
            assignedManagerIdsThisDay.add(selectedIntake.id);
          }
        } catch (error) {
          console.error(`Error assigning Out-loading/Intake separately on ${dateStr}:`, error);
        }
      }

      // Now assign remaining duties (Admin, Floor)
      const dutiesToAssign: ManagerDuty[] = requiresSameManager && outloadingIntakeManager
        ? ["Admin", "Floor"] // Skip Out-loading and Intake since already assigned
        : ["Admin", "Floor"]; // Thu/Fri: already assigned Intake/Out-loading above

      for (const duty of dutiesToAssign) {
        try {
          const dutyManagers = await getManagersForDuty(duty);
          
          // Filter out unavailable managers AND managers already assigned to Intake/Out-loading
          const workingManagers = dutyManagers.filter(m => 
            !unavailableManagerIds.has(m.id) &&
            !assignedManagerIdsThisDay.has(m.id) // CRITICAL: exclude managers on Intake/Out-loading
          );

          if (workingManagers.length === 0) {
            continue;
          }

          // Check who hasn't been assigned this duty recently (fairness)
          const recentAssignments = newAssignments.filter(a => 
            a.duty === duty && 
            workingManagers.some(m => m.id === a.managerId)
          );

          const recentManagerIds = new Set(recentAssignments.map(a => a.managerId));
          const freshManagers = workingManagers.filter(m => !recentManagerIds.has(m.id));

          // Pick from fresh managers if available, otherwise from all eligible
          const poolToUse = freshManagers.length > 0 ? freshManagers : workingManagers;
          const selectedManager = poolToUse[Math.floor(Math.random() * poolToUse.length)];

          newAssignments.push({
            managerId: selectedManager.id,
            managerName: selectedManager.name,
            duty,
            shiftStart: "06:00",
            date: dateStr,
          });
          assignedManagerIdsThisDay.add(selectedManager.id);
        } catch (error) {
          console.error(`Error assigning duty ${duty}:`, error);
        }
      }

      // After all specific duties are assigned, put all remaining available managers on Floor
      const unassignedManagers = availableManagers.filter(m => 
        !assignedManagerIdsThisDay.has(m.id) &&
        m.can_floor // Only assign if they're trained for Floor
      );

      for (const manager of unassignedManagers) {
        newAssignments.push({
          managerId: manager.id,
          managerName: manager.name,
          duty: "Floor",
          shiftStart: "06:00",
          date: dateStr,
        });
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
      recurring_rest_days: [],
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
      recurring_rest_days: manager.recurring_rest_days || [],
    });
    setShowManagerDialog(true);
  };

  const handleSaveManager = async () => {
    try {
      if (!managerForm.name.trim()) {
        addNotification({
          staffName: "System",
          message: "Manager name is required",
          type: "info",
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
        type: "info",
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
        type: "info",
      });
    }
  };

  const handleQuickAvailability = async (manager: Manager, status: AvailabilityType) => {
    try {
      // Set availability for all days in current week
      const weekDates = DAYS.map((_, i) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + i);
        return date;
      });

      for (const date of weekDates) {
        const dateStr = date.toISOString().split("T")[0];
        await setManagerAvailability(manager.id, dateStr, status, "");
      }

      addNotification({
        staffName: "System",
        message: `Set ${manager.name} as ${status} for current week`,
        type: "info",
      });

      loadAvailability();
    } catch (error) {
      console.error("Error setting availability:", error);
      addNotification({
        staffName: "System",
        message: "Failed to update availability",
        type: "info",
      });
    }
  };

  const openCalendarDialog = (manager: Manager) => {
    setSelectedManagerForCalendar(manager);
    setSelectedDate("");
    setSelectedAvailabilityType("rest");
    setShowCalendarDialog(true);
  };

  const handleSetSingleDayAvailability = async () => {
    if (!selectedManagerForCalendar || !selectedDate) {
      addNotification({
        staffName: "System",
        message: "Please select a date",
        type: "info",
      });
      return;
    }

    try {
      await setManagerAvailability(
        selectedManagerForCalendar.id,
        selectedDate,
        selectedAvailabilityType,
        ""
      );

      addNotification({
        staffName: "System",
        message: `Set ${selectedManagerForCalendar.name} as ${selectedAvailabilityType} on ${new Date(selectedDate).toLocaleDateString()}`,
        type: "info",
      });

      setShowCalendarDialog(false);
      loadAvailability();
    } catch (error) {
      console.error("Error setting single day availability:", error);
      addNotification({
        staffName: "System",
        message: "Failed to update availability",
        type: "info",
      });
    }
  };

  const getAvailabilityForManagerDate = (managerId: string, dateStr: string): AvailabilityType => {
    const key = `${managerId}-${dateStr}`;
    return availabilityMap[key]?.type || "available";
  };

  const exportPDF = () => {
    generateManagerDutiesPDF({
      weekStart,
      assignments,
      managers: managers.map(m => ({ id: m.id, name: m.name })),
    });
    
    addNotification({
      staffName: "System",
      message: "Manager duties PDF downloaded successfully",
      type: "info",
    });
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
                <div className="flex gap-2 ml-auto">
                  <Button
                    onClick={() => setShowPrintPreview(true)}
                    disabled={assignments.length === 0}
                    variant="outline"
                    className="gap-2 font-sans font-medium"
                    size="lg"
                  >
                    <Printer className="h-4 w-4" />
                    Print Preview
                  </Button>

                  <Button
                    onClick={exportPDF}
                    disabled={assignments.length === 0}
                    variant="outline"
                    className="gap-2 font-sans font-medium"
                    size="lg"
                  >
                    <Download className="h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Manager Management Section */}
        {showManageSection && (
          <Card className="shadow-sm">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-xl font-condensed font-bold tracking-tight">
                Active Managers
              </CardTitle>
              <CardDescription className="text-sm font-sans">
                {managers.length} managers • Configure duties and availability
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              {loading && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              )}

              {!loading && managers.length === 0 && (
                <div className="text-center py-12">
                  <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                  <h3 className="text-lg font-condensed font-bold tracking-tight mb-2">
                    No Managers Yet
                  </h3>
                  <p className="text-sm font-sans text-muted-foreground mb-4">
                    Add shift managers to start scheduling duties
                  </p>
                  <Button onClick={openCreateDialog} size="lg" className="gap-2">
                    <Plus className="h-5 w-5" />
                    Add First Manager
                  </Button>
                </div>
              )}

              {!loading && managers.length > 0 && (
                <div className="space-y-3">
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
                          {manager.recurring_rest_days && manager.recurring_rest_days.length > 0 && (
                            <Badge variant="outline" className="text-xs font-mono bg-blue-500/10 text-blue-700 border-blue-500">
                              Rest: {manager.recurring_rest_days.map(d => DAYS[d]).join(", ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openCalendarDialog(manager)}
                          className="rounded-lg gap-1"
                        >
                          <span className="font-mono text-xs">Set Availability</span>
                        </Button>
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
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle className="font-condensed text-xl">
                {editingManager ? "Edit Manager" : "Add Manager"}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {editingManager ? "Update manager details and training" : "Add a new manager to the rota system"}
              </DialogDescription>
            </DialogHeader>
            <ManagerForm
              editingManager={editingManager}
              formData={managerForm}
              onInputChange={(key, value) => setManagerForm(prev => ({ ...prev, [key]: value }))}
              onSubmit={handleSaveManager}
              onCancel={() => setShowManagerDialog(false)}
            />
          </DialogContent>
        </Dialog>

        {/* Calendar Availability Dialog */}
        <ManagerAvailabilityDialog
          open={showCalendarDialog}
          onOpenChange={setShowCalendarDialog}
          manager={selectedManagerForCalendar}
          selectedDate={selectedDate}
          onDateChange={setSelectedDate}
          availabilityType={selectedAvailabilityType}
          onTypeChange={setSelectedAvailabilityType}
          onSubmit={handleSetSingleDayAvailability}
        />

        {/* Manager Rota Table */}
        {assignments.length > 0 && (
          <Card className="shadow-sm" data-tour="manager-rota">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-xl font-condensed font-bold tracking-tight">
                Current Week Schedule
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <ManagerRotaTable
                weekDays={weekDates.map((date, i) => ({ date, dateStr: date.toISOString().split("T")[0], dayOfWeek: i }))}
                managers={managers}
                assignments={assignments}
                getAvailabilityForManagerDate={getAvailabilityForManagerDate}
                onDeleteAssignment={(managerId, dateStr) => {
                   // Optional: implement if needed, currently dummy
                   setAssignments(prev => prev.filter(a => !(a.managerId === managerId && a.date === dateStr)));
                }}
              />
            </CardContent>
          </Card>
        )}

        {assignments.length === 0 && (
          <div className="bg-muted/50 border border-border rounded-lg p-8 text-center shadow-sm">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-sm font-mono text-muted-foreground">
              No manager duties generated yet. Click "Generate Rota" to create the schedule.
            </p>
          </div>
        )}
      </div>
      {/* Print Preview Dialog */}
      <ManagerDutiesPrintPreview
        open={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        weekStart={weekStart}
        assignments={assignments}
        managers={managers.map(m => ({ id: m.id, name: m.name }))}
      />
    </Layout>
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}