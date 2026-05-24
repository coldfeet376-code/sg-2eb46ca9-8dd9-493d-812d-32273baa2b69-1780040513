import type { Assignment, FairnessMetrics, StaffMember, Task } from "@/types";

export function calculateFairness(
  assignments: Assignment[],
  staff: StaffMember[]
): number {
  if (assignments.length === 0 || staff.length === 0) return 0;

  // Count assignments per staff member
  const counts = staff.map((s) => {
    return assignments.filter((a) => a.staffId === s.id).length;
  });

  if (counts.length === 0) return 0;

  // Calculate standard deviation
  const mean = counts.reduce((sum, c) => sum + c, 0) / counts.length;
  const variance =
    counts.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / counts.length;
  const stdDev = Math.sqrt(variance);

  // Fairness score: 100 means perfectly equal, lower means less fair
  // If stdDev is 0 (all equal), return 100
  if (stdDev === 0) return 100;

  // Normalize: lower stdDev = higher fairness
  const maxPossibleStdDev = mean; // worst case: some have all, some have none
  const fairness = Math.max(0, 100 - (stdDev / maxPossibleStdDev) * 100);

  return Math.round(fairness);
}