import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { staffService } from "@/services/staffService";
import type { StaffMember, Task, ShiftStart, ShiftPattern, AvailabilityType } from "@/types";

interface TaskConfig {
  [task: string]: number[];
}

// Staff Query Hook - Emergency cache bypass
export function useStaff() {
  return useQuery({
    queryKey: ["staff", "full"],
    queryFn: async () => {
      console.log("🔄 FETCHING STAFF DATA from Supabase...");
      // Fetch all staff
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("name");

      console.log("📡 Supabase staff query result:");
      console.log("   Error:", staffError);
      console.log("   Data count:", staffData?.length || 0);
      
      if (staffError) {
        console.error("❌ Staff query error:", staffError);
        throw staffError;
      }

      if (!staffData || staffData.length === 0) {
        console.warn("⚠️ No staff data returned from database");
        return [];
      }

      // Fetch ALL availability data with pagination to bypass 1000-row limit
      let allAvailability: any[] = [];
      let offset = 0;
      const chunkSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: chunk, error: chunkError } = await supabase
          .from("availability")
          .select("*")
          .range(offset, offset + chunkSize - 1)
          .order("date");
        
        if (chunkError) throw chunkError;
        
        if (!chunk || chunk.length === 0) {
          hasMore = false;
        } else {
          allAvailability = [...allAvailability, ...chunk];
          
          if (chunk.length < chunkSize) {
            hasMore = false;
          } else {
            offset += chunkSize;
          }
        }
      }

      // Create a Map for O(1) lookups
      const availabilityMap = new Map<string, any[]>();
      
      allAvailability.forEach((entry) => {
        const staffId = entry.staff_id;
        if (!availabilityMap.has(staffId)) {
          availabilityMap.set(staffId, []);
        }
        availabilityMap.get(staffId)!.push(entry);
      });

      // Map staff with their availability
      const mappedStaff: StaffMember[] = staffData.map((s) => {
        const staffAvailability = availabilityMap.get(s.id) || [];

        return {
          id: s.id,
          name: s.name,
          trainedTasks: s.trained_tasks as Task[],
          shiftStart: s.shift_start as ShiftStart,
          shiftPattern: s.shift_pattern as ShiftPattern,
          restDays: (s.rest_days as number[]) || [],
          availability: staffAvailability.map((a) => ({
            id: a.id,
            date: a.date,
            type: a.type as AvailabilityType,
            notes: a.notes || undefined,
          })),
        };
      });

      console.log(`✅ LOADED ${mappedStaff.length} staff members`);
      console.log(`📊 Total availability entries: ${allAvailability.length}`);
      if (mappedStaff.length > 0 && mappedStaff[0].availability) {
        console.log(`📅 Sample staff availability count: ${mappedStaff[0].availability.length}`);
      }
      return mappedStaff;
    },
    staleTime: 30000, // 30 seconds cache
    refetchOnMount: true,
    refetchOnWindowFocus: false,
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

      if (error) throw error;
      if (!data || data.length === 0) return null;

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
    staleTime: 1000 * 60 * 5, // 5 minutes cache
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
          rest_days: staff.restDays || [],
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
          rest_days: updates.restDays,
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
      const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping", "Equipment"];
      
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
      const { error } = await supabase.from("availability").upsert(
        { ...availability },
        { onConflict: 'staff_id,date' }
      );
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