import type { ManagerAssignment } from "@/types";
import type { Manager } from "@/services/managerService";
import { getManagersForDuty, getManagerAvailability } from "@/services/managerService";

export interface RotaScenario {
  id: number;
  assignments: ManagerAssignment[];
  score: number;
  metrics: {
    shiftBalance: number;
    dutyBalance: number;
    weekendBalance: number;
    difficultyBalance: number;
  };
  strengths: string[];
  weaknesses: string[];
  recommendation: string;
}

/**
 * Calculate a fairness score for a set of assignments
 */
function calculateFairnessScore(assignments: ManagerAssignment[], managers: Manager[]): {
  score: number;
  metrics: RotaScenario["metrics"];
  strengths: string[];
  weaknesses: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  // Metric 1: Shift balance (how evenly distributed are shifts across managers)
  const shiftsPerManager: Record<string, number> = {};
  managers.forEach(m => { shiftsPerManager[m.id] = 0; });
  
  assignments.forEach(a => {
    shiftsPerManager[a.managerId] = (shiftsPerManager[a.managerId] || 0) + 1;
  });

  const shiftCounts = Object.values(shiftsPerManager);
  const avgShifts = shiftCounts.reduce((a, b) => a + b, 0) / shiftCounts.length;
  const shiftVariance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - avgShifts, 2), 0) / shiftCounts.length;
  const shiftBalance = Math.max(0, 100 - (shiftVariance * 10));

  if (shiftBalance >= 90) strengths.push("Excellent shift balance across all managers");
  if (shiftBalance < 60) weaknesses.push("Uneven shift distribution");

  // Metric 2: Duty balance (variety of duties per manager)
  const dutiesPerManager: Record<string, Set<string>> = {};
  managers.forEach(m => { dutiesPerManager[m.id] = new Set(); });
  
  assignments.forEach(a => {
    if (!dutiesPerManager[a.managerId]) dutiesPerManager[a.managerId] = new Set();
    dutiesPerManager[a.managerId].add(a.duty);
  });

  const dutyVariety = Object.values(dutiesPerManager).map(duties => duties.size);
  const avgVariety = dutyVariety.reduce((a, b) => a + b, 0) / dutyVariety.length;
  const varietyVariance = dutyVariety.reduce((sum, count) => sum + Math.pow(count - avgVariety, 2), 0) / dutyVariety.length;
  const dutyBalance = Math.max(0, 100 - (varietyVariance * 25));

  if (dutyBalance >= 85) strengths.push("Good variety of duties for each manager");
  if (dutyBalance < 60) weaknesses.push("Some managers stuck in same duties");

  // Metric 3: Weekend balance (fair distribution of weekend work)
  const weekendShifts: Record<string, number> = {};
  managers.forEach(m => { weekendShifts[m.id] = 0; });
  
  assignments.forEach(a => {
    const date = new Date(a.date);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) { // Sun or Sat
      weekendShifts[a.managerId] = (weekendShifts[a.managerId] || 0) + 1;
    }
  });

  const weekendCounts = Object.values(weekendShifts);
  const avgWeekend = weekendCounts.reduce((a, b) => a + b, 0) / weekendCounts.length;
  const weekendVariance = weekendCounts.reduce((sum, count) => sum + Math.pow(count - avgWeekend, 2), 0) / weekendCounts.length;
  const weekendBalance = Math.max(0, 100 - (weekendVariance * 30));

  if (weekendBalance >= 80) strengths.push("Fair weekend shift distribution");
  if (weekendBalance < 50) weaknesses.push("Uneven weekend shifts");

  // Metric 4: Difficulty balance (mix of hard/easy duties)
  const difficultyScores: Record<string, number> = {
    "Out-loading": 3,
    "Intake": 3,
    "Admin": 1,
    "Floor": 2
  };

  const difficultyPerManager: Record<string, number> = {};
  managers.forEach(m => { difficultyPerManager[m.id] = 0; });
  
  assignments.forEach(a => {
    difficultyPerManager[a.managerId] = (difficultyPerManager[a.managerId] || 0) + (difficultyScores[a.duty] || 0);
  });

  const difficultyCounts = Object.values(difficultyPerManager);
  const avgDifficulty = difficultyCounts.reduce((a, b) => a + b, 0) / difficultyCounts.length;
  const difficultyVariance = difficultyCounts.reduce((sum, count) => sum + Math.pow(count - avgDifficulty, 2), 0) / difficultyCounts.length;
  const difficultyBalance = Math.max(0, 100 - (difficultyVariance * 5));

  if (difficultyBalance >= 85) strengths.push("Well-balanced duty difficulty");
  if (difficultyBalance < 60) weaknesses.push("Uneven workload intensity");

  // Weighted overall score
  const score = (
    shiftBalance * 0.35 +
    dutyBalance * 0.30 +
    weekendBalance * 0.20 +
    difficultyBalance * 0.15
  );

  return {
    score: Math.round(score),
    metrics: {
      shiftBalance: Math.round(shiftBalance),
      dutyBalance: Math.round(dutyBalance),
      weekendBalance: Math.round(weekendBalance),
      difficultyBalance: Math.round(difficultyBalance)
    },
    strengths,
    weaknesses
  };
}

/**
 * Simple pseudo-random number generator with seed
 */
function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * Generate multiple optimized rota scenarios
 */
export async function generateOptimizedScenarios(
  weekStart: Date,
  managers: Manager[]
): Promise<RotaScenario[]> {
  const scenarios: RotaScenario[] = [];

  // Generate 3 scenarios with different random seeds
  for (let i = 0; i < 3; i++) {
    const assignments = await generateSingleScenario(weekStart, managers, i + 1);
    const { score, metrics, strengths, weaknesses } = calculateFairnessScore(assignments, managers);

    let recommendation = "";
    if (score >= 85) recommendation = "Excellent - Highly recommended";
    else if (score >= 75) recommendation = "Good - Recommended";
    else if (score >= 65) recommendation = "Acceptable - Consider alternatives";
    else recommendation = "Below average - Not recommended";

    scenarios.push({
      id: i + 1,
      assignments,
      score,
      metrics,
      strengths,
      weaknesses,
      recommendation
    });
  }

  // Sort by score (best first)
  return scenarios.sort((a, b) => b.score - a.score);
}

/**
 * Generate a single rota scenario with a specific seed for reproducibility
 */
async function generateSingleScenario(
  weekStart: Date,
  managers: Manager[],
  seed: number
): Promise<ManagerAssignment[]> {
  const random = seededRandom(seed * 12345);
  const assignments: ManagerAssignment[] = [];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Helper to get random index
  const randomIndex = (max: number) => Math.floor(random() * max);

  for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + dayOffset);
    const dateStr = date.toISOString().split("T")[0];
    const dayOfWeek = date.getDay();

    // Thu/Fri need different managers for Intake/Out-loading
    const requiresSameManager = !(dayOfWeek === 4 || dayOfWeek === 5);

    // Get unavailable managers
    const unavailableManagerIds = new Set<string>();
    for (const manager of managers) {
      const availability = await getManagerAvailability(manager.id, dateStr, dateStr);
      const dayAvail = availability.find((a: any) => a.date === dateStr);
      if (dayAvail && dayAvail.type !== "available") {
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
        const selected = bothDutiesManagers[randomIndex(bothDutiesManagers.length)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Out-loading",
          shiftStart: "06:00",
          date: dateStr,
        });
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Intake",
          shiftStart: "06:00",
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
        const selected = outloadingManagers[randomIndex(outloadingManagers.length)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Out-loading",
          shiftStart: "06:00",
          date: dateStr,
        });
        assignedManagerIdsThisDay.add(selected.id);
      }

      const availableIntake = intakeManagers.filter(m => !assignedManagerIdsThisDay.has(m.id));
      if (availableIntake.length > 0) {
        const selected = availableIntake[randomIndex(availableIntake.length)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty: "Intake",
          shiftStart: "06:00",
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
        const selected = dutyManagers[randomIndex(dutyManagers.length)];
        assignments.push({
          managerId: selected.id,
          managerName: selected.name,
          duty,
          shiftStart: "06:00",
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
        shiftStart: "06:00",
        date: dateStr,
      });
    });
  }

  return assignments;
}

/**
 * Get detailed fairness metrics for current assignments
 */
export function getDetailedMetrics(
  assignments: ManagerAssignment[],
  managers: Manager[]
): {
  shiftsPerManager: Record<string, number>;
  dutiesPerManager: Record<string, string[]>;
  weekendShiftsPerManager: Record<string, number>;
  avgShifts: number;
  avgVariance: number;
  weekendBalance: number;
} {
  const shiftsPerManager: Record<string, number> = {};
  const dutiesPerManager: Record<string, string[]> = {};
  const weekendShiftsPerManager: Record<string, number> = {};

  managers.forEach(m => {
    shiftsPerManager[m.id] = 0;
    dutiesPerManager[m.id] = [];
    weekendShiftsPerManager[m.id] = 0;
  });

  assignments.forEach(a => {
    shiftsPerManager[a.managerId] = (shiftsPerManager[a.managerId] || 0) + 1;
    
    if (!dutiesPerManager[a.managerId]) dutiesPerManager[a.managerId] = [];
    if (!dutiesPerManager[a.managerId].includes(a.duty)) {
      dutiesPerManager[a.managerId].push(a.duty);
    }

    const date = new Date(a.date);
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      weekendShiftsPerManager[a.managerId] = (weekendShiftsPerManager[a.managerId] || 0) + 1;
    }
  });

  const shiftCounts = Object.values(shiftsPerManager);
  const avgShifts = shiftCounts.reduce((a, b) => a + b, 0) / shiftCounts.length;
  const avgVariance = shiftCounts.reduce((sum, count) => sum + Math.pow(count - avgShifts, 2), 0) / shiftCounts.length;

  const weekendCounts = Object.values(weekendShiftsPerManager);
  const avgWeekend = weekendCounts.reduce((a, b) => a + b, 0) / weekendCounts.length;
  const weekendVariance = weekendCounts.reduce((sum, count) => sum + Math.pow(count - avgWeekend, 2), 0) / weekendCounts.length;
  const weekendBalance = Math.max(0, 100 - (weekendVariance * 30));

  return {
    shiftsPerManager,
    dutiesPerManager,
    weekendShiftsPerManager,
    avgShifts: Math.round(avgShifts * 100) / 100,
    avgVariance: Math.round(avgVariance * 100) / 100,
    weekendBalance: Math.round(weekendBalance),
  };
}