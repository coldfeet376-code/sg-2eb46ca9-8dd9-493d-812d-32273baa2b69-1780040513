import { supabase } from "@/integrations/supabase/client";
import type { Assignment, FairnessMetrics } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface StoredRota {
  id: string;
  week_start: string;
  assignments: Assignment[];
  fairness_metrics?: FairnessMetrics | null;
  locked_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string | null;
  user_email: string | null;
  user_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
}

export const rotaRealtimeService = {
  /**
   * Save using assignments table only - rotas table has cache issues
   */
  async saveRota(
    weekStart: Date,
    assignments: Assignment[],
    fairnessMetrics?: FairnessMetrics | null,
    lockedCount: number = 0
  ): Promise<StoredRota> {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    
    // Delete existing
    await supabase.from("assignments").delete().eq("week_start", weekStartStr);
    
    // Insert new
    if (assignments.length > 0) {
      await supabase.from("assignments").insert(
        assignments.map(a => ({
          week_start: weekStartStr,
          staff_id: a.staffId,
          staff_name: a.staffName,
          task: a.task,
          date: a.date,
          shift_pattern: a.shiftPattern || "All"
        }))
      );
    }

    // Return mock stored rota
    return {
      id: weekStartStr,
      week_start: weekStartStr,
      assignments,
      fairness_metrics: fairnessMetrics,
      locked_count: lockedCount,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  /**
   * Get rota for a specific week from assignments table
   */
  async getRotaForWeek(weekStart: Date): Promise<StoredRota | null> {
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("week_start", weekStartStr);

    if (error) throw error;
    if (!data || data.length === 0) return null;

    const assignments: Assignment[] = data.map(a => ({
      staffId: a.staff_id,
      staffName: a.staff_name,
      task: a.task as any,
      date: a.date,
      shiftPattern: a.shift_pattern as any
    }));

    return {
      id: weekStartStr,
      week_start: weekStartStr,
      assignments,
      fairness_metrics: null,
      locked_count: 0,
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  },

  /**
   * Get all rotas
   */
  async getAllRotas(): Promise<StoredRota[]> {
    const { data, error } = await supabase
      .from("assignments")
      .select("week_start")
      .order("week_start", { ascending: false });

    if (error) throw error;
    
    // Get unique weeks
    const weeks = [...new Set((data || []).map(d => d.week_start))];
    
    // Get rotas for each week
    const rotas = await Promise.all(
      weeks.map(week => this.getRotaForWeek(new Date(week)))
    );
    
    return rotas.filter(r => r !== null) as StoredRota[];
  },

  /**
   * Delete a rota
   */
  async deleteRota(weekStart: Date): Promise<void> {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    await supabase.from("assignments").delete().eq("week_start", weekStartStr);
  },

  /**
   * Subscribe to assignments table changes
   */
  subscribeToRotas(
    callback: (payload: { eventType: string; new: StoredRota; old: StoredRota }) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel("assignments-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assignments",
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType,
            new: payload.new as any,
            old: payload.old as any,
          });
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Log an action to audit trail
   */
  async logAction(
    action: string,
    targetType: string,
    targetId: string,
    details: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const displayName = user.user_metadata?.display_name || user.email?.split("@")[0] || "Unknown";

    const { error } = await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email || "unknown@example.com",
      user_name: displayName,
      action,
      entity_type: targetType,
      entity_id: targetId,
      details,
    });

    if (error) {
      console.error("Error logging action:", error);
    }
  },

  /**
   * Get recent audit log entries
   */
  async getRecentAuditLog(limit: number = 20): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as AuditLogEntry[]) || [];
  },

  /**
   * Subscribe to audit log
   */
  subscribeToAuditLog(
    callback: (entry: AuditLogEntry) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel("audit-log-changes")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audit_log",
        },
        (payload: any) => {
          callback(payload.new as AuditLogEntry);
        }
      )
      .subscribe();

    return channel;
  },

  /**
   * Unsubscribe
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },
};