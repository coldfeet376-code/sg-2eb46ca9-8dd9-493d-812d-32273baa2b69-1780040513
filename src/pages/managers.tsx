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
import { getAllManagers, createManager, updateManager, deleteManager, getManagersForDuty, type Manager, getManagerAvailability, setManagerAvailability, getAvailabilityForDate, type ManagerAvailability } from "@/services/managerService";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DUTIES: ManagerDuty[] = ["Intake", "Out-loading", "Admin", "Floor"];
const MANAGER_PASSWORD = "manager123"; // TODO: Move to env or config

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

  // Availability management state
  const [showAvailabilityDialog, setShowAvailabilityDialog] = useState(false);
  const [selectedManager, setSelectedManager] = useState<Manager | null>(null);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("available");
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, ManagerAvailability>>({});
  const [availabilityNotes, setAvailabilityNotes] = useState("");

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
            console.warn(`No managers can do both Out-loading and Intake on ${dateStr}`);
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
          
          // Filter out unavailable managers
          const workingManagers = dutyManagers.filter(m => 
            !unavailableManagerIds.has(m.id)
          );

          if (workingManagers.length === 0) {
            console.warn(`No managers available for duty: ${duty} on ${dateStr}`);
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

  const openAvailabilityDialog = (manager: Manager) => {
    setSelectedManager(manager);
    setSelectedDates([]);
    setAvailabilityType("available");
    setAvailabilityNotes("");
    setShowAvailabilityDialog(true);
  };

  const handleSetAvailability = async () => {
    if (!selectedManager || selectedDates.length === 0) return;

    try {
      // Save all selected dates
      for (const date of selectedDates) {
        const dateStr = date.toISOString().split("T")[0];
        await setManagerAvailability(
          selectedManager.id,
          dateStr,
          availabilityType,
          availabilityNotes
        );
      }
      
      addNotification({
        staffName: "System",
        message: `Updated ${selectedManager.name}'s availability for ${selectedDates.length} day${selectedDates.length > 1 ? 's' : ''}`,
        type: "info",
      });
      
      setShowAvailabilityDialog(false);
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

  const getAvailabilityForManagerDate = (managerId: string, dateStr: string): AvailabilityType => {
    const key = `${managerId}-${dateStr}`;
    return availabilityMap[key]?.type || "available";
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
                  const dayAssignments = assignments.filter(
                    a => a.duty === duty && a.date === dateStr
                  );
                  return `
                    <td>
                      ${dayAssignments.map(a => `<span class="manager-name">${a.managerName}</span>`).join('')}
                      ${dayAssignments.length === 0 ? '—' : ''}
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
                          onClick={() => openAvailabilityDialog(manager)}
                          className="rounded-lg text-accent hover:bg-accent/10"
                        >
                          <Calendar className="h-4 w-4" />
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

              <div>
                <Label className="font-mono text-xs mb-3 block">Recurring Rest Days (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Select days that this manager is always off every week
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {DAYS.map((day, index) => {
                    const isSelected = managerForm.recurring_rest_days.includes(index);
                    return (
                      <button
                        key={index}
                        type="button"
                        onClick={() => {
                          const current = managerForm.recurring_rest_days;
                          const updated = isSelected
                            ? current.filter(d => d !== index)
                            : [...current, index].sort();
                          setManagerForm({ ...managerForm, recurring_rest_days: updated });
                        }}
                        className={`p-2 text-xs font-mono rounded-lg border-2 transition-all ${
                          isSelected
                            ? "bg-blue-500/20 text-blue-700 border-blue-500"
                            : "bg-muted/50 border-border hover:bg-muted"
                        }`}
                      >
                        {day}
                      </button>
                    );
                  })}
                </div>
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

        {/* Availability Dialog */}
        <Dialog open={showAvailabilityDialog} onOpenChange={setShowAvailabilityDialog}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle className="font-condensed text-lg">
                Set Availability: {selectedManager?.name}
              </DialogTitle>
              <DialogDescription className="font-mono text-xs">
                Select dates and mark status
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label className="font-mono text-xs mb-2 block">Select Date(s)</Label>
                <div className="border rounded-lg bg-background p-2">
                  <Calendar
                    mode="multiple"
                    selected={selectedDates}
                    onSelect={(dates) => setSelectedDates(dates || [])}
                    className="w-full"
                    classNames={{
                      months: "flex flex-col",
                      month: "space-y-2",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-sm font-medium",
                      nav: "space-x-1 flex items-center",
                      nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                      nav_button_previous: "absolute left-1",
                      nav_button_next: "absolute right-1",
                      table: "w-full border-collapse",
                      head_row: "flex",
                      head_cell: "text-muted-foreground rounded-md w-8 font-normal text-[0.7rem]",
                      row: "flex w-full mt-1",
                      cell: "h-8 w-8 text-center text-sm p-0 relative",
                      day: "h-8 w-8 p-0 font-normal text-sm hover:bg-accent hover:text-accent-foreground rounded-md",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                      day_today: "bg-accent text-accent-foreground font-semibold",
                      day_outside: "text-muted-foreground opacity-30",
                      day_disabled: "text-muted-foreground opacity-30",
                      day_hidden: "invisible",
                    }}
                  />
                </div>
                {selectedDates.length > 0 && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    {selectedDates.length} day{selectedDates.length > 1 ? 's' : ''} selected
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="availability-type" className="font-mono text-xs">
                  Status
                </Label>
                <Select
                  value={availabilityType}
                  onValueChange={(value) => setAvailabilityType(value as AvailabilityType)}
                >
                  <SelectTrigger className="font-mono mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">Available</SelectItem>
                    <SelectItem value="rest">Rest Day</SelectItem>
                    <SelectItem value="holiday">Holiday</SelectItem>
                    <SelectItem value="sick">Sick Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="notes" className="font-mono text-xs">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={availabilityNotes}
                  onChange={(e) => setAvailabilityNotes(e.target.value)}
                  placeholder="Add notes..."
                  className="font-mono mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAvailabilityDialog(false)}
                className="rounded-lg"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button 
                onClick={handleSetAvailability} 
                className="rounded-lg gap-2"
                disabled={selectedDates.length === 0}
              >
                <Check className="h-4 w-4" />
                Save
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Rota Table */}
        {assignments.length > 0 && (
          <Card className="shadow-sm hover:shadow-md transition-smooth">
            <CardHeader>
              <CardTitle className="font-condensed text-xl">
                Manager Duties Rota
              </CardTitle>
              <CardDescription className="font-mono text-xs">
                Weekly manager assignments
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
                          
                          // Get all assignments for this duty on this date
                          const dayAssignments = assignments.filter(
                            a => a.duty === duty && a.date === dateStr
                          );
                          
                          const dutyColorClass = getDutyColor(duty);
                          
                          return (
                            <td key={dayIdx} className="p-4 text-center align-top">
                              {dayAssignments.length > 0 ? (
                                <div className="space-y-1">
                                  {dayAssignments.map((assignment, idx) => {
                                    const availabilityStatus = getAvailabilityForManagerDate(assignment.managerId, dateStr);
                                    
                                    return availabilityStatus && availabilityStatus !== "available" ? (
                                      <div
                                        key={idx}
                                        className={`text-xs font-mono px-4 py-2.5 rounded-lg transition-all w-full shadow-sm border-2 ${
                                          availabilityStatus === "rest"
                                            ? "bg-blue-500/10 text-blue-700 border-blue-500"
                                            : availabilityStatus === "holiday"
                                            ? "bg-green-500/10 text-green-700 border-green-500"
                                            : "bg-red-500/10 text-red-700 border-red-500"
                                        }`}
                                      >
                                        <div className="font-semibold">{assignment.managerName}</div>
                                        <div className="text-[10px] uppercase tracking-wide mt-1 opacity-80">
                                          {availabilityStatus}
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        key={idx}
                                        className={`text-xs font-mono px-4 py-2.5 rounded-lg transition-all w-full shadow-sm border-2 ${dutyColorClass}`}
                                      >
                                        <span className="font-semibold">{assignment.managerName}</span>
                                      </div>
                                    );
                                  })}
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
    </Layout>
  );
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day;
  return new Date(d.setDate(diff));
}