import type { StaffMember, Assignment, Task, ShiftStart } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

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
  
  // Track how many times each person has been assigned
  const assignmentCounts: Record<string, number> = {};
  const taskCounts: Record<string, Record<Task, number>> = {};
  const lastTaskAssigned: Record<string, Task | null> = {};
  const inboundCounts: Record<string, number> = {}; // NEW: Track inbound assignments per person

  // Initialize tracking
  staff.forEach((s) => {
    assignmentCounts[s.id] = 0;
    taskCounts[s.id] = {} as Record<Task, number>;
    lastTaskAssigned[s.id] = null;
    inboundCounts[s.id] = 0; // NEW: Initialize inbound counter
  });

  // Generate assignments for each day (Sun-Sat)
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    // Create date using local time - NO timezone conversion
    const currentDate = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + dayOffset);
    const dateStr = getLocalDateString(currentDate);
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][currentDate.getDay()];
    
    log(`\n${"=".repeat(60)}`);
    log(`📅 ${dayName} ${dateStr}`);
    log(`${"=".repeat(60)}`);

    // Process each task for this day
    // taskConfig[task][dayIndex] maps correctly: [0]=Sunday, [1]=Monday, ..., [6]=Saturday
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

        // Check availability for this specific date
        const hasRestDay = s.availability?.some(a => a.date === dateStr && a.type === 'rest');
        const hasHoliday = s.availability?.some(a => a.date === dateStr && a.type === 'holiday');
        const hasSickLeave = s.availability?.some(a => a.date === dateStr && a.type === 'sick');
        
        // NEW: Check recurring rest days
        const isRecurringRestDay = s.recurringRestDays?.includes(currentDate.getDay());
        
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

        // NEW: Inbound constraint for part-time staff
        if (task === "Inbound") {
          const totalShiftsThisWeek = assignmentCounts[s.id];
          const inboundShiftsThisWeek = inboundCounts[s.id];
          
          // If staff member is working ≤3 shifts and already has 1 inbound, skip them
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

      // Sort by fairness: fewest times doing THIS task, then fewest overall
      availableStaff.sort((a, b) => {
        const aTaskCount = (taskCounts[a.id] && taskCounts[a.id][task]) || 0;
        const bTaskCount = (taskCounts[b.id] && taskCounts[b.id][task]) || 0;
        if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;
        
        const aTotal = assignmentCounts[a.id] || 0;
        const bTotal = assignmentCounts[b.id] || 0;
        return aTotal - bTotal;
      });

      // Assign staff
      const toAssign = Math.min(needed, availableStaff.length);
      log(`   ⚡ Assigning ${toAssign} staff:`);
      
      for (let i = 0; i < toAssign; i++) {
        const staffMember = availableStaff[i];
        
        // Create assignment
        const assignment: Assignment = {
          date: dateStr, // Already in YYYY-MM-DD format from getLocalDateString
          task,
          staffId: staffMember.id,
          staffName: staffMember.name,
        };
        assignments.push(assignment);

        assignmentCounts[staffMember.id]++;
        taskCounts[staffMember.id] = taskCounts[staffMember.id] || ({} as Record<Task, number>);
        taskCounts[staffMember.id][task] = (taskCounts[staffMember.id][task] || 0) + 1;
        
        // NEW: Track inbound assignments
        if (task === "Inbound") {
          inboundCounts[staffMember.id]++;
          log(`      📊 Inbound count for ${staffMember.name}: ${inboundCounts[staffMember.id]}`);
        }

        const taskCount = taskCounts[staffMember.id][task];
        const totalCount = assignmentCounts[staffMember.id];
        log(`      ✅ ${staffMember.name} → ${task} (${taskCount}x this task, ${totalCount} total)`);
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
    const tasks = Object.entries(taskCounts[s.id] || {})
      .filter(([_, count]) => count > 0)
      .map(([task, count]) => `${task}:${count}`)
      .join(", ");
    log(`   ${s.name}: ${count} assignments ${tasks ? `(${tasks})` : ''}`);
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