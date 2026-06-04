import type { Assignment, StaffMember, FairnessMetrics, Task } from "@/types";
import { TASK_WEIGHTS } from "@/types";

export function calculateFairnessMetrics(
  assignments: Assignment[],
  staff: StaffMember[]
): FairnessMetrics {
  // Calculate weighted task distribution per staff
  const staffTaskCounts: Record<string, Record<Task, number>> = {};
  const staffWeightedTotals: Record<string, number> = {};

  staff.forEach((s) => {
    staffTaskCounts[s.id] = {
      Frozen: 0,
      Milk: 0,
      TWI: 0,
      Inbound: 0,
      "Inbound Late": 0,
      Outbound: 0,
      Marshaling: 0,
      "Marshal Late": 0,
      Housekeeping: 0,
      Equipment: 0,
    };
    staffWeightedTotals[s.id] = 0;
  });

  // Count assignments with weights
  assignments.forEach((assignment) => {
    if (staffTaskCounts[assignment.staffId]) {
      staffTaskCounts[assignment.staffId][assignment.task]++;
      const weight = TASK_WEIGHTS[assignment.task];
      staffWeightedTotals[assignment.staffId] += weight;
    }
  });

  // Calculate unweighted total assignments per staff
  const staffTotalAssignments = Object.entries(staffTaskCounts).reduce(
    (acc, [staffId, tasks]) => {
      acc[staffId] = Object.values(tasks).reduce((sum, count) => sum + count, 0);
      return acc;
    },
    {} as Record<string, number>
  );

  // Calculate weighted averages and standard deviations
  const weightedTotals = Object.values(staffWeightedTotals);
  const weightedAvg = weightedTotals.length > 0
    ? weightedTotals.reduce((a, b) => a + b, 0) / weightedTotals.length
    : 0;

  const weightedVariance = weightedTotals.length > 0
    ? weightedTotals.reduce((sum, val) => sum + Math.pow(val - weightedAvg, 2), 0) / weightedTotals.length
    : 0;
  
  const weightedStdDev = Math.sqrt(weightedVariance);

  // Calculate task-specific fairness (using weighted counts)
  const taskFairness: Record<Task, number> = {
    Frozen: 0,
    Milk: 0,
    TWI: 0,
    Inbound: 0,
    "Inbound Late": 0,
    Outbound: 0,
    Marshaling: 0,
    Housekeeping: 0,
    Equipment: 0,
  };

  (Object.keys(taskFairness) as Task[]).forEach((task) => {
    const taskCounts = staff.map((s) => staffTaskCounts[s.id][task]);
    const taskAvg = taskCounts.reduce((a, b) => a + b, 0) / taskCounts.length;
    const taskVariance =
      taskCounts.reduce((sum, val) => sum + Math.pow(val - taskAvg, 2), 0) / taskCounts.length;
    const taskStdDev = Math.sqrt(taskVariance);

    // Fairness score: 100 means perfect distribution (stdDev = 0)
    // Lower stdDev = higher fairness
    taskFairness[task] = taskAvg > 0 ? Math.max(0, 100 - (taskStdDev / taskAvg) * 100) : 100;
  });

  // Overall fairness score based on weighted totals
  const overallScore =
    weightedAvg > 0 ? Math.max(0, Math.round(100 - (weightedStdDev / weightedAvg) * 100)) : 100;

  // Build staffWorkload array for FairnessMeter compatibility
  const staffWorkload = staff.map((s) => ({
    staffId: s.id,
    staffName: s.name,
    totalAssignments: staffTotalAssignments[s.id] || 0,
    weightedTotal: staffWeightedTotals[s.id] || 0,
    taskBreakdown: staffTaskCounts[s.id],
    availableDays: 7 - (s.restDays?.length || 0), // Simplified calculation
  }));

  return {
    overallScore,
    taskFairness,
    staffWeightedTotals,
    staffTotalAssignments,
    weightedAverage: weightedAvg,
    weightedStdDev,
    standardDeviation: weightedStdDev,
    staffWorkload,
  };
}