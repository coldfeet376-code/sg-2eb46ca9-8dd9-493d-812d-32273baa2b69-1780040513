import type { StaffMember, Assignment, Task, ShiftStart } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

export function generateWeeklyRota({
  staff,
  taskConfig,
  weekStart,
  lockedAssignments = [],
}: {
  staff: StaffMember[];
  taskConfig: TaskConfig;
  weekStart: Date;
  lockedAssignments?: Assignment[];
}): Assignment[] {
  console.log("generateWeeklyRota called with:", {
    staffCount: staff.length,
    staffNames: staff.map(s => s.name),
    taskConfig: Object.keys(taskConfig),
    weekStart: weekStart.toISOString(),
    lockedCount: lockedAssignments.length
  });

  const assignments: Assignment[] = [...lockedAssignments];

  // Track assignments per staff member for fairness
  const staffAssignmentCounts: Record<string, number> = {};
  // Track what task each staff member did on each date
  const staffTasksByDate: Record<string, Record<string, Task>> = {};
  
  // NEW: Track Inbound assignments for 06:00 shift staff based on working days
  const earlyShiftInboundCount: Record<string, number> = {};
  const earlyShiftWorkingDays: Record<string, number> = {};
  
  staff.forEach((s) => {
    staffAssignmentCounts[s.id] = 0;
    staffTasksByDate[s.id] = {};
    
    // For 06:00 shift staff, calculate working days in the week
    if (s.shiftStart === "06:00") {
      earlyShiftInboundCount[s.id] = 0;
      
      // Count working days (days without rest/holiday/sick)
      let workingDays = 0;
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const currentDate = new Date(weekStart);
        currentDate.setDate(currentDate.getDate() + dayIndex);
        const dateStr = currentDate.toISOString().split("T")[0];
        
        const availability = s.availability?.find((a) => a.date === dateStr);
        if (!availability || availability.type === "available") {
          workingDays++;
        }
      }
      
      earlyShiftWorkingDays[s.id] = workingDays;
    }
  });

  // Count existing locked assignments and populate task history
  lockedAssignments.forEach((a) => {
    // Fallback to finding staffId by name for backward compatibility with older locked assignments
    const staffMember = staff.find((s) => s.name === a.staffName);
    const staffId = a.staffId || staffMember?.id;
    if (staffId) {
      staffAssignmentCounts[staffId] = (staffAssignmentCounts[staffId] || 0) + 1;
      staffTasksByDate[staffId][a.date] = a.task as Task;
      
      // NEW: Count existing Inbound assignments for Frozen-trained staff
      if (a.task === "Inbound" && staffMember?.trainedTasks.includes("Frozen")) {
        earlyShiftInboundCount[staffId] = (earlyShiftInboundCount[staffId] || 0) + 1;
      }
    }
  });

  // Count existing locked assignments and populate task history
  lockedAssignments.forEach((a) => {
    // Fallback to finding staffId by name for backward compatibility with older locked assignments
    const staffMember = staff.find((s) => s.name === a.staffName);
    const staffId = a.staffId || staffMember?.id;
    if (staffId) {
      staffAssignmentCounts[staffId] = (staffAssignmentCounts[staffId] || 0) + 1;
      staffTasksByDate[staffId][a.date] = a.task as Task;
      
      // NEW: Count existing Inbound assignments for 06:00 shift staff
      if (a.task === "Inbound" && staffMember?.shiftStart === "06:00") {
        earlyShiftInboundCount[staffId] = (earlyShiftInboundCount[staffId] || 0) + 1;
      }
    }
  });

  // Group staff by shift start time
  const staffByShift = staff.reduce((acc, s) => {
    const shift = s.shiftStart || "06:00";
    if (!acc[shift]) acc[shift] = [];
    acc[shift].push(s);
    return acc;
  }, {} as Record<ShiftStart, StaffMember[]>);

  // Define shift priorities (earlier shifts get priority for task assignment)
  const shiftOrder: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

  // Process each day
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Get previous day's date for checking consecutive tasks
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];

    // taskConfig format: { "Frozen": [1,2,3,4,5,6,7], "Milk": [2,3,4,5,6,7,8], ... }
    // Process each task
    for (const taskName of Object.keys(taskConfig)) {
      const task = taskName as Task;
      const dayRequirements = taskConfig[task];
      if (!dayRequirements || !Array.isArray(dayRequirements)) continue;
      
      const required = dayRequirements[dayIndex] || 0;
      if (required === 0) continue;

      // Skip if already have locked assignments for this task/day
      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;

      const needed = required - existingCount;
      if (needed <= 0) continue;

      // Try to assign from each shift in order, distributing fairly
      const availableByShift: Record<string, StaffMember[]> = {};

      // First, collect available staff from each shift
      for (const shift of shiftOrder) {
        const shiftStaff = staffByShift[shift] || [];
        
        const available = shiftStaff.filter((s) => {
          // Must be trained for the task
          if (!s.trainedTasks.includes(task)) return false;

          // Check if already assigned on this day
          const alreadyAssigned = assignments.some(
            (a) => a.staffId === s.id && a.date === dateStr
          );
          if (alreadyAssigned) return false;

          // Check availability
          const availability = s.availability?.find((a) => a.date === dateStr);
          if (availability && availability.type !== "available") return false;

          return true;
        });

        if (available.length > 0) {
          availableByShift[shift] = available;
        }
      }

      // Distribute assignments across shifts proportionally
      const allAvailable = Object.entries(availableByShift).flatMap(([shift, staffList]) =>
        staffList.map(s => ({ ...s, shift: shift as ShiftStart }))
      );

      if (allAvailable.length === 0) continue;

      // Randomize within each shift group, then sort by fairness
      const shuffled = allAvailable.sort(() => Math.random() - 0.5);

      // Sort by:
      // 1. Avoid consecutive same task (PRIORITY #1)
      // 2. Fewest assignments (fairness)
      // 3. Shift start time (earlier shifts get slight priority)
      const sorted = shuffled.sort((a, b) => {
        // CRITICAL: Check what task they did on the previous day
        const aPrevTask = staffTasksByDate[a.id]?.[prevDateStr];
        const bPrevTask = staffTasksByDate[b.id]?.[prevDateStr];
        
        // If A did this task yesterday but B didn't, B goes first
        if (aPrevTask === task && bPrevTask !== task) return 1;
        if (aPrevTask !== task && bPrevTask === task) return -1;

        // Secondary: Fewest assignments overall (fairness)
        const aCount = staffAssignmentCounts[a.id] || 0;
        const bCount = staffAssignmentCounts[b.id] || 0;
        if (aCount !== bCount) return aCount - bCount;

        // Tertiary: Slight preference for earlier shifts
        const aShiftIndex = shiftOrder.indexOf(a.shift);
        const bShiftIndex = shiftOrder.indexOf(b.shift);
        return aShiftIndex - bShiftIndex;
      });

      // NEW: Special sorting for Inbound task - prioritize 06:00 shift staff based on working days
      let finalSorted = sorted;
      if (task === "Inbound") {
        finalSorted = sorted.sort((a, b) => {
          const aIsEarlyShift = a.shiftStart === "06:00";
          const bIsEarlyShift = b.shiftStart === "06:00";
          
          // Get current Inbound count and working days for 06:00 shift staff
          const aInboundCount = earlyShiftInboundCount[a.id] || 0;
          const bInboundCount = earlyShiftInboundCount[b.id] || 0;
          const aWorkingDays = earlyShiftWorkingDays[a.id] || 0;
          const bWorkingDays = earlyShiftWorkingDays[b.id] || 0;
          
          // Determine target Inbound assignments: 5-day workers get 2, 3-day workers get 1
          const aTarget = aWorkingDays >= 5 ? 2 : 1;
          const bTarget = bWorkingDays >= 5 ? 2 : 1;
          
          // Priority 1: 06:00 shift staff who haven't reached their target yet
          if (aIsEarlyShift && !bIsEarlyShift && aInboundCount < aTarget) return -1;
          if (!aIsEarlyShift && bIsEarlyShift && bInboundCount < bTarget) return 1;
          
          // Priority 2: Among 06:00 shift staff, prefer those furthest from their target
          if (aIsEarlyShift && bIsEarlyShift) {
            const aRemaining = aTarget - aInboundCount;
            const bRemaining = bTarget - bInboundCount;
            if (aRemaining !== bRemaining) return bRemaining - aRemaining; // Higher remaining gets priority
          }
          
          // Otherwise maintain existing sort order
          // Check consecutive task constraint
          const aPrevTask = staffTasksByDate[a.id]?.[prevDateStr];
          const bPrevTask = staffTasksByDate[b.id]?.[prevDateStr];
          if (aPrevTask === task && bPrevTask !== task) return 1;
          if (aPrevTask !== task && bPrevTask === task) return -1;
          
          // Fairness
          const aCount = staffAssignmentCounts[a.id] || 0;
          const bCount = staffAssignmentCounts[b.id] || 0;
          if (aCount !== bCount) return aCount - bCount;
          
          // Shift priority
          const aShiftIndex = shiftOrder.indexOf(a.shift);
          const bShiftIndex = shiftOrder.indexOf(b.shift);
          return aShiftIndex - bShiftIndex;
        });
      }

      // Assign the needed staff
      for (let i = 0; i < Math.min(needed, finalSorted.length); i++) {
        const selectedStaff = finalSorted[i];
        assignments.push({
          staffId: selectedStaff.id,
          staffName: selectedStaff.name,
          task: task,
          date: dateStr,
        });
        staffAssignmentCounts[selectedStaff.id]++;
        // Track what task this staff member did on this date
        staffTasksByDate[selectedStaff.id][dateStr] = task;
        
        // NEW: Track Inbound assignments for Frozen-trained staff
        if (task === "Inbound" && selectedStaff.trainedTasks.includes("Frozen")) {
          frozenStaffInboundCount[selectedStaff.id] = (frozenStaffInboundCount[selectedStaff.id] || 0) + 1;
        }

        staffAssignmentCounts[selectedStaff.id]++;
        // Track what task this staff member did on this date
        staffTasksByDate[selectedStaff.id][dateStr] = task;
        
        // NEW: Track Inbound assignments for 06:00 shift staff
        if (task === "Inbound" && selectedStaff.shiftStart === "06:00") {
          earlyShiftInboundCount[selectedStaff.id] = (earlyShiftInboundCount[selectedStaff.id] || 0) + 1;
        }
      }
    }
  }

  console.log("generateWeeklyRota completed:", {
    totalAssignments: assignments.length,
    assignmentsByStaff: assignments.reduce((acc, a) => {
      acc[a.staffName] = (acc[a.staffName] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  });

  return assignments;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day; // Sunday = 0, so no adjustment needed
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function navigateWeek(
  currentWeekStart: Date,
  direction: "prev" | "next"
): Date {
  const newDate = new Date(currentWeekStart);
  newDate.setDate(currentWeekStart.getDate() + (direction === "next" ? 7 : -7));
  return newDate;
}

export function getYearWeeks(year: number): Date[] {
  const weeks: Date[] = [];
  const d = new Date(year, 0, 1);
  d.setHours(0, 0, 0, 0);
  
  // Find first Sunday
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  
  // Generate weeks for the year
  while (d.getFullYear() === year || (d.getFullYear() === year + 1 && d.getMonth() === 0 && d.getDate() < 7)) {
    weeks.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  
  return weeks.filter(w => w.getFullYear() === year || (w.getFullYear() === year - 1 && w.getMonth() === 11) || (w.getFullYear() === year + 1 && w.getMonth() === 0 && w.getDate() < 7));
}