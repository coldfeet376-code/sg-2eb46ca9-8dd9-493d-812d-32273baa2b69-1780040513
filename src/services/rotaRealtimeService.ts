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
   * Save or update a rota for a specific week
   */
  async saveRota(
    weekStart: Date,
    assignments: Assignment[],
    fairnessMetrics: any,
    lockedCount: number
  ): Promise<void> {
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];
      
      console.log("💾 Saving rota to Supabase:", {
        weekStart: weekStartStr,
        assignmentCount: assignments.length,
        lockedCount,
        fairnessScore: fairnessMetrics?.overallScore
      });

      const { data, error } = await supabase
        .from("rotas")
        .upsert(
          {
            week_start: weekStartStr,
            assignments: assignments as any,
            fairness_metrics: fairnessMetrics as any,
            locked_count: lockedCount,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "week_start",
          }
        )
        .select()
        .single();

      if (error) {
        console.error("❌ Error saving rota:", error);
        throw error;
      }

      console.log("✅ Rota saved successfully:", data);
      
      // Add small delay to ensure database commit completes
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error("❌ Save rota failed:", error);
      throw error;
    }
  },

  /**
   * Get rota for a specific week
   */
  async getRotaForWeek(weekStart: Date): Promise<any | null> {
    try {
      const weekStartStr = weekStart.toISOString().split("T")[0];
      
      console.log("📥 Loading rota from Supabase:", weekStartStr);

      const { data, error } = await supabase
        .from("rotas")
        .select("*")
        .eq("week_start", weekStartStr)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rota found - not an error
          console.log("ℹ️ No rota found for week:", weekStartStr);
          return null;
        }
        console.error("❌ Error loading rota:", error);
        throw error;
      }

      const assignments = data.assignments as any;
      const fairnessMetrics = data.fairness_metrics as any;

      console.log("✅ Rota loaded:", {
        weekStart: data.week_start,
        assignmentCount: Array.isArray(assignments) ? assignments.length : 0,
        fairnessScore: fairnessMetrics?.overallScore || null
      });

      return data;
    } catch (error) {
      console.error("❌ Load rota failed:", error);
      return null;
    }
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
    targetType: string,
    targetId: string,
    details: string
  ): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get display name from user metadata or email
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