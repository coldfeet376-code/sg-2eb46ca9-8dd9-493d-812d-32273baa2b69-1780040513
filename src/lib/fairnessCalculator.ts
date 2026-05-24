import type { Assignment, FairnessMetrics, StaffMember, Task } from "@/types";

export function calculateFairnessMetrics(
  assignments: Assignment[],
  staff: StaffMember[]
) {
  if (assignments.length === 0 || staff.length === 0) {
    return { overallScore: 0, standardDeviation: 0 };
  }

  // Count assignments per staff member
  const counts = staff.map((s) => {
    return assignments.filter((a) => a.staffId === s.id).length;
  });

  if (counts.length === 0) {
    return { overallScore: 0, standardDeviation: 0 };
  }

  // Calculate standard deviation
  const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const variance =
    counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Fairness score: 100 means perfectly equal, lower means less fair
  // If stdDev is 0 (all equal), return 100
  if (stdDev === 0) {
    return { overallScore: 100, standardDeviation: 0 };
  }

  // Normalize: lower stdDev = higher fairness
  const maxPossibleStdDev = mean > 0 ? mean : 1; // worst case: some have all, some have none
  const fairness = Math.max(0, 100 - (stdDev / maxPossibleStdDev) * 100);

  return {
    overallScore: Math.round(fairness),
    standardDeviation: Number(stdDev.toFixed(2))
  };
}