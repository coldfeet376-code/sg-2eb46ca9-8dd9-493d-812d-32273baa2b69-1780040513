"use client";

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
import { calculateFairnessMetrics } from "@/lib/fairnessCalculator";
import { rotaService } from "@/services/rotaService";
import { useNotifications } from "@/contexts/NotificationContext";
import { useStaff, useTaskConfig } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Assignment, Task, ShiftStart, FairnessMetrics, AvailabilityType } from "@/types";
import { RefreshCw, Download, Lock, Unlock, ChevronLeft, ChevronRight, AlertCircle, History, RotateCcw, Zap, TrendingUp } from "lucide-react";
import { RotaWeekNavigator } from "@/components/rota/RotaWeekNavigator";

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
  const [lockedAssignments, setLockedAssignments] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<RotaSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);
  const [showUnavailableStaff, setShowUnavailableStaff] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [fairnessMetrics, setFairnessMetrics] = useState<FairnessMetrics | null>(null);
  const { addNotification } = useNotifications();

  // React Query hooks - cached data with error handling
  const { data: staff = [], isLoading: staffLoading, error: staffError } = useStaff();
  const { data: taskConfig, isLoading: configLoading, error: configError } = useTaskConfig();

  // Debug logging
  useEffect(() => {
    console.log("Staff Query State:", { 
      staff, 
      staffCount: staff.length, 
      staffLoading, 
      staffError: staffError?.message 
    });
  }, [staff, staffLoading, staffError]);

  useEffect(() => {
    console.log("Task Config Query State:", { 
      taskConfig, 
      configLoading, 
      configError: configError?.message 
    });
  }, [taskConfig, configLoading, configError]);

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

  useEffect(() => {
    // Load saved assignments for the current week
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
    // Save assignments whenever they change
    localStorage.setItem("warehouse-assignments", JSON.stringify(assignments));
  }, [assignments]);

  useEffect(() => {
    // Save locked assignments
    localStorage.setItem("warehouse-locked-assignments", JSON.stringify(lockedAssignments));
  }, [lockedAssignments]);

  useEffect(() => {
    // Save history
    localStorage.setItem("warehouse-rota-history", JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    // Calculate fairness metrics when assignments change
    if (assignments.length > 0 && staff.length > 0) {
      const metrics = calculateFairnessMetrics(assignments, staff);
      setFairnessMetrics(metrics);
    } else {
      setFairnessMetrics(null);
    }
  }, [assignments, staff]);

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

  const generateRota = async () => {
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

    // Create automatic backup
    try {
      await rotaService.createBackup(
        weekStart.toISOString().split("T")[0],
        newAssignments,
        lockedAssignments
      );
      console.log("Automatic backup created successfully");
    } catch (error) {
      console.error("Failed to create automatic backup:", error);
    }

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
        message: "Rota generated successfully with automatic backup",
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

  const lockAll = () => {
    // Lock all current week assignments
    const allLocks: Assignment[] = assignments.map(a => ({
      ...a,
      staffId: a.staffId || staff.find(s => s.name === a.staffName)?.id || `temp-${Date.now()}`
    }));
    
    setLockedAssignments(allLocks);
    addNotification({
      staffName: "System",
      message: `Locked all ${allLocks.length} assignments for this week`,
      type: "info",
    });
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

  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
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

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `warehouse_rota_week_${new Date().toISOString().split('T')[0]}.csv`);
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

  const handlePrint = () => {
    window.print();
  };

  const getTaskColor = (task: string): string => {
    const colorMap: Record<string, string> = {
      "Frozen": "bg-task-frozen text-task-frozen-foreground border-task-frozen",
      "Milk": "bg-task-milk text-task-milk-foreground border-task-milk",
      "TWI": "bg-task-twi text-task-twi-foreground border-task-twi",
      "Inbound": "bg-task-inbound text-task-inbound-foreground border-task-inbound",
      "Outbound": "bg-task-outbound text-task-outbound-foreground border-task-outbound",
      "Marshaling": "bg-task-marshaling text-task-marshaling-foreground border-task-marshaling"
    };
    return colorMap[task] || "bg-primary text-primary-foreground border-primary";
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
            {/* Generate Rota Button - Prominent position */}
            {staff.length > 0 && taskConfig && (
              <Button
                onClick={generateRota}
                size="lg"
                className="gap-2 rounded-lg shadow-md hover:shadow-lg transition-all font-condensed text-base bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Zap className="h-5 w-5" />
                <span>Generate Rota</span>
              </Button>
            )}

            <RotaWeekNavigator
              weekStart={weekStart}
              onPreviousWeek={() => {
                const prevWeek = new Date(weekStart);
                prevWeek.setDate(prevWeek.getDate() - 7);
                setWeekStart(prevWeek);
              }}
              onNextWeek={() => {
                const nextWeek = new Date(weekStart);
                nextWeek.setDate(nextWeek.getDate() + 7);
                setWeekStart(nextWeek);
              }}
              onTodayClick={() => {
                const today = new Date();
                const day = today.getDay();
                const diff = day === 0 ? 0 : 7 - day;
                const saturday = new Date(today);
                saturday.setDate(today.getDate() + diff);
                saturday.setHours(0, 0, 0, 0);
                setWeekStart(saturday);
              }}
            />

            {assignments.length > 0 && (
              <>
                {lockedAssignments.length < assignments.length && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={lockAll}
                    className="gap-2 rounded-lg text-primary hover:text-primary"
                  >
                    <Lock className="h-4 w-4" />
                    <span className="font-mono text-xs">Lock All</span>
                  </Button>
                )}
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
            Week: {weekDates[0].toLocaleDateString("en-GB", { 
              day: "2-digit", 
              month: "short", 
              year: "numeric" 
            })} - {weekDates[6].toLocaleDateString("en-GB", { 
              day: "2-digit", 
              month: "short", 
              year: "numeric" 
            })}
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowUnavailableStaff(!showUnavailableStaff)}
                    className="gap-2 rounded-lg font-mono text-xs shrink-0"
                  >
                    {showUnavailableStaff ? "Hide" : "Show"} Unavailable
                  </Button>
                </div>
              </div>
              
              {/* Task Color Legend */}
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground font-semibold">Task Types:</span>
                {TASKS.map(task => (
                  <div key={task} className="flex items-center gap-1">
                    <div className={`w-4 h-4 rounded ${getTaskColor(task)}`}></div>
                    <span>{task}</span>
                  </div>
                ))}
              </div>
              
              <div className="flex flex-wrap gap-2 text-[10px] font-mono">
                <span className="text-muted-foreground font-semibold">Status:</span>
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
                      <td className="p-4 font-condensed text-sm font-semibold bg-muted/30">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${getTaskColor(task)}`}></div>
                          {task}
                        </div>
                      </td>
                      {DAYS.map((_, dayIdx) => {
                        const dayAssignments = getAssignmentsForTaskAndDay(task, dayIdx);
                        const unavailableStaff = getAllUnavailableStaff(task, dayIdx);
                        return (
                          <td 
                            key={dayIdx} 
                            className="p-4 text-center align-top"
                          >
                            <div className="space-y-2">
                              {/* Assigned staff */}
                              {dayAssignments.length > 0 && dayAssignments.map((assignment, idx) => {
                                const locked = isAssignmentLocked(task, dayIdx, assignment.staffName);
                                const availability = getStaffAvailability(assignment.staffName, dayIdx);
                                const taskColorClass = getTaskColor(task);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => toggleLockAssignment(task, dayIdx, assignment.staffName)}
                                    className={`text-xs font-mono px-4 py-2.5 rounded-lg transition-all cursor-pointer group relative no-print w-full shadow-sm hover:shadow-md border-2 ${
                                      locked 
                                        ? 'bg-warning/20 text-warning-foreground border-warning hover:bg-warning/30 hover:scale-105 locked-assignment' 
                                        : `${taskColorClass} hover:scale-105 hover:shadow-lg`
                                    }`}
                                  >
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="flex items-center gap-2 font-semibold">
                                        {locked ? (
                                          <Lock className="h-3.5 w-3.5 no-print" />
                                        ) : (
                                          <Unlock className="h-3.5 w-3.5 opacity-0 group-hover:opacity-60 transition-opacity no-print" />
                                        )}
                                        {assignment.staffName}
                                      </span>
                                      {availability && availability.type !== 'available' && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-md border font-medium ${availability.color}`}>
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
                                  className="text-xs font-mono px-4 py-2.5 rounded-lg opacity-50 no-print border-2 border-dashed border-muted-foreground/20 bg-muted/20"
                                  title={`${unavailable.name} - ${unavailable.reason}`}
                                >
                                  <div className="flex flex-col items-center gap-1">
                                    <span className="line-through text-muted-foreground font-medium">
                                      {unavailable.name}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md border ${unavailable.color}`}>
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
              <CardTitle className="font-condensed text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Fairness Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`font-mono text-3xl font-bold tabular-nums ${
                !fairnessMetrics ? "text-muted-foreground" :
                fairnessMetrics.overallScore >= 90 ? "text-success" : 
                fairnessMetrics.overallScore >= 70 ? "text-primary" : "text-warning"
              }`}>
                {fairnessMetrics ? fairnessMetrics.overallScore : "—"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {fairnessMetrics ? "Even distribution" : "Generate rota first"}
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

        {staff.length === 0 && !staffLoading && !staffError && (
          <div className="bg-warning/10 border border-warning rounded-lg p-4 shadow-sm no-print">
            <p className="text-sm font-mono text-warning-foreground">
              No staff members configured. Visit the <Link href="/staff" className="underline font-semibold hover:text-warning transition-smooth">Staff page</Link> to add employees.
            </p>
          </div>
        )}

        {!taskConfig && !configLoading && !configError && staff.length > 0 && (
          <div className="bg-warning/10 border border-warning rounded-lg p-4 shadow-sm no-print">
            <p className="text-sm font-mono text-warning-foreground">
              No task configuration found. Visit the <Link href="/config" className="underline font-semibold hover:text-warning transition-smooth">Config page</Link> to set up daily task requirements.
            </p>
          </div>
        )}

        {staffError && (
          <Alert className="bg-destructive/10 border-destructive no-print">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-destructive mb-2">
                Staff Data Error
              </h3>
              <p className="text-sm text-destructive/90 font-mono">
                {staffError.message}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Check browser console for details
              </p>
            </div>
          </Alert>
        )}

        {configError && (
          <Alert className="bg-destructive/10 border-destructive no-print">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-destructive mb-2">
                Configuration Error
              </h3>
              <p className="text-sm text-destructive/90 font-mono">
                {configError.message}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Check browser console for details
              </p>
            </div>
          </Alert>
        )}
      </div>
    </Layout>
  );
}