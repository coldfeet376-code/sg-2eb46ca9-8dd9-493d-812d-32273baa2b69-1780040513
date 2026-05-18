import { supabase } from "@/integrations/supabase/client";

export interface Manager {
  id: string;
  name: string;
  can_intake: boolean;
  can_out_loading: boolean;
  can_admin: boolean;
  can_floor: boolean;
  preferred_shift: "06:00" | "08:00" | null;
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

  return data || [];
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

  return data;
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

  return data;
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

  return data;
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
export async function getManagersForDuty(
  duty: "Intake" | "Out-loading" | "Admin" | "Floor"
): Promise<Manager[]> {
  const columnMap = {
    "Intake": "can_intake",
    "Out-loading": "can_out_loading",
    "Admin": "can_admin",
    "Floor": "can_floor",
  };

  const column = columnMap[duty];

  const { data, error } = await supabase
    .from("managers")
    .select("*")
    .eq(column, true)
    .order("name", { ascending: true });

  console.log(`getManagersForDuty (${duty}):`, { data, error });

  if (error) {
    console.error("Error fetching managers for duty:", error);
    throw error;
  }

  return data || [];
}