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

      // Get eligible staff for this task/date
      let eligibleStaff = staff.filter((s) => {
        // Must be trained in this task
        if (!s.trainedTasks.includes(task)) return false;

        // Check if this is a rest day for this staff member
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        if (s.restDays && s.restDays.includes(dayOfWeek)) {
          return false; // Staff cannot work on their rest days
        }

        // Check availability for this specific date
        if (s.availability) {
          const dateAvailability = s.availability.find(
            (a) => a.date === dateStr
          );
          if (dateAvailability && dateAvailability.type !== "available") {
            return false; // Staff not available (sick, holiday, etc.)
          }
        }

        // Get assignments for this specific date
        const assignmentsForDate = assignments.filter(a => a.date === dateStr);

        // Check if already assigned on this date (but allow Frozen staff to do Inbound)
        const alreadyAssigned = assignmentsForDate.some((a) => {
          if (a.staffId === s.id) {
            // Special case: staff assigned to Frozen can also be assigned to Inbound
            if (task === "Inbound" && a.task === "Frozen") {
              return false;
            }
            return true;
          }
          return false;
        });
        if (alreadyAssigned) return false;

        return true;
      });

      // Split eligible staff into day and night shift workers
      const dayStaff = eligibleStaff.filter(s => {
        // Staff without shift specified defaults to Day
        if (!s.shift || s.shift === "Day") {
          // Further filter by shift start time - after 11:00 is considered night shift
          if (s.shiftStart) {
            const hour = parseInt(s.shiftStart.split(":")[0]);
            return hour <= 11; // Only include staff starting at or before 11:00
          }
          return true; // No shift start specified, include in day shift
        }
        return false;
      });
      
      const nightStaff = eligibleStaff.filter(s => {
        // Explicitly marked as night shift
        if (s.shift === "Night") return true;
        
        // Day shift staff starting after 11:00 are treated as night shift
        if ((!s.shift || s.shift === "Day") && s.shiftStart) {
          const hour = parseInt(s.shiftStart.split(":")[0]);
          return hour > 11;
        }
        
        return false;
      });

      log(`   📊 Day staff available (start ≤11:00): ${dayStaff.length}, Night staff available (start >11:00 or shift=Night): ${nightStaff.length}`);

      // Calculate how many assignments needed for each shift (split evenly if not specified)
      const dayNeeded = Math.ceil(needed / 2);
      const nightNeeded = needed - dayNeeded;

      // Process day shift assignments
      if (dayNeeded > 0 && dayStaff.length > 0) {
        log(`   ☀️ Assigning ${Math.min(dayNeeded, dayStaff.length)} day shift staff`);
        
        // Sort by fairness
        dayStaff.sort((a, b) => {
          const aTaskCount = (taskCounts[a.id] && taskCounts[a.id][task]) || 0;
          const bTaskCount = (taskCounts[b.id] && taskCounts[b.id][task]) || 0;
          if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;
          
          const aTotal = assignmentCounts[a.id] || 0;
          const bTotal = assignmentCounts[b.id] || 0;
          return aTotal - bTotal;
        });

        const dayToAssign = Math.min(dayNeeded, dayStaff.length);
        for (let i = 0; i < dayToAssign; i++) {
          const staffMember = dayStaff[i];
          
          const assignment: Assignment = {
            date: dateStr,
            task,
            staffId: staffMember.id,
            staffName: staffMember.name,
            shift: "Day",
          };
          assignments.push(assignment);

          assignmentCounts[staffMember.id]++;
          taskCounts[staffMember.id] = taskCounts[staffMember.id] || ({} as Record<Task, number>);
          taskCounts[staffMember.id][task] = (taskCounts[staffMember.id][task] || 0) + 1;
          
          if (task === "Inbound") {
            inboundCounts[staffMember.id]++;
          }

          const taskCount = taskCounts[staffMember.id][task];
          const totalCount = assignmentCounts[staffMember.id];
          log(`      ✅ [DAY] ${staffMember.name} → ${task} (${taskCount}x this task, ${totalCount} total)`);
        }
      }

      // Process night shift assignments
      if (nightNeeded > 0 && nightStaff.length > 0) {
        log(`   🌙 Assigning ${Math.min(nightNeeded, nightStaff.length)} night shift staff`);
        
        // Sort by fairness
        nightStaff.sort((a, b) => {
          const aTaskCount = (taskCounts[a.id] && taskCounts[a.id][task]) || 0;
          const bTaskCount = (taskCounts[b.id] && taskCounts[b.id][task]) || 0;
          if (aTaskCount !== bTaskCount) return aTaskCount - bTaskCount;
          
          const aTotal = assignmentCounts[a.id] || 0;
          const bTotal = assignmentCounts[b.id] || 0;
          return aTotal - bTotal;
        });

        const nightToAssign = Math.min(nightNeeded, nightStaff.length);
        for (let i = 0; i < nightToAssign; i++) {
          const staffMember = nightStaff[i];
          
          const assignment: Assignment = {
            date: dateStr,
            task,
            staffId: staffMember.id,
            staffName: staffMember.name,
            shift: "Night",
          };
          assignments.push(assignment);

          assignmentCounts[staffMember.id]++;
          taskCounts[staffMember.id] = taskCounts[staffMember.id] || ({} as Record<Task, number>);
          taskCounts[staffMember.id][task] = (taskCounts[staffMember.id][task] || 0) + 1;
          
          if (task === "Inbound") {
            inboundCounts[staffMember.id]++;
          }

          const taskCount = taskCounts[staffMember.id][task];
          const totalCount = assignmentCounts[staffMember.id];
          log(`      ✅ [NIGHT] ${staffMember.name} → ${task} (${taskCount}x this task, ${totalCount} total)`);
        }
      }

      const totalAssigned = (dayNeeded > 0 && dayStaff.length > 0 ? Math.min(dayNeeded, dayStaff.length) : 0) +
                           (nightNeeded > 0 && nightStaff.length > 0 ? Math.min(nightNeeded, nightStaff.length) : 0);
      
      if (totalAssigned < needed) {
        log(`   ⚠️  WARNING: Only assigned ${totalAssigned}/${needed} for ${task} (day: ${dayStaff.length} available, night: ${nightStaff.length} available)`);
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