import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart } from "@/types";

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
        error: availError?.message
      });

      if (availError) {
        console.error("❌ Availability query error:", availError);
        throw availError;
      }

      const staffMembers: StaffMember[] = (staffData || []).map((s) => ({
        id: s.id,
        name: s.name,
        trainedTasks: (s.trained_tasks || []) as Task[],
        shiftStart: (s.shift_start || "06:00") as ShiftStart,
        availability: (availabilityData || [])
          .filter((a) => a.staff_id === s.id)
          .map((a) => ({
            date: a.date,
            type: a.type as "rest" | "holiday" | "sick" | "available",
            notes: a.notes || undefined,
          })),
      }));

      console.log("✅ Staff members mapped:", staffMembers.length);
      return staffMembers;
    },
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
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
    mutationFn: async (staff: Omit<StaffMember, "id" | "availability">) => {
      const { data, error } = await supabase
        .from("staff")
        .insert({
          name: staff.name,
          trained_tasks: staff.trainedTasks,
          shift_start: staff.shiftStart,
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
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<StaffMember> }) => {
      const { error } = await supabase
        .from("staff")
        .update({
          name: updates.name,
          trained_tasks: updates.trainedTasks,
          shift_start: updates.shiftStart,
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