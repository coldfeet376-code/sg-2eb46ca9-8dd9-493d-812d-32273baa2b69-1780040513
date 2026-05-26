import type { Assignment, StaffMember, Task } from "@/types";
import { calculateFairnessMetrics } from "./fairnessCalculator";

export interface SwapSuggestion {
  id: string;
  fromStaffId: string;
  fromStaffName: string;
  toStaffId: string;
  toStaffName: string;
  task: Task;
  date: string;
  currentFairness: number;
  predictedFairness: number;
  improvement: number;
  reason: string;
  warnings: string[];
}

export function suggestSwaps(
  assignments: Assignment[],
  staff: StaffMember[],
  maxSuggestions = 10
): SwapSuggestion[] {
  const currentMetrics = calculateFairnessMetrics(assignments, staff);
  const suggestions: SwapSuggestion[] = [];

  // Get staff workload with rates
  const workloadWithRates = currentMetrics.staffWorkload
    .filter(w => w.availableDays > 0)
    .map(w => ({
      ...w,
      rate: w.totalAssignments / w.availableDays
    }));

  if (workloadWithRates.length < 2) {
    return []; // Need at least 2 staff to swap
  }

  const avgRate = workloadWithRates.reduce((sum, w) => sum + w.rate, 0) / workloadWithRates.length;

  // Identify over-assigned (above average) and under-assigned (below average) staff
  const overAssigned = workloadWithRates
    .filter(w => w.rate > avgRate + 0.1) // More than avg + threshold
    .sort((a, b) => b.rate - a.rate); // Highest first

  const underAssigned = workloadWithRates
    .filter(w => w.rate < avgRate - 0.1) // Less than avg - threshold
    .sort((a, b) => a.rate - b.rate); // Lowest first

  if (overAssigned.length === 0 || underAssigned.length === 0) {
    return []; // Nothing to balance
  }

  // For each over-assigned staff, find swaps with under-assigned staff
  for (const overStaff of overAssigned) {
    const overPerson = staff.find(s => s.id === overStaff.staffId);
    if (!overPerson) continue;

    // Get their assignments
    const theirAssignments = assignments.filter(a => a.staffId === overStaff.staffId);

    for (const assignment of theirAssignments) {
      for (const underStaff of underAssigned) {
        const underPerson = staff.find(s => s.id === underStaff.staffId);
        if (!underPerson) continue;

        // Check if under-assigned person can do this task
        if (!underPerson.trainedTasks.includes(assignment.task)) continue;

        // Check availability
        const date = new Date(assignment.date);
        const dayOfWeek = date.getDay();
        
        // Check rest days
        const hasRestDay = underPerson.restDays?.some(d => Number(d) === dayOfWeek);
        if (hasRestDay) continue;

        // Check specific availability
        const availability = underPerson.availability?.find(a => a.date === assignment.date);
        const isUnavailable = availability && availability.type !== 'available';
        if (isUnavailable) continue;

        // Check consecutive task violations
        const warnings: string[] = [];
        if (wouldCreateConsecutiveViolation(assignment, underPerson.id, assignments)) {
          warnings.push("May create consecutive same-task assignment");
        }

        // Simulate the swap
        const simulatedAssignments = assignments.map(a => {
          if (a.staffId === assignment.staffId && a.date === assignment.date && a.task === assignment.task) {
            return { ...a, staffId: underStaff.staffId, staffName: underStaff.staffName };
          }
          return a;
        });

        const newMetrics = calculateFairnessMetrics(simulatedAssignments, staff);
        const improvement = newMetrics.overallScore - currentMetrics.overallScore;

        // Only suggest if it improves fairness
        if (improvement > 0.5) {
          const targetAssignments = Math.round(avgRate * underStaff.availableDays);
          
          suggestions.push({
            id: `${assignment.staffId}-${underStaff.staffId}-${assignment.date}-${assignment.task}`,
            fromStaffId: assignment.staffId,
            fromStaffName: assignment.staffName,
            toStaffId: underStaff.staffId,
            toStaffName: underStaff.staffName,
            task: assignment.task,
            date: assignment.date,
            currentFairness: currentMetrics.overallScore,
            predictedFairness: newMetrics.overallScore,
            improvement,
            reason: `${assignment.staffName} is over-assigned (${overStaff.totalAssignments} shifts), ${underStaff.staffName} is under-assigned (${underStaff.totalAssignments}/${targetAssignments} target)`,
            warnings
          });
        }
      }
    }
  }

  // Sort by improvement (highest first) and limit
  return suggestions
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, maxSuggestions);
}

function wouldCreateConsecutiveViolation(
  assignment: Assignment,
  newStaffId: string,
  allAssignments: Assignment[]
): boolean {
  const assignmentDate = new Date(assignment.date);
  
  // Check day before
  const dayBefore = new Date(assignmentDate);
  dayBefore.setDate(dayBefore.getDate() - 1);
  const dayBeforeStr = dayBefore.toISOString().split("T")[0];
  
  const prevAssignment = allAssignments.find(
    a => a.staffId === newStaffId && a.date === dayBeforeStr
  );
  if (prevAssignment && prevAssignment.task === assignment.task) {
    return true;
  }

  // Check day after
  const dayAfter = new Date(assignmentDate);
  dayAfter.setDate(dayAfter.getDate() + 1);
  const dayAfterStr = dayAfter.toISOString().split("T")[0];
  
  const nextAssignment = allAssignments.find(
    a => a.staffId === newStaffId && a.date === dayAfterStr
  );
  if (nextAssignment && nextAssignment.task === assignment.task) {
    return true;
  }

  return false;
}