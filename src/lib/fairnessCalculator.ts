import type { Assignment, FairnessMetrics, StaffMember, Task } from "@/types";

export function calculateFairnessMetrics(
  assignments: Assignment[],
  staff: StaffMember[]
): FairnessMetrics {
  if (assignments.length === 0 || staff.length === 0) {
    return { overallScore: 0, standardDeviation: 0, staffWorkload: [] };
  }

  // Get all unique dates in the assignments (the week being analyzed)
  const weekDates = [...new Set(assignments.map(a => a.date))].sort();

  // Calculate staff workload details
  const staffWorkload = staff.map((s) => {
    const staffAssignments = assignments.filter((a) => a.staffId === s.id);
    const totalAssignments = staffAssignments.length;
    
    const taskBreakdown: Record<Task, number> = {
      "Frozen": 0,
      "Milk": 0,
      "TWI": 0,
      "Inbound": 0,
      "Inbound Late": 0,
      "Outbound": 0,
      "Marshaling": 0,
      "Housekeeping": 0,
    };

    staffAssignments.forEach((a) => {
      if (a.task in taskBreakdown) {
        taskBreakdown[a.task]++;
      }
    });

    // Calculate available days (exclude rest days, holidays, sick leave)
    let availableDays = 0;
    weekDates.forEach(dateStr => {
      const date = new Date(dateStr);
      const dayOfWeek = date.getDay();
      
      // Check if staff has a rest day on this day of week
      const isRestDay = s.restDays?.some(d => Number(d) === dayOfWeek);
      
      // Check if staff has special unavailability on this specific date
      const availability = s.availability?.find(a => a.date === dateStr);
      const isUnavailable = availability && availability.type !== 'available';
      
      // Count as available day only if NOT rest day AND NOT unavailable
      if (!isRestDay && !isUnavailable) {
        availableDays++;
      }
    });

    return {
      staffId: s.id,
      staffName: s.name,
      totalAssignments,
      taskBreakdown,
      availableDays, // Track available days for rate calculation
    };
  });

  // Calculate assignment rates (assignments per available day) instead of raw counts
  // Only include staff who had at least 1 available day
  const rates = staffWorkload
    .filter(w => w.availableDays > 0)
    .map(w => w.totalAssignments / w.availableDays);

  if (rates.length === 0) {
    return { overallScore: 0, standardDeviation: 0, staffWorkload: [] };
  }

  // Calculate standard deviation on rates, not raw counts
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  const variance =
    rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  // Fairness score: 100 means perfectly equal rates, lower means less fair
  // If stdDev is 0 (all equal rates), return 100
  if (stdDev === 0) {
    return { overallScore: 100, standardDeviation: 0, staffWorkload };
  }

  // Normalize: lower stdDev = higher fairness
  // Max possible stdDev is when one person has all assignments and others have none
  const maxPossibleStdDev = mean > 0 ? mean : 1;
  const fairness = Math.max(0, 100 - (stdDev / maxPossibleStdDev) * 100);

  return {
    overallScore: Math.round(fairness),
    standardDeviation: Number(stdDev.toFixed(2)),
    staffWorkload
  };
}