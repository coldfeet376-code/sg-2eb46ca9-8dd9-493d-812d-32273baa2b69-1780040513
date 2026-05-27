import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart, ShiftPattern } from "@/types";

interface TaskConfig {
  [task: string]: number[];
}

// Staff Query Hook with optional date range centered on a specific date
export function useStaff(options?: { centerDate?: Date; weeksWindow?: number }) {
  const centerDate = options?.centerDate || new Date();
  const weeksWindow = options?.weeksWindow || 12; // Default 12 weeks for rota page
  const loadAllData = weeksWindow >= 999; // If 999+, load everything
  
  return useQuery({
    queryKey: ["staff", "v4", loadAllData ? "all" : centerDate.toISOString().split('T')[0], weeksWindow],
    queryFn: async () => {
      console.log("🔍 Starting staff query with v4 and date-range pagination...");
      
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("name");

      console.log("📊 Staff query result:", { 
        staffCount: staffData?.length || 0, 
        error: staffError?.message,
      });

      if (staffError) {
        console.error("❌ Staff query error:", staffError);
        throw staffError;
      }

      if (!staffData || staffData.length === 0) {
        console.warn("⚠️ No staff data returned from database");
        return [];
      }

      // Fetch availability - either ALL data or date-range filtered
      console.log("📅 Fetching availability data...");
      let availabilityQuery = supabase
        .from("availability")
        .select("*")
        .order('date', { ascending: true });

      if (!loadAllData) {
        // Calculate date range centered on the provided date
        const today = centerDate;
        const weeksBack = Math.floor(weeksWindow / 2);
        const weeksForward = Math.ceil(weeksWindow / 2);
        
        const startDate = new Date(today);
        startDate.setDate(today.getDate() - (weeksBack * 7));
        const endDate = new Date(today);
        endDate.setDate(today.getDate() + (weeksForward * 7));
        
        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];
        
        console.log(`📅 Loading availability from ${startDateStr} to ${endDateStr} (${weeksWindow} weeks window, centered on ${centerDate.toISOString().split('T')[0]})`);
        
        availabilityQuery = availabilityQuery
          .gte('date', startDateStr)
          .lte('date', endDateStr);
      } else {
        console.log(`📅 Loading ALL availability data (no date restrictions)`);
      }

      const { data: availabilityData, error: availError } = await availabilityQuery;

      if (availError) {
        console.error("❌ Availability query error:", availError);
        throw availError;
      }

      console.log(`✅ Fetched ${availabilityData?.length || 0} availability records${loadAllData ? ' (all data)' : ` (${weeksWindow}-week window)`}`);

      if (!availabilityData || availabilityData.length === 0) {
        console.warn("⚠️ No availability data in date range");
        const staffMembers: StaffMember[] = (staffData || []).map((s) => ({
          id: s.id,
          name: s.name,
          trainedTasks: (s.trained_tasks || []) as Task[],
          shiftStart: (s.shift_start || "06:00") as ShiftStart,
          shiftPattern: (s.shift_pattern || "All") as ShiftPattern,
          availability: [],
        }));
        return staffMembers;
      }

      const staffMembers: StaffMember[] = (staffData || []).map((s) => {
        const staffIdStr = String(s.id);
        
        const staffAvail = (availabilityData || [])
          .filter((a) => String(a.staff_id) === staffIdStr)
          .map((a) => ({
            date: a.date,
            type: a.type as "rest" | "holiday" | "sick" | "available",
            notes: a.notes || undefined,
          }));
        
        return {
          id: s.id,
          name: s.name,
          trainedTasks: (s.trained_tasks || []) as Task[],
          shiftStart: (s.shift_start || "06:00") as ShiftStart,
          shiftPattern: (s.shift_pattern || "All") as ShiftPattern,
          availability: staffAvail,
        };
      });

      console.log("✅ Staff members mapped:", staffMembers.length);
      return staffMembers;
    },
    retry: 1,
    staleTime: 1000 * 30,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
}

// Task Config Query Hook
export function useTaskConfig() {
  return useQuery({
    queryKey: ["taskConfig"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_config")
        .select("*");

      if (error) {
        console.error("Error fetching task config:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        return null;
      }

      const config: TaskConfig = {};
      data.forEach((row) => {
        config[row.task] = [
          row.sunday,
          row.monday,
          row.tuesday,
          row.wednesday,
          row.thursday,
          row.friday,
          row.saturday,
        ];
      });

      return config;
    },
    retry: 1,
    staleTime: 1000 * 60 * 5,
  });
}

// Staff Mutation Hooks
export function useAddStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (staff: Omit<StaffMember, "id" | "availability"> & { shiftPattern?: ShiftPattern }) => {
      const { data, error } = await supabase
        .from("staff")
        .insert({
          name: staff.name,
          trained_tasks: staff.trainedTasks,
          shift_start: staff.shiftStart,
          shift_pattern: staff.shiftPattern || "All",
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "v4"] });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StaffMember> & { shiftPattern?: ShiftPattern } }) => {
      const { error } = await supabase
        .from("staff")
        .update({
          name: updates.name,
          trained_tasks: updates.trainedTasks,
          shift_start: updates.shiftStart,
          shift_pattern: updates.shiftPattern,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "v4"] });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "v4"] });
    },
  });
}

// Task Config Mutation Hook
export function useUpdateTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskConfig: TaskConfig) => {
      const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping"];
      
      for (const task of TASKS) {
        const { error } = await supabase
          .from("task_config")
          .update({
            sunday: taskConfig[task][0],
            monday: taskConfig[task][1],
            tuesday: taskConfig[task][2],
            wednesday: taskConfig[task][3],
            thursday: taskConfig[task][4],
            friday: taskConfig[task][5],
            saturday: taskConfig[task][6],
            updated_at: new Date().toISOString(),
          })
          .eq("task", task);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["taskConfig"] });
    },
  });
}

// Availability Mutation Hooks
export function useAddAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (availability: {
      staff_id: string;
      date: string;
      type: string;
      notes?: string;
    }) => {
      const { error } = await supabase.from("availability").insert(availability);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "v4"] });
    },
  });
}

export function useDeleteAvailability() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ staffId, date }: { staffId: string; date: string }) => {
      const { error } = await supabase
        .from("availability")
        .delete()
        .eq("staff_id", staffId)
        .eq("date", date);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff", "v4"] });
    },
  });
}

// Generic Mutation Hook for arbitrary tables
export function useSupabaseMutation(table: "staff" | "availability" | "assignments" | "audit_log" | "invitations" | "manager_availability" | "managers" | "profiles" | "rota_backups" | "rotas" | "task_config", type: "insert" | "update" | "delete") {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: any) => {
      let result;
      if (type === "insert") {
        result = await supabase.from(table).insert(payload).select().single();
      } else if (type === "update") {
        result = await supabase.from(table).update(payload.updates).eq("id", payload.id).select().single();
      } else {
        result = await supabase.from(table).delete().eq("id", payload.id);
      }

      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [table] });
    },
  });
}