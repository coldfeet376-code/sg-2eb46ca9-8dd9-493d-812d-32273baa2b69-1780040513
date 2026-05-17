import type { Assignment, FairnessMetrics, StaffMember, Task } from "@/types";

export function calculateFairnessMetrics(
  assignments: Assignment[],
  staff: StaffMember[]
): FairnessMetrics {
  // Count assignments per staff member
  const staffWorkload = staff.map(s => {
    const staffAssignments = assignments.filter(a => a.staffId === s.id);
    const taskBreakdown: Record<Task, number> = {
      Frozen: 0,
      Milk: 0,
      TWI: 0,
      Inbound: 0,
      Outbound: 0,
      Marshaling: 0
    };

    staffAssignments.forEach(a => {
      taskBreakdown[a.task] = (taskBreakdown[a.task] || 0) + 1;
    });

    return {
      staffId: s.id,
      staffName: s.name,
      totalAssignments: staffAssignments.length,
      taskBreakdown
    };
  });

  // Calculate standard deviation
  const assignmentCounts = staffWorkload.map(s => s.totalAssignments);
  const mean = assignmentCounts.reduce((a, b) => a + b, 0) / assignmentCounts.length;
  const variance = assignmentCounts.reduce((sum, count) => sum + Math.pow(count - mean, 2), 0) / assignmentCounts.length;
  const standardDeviation = Math.sqrt(variance);

  // Calculate overall fairness score (0-100)
  // Lower standard deviation = higher fairness
  // Perfect fairness (SD=0) = 100, high SD = lower score
  const maxReasonableSD = mean * 0.5; // If SD is 50% of mean, score is 0
  const overallScore = Math.max(0, Math.min(100, 100 - (standardDeviation / maxReasonableSD) * 100));

  return {
    overallScore: Math.round(overallScore),
    staffWorkload,
    standardDeviation: Math.round(standardDeviation * 100) / 100
  };
}