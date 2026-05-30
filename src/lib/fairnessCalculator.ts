import type { Assignment, FairnessMetrics, StaffMember, Task } from "@/types";

// Task weights for fairness calculation
const TASK_WEIGHTS: Record<Task, number> = {
  "Frozen": 1.2,
  "Milk": 1.1,
  "TWI": 1.0,
  "Inbound": 1.3,
  "Outbound": 1.2,
  "Marshaling": 1.1,
  "Equipment": 1.0,
  "Inbound Late": 1.4,
};

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
    
    // Calculate weighted total (Inbound Late = 0.5, others = 1.0)
    const weightedTotal = staffAssignments.reduce((sum, a) => {
      const weight = TASK_WEIGHTS[a.task] || 1.0;
      return sum + weight;
    }, 0);
    
    // Keep raw count for display
    const totalAssignments = staffAssignments.length;
    
    const taskBreakdown: Record<Task, number> = {
      "Frozen": 0,
      "Milk": 0,
      "TWI": 0,
      "Inbound": 0,
      "Inbound Late": 0,
      "Outbound": 0,
      "Marshaling": 0,
      "Equipment": 0,
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
      weightedAssignments: Number(weightedTotal.toFixed(1)), // NEW: Track weighted total
      taskBreakdown,
      availableDays,
    };
  });

  // Calculate assignment rates using WEIGHTED assignments per available day
  // Exclude single-task staff from fairness calculation (they have no choice in assignments)
  const rates = staffWorkload
    .filter(w => {
      // Must have at least 1 available day
      if (w.availableDays === 0) return false;
      
      // Find staff member to check training
      const staffMember = staff.find(s => s.id === w.staffId);
      if (!staffMember) return false;
      
      // Exclude single-task staff from fairness calculation
      const isMultiSkilled = staffMember.trainedTasks.length > 1;
      return isMultiSkilled;
    })
    .map(w => w.weightedAssignments / w.availableDays); // Use weighted assignments

  if (rates.length === 0) {
    // No multi-skilled staff with available days - fairness score doesn't apply
    return { overallScore: 0, standardDeviation: 0, staffWorkload: [] };
  }

  // Calculate standard deviation on weighted rates for multi-skilled staff only
  const mean = rates.reduce((sum, r) => sum + r, 0) / rates.length;
  const variance =
    rates.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / rates.length;
  const stdDev = Math.sqrt(variance);

  // Fairness score: 100 means perfectly equal rates, lower means less fair
  if (stdDev === 0) {
    return { overallScore: 100, standardDeviation: 0, staffWorkload };
  }

  // Normalize: lower stdDev = higher fairness
  const maxPossibleStdDev = mean > 0 ? mean : 1;
  const fairness = Math.max(0, 100 - (stdDev / maxPossibleStdDev) * 100);

  return {
    overallScore: Math.round(fairness),
    standardDeviation: Number(stdDev.toFixed(2)),
    staffWorkload
  };
}