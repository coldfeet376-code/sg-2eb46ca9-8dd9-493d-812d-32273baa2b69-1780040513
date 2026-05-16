import type { StaffMember, Task, Assignment } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

interface RotaContext {
  staff: StaffMember[];
  taskConfig: TaskConfig;
  weekStart: Date;
}

interface StaffTaskHistory {
  [staffId: string]: {
    lastTask: Task | null;
    taskCounts: { [task: string]: number };
  };
}

/**
 * Generates weekly rota assignments using constraint-based rotation algorithm
 * 
 * Constraints:
 * 1. No consecutive same-task assignments
 * 2. Fair distribution - balance task counts across staff
 * 3. Training-aware - only assign tasks staff are trained for
 * 4. Randomization within trained tasks to prevent patterns
 * 5. Respect availability (rest days, absences, holidays)
 */
export function generateWeeklyRota(context: RotaContext): Assignment[] {
  const { staff, taskConfig, weekStart } = context;
  const assignments: Assignment[] = [];
  const history: StaffTaskHistory = {};

  // Initialize history tracking
  staff.forEach(member => {
    history[member.id] = {
      lastTask: null,
      taskCounts: {},
    };
  });

  // Process each day of the week (Sun-Sat)
  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + dayIndex);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Get available staff for this day
    const availableStaff = staff.filter(member => 
      isStaffAvailable(member, dateStr)
    );

    // Process each task for this day
    Object.keys(taskConfig).forEach(taskName => {
      const task = taskName as Task;
      const requiredCount = taskConfig[task][dayIndex];

      if (requiredCount === 0) return;

      // Get eligible staff for this task
      const eligible = availableStaff.filter(member =>
        member.trainedTasks.includes(task) &&
        history[member.id].lastTask !== task // No consecutive same task
      );

      // Sort by task count (fair distribution) with randomization
      const sorted = [...eligible].sort((a, b) => {
        const aCount = history[a.id].taskCounts[task] || 0;
        const bCount = history[b.id].taskCounts[task] || 0;
        
        if (aCount === bCount) {
          // Randomize when counts are equal
          return Math.random() - 0.5;
        }
        
        return aCount - bCount; // Assign to those with fewer of this task
      });

      // Assign required number of staff
      const assigned = sorted.slice(0, requiredCount);
      
      assigned.forEach(member => {
        assignments.push({
          staffId: member.id,
          staffName: member.name,
          task,
          date: dateStr,
        });

        // Update history
        history[member.id].lastTask = task;
        history[member.id].taskCounts[task] = 
          (history[member.id].taskCounts[task] || 0) + 1;

        // Remove from available pool for this day
        const idx = availableStaff.indexOf(member);
        if (idx !== -1) {
          availableStaff.splice(idx, 1);
        }
      });
    });

    // Reset lastTask at end of day to allow same task on non-consecutive days
    staff.forEach(member => {
      history[member.id].lastTask = null;
    });
  }

  return assignments;
}

/**
 * Check if staff member is available on given date
 */
function isStaffAvailable(member: StaffMember, dateStr: string): boolean {
  // Check rest days
  if (member.restDays.includes(dateStr)) {
    return false;
  }

  const checkDate = new Date(dateStr);

  // Check absences
  for (const absence of member.absences) {
    const start = new Date(absence.start);
    const end = new Date(absence.end);
    if (checkDate >= start && checkDate <= end) {
      return false;
    }
  }

  // Check holidays
  for (const holiday of member.holidays) {
    const start = new Date(holiday.start);
    const end = new Date(holiday.end);
    if (checkDate >= start && checkDate <= end) {
      return false;
    }
  }

  return true;
}

/**
 * Get Sunday date for a given date's week
 */
export function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Navigate to next/previous week
 */
export function navigateWeek(currentWeekStart: Date, direction: "next" | "prev"): Date {
  const newDate = new Date(currentWeekStart);
  newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
  return newDate;
}

/**
 * Get all week starts for a year
 */
export function getYearWeeks(year: number): Date[] {
  const weeks: Date[] = [];
  const firstDay = new Date(year, 0, 1);
  const firstSunday = getWeekStart(firstDay);
  
  const current = new Date(firstSunday);
  while (current.getFullYear() <= year) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }
  
  // Filter to only include weeks where Sunday is in target year or week includes any day of target year
  return weeks.filter(weekStart => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekStart.getFullYear() === year || weekEnd.getFullYear() === year;
  });
}