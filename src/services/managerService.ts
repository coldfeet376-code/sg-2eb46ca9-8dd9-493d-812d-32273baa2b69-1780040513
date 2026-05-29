import { supabase } from "@/integrations/supabase/client";
import type { ManagerDuty, AvailabilityType } from "@/types";

export interface Manager {
  id: string;
  name: string;
  can_intake: boolean;
  can_out_loading: boolean;
  can_admin: boolean;
  can_floor: boolean;
  preferred_shift: "06:00" | "08:00" | null;
  recurring_rest_days: number[];
  created_at: string;
  updated_at: string;
}

export interface CreateManagerInput {
  name: string;
  can_intake: boolean;
  can_out_loading: boolean;
  can_admin: boolean;
  can_floor: boolean;
  preferred_shift: "06:00" | "08:00" | null;
}

export interface UpdateManagerInput extends Partial<CreateManagerInput> {
  id: string;
}

/**
 * Fetch all managers from the database
 */
export async function getAllManagers(): Promise<Manager[]> {
  const { data, error } = await supabase
    .from("managers")
    .select("*")
    .order("name", { ascending: true });

  console.log("getAllManagers:", { data, error });

  if (error) {
    console.error("Error fetching managers:", error);
    throw error;
  }

  return (data as unknown as Manager[]) || [];
}

/**
 * Get a single manager by ID
 */
export async function getManagerById(id: string): Promise<Manager | null> {
  const { data, error } = await supabase
    .from("managers")
    .select("*")
    .eq("id", id)
    .single();

  console.log("getManagerById:", { data, error });

  if (error) {
    console.error("Error fetching manager:", error);
    throw error;
  }

  return data ? (data as unknown as Manager) : null;
}

/**
 * Create a new manager
 */
export async function createManager(input: CreateManagerInput): Promise<Manager> {
  const { data, error } = await supabase
    .from("managers")
    .insert([input])
    .select()
    .single();

  console.log("createManager:", { data, error });

  if (error) {
    console.error("Error creating manager:", error);
    throw error;
  }

  return data as unknown as Manager;
}

/**
 * Update an existing manager
 */
export async function updateManager(input: UpdateManagerInput): Promise<Manager> {
  const { id, ...updates } = input;

  const { data, error } = await supabase
    .from("managers")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  console.log("updateManager:", { data, error });

  if (error) {
    console.error("Error updating manager:", error);
    throw error;
  }

  return data as unknown as Manager;
}

/**
 * Delete a manager
 */
export async function deleteManager(id: string): Promise<void> {
  const { error } = await supabase
    .from("managers")
    .delete()
    .eq("id", id);

  console.log("deleteManager:", { error });

  if (error) {
    console.error("Error deleting manager:", error);
    throw error;
  }
}

/**
 * Get managers who can perform a specific duty
 */
export async function getManagersForDuty(duty: ManagerDuty): Promise<Manager[]> {
  const columnMap: Record<ManagerDuty, string> = {
    Intake: "can_intake",
    "Out-loading": "can_out_loading",
    Admin: "can_admin",
    Floor: "can_floor",
  };

  const column = columnMap[duty];

  // Use any for the query builder to avoid TS excessively deep instantiation errors
  // with dynamic column names in Supabase's eq() method
  const queryBuilder: any = supabase.from("managers").select("*");
  const { data, error } = await queryBuilder
    .eq(column, true)
    .order("name", { ascending: true });

  console.log(`getManagersForDuty (${duty}):`, { data, error });

  if (error) {
    console.error("Error fetching managers for duty:", error);
    throw error;
  }

  return (data as unknown as Manager[]) || [];
}

// Availability management
export interface ManagerAvailability {
  id: string;
  manager_id: string;
  date: string;
  type: AvailabilityType;
  notes?: string;
  created_at: string;
}

export async function getManagerAvailability(
  managerId: string,
  startDate: string,
  endDate: string
): Promise<ManagerAvailability[]> {
  const { data, error } = await supabase
    .from("manager_availability")
    .select("*")
    .eq("manager_id", managerId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: true });

  console.log("getManagerAvailability:", { data, error });

  if (error) {
    console.error("Error fetching manager availability:", error);
    throw error;
  }

  return (data as unknown as ManagerAvailability[]) || [];
}

export async function setManagerAvailability(
  managerId: string,
  date: string,
  type: AvailabilityType,
  notes?: string
): Promise<void> {
  const { error } = await supabase.from("manager_availability").upsert(
    {
      manager_id: managerId,
      date,
      type,
      notes: notes || null,
    },
    {
      onConflict: "manager_id,date",
    }
  );

  console.log("setManagerAvailability:", { error });

  if (error) {
    console.error("Error setting manager availability:", error);
    throw error;
  }
}

export async function deleteManagerAvailability(
  managerId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from("manager_availability")
    .delete()
    .eq("manager_id", managerId)
    .eq("date", date);

  console.log("deleteManagerAvailability:", { error });

  if (error) {
    console.error("Error deleting manager availability:", error);
    throw error;
  }
}

export async function getAvailabilityForDate(date: string): Promise<ManagerAvailability[]> {
  const { data, error } = await supabase
    .from("manager_availability")
    .select("*")
    .eq("date", date);

  console.log("getAvailabilityForDate:", { data, error });

  if (error) {
    console.error("Error fetching availability for date:", error);
    throw error;
  }

  return (data as unknown as ManagerAvailability[]) || [];
}