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
  
  // CRITICAL DEBUG: Show exactly what week we're generating for
  // Note: baseYear, baseMonth, baseDay are defined below in the main loop
  const debugYear = weekStart.getFullYear();
  const debugMonth = weekStart.getMonth();
  const debugDay = weekStart.getDate();
  const weekEndDate = new Date(debugYear, debugMonth, debugDay + 6);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🗓️  GENERATING ROTA FOR WEEK:`);
  console.log(`   Start (Sunday):  ${weekStart.toDateString()} (${debugYear}-${String(debugMonth+1).padStart(2,'0')}-${String(debugDay).padStart(2,'0')})`);
  console.log(`   End (Saturday):  ${weekEndDate.toDateString()} (${weekEndDate.getFullYear()}-${String(weekEndDate.getMonth()+1).padStart(2,'0')}-${String(weekEndDate.getDate()).padStart(2,'0')})`);
  console.log('');
  console.log('   Full Week Dates:');
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(debugYear, debugMonth, debugDay + i);
    const dayStr = getLocalDateString(dayDate);
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i];
    console.log(`   ${dayName.padEnd(10)}: ${dayDate.toDateString()} (${dayStr})`);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  log(`📅 Week: ${weekStart.toDateString()}`);
  log("=".repeat(60));
  log("🚀 ROTA GENERATION STARTED");
  log(`👥 Staff: ${staff.length}`);
  log(`🔒 Locked: ${lockedAssignments.length}`);
  log("=".repeat(60));

  const assignments: Assignment[] = [...lockedAssignments];
  
  // Extract local date components once
  const baseYear = weekStart.getFullYear();
  const baseMonth = weekStart.getMonth();
  const baseDay = weekStart.getDate();

  // Track how many times each person has been assigned
  const assignmentCounts: Record<string, number> = {};
  const taskCounts: Record<string, Record<Task, number>> = {};
  
  const initTaskRecord = (): Record<Task, number> => ({
    "Frozen": 0,
    "Milk": 0,
    "TWI": 0,
    "Inbound": 0,
    "Inbound Late": 0,
    "Outbound": 0,
    "Marshaling": 0,
    "Housekeeping": 0
  });

  staff.forEach(s => {
    assignmentCounts[s.id] = 0;
    taskCounts[s.id] = initTaskRecord();
  });

  // Count locked assignments
  lockedAssignments.forEach(a => {
    if (a.staffId) {
      assignmentCounts[a.staffId] = (assignmentCounts[a.staffId] || 0) + 1;
      taskCounts[a.staffId] = taskCounts[a.staffId] || initTaskRecord();
      taskCounts[a.staffId][a.task as Task] = (taskCounts[a.staffId][a.task as Task] || 0) + 1;
    }
  });

  log("\n📋 Initial assignment counts:");
  staff.forEach(s => {
    log(`   ${s.name}: ${assignmentCounts[s.id]} assignments`);
  });

  // Process each day
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(baseYear, baseMonth, baseDay + dayIndex);
    const dateStr = getLocalDateString(currentDate);
    const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayIndex];
    
    log(`\n${"=".repeat(60)}`);
    log(`📅 ${dayName} - ${dateStr}`);
    log("=".repeat(60));

    // Process each task for this day
    // taskConfig[task][dayIndex] maps correctly: [0]=Sunday, [1]=Monday, ..., [6]=Saturday
    for (const taskName of Object.keys(taskConfig)) {
      const task = taskName as Task;
      const required = taskConfig[task][dayIndex];
      
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
        // Match EXACT date string format (YYYY-MM-DD)
        // Find ALL entries for this date (in case of duplicates) and use the most restrictive
        const availabilityEntries = staffMember.availability?.filter(a => a.date === dateStr) || [];
        
        console.log(`    🔍 Checking ${staffMember.name} for ${dateStr}:`, {
          totalAvailabilityEntries: staffMember.availability?.length || 0,
          entriesForThisDate: availabilityEntries.length,
          entries: availabilityEntries.map(e => ({ date: e.date, type: e.type }))
        });
        
        // Normalize all availability types and pick the most restrictive
        let normalizedType: string | null = null;
        
        for (const availability of availabilityEntries) {
          const rawType = availability.type.toString().toLowerCase().trim();
          console.log(`      Raw type: "${availability.type}" → normalized check: "${rawType}"`);
          
          // Most restrictive statuses win (rest/sick/holiday override available)
          if (rawType.includes('rest')) {
            normalizedType = 'rest';
            break; // Rest day is most restrictive, stop checking
          } else if (rawType.includes('sick') && normalizedType !== 'rest') {
            normalizedType = 'sick';
          } else if ((rawType.includes('holiday') || rawType.includes('hol')) && !['rest', 'sick'].includes(normalizedType || '')) {
            normalizedType = 'holiday';
          } else if ((rawType.includes('available') || rawType.includes('avail')) && !normalizedType) {
            normalizedType = 'available';
          }
        }
        
        console.log(`      Final normalized type: "${normalizedType}"`);
        
        // Skip if staff has a rest day, holiday, or sick leave entry
        if (normalizedType && ['rest', 'holiday', 'sick'].includes(normalizedType)) {
          log(`      ⛔ ${staffMember.name}: ${normalizedType.toUpperCase()} on ${dateStr}`);
          console.log(`      ⛔ SKIPPING ${staffMember.name} - ${normalizedType}`);
          continue;
        }
        
        // If no availability record OR explicitly marked "available", they can work
        log(`      ✓ ${staffMember.name}: ${normalizedType || 'working (no entry)'}`);
        console.log(`      ✅ AVAILABLE: ${staffMember.name}`);
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
        
        assignments.push({
          staffId: staffMember.id,
          staffName: staffMember.name,
          task: task,
          date: dateStr,
        });

        assignmentCounts[staffMember.id]++;
        taskCounts[staffMember.id] = taskCounts[staffMember.id] || initTaskRecord();
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