import { supabase } from "@/integrations/supabase/client";
import type { Assignment, RotaBackup } from "@/types";

function toAssignmentRows(weekStart: string, assignments: Assignment[]) {
  return assignments.map((assignment) => ({
    week_start: weekStart,
    staff_id: assignment.staffId,
    staff_name: assignment.staffName,
    task: assignment.task,
    date: assignment.date,
    shift_pattern: assignment.shiftPattern || "All",
  }));
}

export const rotaService = {
  async saveWeeklyAssignments(
    weekStart: string,
    assignments: Assignment[],
    _expectedVersion?: number
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: deleteError } = await supabase
        .from("assignments")
        .delete()
        .eq("week_start", weekStart);

      if (deleteError) {
        console.error("Error deleting old assignments:", deleteError);
        return { success: false, error: `Failed to clear old assignments: ${deleteError.message}` };
      }

      if (assignments.length > 0) {
        const { error: insertError } = await supabase
          .from("assignments")
          .insert(toAssignmentRows(weekStart, assignments));

        if (insertError) {
          console.error("Error inserting assignments:", insertError);
          return { success: false, error: `Failed to save assignments: ${insertError.message}` };
        }
      }

      return { success: true };
    } catch (error: any) {
      console.error("Unexpected error saving rota:", error);
      return { success: false, error: error.message || "Unknown error occurred" };
    }
  },

  async getWeeklyAssignments(weekStart: string, includeAdjacentWeeks: boolean = false): Promise<Assignment[]> {
    let query = supabase.from("assignments").select("*");

    if (includeAdjacentWeeks) {
      const weekStartDate = new Date(weekStart);
      const prevWeekDate = new Date(weekStartDate);
      prevWeekDate.setDate(weekStartDate.getDate() - 7);
      const nextWeekDate = new Date(weekStartDate);
      nextWeekDate.setDate(weekStartDate.getDate() + 7);

      query = query
        .gte("week_start", prevWeekDate.toISOString().split("T")[0])
        .lte("week_start", nextWeekDate.toISOString().split("T")[0]);
    } else {
      query = query.eq("week_start", weekStart);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching assignments:", error);
      throw error;
    }

    return (data || []).map((assignment: any) => ({
      staffId: assignment.staff_id,
      staffName: assignment.staff_name,
      task: assignment.task,
      date: assignment.date,
      shiftPattern: assignment.shift_pattern || "All",
    }));
  },

  async getCurrentRotaVersion(_weekStart: string): Promise<number> {
    return 0;
  },

  async createBackup(weekStart: string, assignments: Assignment[], lockedAssignments: Assignment[]): Promise<void> {
    const { error } = await supabase
      .from("rota_backups")
      .insert({
        week_start: weekStart,
        assignments: assignments as any,
        locked_assignments: lockedAssignments as any,
        created_by: "system",
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

    return (data || []).map((backup: any) => ({
      id: backup.id,
      weekStart: backup.week_start,
      assignments: backup.assignments as unknown as Assignment[],
      lockedAssignments: backup.locked_assignments as unknown as Assignment[],
      createdAt: backup.created_at,
      createdBy: backup.created_by || undefined,
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
  },
};
