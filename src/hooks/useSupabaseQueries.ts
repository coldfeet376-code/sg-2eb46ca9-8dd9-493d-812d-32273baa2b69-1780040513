import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart, ShiftPattern } from "@/types";

interface TaskConfig {
  [task: string]: number[];
}

// Staff Query Hook - Emergency cache bypass
export function useStaff() {
  // Generate unique timestamp for this page load to force fresh fetch
  const loadTimestamp = useRef(Date.now()).current;
  
  return useQuery({
    queryKey: ["staff", "emergency-bypass", loadTimestamp],
    queryFn: async () => {
      const fetchId = Math.random().toString(36).substring(7);
      console.log(`🚨 [EMERGENCY FETCH ${fetchId}] Starting with cache bypass at ${new Date().toISOString()}`);
      
      try {
        // Add cache-busting query parameter to Supabase request
        const { data: staffData, error: staffError } = await supabase
          .from("staff")
          .select("*")
          .order("name");

        if (staffError) {
          console.error(`❌ [${fetchId}] Staff query error:`, staffError);
          throw staffError;
        }

        console.log(`📊 [${fetchId}] Staff loaded:`, staffData?.length || 0, "members");

        if (!staffData || staffData.length === 0) {
          console.warn(`⚠️ [${fetchId}] No staff data in database`);
          return [];
        }

        // Fetch ALL availability data with NO date filtering
        console.log(`📅 [${fetchId}] Fetching COMPLETE availability dataset (no filters)...`);
        const { data: availabilityData, error: availError } = await supabase
          .from("availability")
          .select("*")
          .limit(50000) // Override default 1000-row limit to fetch full dataset
          .order('date', { ascending: true });

        if (availError) {
          console.error(`❌ [${fetchId}] Availability query error:`, availError);
          throw availError;
        }

        const totalAvail = availabilityData?.length || 0;
        console.log(`✅ [${fetchId}] Fetched ${totalAvail} total availability records from database`);
        
        if (totalAvail === 0) {
          console.warn(`⚠️ [${fetchId}] Database returned ZERO availability records!`);
        }

        if (!availabilityData || availabilityData.length === 0) {
          console.warn(`⚠️ [${fetchId}] No availability data in database`);
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
          
          // Detailed logging for Abbo and Brian
          if (s.name.toLowerCase().includes('abbo') || s.name.toLowerCase().includes('brian')) {
            console.log(`🔍 [${fetchId}] ${s.name}:`);
            console.log(`   Total entries: ${staffAvail.length}`);
            if (staffAvail.length > 0) {
              console.log(`   Date range: ${staffAvail[0].date} → ${staffAvail[staffAvail.length - 1].date}`);
              console.log(`   First 3: ${staffAvail.slice(0, 3).map(a => `${a.date}(${a.type})`).join(', ')}`);
              console.log(`   Last 3: ${staffAvail.slice(-3).map(a => `${a.date}(${a.type})`).join(', ')}`);
              
              // Check May 24-30 week specifically
              const mayWeek = staffAvail.filter(a => a.date >= '2026-05-24' && a.date <= '2026-05-30');
              console.log(`   May 24-30 entries: ${mayWeek.map(a => `${a.date}(${a.type})`).join(', ')}`);
            } else {
              console.warn(`   ⚠️ NO availability entries for ${s.name}!`);
            }
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

        console.log(`✅ [${fetchId}] Successfully mapped ${staffMembers.length} staff members`);
        console.log(`📊 [${fetchId}] Query complete - returning fresh data to React Query`);
        return staffMembers;
        
      } catch (error) {
        console.error(`❌ [${fetchId}] Fatal error:`, error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 0, // Never consider data stale
    gcTime: 0, // Don't cache
    refetchOnMount: "always",
    refetchOnWindowFocus: "always",
    refetchOnReconnect: "always",
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