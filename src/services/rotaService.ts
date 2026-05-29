import { supabase } from "@/integrations/supabase/client";
import type { Assignment, RotaBackup } from "@/types";

export const rotaService = {
  async saveWeeklyAssignments(weekStart: string, assignments: Assignment[], expectedVersion?: number): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete existing assignments for this week
      const { error: deleteError } = await supabase
        .from("assignments")
        .delete()
        .eq("week_start", weekStart);

      if (deleteError) {
        console.error("Error deleting old assignments:", deleteError);
        return { success: false, error: `Failed to clear old assignments: ${deleteError.message}` };
      }

      // Insert new assignments
      if (assignments.length > 0) {
        const { error: insertError } = await supabase
          .from("assignments")
          .insert(assignments.map(a => ({
            week_start: weekStart,
            staff_id: a.staffId,
            staff_name: a.staffName,
            task: a.task,
            date: a.date,
            shift_pattern: a.shiftPattern || "All"
          })));

        if (insertError) {
          console.error("Error inserting assignments:", insertError);
          return { success: false, error: `Failed to save assignments: ${insertError.message}` };
        }
      }

      console.log("✅ Successfully saved", assignments.length, "assignments for week", weekStart);
      return { success: true };
    } catch (error: any) {
      console.error("Unexpected error saving rota:", error);
      return { success: false, error: error.message || "Unknown error occurred" };
    }
  },

  async getWeeklyAssignments(weekStart: string, includeAdjacentWeeks: boolean = false): Promise<Assignment[]> {
    let query = supabase
      .from("assignments")
      .select("*");

    if (includeAdjacentWeeks) {
      const weekStartDate = new Date(weekStart);
      const prevWeekDate = new Date(weekStartDate);
      prevWeekDate.setDate(weekStartDate.getDate() - 7);
      const nextWeekDate = new Date(weekStartDate);
      nextWeekDate.setDate(weekStartDate.getDate() + 7);
      
      const prevWeekStr = prevWeekDate.toISOString().split('T')[0];
      const nextWeekStr = nextWeekDate.toISOString().split('T')[0];
      
      query = query
        .gte('week_start', prevWeekStr)
        .lte('week_start', nextWeekStr);
    } else {
      query = query.eq("week_start", weekStart);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }

    return (data || []).map(a => ({
      staffId: a.staff_id,
      staffName: a.staff_name,
      task: a.task as any,
      date: a.date,
      shiftPattern: a.shift_pattern as any
    }));
  },

  async getCurrentRotaVersion(weekStart: string): Promise<number> {
    return 1; // Simple version tracking removed
  },

  async createBackup(weekStart: string, assignments: Assignment[], lockedAssignments: Assignment[]): Promise<void> {
    const { error } = await supabase
      .from("rota_backups")
      .insert({
        week_start: weekStart,
        assignments: assignments as any,
        locked_assignments: lockedAssignments as any,
        created_by: "system"
      });

    if (error) {
      console.error("Error creating backup:", error);
      throw error;
    }
  },

  async getBackups(weekStart?: string): Promise<RotaBackup[]> {
    let query = supabase
      .from("rota_backups")
      .select("*")
      .order("created_at", { ascending: false });

    if (weekStart) {
      query = query.eq("week_start", weekStart);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching backups:", error);
      throw error;
    }

    return (data || []).map(b => ({
      id: b.id,
      weekStart: b.week_start,
      assignments: b.assignments as unknown as Assignment[],
      lockedAssignments: b.locked_assignments as unknown as Assignment[],
      createdAt: b.created_at,
      createdBy: b.created_by || undefined
    }));
  },

  async deleteOldBackups(daysToKeep: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const { error } = await supabase
      .from("rota_backups")
      .delete()
      .lt("created_at", cutoffDate.toISOString());

    if (error) {
      console.error("Error deleting old backups:", error);
      throw error;
    }
  }
};