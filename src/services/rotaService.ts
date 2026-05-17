import { supabase } from "@/integrations/supabase/client";
import type { Assignment, RotaBackup } from "@/types";

export const rotaService = {
  async saveWeeklyAssignments(weekStart: string, assignments: Assignment[]): Promise<void> {
    // Delete existing assignments for this week
    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("week_start", weekStart);

    if (deleteError) {
      console.error("Error deleting old assignments:", deleteError);
      throw deleteError;
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
        throw insertError;
      }
    }
  },

  async getWeeklyAssignments(weekStart: string): Promise<Assignment[]> {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("week_start", weekStart);

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
      assignments: b.assignments as Assignment[],
      lockedAssignments: b.locked_assignments as Assignment[],
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