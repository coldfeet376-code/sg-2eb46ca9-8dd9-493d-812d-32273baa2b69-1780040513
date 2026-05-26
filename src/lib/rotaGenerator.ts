import type { StaffMember, Assignment, Task, ShiftStart } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

// Centralized date handling to prevent timezone bugs
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const assignments: Assignment[] = [...lockedAssignments];

  // Track assignments per staff member
  const staffAssignmentCounts: Record<string, number> = {};
  const staffTasksByDate: Record<string, Record<string, Task>> = {};
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

  // Count existing locked assignments
  lockedAssignments.forEach((a) => {
    const staffMember = staff.find((s) => s.name === a.staffName);
    const staffId = a.staffId || staffMember?.id;
    if (staffId) {
      staffAssignmentCounts[staffId] = (staffAssignmentCounts[staffId] || 0) + 1;
      staffTasksByDate[staffId][a.date] = a.task as Task;
      staffTaskCounts[staffId][a.task as Task] = (staffTaskCounts[staffId][a.task as Task] || 0) + 1;
    }
  });

  // Group staff by shift start time
  const staffByShift = staff.reduce((acc, s) => {
    const shift = s.shiftStart || "06:00";
    if (!acc[shift]) acc[shift] = [];
    acc[shift].push(s);
    return acc;
  }, {} as Record<ShiftStart, StaffMember[]>);

  const shiftOrder: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

  // Calculate working days per staff member
  const staffWorkingDays: Record<string, number> = {};
  staff.forEach(s => {
    let workingDays = 0;
    for (let d = 0; d < 7; d++) {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      const dateStr = getLocalDateString(date);
      
      const availability = s.availability?.find(a => a.date === dateStr);
      if (!availability || availability.type === "available") {
        workingDays++;
      }
    }
    staffWorkingDays[s.id] = workingDays;
  });

  // Helper: Get available staff for a specific task/day
  const getAvailableStaff = (task: Task, dateStr: string, dayIndex: number): StaffMember[] => {
    const allStaff: StaffMember[] = [];
    
    for (const shift of shiftOrder) {
      const shiftStaff = staffByShift[shift] || [];
      
      const available = shiftStaff.filter((s) => {
        // Must be trained for the task
        const taskToCheck = task === "Inbound Late" ? "Inbound" : task;
        if (!s.trainedTasks.includes(taskToCheck)) {
          return false;
        }
        
        // Check if already assigned on this day
        const dayAssignments = assignments.filter(
          (a) => a.staffId === s.id && a.date === dateStr
        );
        
        // SPECIAL RULE: Frozen finishes at 10:00, so staff can do Frozen + Inbound on same day
        const hasFrozen = dayAssignments.some(a => a.task === "Frozen");
        const hasInbound = dayAssignments.some(a => a.task === "Inbound" || a.task === "Inbound Late");
        
        if (dayAssignments.length > 0) {
          // Allow Frozen + Inbound combination
          if ((task === "Inbound" || task === "Inbound Late") && hasFrozen && !hasInbound) {
            // This is OK - they have Frozen, now assigning Inbound
          } else if (task === "Frozen" && hasInbound && !hasFrozen) {
            // This is OK - they have Inbound, now assigning Frozen
          } else {
            // Any other combination = already assigned, skip
            return false;
          }
        }

        // CRITICAL AVAILABILITY CHECK
        // Block ONLY if explicitly marked as unavailable (rest day, holiday, sick)
        const availability = s.availability?.find((a) => a.date === dateStr);
        
        if (availability && availability.type !== "available") {
          // Explicitly marked as rest day, holiday, or sick leave - BLOCK
          return false;
        }
        
        // No record OR record says "available" - ALLOW
        return true;
      });

      allStaff.push(...available);
    }

    return allStaff;
  };

  // Helper: Check consecutive task violation
  const wouldViolateConsecutive = (staffId: string, task: Task, dateStr: string): boolean => {
    const currentDate = new Date(dateStr);
    
    // Check previous day
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    const prevDateStr = getLocalDateString(prevDate);
    const prevTask = staffTasksByDate[staffId]?.[prevDateStr];
    
    if (task === "Inbound" || task === "Inbound Late") {
      if (prevTask === "Inbound" || prevTask === "Inbound Late") return true;
    }
    if (prevTask === task) return true;
    
    // Check next day
    const nextDate = new Date(currentDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = getLocalDateString(nextDate);
    const nextTask = staffTasksByDate[staffId]?.[nextDateStr];
    
    if (task === "Inbound" || task === "Inbound Late") {
      if (nextTask === "Inbound" || nextTask === "Inbound Late") return true;
    }
    if (nextTask === task) return true;
    
    return false;
  };

  // Helper: Assign staff to a slot
  const assignStaff = (staffMember: StaffMember, task: Task, dateStr: string): void => {
    assignments.push({
      staffId: staffMember.id,
      staffName: staffMember.name,
      task: task,
      date: dateStr,
    });
    
    staffAssignmentCounts[staffMember.id]++;
    staffTasksByDate[staffMember.id][dateStr] = task;
    staffTaskCounts[staffMember.id][task]++;
  };

  // Simplified sorting: 4 priorities only
  const sortByFairness = (available: StaffMember[], task: Task, dateStr: string): StaffMember[] => {
    return available.sort((a, b) => {
      // Priority 1: Avoid consecutive tasks (hard constraint)
      const aViolates = wouldViolateConsecutive(a.id, task, dateStr);
      const bViolates = wouldViolateConsecutive(b.id, task, dateStr);
      if (aViolates && !bViolates) return 1;
      if (!aViolates && bViolates) return -1;

      // Sort by priority
      available.sort((a, b) => {
        // Priority 0: Avoid consecutive tasks (soft preference, not blocker)
        const aConsecutive = hasConsecutiveTask(a.id, task, dateStr);
        const bConsecutive = hasConsecutiveTask(b.id, task, dateStr);
        if (aConsecutive !== bConsecutive) return aConsecutive ? 1 : -1;

        // Priority 1: Fewest times doing THIS task
        const aTaskCount = taskCounts.get(a.id)?.get(task) || 0;
        const bTaskCount = taskCounts.get(b.id)?.get(task) || 0;
        if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;

        // Priority 2: Fewest overall assignments
        const aTotal = totalCounts.get(a.id) || 0;
        const bTotal = totalCounts.get(b.id) || 0;
        if (aTotal !== bTotal) return aTotal - bTotal;

        // Priority 3: Earlier shift preferred
        const aShiftIdx = shiftOrder.indexOf(a.shiftStart || "06:00");
        const bShiftIdx = shiftOrder.indexOf(b.shiftStart || "06:00");
        return aShiftIdx - bShiftIdx;
      });
    });
  };

  // Task priority for processing order
  const getTaskPriority = (task: Task): number => {
    if (task === "Frozen") return 1;
    if (task === "Inbound") return 1;
    if (task === "Inbound Late") return 2;
    if (task === "Milk" || task === "TWI" || task === "Outbound" || task === "Marshaling") return 3;
    return 4; // Housekeeping
  };

  const taskOrder = Object.keys(taskConfig).sort((a, b) => {
    const aPriority = getTaskPriority(a as Task);
    const bPriority = getTaskPriority(b as Task);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b);
  });

  // Track unfilled slots for diagnostics
  const unfilledSlots: Array<{ task: Task; date: string; reason: string }> = [];

  // ============================================
  // PHASE A: CRITICAL + FIRST ASSIGNMENTS
  // ============================================
  console.log("🎯 PHASE A: Critical tasks + ensuring everyone gets first assignment...");

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = getLocalDateString(currentDate);

    for (const taskName of taskOrder) {
      const task = taskName as Task;
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;

      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;
      const needed = required - existingCount;
      if (needed <= 0) continue;

      const available = getAvailableStaff(task, dateStr, dayIndex);
      
      if (available.length === 0) {
        unfilledSlots.push({ task, date: dateStr, reason: "No trained staff available" });
        continue;
      }

      // Priority 1: Tasks with limited staff pool (1-2 people) - assign immediately
      if (task !== "Inbound Late" && available.length <= 2) {
        const sorted = sortByFairness(available, task, dateStr);
        const toAssign = Math.min(needed, sorted.length);
        
        for (let i = 0; i < toAssign; i++) {
          assignStaff(sorted[i], task, dateStr);
        }
        continue;
      }

      // Priority 2: Staff with zero assignments get preference
      const zeroAssignmentStaff = available.filter(s => staffAssignmentCounts[s.id] === 0);
      
      if (zeroAssignmentStaff.length > 0) {
        const sorted = sortByFairness(zeroAssignmentStaff, task, dateStr);
        const toAssign = Math.min(needed, sorted.length);
        
        for (let i = 0; i < toAssign; i++) {
          assignStaff(sorted[i], task, dateStr);
        }
      }
    }
  }

  // ============================================
  // PHASE B: FAIR DISTRIBUTION
  // ============================================
  console.log("📍 PHASE B: Fair distribution with quotas...");

  // Step 1: Frozen-trained staff Inbound quota
  const frozenTrainedStaff = staff.filter(s => 
    s.trainedTasks.includes("Frozen") && s.trainedTasks.includes("Inbound")
  );
  
  for (const staffMember of frozenTrainedStaff) {
    const workingDays = staffWorkingDays[staffMember.id] || 0;
    
    let inboundQuota = 0;
    if (workingDays >= 5) inboundQuota = 2;
    else if (workingDays >= 3) inboundQuota = 1;
    
    if (inboundQuota === 0) continue;
    
    const currentInboundCount = assignments.filter(a => 
      a.staffId === staffMember.id && a.task === "Inbound"
    ).length;
    
    const inboundNeeded = inboundQuota - currentInboundCount;
    if (inboundNeeded <= 0) continue;
    
    let assigned = 0;
    for (let dayIndex = 0; dayIndex < 7 && assigned < inboundNeeded; dayIndex++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + dayIndex);
      const dateStr = getLocalDateString(currentDate);
      
      const task = "Inbound" as Task;
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;
      
      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;
      
      if (existingCount >= required) continue;
      
      const available = getAvailableStaff(task, dateStr, dayIndex);
      const canAssign = available.some(s => s.id === staffMember.id);
      
      if (canAssign && !wouldViolateConsecutive(staffMember.id, task, dateStr)) {
        assignStaff(staffMember, task, dateStr);
        assigned++;
      }
    }
  }

  // Step 2: Fill all remaining slots
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = getLocalDateString(currentDate);

    for (const taskName of taskOrder) {
      const task = taskName as Task;
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;

      const existingCount = assignments.filter(
        (a) => a.date === dateStr && a.task === task
      ).length;
      const needed = required - existingCount;
      if (needed <= 0) continue;

      const available = getAvailableStaff(task, dateStr, dayIndex);
      
      if (available.length === 0) {
        unfilledSlots.push({ task, date: dateStr, reason: "No available staff (all assigned or unavailable)" });
        continue;
      }

      const sorted = sortByFairness(available, task, dateStr);
      const toAssign = Math.min(needed, sorted.length);
      
      for (let i = 0; i < toAssign; i++) {
        assignStaff(sorted[i], task, dateStr);
      }

      // Log if we couldn't fill all slots
      if (toAssign < needed) {
        unfilledSlots.push({ 
          task, 
          date: dateStr, 
          reason: `Only ${toAssign}/${needed} slots filled (${available.length} available, ${needed - toAssign} blocked by constraints)` 
        });
      }
    }
  }

  // ============================================
  // DIAGNOSTICS
  // ============================================
  console.log("✅ Rota generation complete");
  console.log(`   Total assignments: ${assignments.length}`);
  
  const zeroAssignments = staff.filter(s => staffAssignmentCounts[s.id] === 0);
  if (zeroAssignments.length > 0) {
    console.log("⚠️ Staff with ZERO assignments:");
    zeroAssignments.forEach(s => {
      const workingDays = staffWorkingDays[s.id];
      const reasons: string[] = [];
      
      if (workingDays === 0) reasons.push("no working days this week");
      if (s.trainedTasks.length === 0) reasons.push("not trained on any tasks");
      if (s.trainedTasks.length > 0 && workingDays > 0) {
        reasons.push(`trained on ${s.trainedTasks.join(", ")} but couldn't be assigned - check task requirements and availability conflicts`);
      }
      
      console.log(`   - ${s.name}: ${reasons.join(", ")}`);
    });
  }

  if (unfilledSlots.length > 0) {
    console.log("⚠️ Unfilled slots:");
    unfilledSlots.forEach(slot => {
      console.log(`   - ${slot.task} on ${slot.date}: ${slot.reason}`);
    });
  }

  return assignments;
}

export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
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
  
  while (d.getDay() !== 0) {
    d.setDate(d.getDate() + 1);
  }
  
  while (d.getFullYear() === year || (d.getFullYear() === year + 1 && d.getMonth() === 0 && d.getDate() < 7)) {
    weeks.push(new Date(d));
    d.setDate(d.getDate() + 7);
  }
  
  return weeks.filter(w => w.getFullYear() === year || (w.getFullYear() === year - 1 && w.getMonth() === 11) || (w.getFullYear() === year + 1 && w.getMonth() === 0 && w.getDate() < 7));
}