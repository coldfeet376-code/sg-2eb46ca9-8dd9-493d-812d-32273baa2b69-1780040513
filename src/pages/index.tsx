import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SEO } from "@/components/SEO";
import { generateWeeklyRota, getWeekStart, navigateWeek, getYearWeeks } from "@/lib/rotaGenerator";
import { useNotifications } from "@/contexts/NotificationContext";
import { useStaff, useTaskConfig } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Assignment, Task, ShiftStart } from "@/types";
import { RefreshCw, Download, Lock, Unlock, ChevronLeft, ChevronRight, AlertCircle, History, RotateCcw } from "lucide-react";

// Dynamic import for OnboardingTour to prevent SSR hydration issues
const OnboardingTour = dynamic(
  () => import("@/components/OnboardingTour").then(mod => mod.OnboardingTour),
  { ssr: false }
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

interface RotaSnapshot {
  id: string;
  timestamp: number;
  weekStart: string;
  assignments: Assignment[];
  lockedAssignments: Assignment[];
}

interface CoverageGap {
  task: string;
  date: string;
  required: number;
  available: number;
  gap: number;
}

interface TaskConfig {
  [task: string]: number[];
}

export default function Home() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [viewMode, setViewMode] = useState<"week" | "year">("week");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [yearRotas, setYearRotas] = useState<Map<string, Assignment[]>>(new Map());
  const [lockedAssignments, setLockedAssignments] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<RotaSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);
  const [showUnavailableStaff, setShowUnavailableStaff] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const { addNotification } = useNotifications();

  // React Query hooks - cached data
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const { data: taskConfig, isLoading: configLoading } = useTaskConfig();

  useEffect(() => {
    // Load locked assignments and history from localStorage
    const savedLocked = localStorage.getItem("warehouse-locked-assignments");
    const savedHistory = localStorage.getItem("warehouse-rota-history");
    
    if (savedLocked) {
      const parsed = JSON.parse(savedLocked);
      setLockedAssignments(parsed);
    }
    if (savedHistory) {
      const parsed = JSON.parse(savedHistory);
      setHistory(parsed);
    }
  }, []);

  const loadStaff = async () => {
    try {
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("name");

      if (staffError) {
        console.error("Error fetching staff:", staffError);
        return;
      }

      const { data: availabilityData, error: availError } = await supabase
        .from("availability")
        .select("*");

      if (availError) {
        console.error("Error fetching availability:", availError);
        return;
      }

      const staffMembers: StaffMember[] = (staffData || []).map((s) => ({
        id: s.id,
        name: s.name,
        trainedTasks: (s.trained_tasks || []) as Task[],
        shiftStart: (s.shift_start || "06:00") as ShiftStart,
        availability: (availabilityData || [])
          .filter((a) => a.staff_id === s.id)
          .map((a) => ({
            date: a.date,
            type: a.type as "rest" | "holiday" | "sick" | "available",
            notes: a.notes || undefined,
          })),
      }));

      setStaff(staffMembers);
    } catch (error) {
      console.error("Error loading staff:", error);
    }
  };

  const loadTaskConfig = async () => {
    try {
      const { data, error } = await supabase
        .from("task_config")
        .select("*");

      if (error) {
        console.error("Error fetching task config:", error);
        return;
      }

      if (data && data.length > 0) {
        const config: TaskConfig = {};
        data.forEach((row) => {
          config[row.task] = [
            row.sunday,
            row.monday,
            row.tuesday,
            row.wednesday,
            row.thursday,
            row.friday,
            row.saturday,
          ];
        });
        setTaskConfig(config);
      }
    } catch (error) {
      console.error("Error loading task config:", error);
    }
  };

  useEffect(() => {
    // Save locked assignments
    localStorage.setItem("warehouse-locked-assignments", JSON.stringify(lockedAssignments));
  }, [lockedAssignments]);

  useEffect(() => {
    // Save history
    localStorage.setItem("warehouse-rota-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    // Generate rota when data is available
    if (staff.length > 0 && taskConfig && !staffLoading && !configLoading) {
      if (viewMode === "week") {
        generateRota();
      } else {
        generateYearRota();
      }
    }
  }, [staff, taskConfig, weekStart, viewMode, selectedYear, staffLoading, configLoading]);

  const checkCoverageGaps = (): CoverageGap[] => {
    if (!staff.length || !taskConfig) return [];

    const gaps: CoverageGap[] = [];

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(weekStart.getDate() + dayOffset);
      const dateStr = currentDate.toISOString().split("T")[0];

      TASKS.forEach((task) => {
        const required = taskConfig[task]?.[dayOffset] || 0;
        if (required === 0) return;

        // Count available staff for this task on this date
        const availableStaff = staff.filter((s) => {
          // Must be trained
          if (!s.trainedTasks.includes(task as Task)) return false;

          // Check availability
          if (s.availability) {
            const entry = s.availability.find((a) => a.date === dateStr);
            if (entry && entry.type !== "available") return false;
          }

          // Check regular rest days
          const dayOfWeek = currentDate.getDay();
          if (s.restDays?.some(d => Number(d) === dayOfWeek)) return false;

          return true;
        }).length;

        // Count locked assignments for this task/date
        const lockedCount = lockedAssignments.filter(
          (a) => a.task === task && a.date === dateStr
        ).length;

        const effectiveAvailable = Math.max(0, availableStaff - lockedCount);

        if (effectiveAvailable < required) {
          gaps.push({
            task,
            date: dateStr,
            required,
            available: effectiveAvailable,
            gap: required - effectiveAvailable,
          });
        }
      });
    }

    return gaps;
  };

  const saveSnapshot = (newAssignments: Assignment[]) => {
    const snapshot: RotaSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      weekStart: weekStart.toISOString(),
      assignments: newAssignments,
      lockedAssignments: [...lockedAssignments],
    };

    // Keep only last 50 snapshots to prevent storage bloat
    const updatedHistory = [snapshot, ...history].slice(0, 50);
    setHistory(updatedHistory);
  };

  const generateRota = () => {
    if (!staff.length || !taskConfig) return;

    // Check for coverage gaps first
    const gaps = checkCoverageGaps();

    // Always generate the rota
    const newAssignments = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
      lockedAssignments,
    });
    
    setAssignments(newAssignments);
    saveSnapshot(newAssignments);

    // Show coverage gap warning as notification if gaps exist
    if (gaps.length > 0) {
      setCoverageGaps(gaps);
      setShowCoverageWarning(true);
      addNotification({
        staffName: "System",
        message: `Rota generated with ${gaps.length} coverage gap(s) - review warnings`,
        type: "info",
      });
    } else {
      // Generate notifications for each staff member when no gaps
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
      
      addNotification({
        staffName: "System",
        message: "Rota generated successfully",
        type: "info",
      });
    }
  };

  const forceGenerateRota = () => {
    setShowCoverageWarning(false);
    
    const newAssignments = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
      lockedAssignments,
    });
    setAssignments(newAssignments);
    saveSnapshot(newAssignments);

    addNotification({
      staffName: "System",
      message: `Rota generated with ${coverageGaps.length} coverage gap(s)`,
      type: "info",
    });
  };

  const restoreSnapshot = (snapshot: RotaSnapshot) => {
    setAssignments(snapshot.assignments);
    setLockedAssignments(snapshot.lockedAssignments);
    setWeekStart(new Date(snapshot.weekStart));
    setHistoryOpen(false);
    
    addNotification({
      staffName: "System",
      message: `Restored rota from ${new Date(snapshot.timestamp).toLocaleString()}`,
      type: "info",
    });
  };

  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}d ago`;
    }
    
    // Full date
    return date.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getCurrentWeekHistory = (): RotaSnapshot[] => {
    const weekStartStr = weekStart.toISOString();
    return history.filter(h => h.weekStart === weekStartStr);
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
    
    const existingLockIndex = lockedAssignments.findIndex(
      lock => lock.task === task && lock.date === dateStr && lock.staffName === staffName
    );

    if (existingLockIndex >= 0) {
      // Unlock
      setLockedAssignments(lockedAssignments.filter((_, i) => i !== existingLockIndex));
    } else {
      // Lock - Find staff ID for the assignment
      const staffMember = staff.find(s => s.name === staffName);
      setLockedAssignments([...lockedAssignments, { 
        task: task as Task, 
        date: dateStr, 
        staffName,
        staffId: staffMember?.id || `temp-${Date.now()}`
      }]);
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
    setShowUnlockConfirm(false);
  };

  const exportPDF = () => {
    if (viewMode === "week") {
      exportWeekPDF();
    } else {
      exportYearPDF();
    }
  };

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    
    if (viewMode === "week") {
      csvContent += "Task," + weekDates.map(d => `${DAYS[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`).join(",") + "\n";
      
      TASKS.forEach(task => {
        let row = task;
        weekDates.forEach((_, dayIdx) => {
          const dayAssignments = getAssignmentsForTaskAndDay(task, dayIdx);
          const staffNames = dayAssignments.map(a => a.staffName).join(" & ");
          row += `,"${staffNames || ''}"`;
        });
        csvContent += row + "\n";
      });
    } else {
      const weeks = getYearWeeks(selectedYear);
      csvContent += "Week Starting,Task," + DAYS.join(",") + "\n";
      
      weeks.forEach(weekStartDate => {
        const weekKey = weekStartDate.toISOString();
        const weekAssignments = yearRotas.get(weekKey) || [];
        const weekDatesLocal = DAYS.map((_, i) => {
          const date = new Date(weekStartDate);
          date.setDate(weekStartDate.getDate() + i);
          return date;
        });
        
        TASKS.forEach(task => {
          let row = `${weekDatesLocal[0].toLocaleDateString()},${task}`;
          DAYS.forEach((_, dayIdx) => {
            const date = weekDatesLocal[dayIdx];
            const dateStr = date.toISOString().split("T")[0];
            const dayAssignments = weekAssignments.filter(a => a.task === task && a.date === dateStr);
            const staffNames = dayAssignments.map(a => a.staffName).join(" & ");
            row += `,"${staffNames || ''}"`;
          });
          csvContent += row + "\n";
        });
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warehouse_rota_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    addNotification({
      staffName: "System",
      message: "CSV exported successfully",
      type: "info",
    });
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

  const getStaffAvailability = (staffName: string, dateIndex: number): { type: string; color: string; label: string } | null => {
    const staffMember = staff.find(s => s.name === staffName);
    if (!staffMember) return null;

    const date = weekDates[dateIndex];
    const dateStr = date.toISOString().split("T")[0];
    
    const availability = staffMember.availability?.find(a => a.date === dateStr);
    
    if (!availability) return { type: 'available', color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' };
    
    switch (availability.type) {
      case 'rest':
        return { type: 'rest', color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Rest Day' };
      case 'sick':
        return { type: 'sick', color: 'bg-red-50 text-red-700 border-red-200', label: 'Sick' };
      case 'holiday':
        return { type: 'holiday', color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Holiday' };
      case 'available':
        return { type: 'available', color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' };
      default:
        return null;
    }
  };

  const getAllUnavailableStaff = (task: string, dateIndex: number): { name: string; reason: string; color: string }[] => {
    const date = weekDates[dateIndex];
    const dateStr = date.toISOString().split("T")[0];
    
    return staff
      .filter(s => {
        // Must be trained for the task
        if (!s.trainedTasks.includes(task as Task)) return false;
        
        // Must have unavailability
        const availability = s.availability?.find(a => a.date === dateStr);
        return availability && availability.type !== 'available';
      })
      .map(s => {
        const availability = s.availability?.find(a => a.date === dateStr);
        const status = getStaffAvailability(s.name, dateIndex);
        return {
          name: s.name,
          reason: status?.label || 'Unavailable',
          color: status?.color || 'bg-gray-50 text-gray-700 border-gray-200'
        };
      });
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

  const handlePrint = () => {
    window.print();
  };

  return (
    <Layout>
      <OnboardingTour />
      <SEO
        title="Warehouse Rota System"
        description="Fair distribution work rotation system for warehouse operations"
      />
      
      <div className="space-y-6">
        {/* Coverage Warning Modal */}
        {showCoverageWarning && coverageGaps.length > 0 && (
          <Alert className="bg-warning/10 border-warning">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-warning mb-2">
                Coverage Gaps Detected
              </h3>
              <p className="text-sm text-warning/90 mb-3">
                {coverageGaps.length} instance(s) where staff availability is insufficient for task requirements:
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {coverageGaps.map((gap, idx) => (
                  <div key={idx} className="text-xs font-mono bg-warning/5 p-2 rounded border border-warning/20">
                    <span className="font-semibold">{gap.task}</span> on{" "}
                    {new Date(gap.date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "short",
                    })}
                    : Need <span className="font-semibold">{gap.required}</span>, only{" "}
                    <span className="font-semibold">{gap.available}</span> available (
                    <span className="text-warning font-semibold">-{gap.gap}</span> gap)
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCoverageWarning(false)}
                  className="rounded-lg"
                >
                  Dismiss
                </Button>
              </div>
            </div>
          </Alert>
        )}

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
                <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                  <SheetTrigger asChild>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-2 rounded-lg"
                    >
                      <History className="h-4 w-4" />
                      <span className="font-mono text-xs">History</span>
                      {getCurrentWeekHistory().length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                          {getCurrentWeekHistory().length}
                        </Badge>
                      )}
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-[400px] sm:w-[540px]">
                    <SheetHeader>
                      <SheetTitle className="font-condensed">Rota History</SheetTitle>
                      <SheetDescription className="font-mono text-xs">
                        Browse and restore previous versions for this week
                      </SheetDescription>
                    </SheetHeader>
                    <ScrollArea className="h-[calc(100vh-120px)] mt-6">
                      <div className="space-y-3">
                        {getCurrentWeekHistory().length === 0 ? (
                          <div className="text-center py-12 text-muted-foreground">
                            <History className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p className="text-sm font-mono">No history for this week</p>
                          </div>
                        ) : (
                          getCurrentWeekHistory().map((snapshot, index) => (
                            <Card 
                              key={snapshot.id} 
                              className="shadow-sm hover:shadow-md transition-smooth cursor-pointer"
                              onClick={() => restoreSnapshot(snapshot)}
                            >
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <RotateCcw className="h-4 w-4 text-muted-foreground" />
                                    <CardTitle className="font-mono text-sm">
                                      {formatTimestamp(snapshot.timestamp)}
                                    </CardTitle>
                                  </div>
                                  {index === 0 && (
                                    <Badge variant="default" className="font-mono text-[10px]">
                                      Current
                                    </Badge>
                                  )}
                                </div>
                                <CardDescription className="font-mono text-xs mt-1">
                                  {snapshot.assignments.length} assignments
                                  {snapshot.lockedAssignments.length > 0 && (
                                    <span className="text-warning ml-2">
                                      · {snapshot.lockedAssignments.length} locked
                                    </span>
                                  )}
                                </CardDescription>
                              </CardHeader>
                              <CardContent className="pt-0">
                                <div className="text-xs font-mono text-muted-foreground">
                                  <div className="flex flex-wrap gap-1">
                                    {TASKS.map(task => {
                                      const count = snapshot.assignments.filter(a => a.task === task).length;
                                      if (count === 0) return null;
                                      return (
                                        <Badge 
                                          key={task} 
                                          variant="outline" 
                                          className="text-[10px] font-mono"
                                        >
                                          {task}: {count}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </SheetContent>
                </Sheet>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={generateRota}
                  disabled={!staff.length || !taskConfig || staffLoading || configLoading}
                  className="gap-2 ml-2 rounded-lg"
                  data-tour="generate-button"
                >
                  <RefreshCw className={`h-4 w-4 ${staffLoading || configLoading ? 'animate-spin' : ''}`} />
                  <span className="font-mono text-xs">
                    {staffLoading || configLoading ? "Loading..." : "Generate Rota"}
                  </span>
                </Button>
                {lockedAssignments.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowUnlockConfirm(true)}
                    className="gap-2 rounded-lg text-warning hover:text-warning"
                  >
                    <Unlock className="h-4 w-4" />
                    <span className="font-mono text-xs">Unlock All ({getLockedCount()})</span>
                  </Button>
                )}
              </>
            )}
            
            <div className="flex gap-2">
              <Button 
                variant="default" 
                size="sm" 
                className="gap-2 rounded-lg shadow-sm hover:shadow-md transition-smooth hidden sm:flex"
                onClick={exportPDF}
                disabled={staff.length === 0 || !taskConfig}
              >
                <Download className="h-4 w-4" />
                <span className="font-mono text-xs">PDF</span>
              </Button>
              
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 rounded-lg shadow-sm hover:shadow-md transition-smooth hidden sm:flex"
                onClick={exportCSV}
                disabled={staff.length === 0 || !taskConfig}
              >
                <Download className="h-4 w-4" />
                <span className="font-mono text-xs">CSV</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Unlock All Confirmation */}
        {showUnlockConfirm && (
          <Alert className="bg-warning/10 border-warning">
            <AlertCircle className="h-5 w-5 text-warning" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-warning mb-2">
                Unlock All Assignments?
              </h3>
              <p className="text-sm text-warning/90 mb-3">
                This will remove all {getLockedCount()} locked assignments. They will be reassigned when you regenerate the rota.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={unlockAll}
                  className="rounded-lg text-warning hover:text-warning"
                >
                  Confirm Unlock
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUnlockConfirm(false)}
                  className="rounded-lg"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </Alert>
        )}

        {/* Print-only header */}
        <div className="hidden print:block mb-4">
          <h1 className="font-condensed text-2xl font-bold">
            WAREHOUSE ROTA
          </h1>
          <p className="font-mono text-sm mt-1">
            {viewMode === "week" ? (
              `Week: ${weekDates[0].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })} - ${weekDates[6].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })}`
            ) : (
              `Year ${selectedYear} - ${getYearWeeks(selectedYear).length} weeks`
            )}
          </p>
          <p className="font-mono text-xs text-gray-600 mt-1">
            Printed: {new Date().toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {viewMode === "week" ? (
          <>
            <Card className="shadow-sm hover:shadow-md transition-smooth page-break-inside-avoid" data-tour="rota-table">
              <CardHeader className="no-print">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="font-condensed text-xl">Current Week Schedule</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        Click assignments to lock/unlock them during regeneration
                      </CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowUnavailableStaff(!showUnavailableStaff)}
                      className="gap-2 rounded-lg font-mono text-xs shrink-0"
                    >
                      {showUnavailableStaff ? "Hide" : "Show"} Unavailable
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span>Rest Day</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span>Holiday</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span>Sick</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-warning" />
                      <span>Locked</span>
                    </div>
                  </div>
                </div>
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
                            const unavailableStaff = getAllUnavailableStaff(task, dayIdx);
                            return (
                              <td 
                                key={dayIdx} 
                                className="p-3 text-center align-top"
                              >
                                <div className="space-y-1.5">
                                  {/* Assigned staff */}
                                  {dayAssignments.length > 0 && dayAssignments.map((assignment, idx) => {
                                    const locked = isAssignmentLocked(task, dayIdx, assignment.staffName);
                                    const availability = getStaffAvailability(assignment.staffName, dayIdx);
                                    return (
                                      <button
                                        key={idx}
                                        onClick={() => toggleLockAssignment(task, dayIdx, assignment.staffName)}
                                        className={`text-xs font-mono px-3 py-1.5 rounded-lg transition-smooth cursor-pointer group relative no-print w-full ${
                                          locked 
                                            ? 'bg-warning/20 text-warning-foreground border-2 border-warning hover:bg-warning/30 locked-assignment' 
                                            : 'bg-primary/10 text-primary hover:bg-primary/20 border-2 border-transparent hover:border-primary/30'
                                        }`}
                                      >
                                        <div className="flex flex-col items-center gap-0.5">
                                          <span className="flex items-center gap-1.5">
                                            {locked ? (
                                              <Lock className="h-3 w-3 no-print" />
                                            ) : (
                                              <Unlock className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity no-print" />
                                            )}
                                            {assignment.staffName}
                                          </span>
                                          {availability && availability.type !== 'available' && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded border ${availability.color}`}>
                                              {availability.label}
                                            </span>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                  
                                  {/* Unavailable staff (grayed out) */}
                                  {showUnavailableStaff && unavailableStaff.map((unavailable, idx) => (
                                    <div
                                      key={`unavail-${idx}`}
                                      className="text-xs font-mono px-3 py-1.5 rounded-lg opacity-40 no-print"
                                      title={`${unavailable.name} - ${unavailable.reason}`}
                                    >
                                      <div className="flex flex-col items-center gap-0.5">
                                        <span className="line-through text-muted-foreground">
                                          {unavailable.name}
                                        </span>
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded border ${unavailable.color}`}>
                                          {unavailable.reason}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                  
                                  {/* Empty state */}
                                  {dayAssignments.length === 0 && unavailableStaff.length === 0 && (
                                    <div className="text-xs font-mono text-muted-foreground">
                                      —
                                    </div>
                                  )}
                                  
                                  {/* Print-only version */}
                                  <div className="hidden print:block space-y-1">
                                    {dayAssignments.map((assignment, idx) => {
                                      const locked = isAssignmentLocked(task, dayIdx, assignment.staffName);
                                      const availability = getStaffAvailability(assignment.staffName, dayIdx);
                                      return (
                                        <div key={idx} className={locked ? 'locked-assignment' : ''}>
                                          {assignment.staffName}
                                          {availability && availability.type !== 'available' && ` (${availability.label})`}
                                          {locked ? ' 🔒' : ''}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
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

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 no-print">
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
          <div className="bg-warning/10 border border-warning rounded-lg p-4 shadow-sm no-print">
            <p className="text-sm font-mono text-warning-foreground">
              No staff members configured. Visit the <Link href="/staff" className="underline font-semibold hover:text-warning transition-smooth">Staff page</Link> to add employees.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}