import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, Task, ShiftStart, ShiftPattern, AvailabilityType } from "@/types";

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

        // Fetch ALL availability data directly - remove default 1000 row limit
        console.log(`📅 [${fetchId}] Fetching COMPLETE availability dataset (full year)...`);
        
        const { data: rawData, error: availError } = await supabase
          .from("availability")
          .select("*")
          .limit(20000); // Set high limit to get all 52 weeks for all staff

        if (availError) {
          console.error(`❌ [${fetchId}] Availability fetch error:`, availError);
          throw availError;
        }
        
        const availabilityData: any[] = rawData || [];

        const totalAvail = availabilityData.length;
        console.log(`✅ [${fetchId}] Fetched ${totalAvail} total availability records (full year)`);
        
        if (totalAvail === 0) {
          console.warn(`⚠️ [${fetchId}] Database returned ZERO availability records!`);
        }

        // Create a Map for O(1) lookups: staff_id -> array of availability entries
        const availabilityMap = new Map<string, any[]>();
        
        availabilityData.forEach((entry) => {
          const staffId = entry.staff_id;
          if (!availabilityMap.has(staffId)) {
            availabilityMap.set(staffId, []);
          }
          availabilityMap.get(staffId)!.push(entry);
        });
        
        console.log(`📊 [${fetchId}] Created availability map for ${availabilityMap.size} staff members`);
        console.log(`📊 [${fetchId}] Sample staff_id keys:`, Array.from(availabilityMap.keys()).slice(0, 3));

        // Map staff with their availability
        const mappedStaff: StaffMember[] = staffData.map((s) => {
          const staffAvailability = availabilityMap.get(s.id) || [];
          
          // DEBUG: Log for specific staff to trace mapping
          if (s.name?.includes('ABBO') || s.name?.includes('BRIAN')) {
            console.log(`🔍 [${fetchId}] ${s.name}:`);
            console.log(`   Staff ID: ${s.id}`);
            console.log(`   Total entries: ${staffAvailability.length}`);
            if (staffAvailability.length > 0) {
              console.log(`   First entry:`, staffAvailability[0]);
            } else {
              console.log(`   ⚠️ NO availability entries for ${s.name}!`);
            }
          }

          return {
            id: s.id,
            name: s.name,
            trainedTasks: s.trained_tasks as Task[],
            shiftStart: s.shift_start as ShiftStart,
            shiftPattern: s.shift_pattern as ShiftPattern,
            availability: staffAvailability.map((a) => ({
              id: a.id,
              date: a.date,
              type: a.type as AvailabilityType,
              notes: a.notes || undefined,
            })),
          };
        });

        console.log(`✅ [${fetchId}] Successfully mapped ${mappedStaff.length} staff members`);
        console.log(`📊 [${fetchId}] Query complete - returning fresh data to React Query`);
        return mappedStaff;
        
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

// Staff Query Hook - Full availability join
export function useStaffQuery() {
  return useQuery({
    queryKey: ["staff", "full"],
    queryFn: async () => {
      console.log('🔍 useStaffQuery: Starting staff fetch...');
      
      // Fetch staff with their availability via JOIN
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select(`
          *,
          availability (
            id,
            date,
            type,
            notes,
            created_at
          )
        `)
        .order("name");

      if (staffError) {
        console.error('❌ useStaffQuery: Staff fetch error:', staffError);
        throw staffError;
      }

      console.log(`✅ useStaffQuery: Fetched ${staffData?.length || 0} staff members`);
      console.log('📊 useStaffQuery: Raw staff data sample:', staffData?.[0]);

      // Transform to match StaffMember interface
      const staff: StaffMember[] = (staffData || []).map((s) => {
        const availabilityRecords = (s.availability || []).map((a: any) => ({
          id: a.id,
          date: a.date,
          type: a.type as AvailabilityType,
          notes: a.notes || undefined,
        }));
        
        return {
          id: s.id,
          name: s.name,
          trainedTasks: (s.trained_tasks || []) as Task[],
          availability: availabilityRecords,
        };
      });

      console.log(`✅ useStaffQuery: Transformed ${staff.length} staff members`);
      console.log('📊 useStaffQuery: First staff member availability count:', staff[0]?.availability?.length || 0);
      console.log('📊 useStaffQuery: First staff availability sample:', staff[0]?.availability?.[0]);

      return staff;
    },
    staleTime: 1000 * 10, // 10 seconds
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