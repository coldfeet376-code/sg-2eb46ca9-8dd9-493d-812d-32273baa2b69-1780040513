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
  // Track unique non-Frozen tasks for variety (5-day workers should get 2+ different tasks)
  const staffTaskVariety: Record<string, Set<Task>> = {};
  
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
    staffTaskVariety[s.id] = new Set<Task>();
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
      
      if (a.task !== "Frozen") {
        staffTaskVariety[staffId]?.add(a.task as Task);
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

        // Check availability
        const availability = s.availability?.find((a) => a.date === dateStr);
        if (availability && availability.type !== "available") return false;

        return true;
      });

      allStaff.push(...available);
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

  // Define task priority - higher priority tasks are filled first
  const getTaskPriority = (task: Task): number => {
    if (task === "Frozen") return 1; // Specialized training
    if (task === "Inbound") return 1; // Early shift must be covered first
    if (task === "Inbound Late") return 2; // Late shift fills after early
    if (task === "Milk") return 3;
    if (task === "TWI") return 3;
    if (task === "Outbound") return 3;
    if (task === "Marshaling") return 3;
    if (task === "Housekeeping") return 4; // Lowest priority
    return 5;
  };

  // Sort tasks by priority for processing order
  const taskOrder = Object.keys(taskConfig).sort((a, b) => {
    const aPriority = getTaskPriority(a as Task);
    const bPriority = getTaskPriority(b as Task);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return a.localeCompare(b); // Alphabetical for same priority
  });

  console.log("📋 Task processing order:", taskOrder.join(" → "));

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
  // PRE-PHASE: CRITICAL ASSIGNMENTS (Limited Options)
  // ============================================
  console.log("🎯 PRE-PHASE: Handling constrained tasks (only 1-2 staff available)...");

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Check each task on this day (in priority order)
    for (const taskName of taskOrder) {
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
      
      // CRITICAL: If only 1-2 staff available for this task, assign immediately
      // BUT: Skip "Inbound Late" - it's a subset of Inbound-trained staff and should be filled AFTER Inbound
      if (task !== "Inbound Late" && available.length > 0 && available.length <= 2) {
        console.log(`  🚨 CRITICAL: Only ${available.length} staff available for ${task} on ${dateStr}: ${available.map(s => s.name).join(", ")}`);
        
        // Sort by: no consecutive tasks > fewest specific task count > fewest overall
        const sorted = available.sort((a, b) => {
          const aViolates = wouldViolateConsecutive(a.id, task, dateStr);
          const bViolates = wouldViolateConsecutive(b.id, task, dateStr);
          if (aViolates && !bViolates) return 1;
          if (!aViolates && bViolates) return -1;
          
          const aTaskCount = staffTaskCounts[a.id]?.[task] || 0;
          const bTaskCount = staffTaskCounts[b.id]?.[task] || 0;
          if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;
          
          const aCount = staffAssignmentCounts[a.id] || 0;
          const bCount = staffAssignmentCounts[b.id] || 0;
          return aCount - bCount;
        });

        // Assign as many as needed from the limited pool
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
          if (task !== "Frozen") {
            staffTaskVariety[selectedStaff.id].add(task);
          }
          
          console.log(`  ✓ CRITICAL: Assigned ${selectedStaff.name} to ${task} on ${dateStr} (limited options)`);
        }
      }
    }
  }

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

    // For each task on this day (in priority order)
    for (const taskName of taskOrder) {
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
          if (task !== "Frozen") {
            staffTaskVariety[selectedStaff.id].add(task);
          }
          
          console.log(`  ✓ Assigned ${selectedStaff.name} to ${task} on ${dateStr} (first assignment)`);
        }
      }
    }
  }

  // ============================================
  // PHASE 1.5: INBOUND QUOTA FOR FROZEN-TRAINED STAFF
  // ============================================
  console.log("📍 PHASE 1.5: Ensuring Frozen-trained staff get Inbound quota...");

  // Identify Frozen-trained staff and their Inbound quota
  const frozenTrainedStaff = staff.filter(s => s.trainedTasks.includes("Frozen") && s.trainedTasks.includes("Inbound"));
  
  for (const staffMember of frozenTrainedStaff) {
    const workingDays = staffWorkingDays[staffMember.id] || 0;
    
    // Determine Inbound quota based on working days
    let inboundQuota = 0;
    if (workingDays >= 5) {
      inboundQuota = 2; // 5-day workers get 2 Inbound shifts
    } else if (workingDays >= 3) {
      inboundQuota = 1; // 3-day workers get 1 Inbound shift
    }
    
    if (inboundQuota === 0) continue;
    
    // Count current Inbound assignments for this staff member
    const currentInboundCount = assignments.filter(a => 
      a.staffId === staffMember.id && (a.task === "Inbound" || a.task === "Inbound Late")
    ).length;
    
    const inboundNeeded = inboundQuota - currentInboundCount;
    
    if (inboundNeeded <= 0) {
      console.log(`  ✓ ${staffMember.name} already has ${currentInboundCount}/${inboundQuota} Inbound shifts`);
      continue;
    }
    
    console.log(`  🎯 ${staffMember.name} needs ${inboundNeeded} more Inbound shifts (${currentInboundCount}/${inboundQuota} current)`);
    
    // Find days where we can assign this staff member to Inbound
    let assigned = 0;
    for (let dayIndex = 0; dayIndex < 7 && assigned < inboundNeeded; dayIndex++) {
      const currentDate = new Date(weekStart);
      currentDate.setDate(currentDate.getDate() + dayIndex);
      const dateStr = currentDate.toISOString().split("T")[0];
      
      // Try Inbound first, then Inbound Late
      for (const task of ["Inbound", "Inbound Late"] as Task[]) {
        if (assigned >= inboundNeeded) break;
        
        const required = taskConfig[task][dayIndex] || 0;
        if (required === 0) continue;
        
        const existingCount = assignments.filter(
          (a) => a.date === dateStr && a.task === task
        ).length;
        
        if (existingCount >= required) continue; // This task is full
        
        // Check if this staff member can be assigned
        const available = getAvailableStaff(task, dateStr, dayIndex);
        const canAssign = available.some(s => s.id === staffMember.id);
        
        if (canAssign && !wouldViolateConsecutive(staffMember.id, task, dateStr)) {
          assignments.push({
            staffId: staffMember.id,
            staffName: staffMember.name,
            task: task,
            date: dateStr,
          });
          
          staffAssignmentCounts[staffMember.id]++;
          staffTasksByDate[staffMember.id][dateStr] = task;
          staffTaskCounts[staffMember.id][task]++;
          if (task !== "Frozen") {
            staffTaskVariety[staffMember.id].add(task);
          }
          
          assigned++;
          console.log(`    ✓ Assigned ${staffMember.name} to ${task} on ${dateStr} (quota: ${assigned}/${inboundQuota})`);
          break; // Move to next day
        }
      }
    }
    
    if (assigned < inboundNeeded) {
      console.log(`  ⚠️ Could only assign ${assigned}/${inboundQuota} Inbound shifts for ${staffMember.name} (insufficient slots/availability)`);
    }
  }

  // ============================================
  // PHASE 2: FILL REMAINING SLOTS WITH FAIRNESS
  // ============================================
  console.log("📍 PHASE 2: Filling remaining slots with fairness algorithm...");

  // Helper: Calculate available staff pool size for each task on each day
  const getTaskPoolSize = (task: Task, dateStr: string, dayIndex: number): number => {
    return getAvailableStaff(task, dateStr, dayIndex).length;
  };

  // Helper: Calculate "opportunity cost" of assigning this person to this task
  // Lower score = they're needed more elsewhere (should go to scarce tasks)
  // Higher score = they have plenty of alternatives (can do common tasks)
  const calculateOpportunityCost = (staffMember: StaffMember, currentTask: Task, dateStr: string, dayIndex: number): number => {
    let totalAlternativePoolSize = 0;
    let alternativeTaskCount = 0;

    // Check all OTHER tasks this person could do on this day
    for (const task of staffMember.trainedTasks) {
      if (task === currentTask) continue; // Skip the task we're considering
      
      const taskToCheck = task === "Inbound Late" ? "Inbound" : task;
      if (!staffMember.trainedTasks.includes(taskToCheck)) continue;

      // Check if this task needs staff on this day
      const required = taskConfig[task][dayIndex] || 0;
      if (required === 0) continue;

      // Count how many other people could do this alternative task
      const poolSize = getTaskPoolSize(task, dateStr, dayIndex);
      if (poolSize > 0) {
        totalAlternativePoolSize += poolSize;
        alternativeTaskCount++;
      }
    }

    // If they have no alternatives, return 0 (high priority for current task)
    if (alternativeTaskCount === 0) return 0;

    // Average pool size for their alternative tasks
    // Higher = they have lots of options elsewhere = assign them to current task
    // Lower = they're scarce elsewhere = save them for scarce tasks
    return totalAlternativePoolSize / alternativeTaskCount;
  };

  // Process each day again to fill remaining capacity
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(currentDate.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Process each task (in priority order - Inbound before Inbound Late)
    for (const taskName of taskOrder) {
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

        // Priority 2: Task variety for 5+ day workers (should get 2+ unique non-Frozen tasks)
        if (task !== "Frozen") {
          const aWorkingDays = staffWorkingDays[a.id] || 0;
          const bWorkingDays = staffWorkingDays[b.id] || 0;
          const aVariety = staffTaskVariety[a.id]?.size || 0;
          const bVariety = staffTaskVariety[b.id]?.size || 0;
          
          // If staff works 5+ days and has <2 unique non-Frozen tasks, prioritize them
          const aNeedsVariety = aWorkingDays >= 5 && aVariety < 2;
          const bNeedsVariety = bWorkingDays >= 5 && bVariety < 2;
          
          if (aNeedsVariety && !bNeedsVariety) return -1;
          if (!aNeedsVariety && bNeedsVariety) return 1;
        }

        // Priority 3: Resource scarcity - assign to tasks where they're most needed
        // People with larger alternative pools go to common tasks, scarce specialists saved for scarce tasks
        const aOpportunityCost = calculateOpportunityCost(a, task, dateStr, dayIndex);
        const bOpportunityCost = calculateOpportunityCost(b, task, dateStr, dayIndex);
        // Higher opportunity cost = more alternatives = lower priority for THIS task
        if (aOpportunityCost !== bOpportunityCost) return bOpportunityCost - aOpportunityCost;

        // Priority 4: Fewest times doing THIS specific task
        const aTaskCount = staffTaskCounts[a.id]?.[task] || 0;
        const bTaskCount = staffTaskCounts[b.id]?.[task] || 0;
        if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;

        // Priority 5: Fewest overall assignments
        const aCount = staffAssignmentCounts[a.id] || 0;
        const bCount = staffAssignmentCounts[b.id] || 0;
        if (aCount !== bCount) return aCount - bCount;

        // Priority 6: Earlier shifts get slight preference
        const shiftA = a.shiftStart || "06:00";
        const shiftB = b.shiftStart || "06:00";
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
        if (task !== "Frozen") {
          staffTaskVariety[selectedStaff.id].add(task);
        }
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