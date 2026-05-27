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

  const assignments: Assignment[] = [...lockedAssignments];
  
  // Track how many times each person has been assigned
  const assignmentCounts: Record<string, number> = {};
  const taskCounts: Record<string, Record<Task, number>> = {};
  const lastTaskAssigned: Record<string, Task | null> = {};

  // Initialize tracking
  staff.forEach((s) => {
    assignmentCounts[s.id] = 0;
    taskCounts[s.id] = {} as Record<Task, number>;
    lastTaskAssigned[s.id] = null;
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

      // Find available staff for this task on this day
      const availableStaff: StaffMember[] = [];

      for (const staffMember of staff) {
        // Check 1: Is staff trained for this task?
        const taskToCheck = task === "Inbound Late" ? "Inbound" : task;
        if (!staffMember.trainedTasks.includes(taskToCheck)) {
          log(`      ❌ ${staffMember.name}: Not trained on ${taskToCheck}`);
          continue;
        }

        // Check 1.5: Weekly Inbound limit for part-time staff
        const partTimeInboundLimit = ["POPE R", "FLAHERTY P", "WILSON I"];
        if (partTimeInboundLimit.includes(staffMember.name) && (task === "Inbound" || task === "Inbound Late")) {
          const inboundThisWeek = assignments.filter(
            a => a.staffId === staffMember.id && (a.task === "Inbound" || a.task === "Inbound Late")
          ).length;
          
          if (inboundThisWeek >= 1) {
            log(`      ❌ ${staffMember.name}: Already has ${inboundThisWeek} Inbound this week (max 1)`);
            continue;
          }
        }

        // Check 2: Is staff available on this date?
        // Simple, bulletproof: find exact date match, check type
        const unavailableEntry = staffMember.availability?.find(a => {
          if (a.date !== dateStr) return false;
          const type = a.type.toString().toLowerCase().trim();
          return type.includes('rest') || type.includes('holiday') || type.includes('sick');
        });
        
        if (unavailableEntry) {
          log(`      ⛔ ${staffMember.name}: ${unavailableEntry.type} on ${dateStr}`);
          continue;
        }
        
        log(`      ✓ ${staffMember.name}: available`);
        availableStaff.push(staffMember);
      }

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