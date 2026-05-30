import type { StaffMember, Assignment, Task, ShiftStart } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

// Task weights for fairness - Inbound Late is half a shift
const TASK_WEIGHTS: Record<Task, number> = {
  "Frozen": 1.0,
  "Milk": 1.0,
  "TWI": 1.0,
  "Inbound": 1.0,
  "Inbound Late": 0.5, // Half-day shift
  "Outbound": 1.0,
  "Marshaling": 1.0,
  "Equipment": 1.0,
};

// Centralized date handling - use local components only
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
}): { assignments: Assignment[]; diagnostics: string[] } {
  const diagnostics: string[] = [];
  const log = (msg: string) => diagnostics.push(msg);
  
  log(`📅 Week: ${weekStart.toDateString()}`);
  log("=".repeat(60));
  log("🚀 ROTA GENERATION STARTED");
  log(`👥 Staff: ${staff.length}`);
  log(`🔒 Locked: ${lockedAssignments.length}`);
  log("=".repeat(60));

  const weekDates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    weekDates.push(date);
  }

  // Special diagnostic for problematic week
  const weekStartStr = getLocalDateString(weekStart);
  if (weekStartStr === "2026-05-24") {
    log("🔍 DIAGNOSTIC: Processing problematic week 2026-05-24");
    log(`   Week start: ${weekStart.toISOString()}`);
    log(`   Week dates: ${weekDates.map(d => getLocalDateString(d)).join(", ")}`);
    log(`   Staff count: ${staff.length}`);
    log(`   Task config: ${JSON.stringify(taskConfig)}`);
  }

  const assignments: Assignment[] = [...lockedAssignments];
  
  // Track weighted assignment counts (Inbound Late = 0.5, others = 1.0)
  const assignmentCounts: Record<string, number> = {}; // Raw counts for display
  const weightedCounts: Record<string, number> = {}; // Weighted for fairness
  const taskCounts: Record<Task, number> = {
    "Frozen": 0,
    "Milk": 0,
    "TWI": 0,
    "Inbound": 0,
    "Outbound": 0,
    "Marshaling": 0,
    "Equipment": 0,
    "Inbound Late": 0,
  };
  const lastTaskAssigned: Record<string, Task | null> = {};
  const inboundCounts: Record<string, number> = {};

  // Initialize tracking
  staff.forEach((s) => {
    assignmentCounts[s.id] = 0;
    weightedCounts[s.id] = 0;
    taskCounts[s.id] = {} as Record<Task, number>;
    lastTaskAssigned[s.id] = null;
    inboundCounts[s.id] = 0;
  });

  // Generate assignments for each day (Sun-Sat)
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayOffset);
    const dateStr = getLocalDateString(currentDate);
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()];
    
    log(`\n${"=".repeat(60)}`);
    log(`📅 ${dayName} ${dateStr}`);
    log(`${"=".repeat(60)}`);

    // Process each task for this day
    for (const taskName of Object.keys(taskConfig)) {
      const task = taskName as Task;
      const required = taskConfig[task][dayOffset];
      
      if (required === 0) {
        log(`   ⏭️  ${task}: 0 required, skipping`);
        continue;
      }

      log(`\n   🎯 ${task}: ${required} required`);

      // Check how many are already assigned (locked)
      const alreadyAssigned = assignments.filter(
        a => a.date === dateStr && a.task === task
      ).length;
      
      const needed = required - alreadyAssigned;
      
      if (needed <= 0) {
        log(`   ✅ ${task}: Already filled (${alreadyAssigned}/${required})`);
        continue;
      }

      log(`   🔍 Need to assign ${needed} more staff`);

      // Filter available staff for this task on this day
      const availableStaff = staff.filter((s) => {
        // Must be trained for this task
        if (!s.trainedTasks.includes(task)) {
          return false;
        }

        // Check if already assigned to ANY task on this date
        const alreadyAssignedToday = assignments.some(
          a => a.date === dateStr && a.staffId === s.id
        );
        if (alreadyAssignedToday) {
          log(`   ❌ ${s.name} - already assigned to another task today`);
          return false;
        }

        // Check availability for this specific date
        const hasRestDay = s.availability?.some(a => a.date === dateStr && a.type === 'rest');
        const hasHoliday = s.availability?.some(a => a.date === dateStr && a.type === 'holiday');
        const hasSickLeave = s.availability?.some(a => a.date === dateStr && a.type === 'sick');
        const isRecurringRestDay = s.restDays?.includes(currentDate.getDay());
        
        // DEBUG: Log Brian Murray's availability check
        if (s.name.includes('BRIAN')) {
          log(`   🔍 BRIAN MURRAY availability check for ${dateStr}:`);
          log(`      Total availability entries: ${s.availability?.length || 0}`);
          log(`      Has rest day? ${hasRestDay}`);
          log(`      Has holiday? ${hasHoliday}`);
          log(`      Has sick leave? ${hasSickLeave}`);
          log(`      Is recurring rest day? ${isRecurringRestDay}`);
          if (s.availability && s.availability.length > 0) {
            const matchingEntry = s.availability.find(a => a.date === dateStr);
            log(`      Matching entry for ${dateStr}: ${matchingEntry ? JSON.stringify(matchingEntry) : 'NONE'}`);
            log(`      Sample availability dates: ${s.availability.slice(0, 5).map(a => `${a.date}(${a.type})`).join(', ')}`);
          }
        }
        
        if (hasRestDay || hasHoliday || hasSickLeave || isRecurringRestDay) {
          log(`   ❌ ${s.name} - unavailable (${hasRestDay ? 'rest' : hasHoliday ? 'holiday' : hasSickLeave ? 'sick' : 'recurring rest'})`);
          return false;
        }

        // Inbound constraint for part-time staff
        if (task === "Inbound") {
          const totalShiftsThisWeek = assignmentCounts[s.id];
          const inboundShiftsThisWeek = inboundCounts[s.id];
          
          if (totalShiftsThisWeek <= 3 && inboundShiftsThisWeek >= 1) {
            log(`   ⚠️ ${s.name} - inbound constraint (part-time with ${inboundShiftsThisWeek} inbound already)`);
            return false;
          }
        }

        return true;
      });

      log(`   📊 ${availableStaff.length} staff available: ${availableStaff.map(s => s.name).join(", ")}`);

      if (availableStaff.length === 0) {
        log(`   ⚠️  WARNING: No staff available for ${task} on ${dayName}`);
        continue;
      }

      // Sort by WEIGHTED fairness: fewest weighted shifts, then fewest of THIS task
      availableStaff.sort((a, b) => {
        // Primary: lowest weighted total gets priority
        const aWeighted = weightedCounts[a.id] || 0;
        const bWeighted = weightedCounts[b.id] || 0;
        if (aWeighted !== bWeighted) return aWeighted - bWeighted;
        
        // Secondary: fewest times doing THIS specific task
        const aTaskCount = (taskCounts[a.id]?.[task] as number) || 0;
        const bTaskCount = (taskCounts[b.id]?.[task] as number) || 0;
        return aTaskCount - bTaskCount;
      });

      // Assign staff
      const toAssign = Math.min(needed, availableStaff.length);
      log(`   ⚡ Assigning ${toAssign} staff:`);
      
      for (let i = 0; i < toAssign; i++) {
        const staffMember = availableStaff[i];
        
        // Create assignment
        const assignment: Assignment = {
          date: dateStr,
          task,
          staffId: staffMember.id,
          staffName: staffMember.name,
        };
        assignments.push(assignment);

        // Update counts
        assignmentCounts[staffMember.id]++;
        
        // Update WEIGHTED count
        const taskWeight = TASK_WEIGHTS[task] || 1.0;
        weightedCounts[staffMember.id] = (weightedCounts[staffMember.id] || 0) + taskWeight;
        
        taskCounts[staffMember.id] = taskCounts[staffMember.id] || ({} as Record<Task, number>);
        taskCounts[staffMember.id][task] = (taskCounts[staffMember.id][task] || 0) + 1;
        
        // Track inbound assignments
        if (task === "Inbound") {
          inboundCounts[staffMember.id]++;
          log(`      📊 Inbound count for ${staffMember.name}: ${inboundCounts[staffMember.id]}`);
        }

        const taskCount = taskCounts[staffMember.id][task];
        const totalCount = assignmentCounts[staffMember.id];
        const weightedTotal = weightedCounts[staffMember.id].toFixed(1);
        log(`      ✅ ${staffMember.name} → ${task} (${taskCount}x this task, ${totalCount} raw, ${weightedTotal} weighted)`);
      }

      if (toAssign < needed) {
        log(`   ⚠️  WARNING: Only assigned ${toAssign}/${needed} for ${task}`);
      }
    }
  }

  log("\n" + "=".repeat(60));
  log("📊 FINAL ASSIGNMENT SUMMARY");
  log("=".repeat(60));
  staff.forEach(s => {
    const count = assignmentCounts[s.id] || 0;
    const weighted = (weightedCounts[s.id] || 0).toFixed(1);
    const tasks = Object.entries(taskCounts[s.id] || {})
      .filter(([_, count]) => count > 0)
      .map(([task, count]) => `${task}:${count}`)
      .join(", ");
    log(`   ${s.name}: ${count} raw / ${weighted} weighted ${tasks ? `(${tasks})` : ''}`);
  });

  const unassigned = staff.filter(s => (assignmentCounts[s.id] || 0) === 0);
  if (unassigned.length > 0) {
    log(`\n⚠️  Staff with ZERO assignments: ${unassigned.map(s => s.name).join(", ")}`);
  }

  log(`\n✅ Total assignments: ${assignments.length}`);
  log("=".repeat(60) + "\n");

  return { assignments, diagnostics };
}

export function getWeekStart(date: Date): Date {
  // Create a new date at midnight local time
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
  
  // Go back to the most recent Sunday (or stay on Sunday if already Sunday)
  const daysToSubtract = day; // If day=0 (Sunday), subtract 0; if day=6 (Saturday), subtract 6
  d.setDate(d.getDate() - daysToSubtract);
  
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