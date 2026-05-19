import { supabase } from "@/integrations/supabase/client";
import type { ManagerAssignment } from "@/types";

export interface TrendData {
  period: string;
  value: number;
  label: string;
}

export interface AbsencePattern {
  managerId: string;
  managerName: string;
  dayOfWeek: number;
  dayName: string;
  absenceRate: number;
  totalAbsences: number;
  totalPossibleDays: number;
  severity: "low" | "medium" | "high";
}

export interface SeasonalPattern {
  month: string;
  averageAbsences: number;
  peakDays: string[];
}

export interface FairnessMetric {
  managerId: string;
  managerName: string;
  totalShifts: number;
  dutyDistribution: Record<string, number>;
  weekendCount: number;
  fairnessScore: number; // 0-100, higher is more fair
}

/**
 * Get historical assignment counts by week for trend analysis
 */
export async function getHistoricalTrends(
  startDate: Date,
  endDate: Date
): Promise<TrendData[]> {
  // Generate realistic mock data for historical trends since assignments are client-side only
  const trends: TrendData[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    if (current.getDay() === 0) {
      trends.push({
        period: current.toISOString().split("T")[0],
        value: Math.floor(Math.random() * 10) + 40, // 40-50 shifts per week
        label: current.toLocaleDateString("en-US", { month: "short", day: "numeric" })
      });
    }
    current.setDate(current.getDate() + 1);
  }
  
  return trends;
}

/**
 * Analyze absence patterns by manager and day of week
 */
export async function analyzeAbsencePatterns(): Promise<AbsencePattern[]> {
  // Get all availability records where type is NOT available
  const { data: absences, error } = await supabase
    .from("manager_availability")
    .select("manager_id, date, type")
    .neq("type", "available");

  if (error || !absences) {
    console.error("Error fetching absences:", error);
    return [];
  }

  // Get all managers
  const { data: managers, error: managersError } = await supabase
    .from("managers")
    .select("id, name");

  if (managersError) {
    console.error("Error fetching managers:", error);
    return [];
  }

  const patterns: AbsencePattern[] = [];
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // Analyze each manager
  for (const manager of managers) {
    const managerAbsences = absences.filter(a => a.manager_id === manager.id);
    
    // Count by day of week
    const dayCount = new Map<number, number>();
    const totalDays = new Map<number, number>();

    // Get date range of all data
    const dates = managerAbsences.map(a => new Date(a.date));
    if (dates.length === 0) continue;

    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));

    // Count total possible days for each day of week
    const current = new Date(minDate);
    while (current <= maxDate) {
      const dayOfWeek = current.getDay();
      totalDays.set(dayOfWeek, (totalDays.get(dayOfWeek) || 0) + 1);
      current.setDate(current.getDate() + 1);
    }

    // Count absences by day of week
    managerAbsences.forEach(absence => {
      const date = new Date(absence.date);
      const dayOfWeek = date.getDay();
      dayCount.set(dayOfWeek, (dayCount.get(dayOfWeek) || 0) + 1);
    });

    // Calculate rates for each day
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const absenceCount = dayCount.get(dayOfWeek) || 0;
      const totalCount = totalDays.get(dayOfWeek) || 1;
      const rate = absenceCount / totalCount;

      if (absenceCount > 0) {
        patterns.push({
          managerId: manager.id,
          managerName: manager.name,
          dayOfWeek,
          dayName: DAYS[dayOfWeek],
          absenceRate: rate,
          totalAbsences: absenceCount,
          totalPossibleDays: totalCount,
          severity: rate > 0.3 ? "high" : rate > 0.15 ? "medium" : "low",
        });
      }
    }
  }

  // Sort by absence rate descending
  return patterns.sort((a, b) => b.absenceRate - a.absenceRate);
}

/**
 * Predict high-risk absence periods based on historical patterns
 */
export async function predictAbsenceRisks(
  futureWeeks: number = 4
): Promise<Array<{ date: string; riskScore: number; reasons: string[] }>> {
  const patterns = await analyzeAbsencePatterns();
  const predictions: Array<{ date: string; riskScore: number; reasons: string[] }> = [];

  const today = new Date();
  
  for (let weekOffset = 0; weekOffset < futureWeeks; weekOffset++) {
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const date = new Date(today);
      date.setDate(date.getDate() + (weekOffset * 7) + dayOffset);
      const dayOfWeek = date.getDay();
      const dateStr = date.toISOString().split("T")[0];

      // Calculate risk score based on patterns
      const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);
      const highRiskPatterns = dayPatterns.filter(p => p.severity === "high");
      
      const riskScore = Math.min(
        100,
        highRiskPatterns.reduce((sum, p) => sum + (p.absenceRate * 100), 0)
      );

      if (riskScore > 20) {
        predictions.push({
          date: dateStr,
          riskScore,
          reasons: highRiskPatterns.map(
            p => `${p.managerName} has ${Math.round(p.absenceRate * 100)}% absence rate on ${p.dayName}s`
          ),
        });
      }
    }
  }

  return predictions.sort((a, b) => b.riskScore - a.riskScore);
}

/**
 * Calculate fairness metrics for current assignments
 */
export async function calculateFairnessMetrics(
  assignments: ManagerAssignment[]
): Promise<FairnessMetric[]> {
  // Get all managers
  const { data: managers, error } = await supabase
    .from("managers")
    .select("id, name");

  if (error || !managers) return [];

  const metrics: FairnessMetric[] = [];

  for (const manager of managers) {
    const managerAssignments = assignments.filter(a => a.managerId === manager.id);
    
    // Count duty distribution
    const dutyDistribution: Record<string, number> = {};
    managerAssignments.forEach(a => {
      dutyDistribution[a.duty] = (dutyDistribution[a.duty] || 0) + 1;
    });

    // Count weekend shifts (Sat = 6, Sun = 0)
    const weekendCount = managerAssignments.filter(a => {
      const date = new Date(a.date);
      const day = date.getDay();
      return day === 0 || day === 6;
    }).length;

    // Calculate fairness score (simplified - can be enhanced)
    const totalShifts = managerAssignments.length;
    const dutyVariance = Object.values(dutyDistribution).length;
    const expectedShifts = assignments.length / managers.length;
    const shiftDeviation = Math.abs(totalShifts - expectedShifts);
    
    const fairnessScore = Math.max(
      0,
      100 - (shiftDeviation * 10) - (dutyVariance < 3 ? 20 : 0)
    );

    metrics.push({
      managerId: manager.id,
      managerName: manager.name,
      totalShifts,
      dutyDistribution,
      weekendCount,
      fairnessScore: Math.round(fairnessScore),
    });
  }

  return metrics.sort((a, b) => a.fairnessScore - b.fairnessScore);
}

/**
 * Get seasonal patterns from historical data
 */
export async function getSeasonalPatterns(): Promise<SeasonalPattern[]> {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const { data: absences, error } = await supabase
    .from("manager_availability")
    .select("date, type")
    .neq("type", "available")
    .gte("date", oneYearAgo.toISOString().split("T")[0]);

  if (error || !absences) return [];

  // Group by month
  const monthlyData = new Map<string, { total: number; dates: string[] }>();
  
  absences.forEach(absence => {
    const date = new Date(absence.date);
    const monthKey = date.toLocaleDateString("en-US", { month: "long" });
    
    if (!monthlyData.has(monthKey)) {
      monthlyData.set(monthKey, { total: 0, dates: [] });
    }
    
    const data = monthlyData.get(monthKey)!;
    data.total += 1;
    data.dates.push(absence.date);
  });

  // Calculate peak days for each month
  const patterns: SeasonalPattern[] = [];
  
  monthlyData.forEach((data, month) => {
    const dayFrequency = new Map<string, number>();
    data.dates.forEach(date => {
      const day = new Date(date).toLocaleDateString("en-US", { weekday: "long" });
      dayFrequency.set(day, (dayFrequency.get(day) || 0) + 1);
    });

    const peakDays = Array.from(dayFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([day]) => day);

    patterns.push({
      month,
      averageAbsences: data.total,
      peakDays,
    });
  });

  return patterns;
}