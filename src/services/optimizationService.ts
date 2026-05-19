import type { Manager, ManagerAssignment } from "@/types";
import { getManagersForDuty, getAvailabilityForDate } from "@/services/managerService";

export interface RotaScenario {
  id: string;
  assignments: ManagerAssignment[];
  fairnessScore: number;
  strengths: string[];
  weaknesses: string[];
  metrics: {
    avgShiftsPerManager: number;
    dutyDistributionVariance: number;
    weekendBalance: number;
  };
}

interface DutyWeight {
  difficulty: number; // 1-10
  desirability: number; // 1-10
}

const DUTY_WEIGHTS: Record<string, DutyWeight> = {
  "Out-loading": { difficulty: 8, desirability: 3 },
  "Intake": { difficulty: 7, desirability: 4 },
  "Admin": { difficulty: 3, desirability: 8 },
  "Floor": { difficulty: 5, desirability: 6 },
};

/**
 * Generate multiple rota scenarios and score them for fairness
 */
export async function generateOptimizedScenarios(
  managers: Manager[],
  weekStart: Date,
  count: number = 3
): Promise<RotaScenario[]> {
  const scenarios: RotaScenario[] = [];

  for (let i = 0; i < count; i++) {
    const assignments = await generateSingleScenario(managers, weekStart, i);
    const score = calculateScenarioScore(assignments, managers);
    const analysis = analyzeScenario(assignments, managers);

    scenarios.push({
      id: `scenario-${i + 1}`,
      assignments,
      fairnessScore: score,
      strengths: analysis.strengths,
      weaknesses: analysis.weaknesses,
      metrics: analysis.metrics,
    });
  }

  // Sort by fairness score descending
  return scenarios.sort((a, b) => b.fairnessScore - a.fairnessScore);
}

/**
 * Generate a single rota scenario with randomization seed
 */
async function generateSingleScenario(
  managers: Manager[],
  weekStart: Date,
  seed: number
): Promise<ManagerAssignment[]> {
  const assignments: ManagerAssignment[] = [];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Seeded random for reproducibility
  const random = (min: number, max: number) => {
    const x = Math.sin(seed++) * 10000;
    const rand = x - Math.floor(x);
    return Math.floor(rand * (max - min + 1)) + min;
  };

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();
    const requiresSameManager = dayOfWeek !== 4 && dayOfWeek !== 5; // Not Thu/Fri

    // Get unavailable managers
    const unavailableManagerIds = new Set<string>();
    for (const manager of managers) {
      const availability = await getAvailabilityForDate(manager.id, dateStr);
      if (availability.type !== "available") {
        unavailableManagerIds.add(manager.id);
      }
    }

    const availableManagers = managers.filter(m => !unavailableManagerIds.has(m.id));
    const assignedManagerIdsThisDay = new Set<string>();

    // Assign Out-loading and Intake
    if (requiresSameManager) {
      const bothDutiesManagers = availableManagers.filter(m => 
        m.can_out_loading && m.can_intake
      );
      if (bothDutiesManagers.length > 0) {
        const selected = bothDutiesManagers[random(0, bothDutiesManagers.length - 1)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Out-loading",
          date: dateStr,
        });
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Intake",
          date: dateStr,
        });
        assignedManagerIdsThisDay.add(selected.id);
      }
    } else {
      // Separate managers for Thu/Fri
      const outloadingManagers = availableManagers.filter(m => m.can_out_loading);
      const intakeManagers = availableManagers.filter(m => 
        m.can_intake && !assignedManagerIdsThisDay.has(m.id)
      );

      if (outloadingManagers.length > 0) {
        const selected = outloadingManagers[random(0, outloadingManagers.length - 1)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Out-loading",
          date: dateStr,
        });
        assignedManagerIdsThisDay.add(selected.id);
      }

      const availableIntake = intakeManagers.filter(m => !assignedManagerIdsThisDay.has(m.id));
      if (availableIntake.length > 0) {
        const selected = availableIntake[random(0, availableIntake.length - 1)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Intake",
          date: dateStr,
        });
        assignedManagerIdsThisDay.add(selected.id);
      }
    }

    // Assign Admin and Floor
    for (const duty of ["Admin", "Floor"] as const) {
      const dutyManagers = availableManagers.filter(m => {
        if (duty === "Admin") return m.can_admin && !assignedManagerIdsThisDay.has(m.id);
        if (duty === "Floor") return m.can_floor && !assignedManagerIdsThisDay.has(m.id);
        return false;
      });

      if (dutyManagers.length > 0) {
        const selected = dutyManagers[random(0, dutyManagers.length - 1)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty,
          date: dateStr,
        });
        assignedManagerIdsThisDay.add(selected.id);
      }
    }

    // Remaining managers go to Floor
    const unassigned = availableManagers.filter(m => 
      !assignedManagerIdsThisDay.has(m.id) && m.can_floor
    );
    unassigned.forEach(manager => {
      assignments.push({
        managerId: manager.id,
        managerName: manager.name,
        duty: "Floor",
        date: dateStr,
      });
    });
  }

  return assignments;
}

/**
 * Calculate overall fairness score for a scenario
 */
function calculateScenarioScore(
  assignments: ManagerAssignment[],
  managers: Manager[]
): number {
  let totalScore = 0;
  const weights = {
    shiftBalance: 0.35,
    dutyBalance: 0.3,
    weekendBalance: 0.2,
    difficultyBalance: 0.15,
  };

  // 1. Shift balance (equal number of shifts per manager)
  const shiftsPerManager = new Map<string, number>();
  assignments.forEach(a => {
    shiftsPerManager.set(a.managerId, (shiftsPerManager.get(a.managerId) || 0) + 1);
  });
  const shiftCounts = Array.from(shiftsPerManager.values());
  const avgShifts = shiftCounts.reduce((a, b) => a + b, 0) / shiftCounts.length;
  const shiftVariance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - avgShifts, 2), 0) / shiftCounts.length;
  const shiftBalanceScore = Math.max(0, 100 - shiftVariance * 10);

  // 2. Duty balance (variety of duties per manager)
  const dutiesPerManager = new Map<string, Set<string>>();
  assignments.forEach(a => {
    if (!dutiesPerManager.has(a.managerId)) {
      dutiesPerManager.set(a.managerId, new Set());
    }
    dutiesPerManager.get(a.managerId)!.add(a.duty);
  });
  const dutyVariety = Array.from(dutiesPerManager.values()).map(s => s.size);
  const avgVariety = dutyVariety.reduce((a, b) => a + b, 0) / dutyVariety.length;
  const dutyBalanceScore = (avgVariety / 4) * 100; // Max 4 duties

  // 3. Weekend balance (equal weekend shifts)
  const weekendShifts = new Map<string, number>();
  assignments.forEach(a => {
    const date = new Date(a.date);
    const day = date.getDay();
    if (day === 0 || day === 6) {
      weekendShifts.set(a.managerId, (weekendShifts.get(a.managerId) || 0) + 1);
    }
  });
  const weekendCounts = Array.from(weekendShifts.values());
  const avgWeekend = weekendCounts.length > 0 
    ? weekendCounts.reduce((a, b) => a + b, 0) / weekendCounts.length 
    : 0;
  const weekendVariance = weekendCounts.length > 0
    ? weekendCounts.reduce((sum, count) => sum + Math.pow(count - avgWeekend, 2), 0) / weekendCounts.length
    : 0;
  const weekendBalanceScore = Math.max(0, 100 - weekendVariance * 20);

  // 4. Difficulty balance (equal hard duties distribution)
  const difficultyPerManager = new Map<string, number>();
  assignments.forEach(a => {
    const weight = DUTY_WEIGHTS[a.duty]?.difficulty || 5;
    difficultyPerManager.set(a.managerId, (difficultyPerManager.get(a.managerId) || 0) + weight);
  });
  const difficultyCounts = Array.from(difficultyPerManager.values());
  const avgDifficulty = difficultyCounts.reduce((a, b) => a + b, 0) / difficultyCounts.length;
  const difficultyVariance = difficultyCounts.reduce((sum, count) => sum + Math.pow(count - avgDifficulty, 2), 0) / difficultyCounts.length;
  const difficultyBalanceScore = Math.max(0, 100 - difficultyVariance * 5);

  // Weighted total
  totalScore = 
    shiftBalanceScore * weights.shiftBalance +
    dutyBalanceScore * weights.dutyBalance +
    weekendBalanceScore * weights.weekendBalance +
    difficultyBalanceScore * weights.difficultyBalance;

  return Math.round(totalScore);
}

/**
 * Analyze scenario strengths and weaknesses
 */
function analyzeScenario(
  assignments: ManagerAssignment[],
  managers: Manager[]
): {
  strengths: string[];
  weaknesses: string[];
  metrics: RotaScenario["metrics"];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Calculate metrics
  const shiftsPerManager = new Map<string, number>();
  const dutiesPerManager = new Map<string, Set<string>>();
  const weekendShifts = new Map<string, number>();

  assignments.forEach(a => {
    shiftsPerManager.set(a.managerId, (shiftsPerManager.get(a.managerId) || 0) + 1);
    
    if (!dutiesPerManager.has(a.managerId)) {
      dutiesPerManager.set(a.managerId, new Set());
    }
    dutiesPerManager.get(a.managerId)!.add(a.duty);

    const date = new Date(a.date);
    const day = date.getDay();
    if (day === 0 || day === 6) {
      weekendShifts.set(a.managerId, (weekendShifts.get(a.managerId) || 0) + 1);
    }
  });

  const shiftCounts = Array.from(shiftsPerManager.values());
  const avgShiftsPerManager = shiftCounts.reduce((a, b) => a + b, 0) / shiftCounts.length;
  const maxShifts = Math.max(...shiftCounts);
  const minShifts = Math.min(...shiftCounts);

  // Analyze shift balance
  if (maxShifts - minShifts <= 2) {
    strengths.push("Excellent shift balance across all managers");
  } else {
    weaknesses.push(`Uneven shift distribution (${minShifts}-${maxShifts} shifts per manager)`);
  }

  // Analyze duty variety
  const dutyVariety = Array.from(dutiesPerManager.values()).map(s => s.size);
  const avgDutyVariety = dutyVariety.reduce((a, b) => a + b, 0) / dutyVariety.length;
  if (avgDutyVariety >= 3) {
    strengths.push("Good duty variety for all managers");
  } else {
    weaknesses.push("Limited duty variety - some managers stuck in same roles");
  }

  // Analyze weekend distribution
  const weekendCounts = Array.from(weekendShifts.values());
  if (weekendCounts.length > 0) {
    const maxWeekend = Math.max(...weekendCounts);
    const minWeekend = Math.min(...weekendCounts);
    if (maxWeekend - minWeekend <= 1) {
      strengths.push("Fair weekend shift distribution");
    } else {
      weaknesses.push(`Unequal weekend shifts (${minWeekend}-${maxWeekend} per manager)`);
    }
  }

  // Calculate variance
  const avgVariance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - avgShiftsPerManager, 2), 0) / shiftCounts.length;
  
  const weekendBalance = weekendCounts.length > 0
    ? 100 - (Math.max(...weekendCounts) - Math.min(...weekendCounts)) * 25
    : 100;

  return {
    strengths,
    weaknesses,
    metrics: {
      avgShiftsPerManager: Math.round(avgShiftsPerManager * 10) / 10,
      dutyDistributionVariance: Math.round(avgVariance * 100) / 100,
      weekendBalance: Math.round(weekendBalance),
    },
  };
}