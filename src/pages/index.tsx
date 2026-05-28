import { useState, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Layout } from "@/components/Layout";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { generateWeeklyRota, getWeekStart, navigateWeek, getYearWeeks } from "@/lib/rotaGenerator";
import { calculateFairnessMetrics } from "@/lib/fairnessCalculator";
import { generateStaffRotaPDF } from "@/lib/pdfGenerator";
import { rotaService } from "@/services/rotaService";
import { staffService } from "@/services/staffService";
import { rotaRealtimeService, type StoredRota } from "@/services/rotaRealtimeService";
import { useNotifications } from "@/contexts/NotificationContext";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useStaff, useTaskConfig, useUpdateTaskConfig } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Assignment, Task, ShiftStart, FairnessMetrics, AvailabilityType } from "@/types";
import { Info, Calendar, Download, Eye, RefreshCw, Lock, Unlock, Shuffle, TrendingUp, Users, Target, Settings, HelpCircle, AlertCircle, Zap, History, RotateCcw, Printer, Bug, Sparkles, Wand2, ArrowRight, ArrowLeftRight } from "lucide-react";
import { RotaWeekNavigator } from "@/components/rota/RotaWeekNavigator";
import { FairnessMeter } from "@/components/rota/FairnessMeter";
import { SmartAssignmentDialog } from "@/components/rota/SmartAssignmentDialog";
import { SwapSuggestionsDialog } from "@/components/rota/SwapSuggestionsDialog";
import { RotaTableRow } from "@/components/rota/RotaTableRow";
import { suggestSwaps, type SwapSuggestion } from "@/lib/swapSuggester";
import { useToast } from "@/hooks/use-toast";
import { StaffRotaPrintPreview } from "@/components/StaffRotaPrintPreview";
import { RecentChangesPanel } from "@/components/RecentChangesPanel";
import { useTour } from "@/contexts/TourContext";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// Dynamic import for OnboardingTour to prevent SSR hydration issues
const OnboardingTour = dynamic(
  () => import("@/components/OnboardingTour").then(mod => mod.OnboardingTour),
  { ssr: false }
);

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping"];

function getLocalDateString(date: Date): string {
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

export default function IndexPage() {
  
  // Safe date initialization with fallback - always start on Sunday
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [lockedAssignments, setLockedAssignments] = useState<Assignment[]>([]);
  const [showSwapSuggestions, setShowSwapSuggestions] = useState(false);
  const [swapSuggestions, setSwapSuggestions] = useState<SwapSuggestion[]>([]);
  const [swapDialogOpen, setSwapDialogOpen] = useState(false);
  const { resetTour } = useTour();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [history, setHistory] = useState<RotaSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [coverageGaps, setCoverageGaps] = useState<CoverageGap[]>([]);
  const [showCoverageWarning, setShowCoverageWarning] = useState(false);
  const [showUnavailableStaff, setShowUnavailableStaff] = useState(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState(false);
  const [fairnessMetrics, setFairnessMetrics] = useState<ReturnType<typeof calculateFairnessMetrics> | null>(null);
  const { addNotification } = useNotifications();
  const [rotaChannel, setRotaChannel] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [smartAssignDialog, setSmartAssignDialog] = useState<{
    open: boolean;
    task: Task | null;
    date: string;
  }>({ open: false, task: null, date: "" });
  const [manualSwapDialog, setManualSwapDialog] = useState<{
    open: boolean;
    assignment: Assignment | null;
  }>({ open: false, assignment: null });

  // React Query hooks - cached data with error handling
  const { data: staff = [], isLoading: staffLoading, error: staffError } = useStaff();
  const { data: taskConfig, isLoading: configLoading, error: configError } = useTaskConfig();
  
  const [activeTab, setActiveTab] = useState<string>("rota");
  const [taskConfigData, setTaskConfigData] = useState<TaskConfig | null>(null);
  const updateTaskConfig = useUpdateTaskConfig();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Calculate week dates early - needed by multiple functions
  const weekDates = useMemo(() => {
    try {
      if (!weekStart) return [];
      // Use local components only - match rota generator pattern
      const baseYear = weekStart.getFullYear();
      const baseMonth = weekStart.getMonth();
      const baseDay = weekStart.getDate();
      
      return DAYS.map((_, i) => {
        const date = new Date(baseYear, baseMonth, baseDay + i);
        return date;
      });
    } catch (e) {
      console.error("Error calculating week dates:", e);
      return [];
    }
  }, [weekStart]);
  
  // Sync taskConfig to local state for editing
  useEffect(() => {
    if (taskConfig) {
      setTaskConfigData(taskConfig);
    }
  }, [taskConfig]);

  useEffect(() => {
    try {
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
    } catch (e) {
      console.error("Error loading from localStorage:", e);
    }
  }, []);

  useEffect(() => {
    // Load saved assignments for the current week from Supabase
    const loadRotaFromSupabase = async () => {
      try {
        const rota = await rotaRealtimeService.getRotaForWeek(weekStart);
        if (rota) {
          setAssignments(rota.assignments);
          if (rota.fairness_metrics) {
            setFairnessMetrics(rota.fairness_metrics as any);
          }
        } else {
          setAssignments([]);
          setFairnessMetrics(null);
        }
      } catch (error) {
        console.error("Error loading rota:", error);
        setAssignments([]);
        setFairnessMetrics(null);
      }
    };

    loadRotaFromSupabase();

    // Set up real-time subscription with debouncing
    let updateTimeout: NodeJS.Timeout;
    const channel = rotaRealtimeService.subscribeToRotas((payload) => {
      // Debounce rapid updates
      clearTimeout(updateTimeout);
      updateTimeout = setTimeout(() => {
        const changedWeek = new Date(payload.new.week_start);
        if (changedWeek.toISOString().split("T")[0] === weekStart.toISOString().split("T")[0]) {
          setAssignments(payload.new.assignments);
          if (payload.new.fairness_metrics) {
            setFairnessMetrics(payload.new.fairness_metrics as any);
          }
          
          addNotification({
            staffName: "System",
            message: `Rota updated by colleague`,
            type: "info",
          });
        }
      }, 300); // 300ms debounce
    });

    setRotaChannel(channel);

    // Cleanup
    return () => {
      clearTimeout(updateTimeout);
      if (channel) {
        rotaRealtimeService.unsubscribe(channel);
      }
    };
  }, [weekStart, addNotification]);

  // Save assignments to Supabase whenever they change (excluding initial load and generates)
  useEffect(() => {
    const saveRotaToSupabase = async () => {
      if (assignments.length > 0) {
        try {
          await rotaRealtimeService.saveRota(
            weekStart,
            assignments,
            fairnessMetrics,
            lockedAssignments.length
          );
        } catch (error) {
          console.error("Error saving rota:", error);
        }
      }
    };

    // Debounce saves - generateRota already saves immediately
    const timeoutId = setTimeout(saveRotaToSupabase, 3000); // 3 seconds
    return () => clearTimeout(timeoutId);
  }, [assignments, weekStart, fairnessMetrics, lockedAssignments.length]);

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
      const dateStr = getLocalDateString(currentDate);

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
    
    // Persist to localStorage
    try {
      localStorage.setItem("warehouse-rota-history", JSON.stringify(updatedHistory));
    } catch (e) {
      console.error("Error saving history to localStorage:", e);
    }
  };

  const generateRota = async () => {
    const result = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
      lockedAssignments
    });
    const newAssignments = result.assignments;
    
    const metrics = calculateFairnessMetrics(newAssignments, staff);
    
    // Auto-lock all assignments after generation
    const newLocked = [...newAssignments];
    
    // Save immediately to Supabase to prevent race condition with real-time subscription
    try {
      await rotaRealtimeService.saveRota(
        weekStart,
        newAssignments,
        metrics,
        newLocked.length
      );
      
      // Only update local state after successful save
      setAssignments(newAssignments);
      setFairnessMetrics(metrics);
      setLockedAssignments(newLocked);
      
      // Save to history
      saveSnapshot(newAssignments);
      
      await rotaRealtimeService.logAction(
        "generated",
        "rota",
        getLocalDateString(weekStart),
        `Generated rota for week of ${weekStart.toLocaleDateString()} (auto-locked)`
      );
      
      addNotification({
        staffName: "System",
        message: "Rota generated and locked successfully",
        type: "info",
      });
    } catch (error) {
      console.error("Error saving rota:", error);
      toast({
        title: "❌ Save Failed",
        description: "Rota generated but failed to save. Try again.",
        variant: "destructive",
      });
    }
  };

  const forceGenerateRota = () => {
    setShowCoverageWarning(false);
    
    const result = generateWeeklyRota({
      staff,
      taskConfig,
      weekStart,
      lockedAssignments,
    });
    const newAssignments = result.assignments;
    setAssignments(newAssignments);
    
    // Auto-lock all assignments after forced generation
    setLockedAssignments([...newAssignments]);
    
    saveSnapshot(newAssignments);

    addNotification({
      staffName: "System",
      message: `Rota generated with ${coverageGaps.length} coverage gap(s) and locked`,
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
    const weekStartStr = weekStart.toISOString().split('T')[0]; // Get just the date part
    return history.filter(h => {
      const historyDate = new Date(h.weekStart).toISOString().split('T')[0];
      return historyDate === weekStartStr;
    });
  };

  const toggleLockAssignment = async (task: string, dayIndex: number, staffName: string) => {
    const dateStr = getLocalDateString(weekDates[dayIndex]);
    
    const assignment = assignments.find(
      (a) => a.task === task && a.date === dateStr && a.staffName === staffName
    );

    if (!assignment) return;

    const isLocked = lockedAssignments.some(
      (la) => la.task === task && la.date === dateStr && la.staffName === staffName
    );

    let newLocked: Assignment[];
    if (isLocked) {
      newLocked = lockedAssignments.filter(
        (la) => !(la.task === task && la.date === dateStr && la.staffName === staffName)
      );
      await rotaRealtimeService.logAction(
        "unlocked",
        "assignment",
        `${dateStr}-${task}-${staffName}`,
        `Unlocked ${staffName} for ${task} on ${DAYS[dayIndex]}`
      );
    } else {
      newLocked = [...lockedAssignments, assignment];
      await rotaRealtimeService.logAction(
        "locked",
        "assignment",
        `${dateStr}-${task}-${staffName}`,
        `Locked ${staffName} for ${task} on ${DAYS[dayIndex]}`
      );
    }
    setLockedAssignments(newLocked);
  };

  const isAssignmentLocked = (task: string, dayIndex: number, staffName: string) => {
    const dateStr = getLocalDateString(weekDates[dayIndex]);
    return lockedAssignments.some(
      (la) => la.task === task && la.date === dateStr && la.staffName === staffName
    );
  };

  const lockAll = async () => {
    setLockedAssignments([...assignments]);
    await rotaRealtimeService.logAction(
      "locked",
      "rota",
      getLocalDateString(weekStart),
      "Locked all assignments"
    );
  };

  const unlockAll = async () => {
    setLockedAssignments([]);
    await rotaRealtimeService.logAction(
      "unlocked_all",
      "rota",
      getLocalDateString(weekStart),
      "Unlocked all assignments"
    );
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
                  const dateStr = getLocalDateString(date);
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
    generateStaffRotaPDF({
      weekStart,
      assignments,
      staff,
      fairnessMetrics,
      lockedCount: lockedAssignments.length,
    });
    
    addNotification({
      staffName: "System",
      message: "Staff rota PDF downloaded successfully",
      type: "info",
    });
  };

  const getAssignmentsForTaskAndDay = (task: string, dateIndex: number): Assignment[] => {
    const date = weekDates[dateIndex];
    const dateStr = getLocalDateString(date);
    
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
    const dateStr = getLocalDateString(date);
    
    const availability = staffMember.availability?.find(a => a.date === dateStr);
    
    // If no availability record, assume working/available (no special status)
    if (!availability) return null;
    
    // Normalize the type value to handle case variations, whitespace, and full phrases
    const normalizedType = availability.type.toString().toLowerCase().trim();
    
    if (normalizedType.includes('rest')) {
      return { type: 'rest', color: 'bg-blue-50 text-blue-700 border-blue-200', label: 'Rest Day' };
    }
    if (normalizedType.includes('sick')) {
      return { type: 'sick', color: 'bg-red-50 text-red-700 border-red-200', label: 'Sick' };
    }
    if (normalizedType.includes('holiday') || normalizedType.includes('hol')) {
      return { type: 'holiday', color: 'bg-purple-50 text-purple-700 border-purple-200', label: 'Holiday' };
    }
    if (normalizedType.includes('available') || normalizedType.includes('avail')) {
      return { type: 'available', color: 'bg-green-50 text-green-700 border-green-200', label: 'Available' };
    }
    
    // Fallback for unknown types
    return null;
  };

  const getAllUnavailableStaff = (task: string, dateIndex: number): { name: string; reason: string; color: string }[] => {
    const date = weekDates[dateIndex];
    const dateStr = getLocalDateString(date);
    
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

  const autoPopulateAvailability = async () => {
    try {
      let updatedCount = 0;
      
      // Use same date calculation as generator - local components only
      const baseYear = weekStart.getFullYear();
      const baseMonth = weekStart.getMonth();
      const baseDay = weekStart.getDate();
      
      for (const staffMember of staff) {
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
          // Create date using local components only - no timezone conversion
          const currentDate = new Date(baseYear, baseMonth, baseDay + dayOffset);
          const year = currentDate.getFullYear();
          const month = String(currentDate.getMonth() + 1).padStart(2, '0');
          const day = String(currentDate.getDate()).padStart(2, '0');
          const dateStr = `${year}-${month}-${day}`;
          
          // Check if availability already exists for this date
          const existingAvailability = staffMember.availability?.find(a => a.date === dateStr);
          
          if (!existingAvailability) {
            // Auto-mark as available
            await staffService.addAvailability(staffMember.id, [{
              date: dateStr,
              type: "available",
              notes: "Auto-populated",
            }]);
            updatedCount++;
          }
        }
      }
      
      toast({
        title: "✅ Availability Set",
        description: `Auto-populated ${updatedCount} availability entries for the week`,
      });
      
      // Refresh staff data
      await new Promise(resolve => setTimeout(resolve, 500));
      window.location.reload();
      
    } catch (error) {
      console.error("Error auto-populating availability:", error);
      toast({
        title: "❌ Error",
        description: "Failed to set availability",
        variant: "destructive",
      });
    }
  };

  const handleSwapApply = (fromStaffId: string, toStaffId: string, task: Task, date: string) => {
    const updatedAssignments = assignments.map((a) =>
      a.staffId === fromStaffId && a.task === task && a.date === date
        ? { ...a, staffId: toStaffId, staffName: staff.find(s => s.id === toStaffId)?.name || "" }
        : a
    );

    const updatedLocked = lockedAssignments.map((a) =>
      a.staffId === fromStaffId && a.task === task && a.date === date
        ? { ...a, staffId: toStaffId, staffName: staff.find(s => s.id === toStaffId)?.name || "" }
        : a
    );

    const newMetrics = calculateFairnessMetrics(updatedAssignments, staff);
    
    setAssignments(updatedAssignments);
    setLockedAssignments(updatedLocked);
    setFairnessMetrics(newMetrics);

    toast({ title: "✅ Swap Applied", description: `Assignment updated successfully` });
  };

  const handleManualSwap = async (newStaffId: string) => {
    if (!manualSwapDialog.assignment) return;

    const { assignment } = manualSwapDialog;
    const newStaff = staff.find(s => s.id === newStaffId);
    if (!newStaff) return;

    handleSwapApply(assignment.staffId, newStaffId, assignment.task, assignment.date);

    // Save immediately
    const updatedAssignments = assignments.map((a) =>
      a.staffId === assignment.staffId && a.task === assignment.task && a.date === assignment.date
        ? { ...a, staffId: newStaffId, staffName: newStaff.name }
        : a
    );

    const newMetrics = calculateFairnessMetrics(updatedAssignments, staff);

    try {
      await rotaRealtimeService.saveRota(
        weekStart,
        updatedAssignments,
        newMetrics,
        lockedAssignments.length
      );

      await rotaRealtimeService.logAction(
        "updated",
        "assignment",
        `${assignment.date}-${assignment.task}`,
        `Manual swap: ${assignment.staffName} → ${newStaff.name}`
      );
    } catch (error) {
      console.error("Error saving swap:", error);
    }

    setManualSwapDialog({ open: false, assignment: null });
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

  const implementAllSwaps = async (swaps: SwapSuggestion[]) => {
    const updatedAssignments = [...assignments];
    const updatedLocked = [...lockedAssignments];
    let successCount = 0;

    swaps.forEach(swap => {
      const fromIndex = updatedAssignments.findIndex(
        a => a.staffId === swap.fromStaffId && a.task === swap.task && a.date === swap.date
      );
      
      if (fromIndex !== -1) {
        const lockedIndex = updatedLocked.findIndex(
          la => la.staffId === swap.fromStaffId && la.task === swap.task && la.date === swap.date
        );

        updatedAssignments[fromIndex] = {
          ...updatedAssignments[fromIndex],
          staffId: swap.toStaffId,
          staffName: swap.toStaffName
        };

        if (lockedIndex !== -1) {
          updatedLocked[lockedIndex] = {
            ...updatedLocked[lockedIndex],
            staffId: swap.toStaffId,
            staffName: swap.toStaffName
          };
        }

        successCount++;
      }
    });

    // Recalculate fairness metrics with updated assignments
    const newMetrics = calculateFairnessMetrics(updatedAssignments, staff);

    setAssignments(updatedAssignments);
    setLockedAssignments(updatedLocked);
    setFairnessMetrics(newMetrics);
    setShowSwapSuggestions(false);

    // Save to Supabase immediately
    try {
      await rotaRealtimeService.saveRota(
        weekStart,
        updatedAssignments,
        newMetrics,
        updatedLocked.length
      );
    } catch (error) {
      console.error("Error saving swapped rota:", error);
    }

    toast({
      title: "✅ Swaps Implemented",
      description: `Applied ${successCount} swaps. New fairness score: ${newMetrics.overallScore}`,
    });

    await rotaRealtimeService.logAction(
      "updated",
      "rota",
      getLocalDateString(weekStart),
      `Implemented ${successCount} smart swaps - Fairness: ${newMetrics.overallScore}`
    );
  };

  return (
    <Layout>
      <OnboardingTour />
      <SEO
        title="Warehouse Rota System"
        description="Fair distribution work rotation system for warehouse operations"
      />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="font-sans">
          <TabsTrigger value="rota">Weekly Rota</TabsTrigger>
          <TabsTrigger value="settings">Task Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="rota" className="space-y-6">
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

        {(staffLoading || configLoading) && (
          <Card className="shadow-sm">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
              Weekly Rota
            </h1>
            <p className="text-sm font-sans text-muted-foreground">
              Automated fair distribution rotation system
            </p>
          </div>
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
              const day = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
              const sunday = new Date(today);
              sunday.setDate(today.getDate() - day); // Go back to Sunday
              sunday.setHours(0, 0, 0, 0);
              setWeekStart(sunday);
            }}
            data-tour="week-navigator"
          />
        </div>

        {/* Action Controls */}
        <Card className="shadow-sm no-print" data-tour="generate-controls">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-xl font-condensed font-bold tracking-tight">
              Rota Actions
            </CardTitle>
            <CardDescription className="text-sm font-sans">
              Generate schedules, manage locks, and export data
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={autoPopulateAvailability}
                disabled={!staff.length || staffLoading}
                variant="outline"
                className="gap-2 font-sans font-medium shadow-sm hover:shadow-md transition-smooth"
                size="lg"
                data-quick-setup
              >
                <Calendar className="h-5 w-5" />
                Quick Setup Week
              </Button>

              <Button
                onClick={generateRota}
                disabled={!staff.length || !taskConfig || staffLoading || configLoading}
                className="gap-2 font-sans font-medium shadow-sm hover:shadow-md transition-smooth"
                size="lg"
              >
                <Zap className="h-5 w-5" />
                Generate Rota
              </Button>

              <Button
                onClick={() => {
                  const suggestions = suggestSwaps(assignments, staff, 10);
                  if (suggestions.length === 0) {
                    toast({
                      title: "No Improvements Found",
                      description: "The current rota is already well-balanced",
                    });
                    return;
                  }
                  setSwapSuggestions(suggestions);
                  setShowSwapSuggestions(true);
                }}
                disabled={assignments.length === 0}
                variant="outline"
                className="gap-2 font-sans font-medium shadow-sm hover:shadow-md transition-smooth"
                size="lg"
              >
                <Shuffle className="h-5 w-5" />
                Suggest Swaps
              </Button>

              <Button
                onClick={lockAll}
                disabled={assignments.length === 0}
                variant="outline"
                className="gap-2 font-sans font-medium"
                size="lg"
              >
                <Lock className="h-4 w-4" />
                Lock All
              </Button>

              <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="outline"
                    className="gap-2 font-sans font-medium"
                    size="lg"
                    disabled={getCurrentWeekHistory().length === 0}
                  >
                    <History className="h-4 w-4" />
                    History ({getCurrentWeekHistory().length})
                  </Button>
                </SheetTrigger>
                <SheetContent className="w-full sm:max-w-lg">
                  <SheetHeader>
                    <SheetTitle className="font-condensed text-xl">Rota History</SheetTitle>
                    <SheetDescription className="font-sans text-sm">
                      Previous versions for week starting {weekStart.toLocaleDateString("en-GB")}
                    </SheetDescription>
                  </SheetHeader>
                  <ScrollArea className="h-[calc(100vh-150px)] mt-6">
                    <div className="space-y-3">
                      {getCurrentWeekHistory().map((snapshot) => (
                        <Card key={snapshot.id} className="shadow-sm hover:shadow-md transition-smooth">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <CardTitle className="text-sm font-mono font-semibold">
                                  {formatTimestamp(snapshot.timestamp)}
                                </CardTitle>
                                <CardDescription className="text-xs font-mono mt-1">
                                  {snapshot.assignments.length} assignments, {snapshot.lockedAssignments.length} locked
                                </CardDescription>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => restoreSnapshot(snapshot)}
                                className="gap-2 font-sans text-xs"
                              >
                                <RotateCcw className="h-3 w-3" />
                                Restore
                              </Button>
                            </div>
                          </CardHeader>
                        </Card>
                      ))}
                      {getCurrentWeekHistory().length === 0 && (
                        <div className="text-center py-8 text-muted-foreground font-mono text-sm">
                          No history for this week
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </SheetContent>
              </Sheet>

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
                  onClick={exportWeekPDF}
                  disabled={assignments.length === 0}
                  variant="outline"
                  className="gap-2 font-sans font-medium"
                  size="lg"
                >
                  <Download className="h-4 w-4" />
                  Export PDF
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Weekly Rota Display */}
        {!staffLoading && !configLoading && assignments.length === 0 && (
          <Card className="shadow-sm">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <div className="h-16 w-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-condensed font-bold tracking-tight mb-2">
                    No Rota Generated Yet
                  </h3>
                  <p className="text-sm font-sans text-muted-foreground">
                    Click "Generate Rota" above to create a fair distribution schedule for this week
                  </p>
                </div>
                <Button
                  onClick={generateRota}
                  disabled={!staff.length || !taskConfig}
                  size="lg"
                  className="gap-2 font-sans font-medium mt-4"
                >
                  <Zap className="h-5 w-5" />
                  Generate Rota Now
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {assignments.length > 0 && (
          <Card className="shadow-sm">
        </Card>
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
                    <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50 rounded-tl-lg w-32 min-w-[8rem]">
                      Task
                    </th>
                    {weekDates.map((date, i) => (
                      <th 
                        key={i} 
                        className={`text-center p-3 font-mono text-xs font-medium bg-muted/50 ${i === 6 ? 'rounded-tr-lg' : ''} w-auto min-w-[120px]`}
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
                      <td className="p-4 font-condensed text-sm font-semibold bg-muted/30 w-32 min-w-[8rem]">
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
                            className="p-3 text-center align-top w-auto min-w-[120px]"
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
                              {dayAssignments.length === 0 && (
                                <div
                                  className="text-center text-muted-foreground text-xs py-2 font-sans hover:bg-accent/50 cursor-pointer rounded-lg transition-smooth border-2 border-dashed border-muted-foreground/20 hover:border-primary/50"
                                  onClick={() => {
                                    setSmartAssignDialog({
                                      open: true,
                                      task: task as Task,
                                      date: getLocalDateString(weekDates[dayIdx]),
                                    });
                                  }}
                                  title="Click for smart assignment suggestions"
                                >
                                  + Suggest
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

        {fairnessMetrics && assignments.length > 0 && (
          <Card className="shadow-sm" data-tour="fairness-metrics">
            <CardHeader className="border-b border-border/50 bg-muted/30">
              <CardTitle className="text-lg font-condensed font-bold tracking-tight">
                Fairness Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="font-mono text-xl font-bold tabular-nums text-primary">
                      {Math.max(0, 100 - Math.round(fairnessMetrics.standardDeviation * 10))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Task Balance
                    </p>
                  </div>
                  <div>
                    <div className="font-mono text-xl font-bold tabular-nums text-primary">
                      {fairnessMetrics.standardDeviation}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Deviation
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Fairness Meter */}
        {staff.length > 0 && assignments.length > 0 && (
          <FairnessMeter
            staff={staff}
            assignments={assignments}
            weekStart={weekStart}
            onSwapApply={handleSwapApply}
          />
        )}

        {/* Recent Changes Panel */}
        <RecentChangesPanel />
        
        {/* Manual Swap Dialog */}
        <Dialog open={manualSwapDialog.open} onOpenChange={(open) => setManualSwapDialog({ open, assignment: null })}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-condensed text-2xl">Manual Swap Assignment</DialogTitle>
              <DialogDescription className="font-mono text-xs">
                {manualSwapDialog.assignment && (
                  <>
                    {manualSwapDialog.assignment.task} on {new Date(manualSwapDialog.assignment.date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>

            {manualSwapDialog.assignment && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <div className="text-sm font-mono">
                    <span className="text-muted-foreground">Current: </span>
                    <span className="font-bold">{manualSwapDialog.assignment.staffName}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-sm font-medium font-mono">Select replacement staff:</div>
                  <div className="grid gap-2 max-h-[400px] overflow-y-auto">
                    {staff
                      .filter(s => {
                        // Must be trained for this task
                        if (!s.trainedTasks.includes(manualSwapDialog.assignment!.task as Task)) return false;
                        
                        // Can't swap to same person
                        if (s.id === manualSwapDialog.assignment!.staffId) return false;
                        
                        // Check if already assigned to another task on same day
                        const alreadyAssignedToday = assignments.some(
                          a => a.date === manualSwapDialog.assignment!.date && a.staffId === s.id
                        );
                        if (alreadyAssignedToday) return false;

                        // Check availability
                        const dateStr = manualSwapDialog.assignment!.date;
                        const hasRestDay = s.availability?.some(a => a.date === dateStr && a.type === 'rest');
                        const hasHoliday = s.availability?.some(a => a.date === dateStr && a.type === 'holiday');
                        const hasSickLeave = s.availability?.some(a => a.date === dateStr && a.type === 'sick');
                        
                        return !hasRestDay && !hasHoliday && !hasSickLeave;
                      })
                      .sort((a, b) => {
                        // Sort by fewest assignments this week
                        const aCount = assignments.filter(asn => asn.staffId === a.id).length;
                        const bCount = assignments.filter(asn => asn.staffId === b.id).length;
                        return aCount - bCount;
                      })
                      .map(s => {
                        const weekAssignments = assignments.filter(a => a.staffId === s.id).length;
                        const taskAssignments = assignments.filter(
                          a => a.staffId === s.id && a.task === manualSwapDialog.assignment!.task
                        ).length;

                        return (
                          <button
                            key={s.id}
                            onClick={() => handleManualSwap(s.id)}
                            className="p-3 border rounded-lg hover:bg-muted transition-colors text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-mono font-semibold">{s.name}</div>
                                <div className="text-xs text-muted-foreground font-mono mt-1">
                                  Week: {weekAssignments} total • {taskAssignments}x {manualSwapDialog.assignment!.task}
                                </div>
                              </div>
                              <ArrowRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Smart Assignment Dialog */}
        <SmartAssignmentDialog
          open={smartAssignDialog.open}
          onClose={() => setSmartAssignDialog({ open: false, task: null, date: "" })}
          task={smartAssignDialog.task}
          date={smartAssignDialog.date}
          staff={staff}
          assignments={assignments}
          onAssign={async (staffId) => {
            const staffMember = staff.find(s => s.id === staffId);
            if (!staffMember) return;
            
            const newAssignment = {
              staffId: staffMember.id,
              staffName: staffMember.name,
              task: smartAssignDialog.task!,
              date: smartAssignDialog.date
            };
            
            setAssignments([...assignments, newAssignment]);
            setSmartAssignDialog({ open: false, task: null, date: "" });
            
            await rotaRealtimeService.logAction(
              "assigned",
              "assignment",
              `${smartAssignDialog.date}-${smartAssignDialog.task}`,
              `Smart assigned ${staffMember.name} to ${smartAssignDialog.task}`
            );
          }}
        />

        <SwapSuggestionsDialog
          open={showSwapSuggestions}
          onOpenChange={setShowSwapSuggestions}
          suggestions={swapSuggestions}
          onImplementSwap={(swap) => handleSwapApply(swap.fromStaffId, swap.toStaffId, swap.task, swap.date)}
          onImplementAll={implementAllSwaps}
        />
      </TabsContent>

        {/* Settings Tab - Task Requirements Configuration */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed">Task Requirements Configuration</CardTitle>
              <CardDescription className="font-sans">
                Set how many staff are needed for each task on each day of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              {taskConfigData && (
                <div className="space-y-6">
                  {["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping"].map((task) => (
                    <div key={task} className="space-y-2">
                      <h3 className="font-condensed font-semibold">{task}</h3>
                      <div className="grid grid-cols-7 gap-2">
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, idx) => (
                          <div key={day}>
                            <label className="text-xs text-muted-foreground font-sans">{day}</label>
                            <Input
                              type="number"
                              min="0"
                              value={taskConfigData[task]?.[idx] || 0}
                              onChange={(e) => {
                                const newConfig = { ...taskConfigData };
                                if (!newConfig[task]) newConfig[task] = [0, 0, 0, 0, 0, 0, 0];
                                newConfig[task][idx] = parseInt(e.target.value) || 0;
                                setTaskConfigData(newConfig);
                              }}
                              className="font-mono text-center"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() => {
                      updateTaskConfig.mutate(taskConfigData);
                      toast({ title: "✅ Configuration Saved", description: "Task requirements updated" });
                    }}
                    disabled={updateTaskConfig.isPending}
                    className="font-sans font-medium"
                  >
                    {updateTaskConfig.isPending ? "Saving..." : "Save Configuration"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
}