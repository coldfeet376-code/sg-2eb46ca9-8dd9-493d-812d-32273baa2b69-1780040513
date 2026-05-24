import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart, ShiftPattern } from "@/types";

interface TaskConfig {
  [task: string]: number[];
}

// Staff Query Hook
export function useStaff() {
  return useQuery({
    queryKey: ["staff"],
    queryFn: async () => {
      console.log("🔍 Starting staff query...");
      
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("name");

      console.log("📊 Staff query result:", { 
        staffCount: staffData?.length || 0, 
        error: staffError?.message,
        staffData: staffData?.slice(0, 2) // Log first 2 for debugging
      });

      if (staffError) {
        console.error("❌ Staff query error:", staffError);
        throw staffError;
      }

      if (!staffData || staffData.length === 0) {
        console.warn("⚠️ No staff data returned from database");
        return [];
      }

      const { data: availabilityData, error: availError } = await supabase
        .from("availability")
        .select("*");

      console.log("📅 Availability query result:", {
        availCount: availabilityData?.length || 0,
        error: availError?.message,
        sampleStaffIds: availabilityData?.slice(0, 3).map(a => ({ staff_id: a.staff_id, date: a.date }))
      });

      if (availError) {
        console.error("❌ Availability query error:", availError);
        throw availError;
      }

      const staffMembers: StaffMember[] = (staffData || []).map((s) => {
        // CRITICAL FIX: Convert both IDs to strings for comparison
        // Supabase might return UUIDs in different formats (UUID object vs string)
        const staffIdStr = String(s.id);
        
        const staffAvail = (availabilityData || [])
          .filter((a) => String(a.staff_id) === staffIdStr)
          .map((a) => ({
            date: a.date,
            type: a.type as "rest" | "holiday" | "sick" | "available",
            notes: a.notes || undefined,
          }));
        
        // ULTRA-DETAILED DEBUG LOGGING for Wilson I and Allison G
        if (s.name.toLowerCase().includes('wilson') || s.name.toLowerCase().includes('allison')) {
          console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`🔍 DETAILED FILTER DEBUG for: ${s.name}`);
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
          console.log(`Staff ID (original): ${s.id} (type: ${typeof s.id})`);
          console.log(`Staff ID (string): ${staffIdStr}`);
          console.log(`Total availability records in database: ${availabilityData?.length || 0}`);
          
          // Check how many records have matching staff_id using string comparison
          const matchingRecords = (availabilityData || []).filter(a => String(a.staff_id) === staffIdStr);
          console.log(`Records matching this staff_id (STRING comparison): ${matchingRecords.length}`);
          
          // Show sample of availability staff_ids to check format
          const sampleAvailIds = (availabilityData || []).slice(0, 5).map(a => ({
            staff_id_original: a.staff_id,
            staff_id_string: String(a.staff_id),
            type_original: typeof a.staff_id,
            matches_our_staff: String(a.staff_id) === staffIdStr,
          }));
          console.log(`Sample availability staff_ids:`, sampleAvailIds);
          
          console.log(`Final filtered availability count: ${staffAvail.length}`);
          if (staffAvail.length > 0) {
            console.log(`First 3 filtered entries:`, staffAvail.slice(0, 3));
          } else {
            console.log(`❌ NO ENTRIES MATCHED - FILTER FAILED!`);
          }
          console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        } else if (staffAvail.length > 0) {
          // For other staff, just log the count
          console.log(`  ${s.name}: ${staffAvail.length} availability entries`);
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

      console.log("✅ Staff members mapped:", staffMembers.length);
      return staffMembers;
    },
    retry: 1,
    staleTime: 1000 * 30, // Cache for only 30 seconds (was 5 minutes)
    refetchOnMount: "always", // Always fetch fresh data when component mounts
    refetchOnWindowFocus: true, // Refetch when user returns to browser tab
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
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
  });
}

// Task Config Mutation Hook
export function useUpdateTaskConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskConfig: TaskConfig) => {
      const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
      
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
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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
      queryClient.invalidateQueries({ queryKey: ["staff"] });
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