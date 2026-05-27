import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart, ShiftPattern } from "@/types";

interface TaskConfig {
  [task: string]: number[];
}

// Staff Query Hook - Stable with full dataset loading
export function useStaff() {
  return useQuery({
    queryKey: ["staff", "full"], // Stable key
    queryFn: async () => {
      console.log("🔍 [useStaff] Starting query...");
      
      try {
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .order("name");

        if (staffError) {
          console.error("❌ [useStaff] Staff query error:", staffError);
          throw staffError;
        }

        console.log("📊 [useStaff] Staff loaded:", staffData?.length || 0, "members");

        if (!staffData || staffData.length === 0) {
          console.warn("⚠️ [useStaff] No staff data in database");
          return [];
        }

        // Fetch ALL availability data
        console.log("📅 [useStaff] Fetching availability data...");
        const { data: availabilityData, error: availError } = await supabase
          .from("availability")
          .select("*")
          .order('date', { ascending: true });

        if (availError) {
          console.error("❌ [useStaff] Availability query error:", availError);
          throw availError;
        }

        console.log(`✅ [useStaff] Fetched ${availabilityData?.length || 0} availability records`);

        if (!availabilityData || availabilityData.length === 0) {
          console.warn("⚠️ [useStaff] No availability data in database");
          // Return staff without availability
          return staffData.map((s) => ({
            id: s.id,
            name: s.name,
            trainedTasks: (s.trained_tasks || []) as Task[],
            shiftStart: (s.shift_start || "06:00") as ShiftStart,
            shiftPattern: (s.shift_pattern || "All") as ShiftPattern,
            availability: [],
          }));
        }

        // Map staff with availability
        const staffMembers: StaffMember[] = staffData.map((s) => {
          const staffIdStr = String(s.id);
          
          const staffAvail = availabilityData
            .filter((a) => String(a.staff_id) === staffIdStr)
            .map((a) => ({
              date: a.date,
              type: a.type as "rest" | "holiday" | "sick" | "available",
              notes: a.notes || undefined,
            }));
          
          // Debug logging for specific staff
          if (s.name.toLowerCase().includes('abbo') || s.name.toLowerCase().includes('brian')) {
            console.log(`   📋 [${s.name}] ${staffAvail.length} entries | Range: ${staffAvail[0]?.date || 'N/A'} → ${staffAvail[staffAvail.length - 1]?.date || 'N/A'}`);
          }
          
          return {
            id: s.id,
            name: s.name,
            trainedTasks: (s.trained_tasks || []) as Task[],
            shiftStart: (s.shift_start || "06:00") as ShiftStart,
            shiftPattern: (s.shift_pattern || "All") as ShiftPattern,
            availability: staffAvail,
          };
        });

        console.log(`✅ [useStaff] Successfully mapped ${staffMembers.length} staff members with availability`);
        return staffMembers;
        
      } catch (error) {
        console.error("❌ [useStaff] Fatal error:", error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 1000 * 10, // 10 seconds
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
}

// Task Config Query Hook
export function useTaskConfig() {
  return useQuery({
    queryKey: ["taskConfig"],
    queryFn: async () => {
      console.log("🔍 Starting task config query...");
      
      const { data, error } = await supabase
        .from("task_config")
        .select("*");

      console.log("📊 Task config query result:", {
        rowCount: data?.length || 0,
        error: error?.message,
        tasks: data?.map(d => d.task) || []
      });

      if (error) {
        console.error("❌ Task config query error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.warn("⚠️ No task config data returned from database");
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

      console.log("✅ Task config mapped:", Object.keys(config));
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
      queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
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