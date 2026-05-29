import { supabase } from "@/integrations/supabase/client";
import type { Assignment } from "@/types";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface StoredRota {
  id: string;
  week_start: string;
  assignments: Assignment[];
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

function toStoredAssignment(row: any): Assignment {
  return {
    staffId: row.staff_id,
    staffName: row.staff_name,
    task: row.task,
    date: row.date,
    shiftPattern: row.shift_pattern || "All",
  };
}

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

function emptyRota(weekStart: string): StoredRota {
  return {
    id: weekStart,
    week_start: weekStart,
    assignments: [],
    locked_count: 0,
    created_by: null,
    created_at: "",
    updated_at: "",
  };
}

export const rotaRealtimeService = {
  async saveRota(
    weekStart: Date,
    assignments: Assignment[],
    _fairnessMetrics?: unknown,
    lockedCount: number = 0
  ): Promise<StoredRota> {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const { data: session } = await supabase.auth.getSession();
    const userId = session.session?.user?.id || null;

    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("week_start", weekStartStr);

    if (deleteError) throw deleteError;

    if (assignments.length > 0) {
      const { error: insertError } = await supabase
        .from("assignments")
        .insert(toAssignmentRows(weekStartStr, assignments));

      if (insertError) throw insertError;
    }

    return {
      ...emptyRota(weekStartStr),
      assignments,
      locked_count: lockedCount,
      created_by: userId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  },

  async getRotaForWeekString(weekStartStr: string): Promise<StoredRota | null> {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("week_start", weekStartStr)
      .order("date", { ascending: true });

    if (error) throw error;
    if (!data || data.length === 0) return null;

    return {
      ...emptyRota(weekStartStr),
      assignments: data.map(toStoredAssignment),
      locked_count: data.length,
    };
  },

  async getRotaForWeek(weekStart: Date): Promise<StoredRota | null> {
    return this.getRotaForWeekString(weekStart.toISOString().split("T")[0]);
  },

  async getAllRotas(): Promise<StoredRota[]> {
    const { data, error } = await supabase
      .from("assignments")
      .select("*")
      .order("week_start", { ascending: false })
      .order("date", { ascending: true });

    if (error) throw error;

    const grouped = new Map<string, Assignment[]>();
    (data || []).forEach((row: any) => {
      const weekStart = row.week_start;
      grouped.set(weekStart, [...(grouped.get(weekStart) || []), toStoredAssignment(row)]);
    });

    return Array.from(grouped.entries()).map(([weekStart, assignments]) => ({
      ...emptyRota(weekStart),
      assignments,
      locked_count: assignments.length,
    }));
  },

  async deleteRota(weekStart: Date): Promise<void> {
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const { error } = await supabase
      .from("assignments")
      .delete()
      .eq("week_start", weekStartStr);

    if (error) throw error;
  },

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
          const row = payload.new?.week_start ? payload.new : payload.old;
          const weekStart = row?.week_start;
          if (!weekStart) return;

          void this.getRotaForWeekString(weekStart).then((rota) => {
            callback({
              eventType: payload.eventType,
              new: rota || emptyRota(weekStart),
              old: emptyRota(weekStart),
            });
          });
        }
      )
      .subscribe();

    return channel;
  },

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

  async getRecentAuditLog(limit: number = 20): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data as AuditLogEntry[]) || [];
  },

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

  async unsubscribe(channel: RealtimeChannel): Promise<void> {
    await supabase.removeChannel(channel);
  },
};
