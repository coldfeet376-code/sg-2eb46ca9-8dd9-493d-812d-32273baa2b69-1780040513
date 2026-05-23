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
  action: string;
  entity_type: string;
  entity_id: string;
  details: string | null;
  created_at: string;
}

export const rotaRealtimeService = {
  /**
   * Save or update a rota for a specific week
   */
  async saveRota(
    weekStart: Date,
    assignments: Assignment[],
    fairnessMetrics?: FairnessMetrics | null,
    lockedCount: number = 0
  ): Promise<StoredRota> {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id;

    // Upsert (insert or update)
    const { data, error } = await supabase
      .from("rotas")
      .upsert(
        {
          week_start: weekStartStr,
          assignments: assignments as any,
          fairness_metrics: fairnessMetrics as any,
          locked_count: lockedCount,
          created_by: userId,
        },
        { onConflict: "week_start" }
      )
      .select()
      .single();

    if (error) throw error;
    return data as unknown as StoredRota;
  },

  /**
   * Get rota for a specific week
   */
  async getRotaForWeek(weekStart: Date): Promise<StoredRota | null> {
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("rotas")
      .select("*")
      .eq("week_start", weekStartStr)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return data as unknown as StoredRota;
  },

  /**
   * Get all rotas (for analytics)
   */
  async getAllRotas(): Promise<StoredRota[]> {
    const { data, error } = await supabase
      .from("rotas")
      .select("*")
      .order("week_start", { ascending: false });

    if (error) throw error;
    return (data as unknown as StoredRota[]) || [];
  },

  /**
   * Delete a rota for a specific week
   */
  async deleteRota(weekStart: Date): Promise<void> {
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const { error } = await supabase
      .from("rotas")
      .delete()
      .eq("week_start", weekStartStr);

    if (error) throw error;
  },

  /**
   * Subscribe to real-time changes on rotas table
   */
  subscribeToRotas(
    callback: (payload: { eventType: string; new: StoredRota; old: StoredRota }) => void
  ): RealtimeChannel {
    const channel = supabase
      .channel("rotas-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rotas",
        },
        (payload: any) => {
          callback({
            eventType: payload.eventType,
            new: payload.new as StoredRota,
            old: payload.old as StoredRota,
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
    entityType: string,
    entityId: string,
    details?: string
  ): Promise<void> {
    const { data: session } = await supabase.auth.getSession();
    const user = session.session?.user;

    if (!user) {
      console.warn("Cannot log action: no authenticated user");
      return;
    }

    const { error } = await supabase.from("audit_log").insert({
      user_id: user.id,
      user_email: user.email || null,
      action,
      entity_type: entityType,
      entity_id: entityId,
      details,
    });

    if (error) {
      console.error("Failed to log action:", error);
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
   * Subscribe to real-time audit log changes
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
   * Unsubscribe from a channel
   */
  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },
};