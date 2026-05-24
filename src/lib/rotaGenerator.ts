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
  
  // NEW: Track how many times each staff member has done each specific task
  const staffTaskCounts: Record<string, Record<Task, number>> = {};
  
  // NEW: Track Inbound assignments for 06:00 shift staff based on working days
  const earlyShiftInboundCount: Record<string, number> = {};
  const earlyShiftWorkingDays: Record<string, number> = {};
  
  staff.forEach((s) => {
    staffAssignmentCounts[s.id] = 0;
    staffTasksByDate[s.id] = {};
    staffTaskCounts[s.id] = {
      "Frozen": 0,
      "Milk": 0,
      "TWI": 0,
      "Inbound": 0,
      "Outbound": 0,
      "Marshaling": 0,
      "Housekeeping": 0,
    };
    
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
      
      // Track task-specific counts
      if (staffTaskCounts[staffId]) {
        staffTaskCounts[staffId][a.task as Task] = (staffTaskCounts[staffId][a.task as Task] || 0) + 1;
      }
      
      // Count existing Inbound assignments for 06:00 shift staff
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

      // Sort by priority:
      // 1. Avoid consecutive same task (CRITICAL - prevents burnout)
      // 2. SPECIAL: For Inbound, NEVER assign if they had Inbound yesterday (hard rule)
      // 3. Fewest times doing THIS SPECIFIC task (task rotation fairness)
      // 4. Fewest overall assignments (general fairness)
      // 5. Shift start time (earlier shifts get slight priority)
      const sorted = shuffled.sort((a, b) => {
        // PRIORITY #1: Check what task they did on the previous day
        const aPrevTask = staffTasksByDate[a.id]?.[prevDateStr];
        const bPrevTask = staffTasksByDate[b.id]?.[prevDateStr];
        
        // SPECIAL RULE FOR INBOUND: Absolute block on consecutive Inbound days
        if (task === "Inbound") {
          const aHadInboundYesterday = aPrevTask === "Inbound";
          const bHadInboundYesterday = bPrevTask === "Inbound";
          
          // If A had Inbound yesterday but B didn't, B goes first (A is blocked)
          if (aHadInboundYesterday && !bHadInboundYesterday) return 1;
          if (!aHadInboundYesterday && bHadInboundYesterday) return -1;
        }
        
        // General rule: If A did this task yesterday but B didn't, B goes first
        if (aPrevTask === task && bPrevTask !== task) return 1;
        if (aPrevTask !== task && bPrevTask === task) return -1;

        // PRIORITY #2: How many times has each person done THIS SPECIFIC task?
        // This ensures fair rotation through each task type
        const aTaskCount = staffTaskCounts[a.id]?.[task] || 0;
        const bTaskCount = staffTaskCounts[b.id]?.[task] || 0;
        if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;

        // PRIORITY #3: Fewest assignments overall (general fairness)
        const aCount = staffAssignmentCounts[a.id] || 0;
        const bCount = staffAssignmentCounts[b.id] || 0;
        if (aCount !== bCount) return aCount - bCount;

        // PRIORITY #4: Slight preference for earlier shifts
        const aShiftIndex = shiftOrder.indexOf(a.shift);
        const bShiftIndex = shiftOrder.indexOf(b.shift);
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
        // Track what task this staff member did on this date
        staffTasksByDate[selectedStaff.id][dateStr] = task;
        
        // Track this specific task count for fairness
        if (staffTaskCounts[selectedStaff.id]) {
          staffTaskCounts[selectedStaff.id][task] = (staffTaskCounts[selectedStaff.id][task] || 0) + 1;
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

  // CONSTRAINT ENFORCEMENT: Ensure minimum assignments
  console.log("🔒 Enforcing minimum assignment constraints...");
  
  // Rule 1: All Frozen-trained staff must get at least 2 Frozen shifts per week
  const frozenTrainedStaff = staff.filter(s => 
    s.trainedTasks.includes("Frozen") && 
    !s.availability.some(a => 
      a.date >= weekStart && 
      a.date < new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 7)).toISOString().split('T')[0] &&
      (a.type === "rest_day" || a.type === "holiday" || a.type === "sick_leave")
    )
  );

  frozenTrainedStaff.forEach(staffMember => {
    const frozenAssignments = assignments.filter(a => 
      a.staffId === staffMember.id && 
      a.task === "Frozen" &&
      a.date >= weekStart &&
      a.date < new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 7)).toISOString().split('T')[0]
    );

    if (frozenAssignments.length < 2) {
      const needed = 2 - frozenAssignments.length;
      console.log(`  ⚠️ ${staffMember.name} needs ${needed} more Frozen shift(s) - searching for opportunities...`);
      
      // Find days where this staff member could be assigned to Frozen
      for (let d = 0; d < 7; d++) {
        if (frozenAssignments.length >= 2) break;
        
        const checkDate = new Date(weekStart);
        checkDate.setDate(checkDate.getDate() + d);
        const dateStr = checkDate.toISOString().split("T")[0];
        
        // Check if already assigned on this day
        const alreadyAssigned = assignments.some(a => a.staffId === staffMember.id && a.date === dateStr);
        if (alreadyAssigned) continue;
        
        // Check availability
        const unavailable = staffMember.availability.some(a => 
          a.date === dateStr && 
          (a.type === "rest_day" || a.type === "holiday" || a.type === "sick_leave")
        );
        if (unavailable) continue;
        
        // Check if Frozen needs more staff on this day
        const frozenNeeded = taskConfig["Frozen"][d];
        const frozenAssigned = assignments.filter(a => a.date === dateStr && a.task === "Frozen").length;
        
        if (frozenAssigned < frozenNeeded) {
          // Add assignment
          assignments.push({
            staffId: staffMember.id,
            staffName: staffMember.name,
            task: "Frozen",
            date: dateStr,
          });
          frozenAssignments.push(assignments[assignments.length - 1]);
          console.log(`    ✓ Added ${staffMember.name} to Frozen on ${dateStr}`);
        }
      }
    }
  });

  // Rule 2: Staff trained on Frozen who work 5 days must get at least 2 Inbound shifts per week
  const frozenFiveDayWorkers = staff.filter(s => {
    // Must be trained on Frozen
    if (!s.trainedTasks.includes("Frozen")) return false;
    
    // Must be trained on Inbound
    if (!s.trainedTasks.includes("Inbound")) return false;
    
    // Count how many days they're NOT unavailable this week
    const weekDates = Array.from({ length: 7 }, (_, d) => {
      const date = new Date(weekStart);
      date.setDate(date.getDate() + d);
      return date.toISOString().split('T')[0];
    });
    
    const unavailableDays = weekDates.filter(date => 
      s.availability.some(a => 
        a.date === date && 
        (a.type === "rest_day" || a.type === "holiday" || a.type === "sick_leave")
      )
    ).length;
    
    const workingDays = 7 - unavailableDays;
    return workingDays >= 5;
  });

  frozenFiveDayWorkers.forEach(staffMember => {
    const inboundAssignments = assignments.filter(a => 
      a.staffId === staffMember.id && 
      a.task === "Inbound" &&
      a.date >= weekStart &&
      a.date < new Date(new Date(weekStart).setDate(new Date(weekStart).getDate() + 7)).toISOString().split('T')[0]
    );

    if (inboundAssignments.length < 2) {
      const needed = 2 - inboundAssignments.length;
      console.log(`  ⚠️ ${staffMember.name} (Frozen-trained 5-day worker) needs ${needed} more Inbound shift(s)...`);
      
      // Find days where this staff member could be assigned to Inbound
      for (let d = 0; d < 7; d++) {
        if (inboundAssignments.length >= 2) break;
        
        const checkDate = new Date(weekStart);
        checkDate.setDate(checkDate.getDate() + d);
        const dateStr = checkDate.toISOString().split("T")[0];
        
        // Check if already assigned on this day
        const alreadyAssigned = assignments.some(a => a.staffId === staffMember.id && a.date === dateStr);
        if (alreadyAssigned) continue;
        
        // CRITICAL: Check if they had Inbound on the previous day (NO CONSECUTIVE INBOUND)
        const prevDate = new Date(checkDate);
        prevDate.setDate(prevDate.getDate() - 1);
        const prevDateStr = prevDate.toISOString().split("T")[0];
        const hadInboundYesterday = assignments.some(a => 
          a.staffId === staffMember.id && 
          a.date === prevDateStr && 
          a.task === "Inbound"
        );
        if (hadInboundYesterday) {
          console.log(`    ✗ Skipping ${dateStr} - ${staffMember.name} had Inbound on ${prevDateStr} (no consecutive)`);
          continue;
        }
        
        // Also check next day to avoid creating consecutive Inbound
        const nextDate = new Date(checkDate);
        nextDate.setDate(nextDate.getDate() + 1);
        const nextDateStr = nextDate.toISOString().split("T")[0];
        const hasInboundTomorrow = assignments.some(a => 
          a.staffId === staffMember.id && 
          a.date === nextDateStr && 
          a.task === "Inbound"
        );
        if (hasInboundTomorrow) {
          console.log(`    ✗ Skipping ${dateStr} - ${staffMember.name} has Inbound on ${nextDateStr} (no consecutive)`);
          continue;
        }
        
        // Check availability
        const unavailable = staffMember.availability.some(a => 
          a.date === dateStr && 
          (a.type === "rest_day" || a.type === "holiday" || a.type === "sick_leave")
        );
        if (unavailable) continue;
        
        // Check if Inbound needs more staff on this day
        const inboundNeeded = taskConfig["Inbound"][d];
        const inboundAssigned = assignments.filter(a => a.date === dateStr && a.task === "Inbound").length;
        
        if (inboundAssigned < inboundNeeded) {
          // Add assignment
          assignments.push({
            staffId: staffMember.id,
            staffName: staffMember.name,
            task: "Inbound",
            date: dateStr,
          });
          inboundAssignments.push(assignments[assignments.length - 1]);
          console.log(`    ✓ Added ${staffMember.name} to Inbound on ${dateStr}`);
        }
      }
    }
  });

  console.log("✅ Constraint enforcement complete");

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