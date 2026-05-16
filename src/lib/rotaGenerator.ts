import type { StaffMember, Task, Assignment } from "@/types";

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

interface LockedAssignment {
  task: string;
  date: string;
  staffName: string;
}

interface RotaGenerationParams {
  staff: StaffMember[];
  taskConfig: TaskConfig;
  weekStart: Date;
  lockedAssignments?: LockedAssignment[];
}

// Check if staff member has consecutive same task
function hasConsecutiveTask(
  staffName: string,
  task: string,
  date: Date,
  existingAssignments: Assignment[]
): boolean {
  const yesterday = new Date(date);
  yesterday.setDate(date.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const tomorrow = new Date(date);
  tomorrow.setDate(date.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  return existingAssignments.some(
    (a) =>
      a.staffName === staffName &&
      a.task === task &&
      (a.date === yesterdayStr || a.date === tomorrowStr)
  );
}

// Calculate fairness score (lower is more fair)
function calculateFairnessScore(
  staffName: string,
  task: string,
  existingAssignments: Assignment[]
): number {
  // Count current task assignments for this staff member
  const taskCount = existingAssignments.filter(
    (a) => a.staffName === staffName && a.task === task
  ).length;

  // Count total assignments for this staff member
  const totalCount = existingAssignments.filter(
    (a) => a.staffName === staffName
  ).length;

  // Lower score = less frequently assigned this task
  return taskCount * 10 + totalCount;
}

export function generateWeeklyRota({
  staff,
  taskConfig,
  weekStart,
  lockedAssignments = [],
}: RotaGenerationParams): Assignment[] {
  const assignments: Assignment[] = [];
  const tasks = Object.keys(taskConfig);

  // First, add all locked assignments
  lockedAssignments.forEach((locked) => {
    assignments.push({
      staffName: locked.staffName,
      task: locked.task as Task,
      date: locked.date,
    });
  });

  // Process each day
  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const currentDate = new Date(weekStart);
    currentDate.setDate(weekStart.getDate() + dayOffset);
    const dateStr = currentDate.toISOString().split("T")[0];

    // Process each task for this day
    tasks.forEach((task) => {
      const requiredCount = taskConfig[task][dayOffset];

      // Check how many locked assignments exist for this task/date
      const lockedCount = assignments.filter(
        (a) => a.task === task && a.date === dateStr
      ).length;

      const remainingNeeded = requiredCount - lockedCount;

      if (remainingNeeded <= 0) return; // Already filled by locked assignments

      // Filter staff: trained on this task AND not already assigned this day AND not locked
      const availableStaff = staff.filter((s) => {
        // Must be trained
        if (!s.trainedTasks.includes(task as Task)) return false;

        // Can't already be assigned this day
        if (
          assignments.some((a) => a.staffName === s.name && a.date === dateStr)
        )
          return false;

        // Check availability (rest days)
        const dayOfWeek = currentDate.getDay();
        if (s.restDays?.includes(dayOfWeek)) return false;

        return true;
      });

      // Assign staff based on fairness
      const candidates = availableStaff
        .map((s) => ({
          staff: s,
          fairnessScore: calculateFairnessScore(s.name, task, assignments),
          hasConsecutive: hasConsecutiveTask(
            s.name,
            task,
            currentDate,
            assignments
          ),
        }))
        .filter((c) => !c.hasConsecutive) // Remove candidates with consecutive same task
        .sort((a, b) => a.fairnessScore - b.fairnessScore); // Sort by fairness (lowest first)

      // Assign the required number of staff
      for (let i = 0; i < Math.min(remainingNeeded, candidates.length); i++) {
        assignments.push({
          staffName: candidates[i].staff.name,
          task: task as Task,
          date: dateStr,
        });
      }
    });
  }

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
  const firstDay = new Date(year, 0, 1);
  const firstSunday = getWeekStart(firstDay);

  // Generate 53 weeks to ensure we cover the entire year
  for (let i = 0; i < 53; i++) {
    const weekStart = new Date(firstSunday);
    weekStart.setDate(firstSunday.getDate() + i * 7);
    weeks.push(weekStart);
  }

  // Filter to only include weeks that overlap with the target year
  return weeks.filter((weekStart) => {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return weekStart.getFullYear() === year || weekEnd.getFullYear() === year;
  });
}