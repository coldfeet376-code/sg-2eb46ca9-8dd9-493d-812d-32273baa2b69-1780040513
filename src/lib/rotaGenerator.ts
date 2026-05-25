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
  console.log("🔄 generateWeeklyRota called with:", {
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
  // Track how many times each staff member has done each specific task
  const staffTaskCounts: Record<string, Record<Task, number>> = {};
  
  staff.forEach((s) => {
    staffAssignmentCounts[s.id] = 0;
    staffTasksByDate[s.id] = {};
    staffTaskCounts[s.id] = {
      "Frozen": 0,
      "Milk": 0,
      "TWI": 0,
      "Inbound": 0,
      "Inbound Late": 0,
      "Outbound": 0,
      "Marshaling": 0,
      "Housekeeping": 0,
    };
  });

  // Count existing locked assignments and populate task history
  lockedAssignments.forEach((a) => {
    const staffMember = staff.find((s) => s.name === a.staffName);
    const staffId = a.staffId || staffMember?.id;
    if (staffId) {
      staffAssignmentCounts[staffId] = (staffAssignmentCounts[staffId] || 0) + 1;
      staffTasksByDate[staffId][a.date] = a.task as Task;
      
      if (staffTaskCounts[staffId]) {
        staffTaskCounts[staffId][a.task as Task] = (staffTaskCounts[staffId][a.task as Task] || 0) + 1;
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

  // Define shift priorities
  const shiftOrder: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

  // Helper: Get available staff for a specific task/day
  const getAvailableStaff = (task: Task, dateStr: string, dayIndex: number): StaffMember[] => {
    const allStaff: StaffMember[] = [];
    
    for (const shift of shiftOrder) {
      const shiftStaff = staffByShift[shift] || [];
      
      const available = shiftStaff.filter((s) => {
        // Must be trained for the task
        const taskToCheck = task === "Inbound Late" ? "Inbound" : task;
        if (!s.trainedTasks.includes(taskToCheck)) return false;
        
        // Shift time filtering
        if (task === "Inbound") {
          if (s.shiftStart !== "06:00") return false;
        } else if (task === "Inbound Late") {
          if (!["09:00", "10:00", "11:00"].includes(s.shiftStart || "06:00")) return false;
        }

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

      allStaff.push(...available.map(s => ({ ...s, shift: shift as ShiftStart })));
    }

    return allStaff;
  };

  // Helper: Check if assigning this task would violate consecutive task rule
  const wouldViolateConsecutive = (staffId: string, task: Task, dateStr: string): boolean => {
    const currentDate = new Date(dateStr);
    
    // Check previous day
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = prevDate.toISOString().split("T")[0];
    const prevTask = staffTasksByDate[staffId]?.[prevDateStr];
    
    // Special rule for Inbound: never allow consecutive
    if (task === "Inbound" || task === "Inbound Late") {
      if (prevTask === "Inbound" || prevTask === "Inbound Late") return true;
    }
    
    // General rule: avoid same task on consecutive days
    if (prevTask === task) return true;
    
    // Check next day to avoid creating a consecutive assignment
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = nextDate.toISOString().split("T")[0];
    const nextTask = staffTasksByDate[staffId]?.[nextDateStr];
    
    if (task === "Inbound" || task === "Inbound Late") {
      if (nextTask === "Inbound" || nextTask === "Inbound Late") return true;
    }
    
    if (nextTask === task) return true;
    
    return false;
  };

  // Calculate total slots needed for the week
  const totalSlotsNeeded = Object.entries(taskConfig).reduce((total, [task, days]) => {
    const taskTotal = days.reduce((sum, count) => sum + count, 0);
    return total + taskTotal;
  }, 0);

  const lockedSlots = lockedAssignments.length;
  const availableSlotsToFill = totalSlotsNeeded - lockedSlots;

  console.log(`📊 Week overview: ${totalSlotsNeeded} total slots, ${lockedSlots} locked, ${availableSlotsToFill} to fill`);

  // Calculate how many working days each staff member has
  const staffWorkingDays: Record<string, number> = {};
  staff.forEach(s => {
    let workingDays = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = date.toISOString().split("T")[0];
      
      const availability = s.availability?.find(a => a.date === dateStr);
      if (!availability || availability.type === "available") {
        workingDays++;
      }
    }
    staffWorkingDays[s.id] = workingDays;
  });

  console.log("👥 Staff working days:", Object.entries(staffWorkingDays).map(([id, days]) => {
    const s = staff.find(x => x.id === id);
    return `${s?.name}: ${days} days`;
  }).join(", "));

  // ============================================
  // PHASE 1: GUARANTEED MINIMUM ASSIGNMENTS
  // ============================================
  console.log("📍 PHASE 1: Ensuring everyone gets at least 1 assignment...");

  // Get staff who need assignments (excluding those already locked to full capacity)
  const staffNeedingAssignments = staff.filter(s => {
    const currentCount = staffAssignmentCounts[s.id] || 0;
    const workingDays = staffWorkingDays[s.id] || 0;
    // If they have fewer assignments than working days, they need more
    return currentCount === 0 && workingDays > 0;
  });

  console.log(`  ${staffNeedingAssignments.length} staff need their first assignment`);

  // Process each day to ensure round-robin distribution
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // For each task on this day
    for (const taskName of Object.keys(taskConfig)) {
      const task = taskName as Task;
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;

      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;
      const needed = required - existingCount;
      if (needed <= 0) continue;

      // Get available staff for this task/day
      const available = getAvailableStaff(task, dateStr, dayIndex);
      
      // Prioritize staff with zero assignments
      const zeroAssignmentStaff = available.filter(s => staffAssignmentCounts[s.id] === 0);
      
      if (zeroAssignmentStaff.length > 0) {
        // Sort by: no consecutive tasks > trained tasks count (versatility)
        const sorted = zeroAssignmentStaff.sort((a, b) => {
          const aViolates = wouldViolateConsecutive(a.id, task, dateStr);
          const bViolates = wouldViolateConsecutive(b.id, task, dateStr);
          if (aViolates && !bViolates) return 1;
          if (!aViolates && bViolates) return -1;
          
          // Prefer more versatile staff (trained on more tasks)
          return b.trainedTasks.length - a.trainedTasks.length;
        });

        // Assign as many zero-assignment staff as possible
        const toAssign = Math.min(needed, sorted.length);
        for (let i = 0; i < toAssign; i++) {
          const selectedStaff = sorted[i];
          assignments.push({
            staffId: selectedStaff.id,
            staffName: selectedStaff.name,
            task: task,
            date: dateStr,
          });
          
          staffAssignmentCounts[selectedStaff.id]++;
          staffTasksByDate[selectedStaff.id][dateStr] = task;
          staffTaskCounts[selectedStaff.id][task]++;
          
          console.log(`  ✓ Assigned ${selectedStaff.name} to ${task} on ${dateStr} (first assignment)`);
        }
      }
    }
  }

  // ============================================
  // PHASE 2: FILL REMAINING SLOTS WITH FAIRNESS
  // ============================================
  console.log("📍 PHASE 2: Filling remaining slots with fairness algorithm...");

  // Process each day again to fill remaining capacity
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Process each task
    for (const taskName of Object.keys(taskConfig)) {
      const task = taskName as Task;
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;

      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;
      const needed = required - existingCount;
      if (needed <= 0) continue;

      // Get available staff
      const available = getAvailableStaff(task, dateStr, dayIndex);
      if (available.length === 0) continue;

      // Sort by fairness criteria
      const sorted = available.sort((a, b) => {
        // Priority 1: Avoid consecutive tasks
        const aViolates = wouldViolateConsecutive(a.id, task, dateStr);
        const bViolates = wouldViolateConsecutive(b.id, task, dateStr);
        if (aViolates && !bViolates) return 1;
        if (!aViolates && bViolates) return -1;

        // Priority 2: Fewest times doing THIS specific task
        const aTaskCount = staffTaskCounts[a.id]?.[task] || 0;
        const bTaskCount = staffTaskCounts[b.id]?.[task] || 0;
        if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;

        // Priority 3: Fewest overall assignments
        const aCount = staffAssignmentCounts[a.id] || 0;
        const bCount = staffAssignmentCounts[b.id] || 0;
        if (aCount !== bCount) return aCount - bCount;

        // Priority 4: Earlier shifts get slight preference
        const shiftA = a.shift || a.shiftStart;
        const shiftB = b.shift || b.shiftStart;
        const aShiftIndex = shiftOrder.indexOf(shiftA as ShiftStart);
        const bShiftIndex = shiftOrder.indexOf(shiftB as ShiftStart);
        return aShiftIndex - bShiftIndex;
      });

      // Assign the needed staff
      for (let i = 0; i < Math.min(needed, sorted.length); i++) {
        const selectedStaff = sorted[i];
        assignments.push({
          staffId: selectedStaff.id,
          staffName: selectedStaff.name,
          task: task,
          date: dateStr,
        });
        
        staffAssignmentCounts[selectedStaff.id]++;
        staffTasksByDate[selectedStaff.id][dateStr] = task;
        staffTaskCounts[selectedStaff.id][task]++;
      }
    }
  }

  console.log("✅ generateWeeklyRota completed:", {
    totalAssignments: assignments.length,
    assignmentsByStaff: Object.entries(staffAssignmentCounts).map(([id, count]) => {
      const s = staff.find(x => x.id === id);
      return `${s?.name}: ${count}`;
    }).join(", ")
  });

  // Log any staff with zero assignments
  const zeroAssignments = staff.filter(s => staffAssignmentCounts[s.id] === 0);
  if (zeroAssignments.length > 0) {
    console.log("⚠️ Staff with ZERO assignments:", zeroAssignments.map(s => {
      const workingDays = staffWorkingDays[s.id];
      return `${s.name} (${workingDays} working days, trained: ${s.trainedTasks.join(", ")})`;
    }).join(", "));
  }

  return assignments;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day;
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