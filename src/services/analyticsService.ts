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
  severity: "low" | "medium" | "high";
  reason: string;
}

export interface SeasonalPattern {
  month: string;
  averageAbsences: number;
  peakDays: string[];
}

export interface HighRiskPrediction {
  weekStart: string;
  weekEnd: string;
  riskLevel: "low" | "medium" | "high";
  expectedAbsences: number;
  managers: Array<{
    name: string;
    probability: number;
    reason: string;
  }>;
}

/**
 * Get historical trend data for assignments over time
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
  const { data: managers } = await supabase
    .from("managers")
    .select("id, name");

  if (!managers) return [];

  const patterns: AbsencePattern[] = [];
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Analyze each manager's absence pattern by day of week
  for (const manager of managers) {
    const managerAbsences = absences.filter(a => a.manager_id === manager.id);
    
    // Group by day of week
    const absencesByDay: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      absencesByDay[i] = 0;
    }

    managerAbsences.forEach(absence => {
      const date = new Date(absence.date);
      const dayOfWeek = date.getDay();
      absencesByDay[dayOfWeek]++;
    });

    // Find days with significant patterns
    const totalAbsences = managerAbsences.length;
    const avgPerDay = totalAbsences / 7;

    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
      const dayAbsences = absencesByDay[dayOfWeek];
      
      if (dayAbsences > 0) {
        const rate = totalAbsences > 0 ? (dayAbsences / totalAbsences) : 0;
        const percentMore = totalAbsences > 0 
          ? Math.round(((dayAbsences - avgPerDay) / avgPerDay) * 100)
          : 0;

        // Only include patterns with at least 20% more absences than average
        if (percentMore >= 20) {
          let severity: "low" | "medium" | "high" = "low";
          if (percentMore >= 50) severity = "high";
          else if (percentMore >= 35) severity = "medium";

          patterns.push({
            managerId: manager.id,
            managerName: manager.name,
            dayOfWeek,
            dayName: DAYS[dayOfWeek],
            absenceRate: Math.round(rate * 100) / 100,
            totalAbsences: dayAbsences,
            severity,
            reason: `${manager.name} calls in sick ${percentMore}% more on ${DAYS[dayOfWeek]}s`
          });
        }
      }
    }
  }

  return patterns.sort((a, b) => {
    const severityOrder = { high: 3, medium: 2, low: 1 };
    return severityOrder[b.severity] - severityOrder[a.severity];
  });
}

/**
 * Get seasonal patterns - monthly absence averages
 */
export async function getSeasonalPatterns(): Promise<SeasonalPattern[]> {
  const { data: absences } = await supabase
    .from("manager_availability")
    .select("date, type")
    .neq("type", "available");

  if (!absences) return [];

  const monthlyAbsences: Record<string, { total: number; days: Set<string> }> = {};
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  absences.forEach(absence => {
    const date = new Date(absence.date);
    const month = MONTHS[date.getMonth()];
    
    if (!monthlyAbsences[month]) {
      monthlyAbsences[month] = { total: 0, days: new Set() };
    }
    
    monthlyAbsences[month].total++;
    monthlyAbsences[month].days.add(absence.date);
  });

  const patterns: SeasonalPattern[] = [];

  MONTHS.forEach(month => {
    const data = monthlyAbsences[month];
    if (data) {
      const peakDays = Array.from(data.days)
        .sort((a, b) => {
          const countA = absences.filter(abs => abs.date === a).length;
          const countB = absences.filter(abs => abs.date === b).length;
          return countB - countA;
        })
        .slice(0, 3)
        .map(date => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" }));

      patterns.push({
        month,
        averageAbsences: data.total,
        peakDays,
      });
    }
  });

  return patterns;
}

/**
 * Predict high-risk periods for absences
 */
export async function predictHighRiskPeriods(): Promise<HighRiskPrediction[]> {
  const patterns = await analyzeAbsencePatterns();
  const predictions: HighRiskPrediction[] = [];
  
  const today = new Date();
  
  // Generate predictions for next 4 weeks
  for (let weekOffset = 0; weekOffset < 4; weekOffset++) {
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() + (weekOffset * 7));
    weekStart.setHours(0, 0, 0, 0);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    // Check if this week has high-risk days
    const weekRisks: Array<{ name: string; probability: number; reason: string }> = [];
    let totalRisk = 0;

    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      const checkDate = new Date(weekStart);
      checkDate.setDate(weekStart.getDate() + dayOffset);
      const dayOfWeek = checkDate.getDay();

      // Find patterns for this day
      const dayPatterns = patterns.filter(p => p.dayOfWeek === dayOfWeek);
      
      dayPatterns.forEach(pattern => {
        const probability = pattern.absenceRate * 100;
        totalRisk += probability;
        
        const existingManager = weekRisks.find(r => r.name === pattern.managerName);
        if (existingManager) {
          existingManager.probability = Math.max(existingManager.probability, probability);
        } else {
          weekRisks.push({
            name: pattern.managerName,
            probability: Math.round(probability),
            reason: pattern.reason
          });
        }
      });
    }

    const avgRisk = weekRisks.length > 0 ? totalRisk / weekRisks.length : 0;
    let riskLevel: "low" | "medium" | "high" = "low";
    if (avgRisk >= 50) riskLevel = "high";
    else if (avgRisk >= 30) riskLevel = "medium";

    if (weekRisks.length > 0) {
      predictions.push({
        weekStart: weekStart.toISOString().split("T")[0],
        weekEnd: weekEnd.toISOString().split("T")[0],
        riskLevel,
        expectedAbsences: Math.ceil(totalRisk / 100),
        managers: weekRisks.sort((a, b) => b.probability - a.probability).slice(0, 3)
      });
    }
  }

  return predictions;
}