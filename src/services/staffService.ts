import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, AvailabilityEntry, Task, ShiftStart } from "@/types";

export const staffService = {
  // Fetch all staff members with their availability
  async getAllStaff(): Promise<StaffMember[]> {
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("*")
      .order("name");

    if (staffError) {
      console.error("Error fetching staff:", staffError);
      throw staffError;
    }

    const { data: availabilityData, error: availError } = await supabase
      .from("availability")
      .select("*");

    if (availError) {
      console.error("Error fetching availability:", availError);
      throw availError;
    }

    const staff: StaffMember[] = (staffData || []).map((s) => ({
      id: s.id,
      name: s.name,
      trainedTasks: (s.trained_tasks || []) as Task[],
      shiftStart: (s.shift_start || "06:00") as ShiftStart,
      shiftPattern: s.shift_pattern || "All",
      availability: (availabilityData || [])
        .filter((a) => a.staff_id === s.id)
        .map((a) => ({
          date: a.date,
          type: a.type as "rest" | "holiday" | "sick" | "available",
          notes: a.notes || undefined,
        })),
    }));

    return staff;
  },

  // Add new staff member
  async addStaff(staff: Omit<StaffMember, "id" | "availability"> & { shiftPattern?: string }): Promise<StaffMember> {
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

    if (error) {
      console.error("Error adding staff:", error);
      throw error;
    }

    return {
      id: data.id,
      name: data.name,
      trainedTasks: (data.trained_tasks || []) as Task[],
      shiftStart: (data.shift_start || "06:00") as ShiftStart,
      shiftPattern: data.shift_pattern || "All",
      availability: [],
    };
  },

  // Update staff member
  async updateStaff(
    id: string,
    updates: Partial<Omit<StaffMember, "id" | "availability">> & { shiftPattern?: string }
  ): Promise<void> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.trainedTasks !== undefined) updateData.trained_tasks = updates.trainedTasks;
    if (updates.shiftStart !== undefined) updateData.shift_start = updates.shiftStart;
    if (updates.shiftPattern !== undefined) updateData.shift_pattern = updates.shiftPattern;
    updateData.updated_at = new Date().toISOString();

    const { error } = await supabase.from("staff").update(updateData).eq("id", id);

    if (error) {
      console.error("Error updating staff:", error);
      throw error;
    }
  },

  // Delete staff member
  async deleteStaff(id: string): Promise<void> {
    const { error } = await supabase.from("staff").delete().eq("id", id);

    if (error) {
      console.error("Error deleting staff:", error);
      throw error;
    }
  },

  // Add availability entries
  async addAvailability(
    staffId: string,
    entries: AvailabilityEntry[]
  ): Promise<void> {
    const insertData = entries.map((entry) => ({
      staff_id: staffId,
      date: entry.date,
      type: entry.type,
      notes: entry.notes || null,
    }));

    const { error } = await supabase
      .from("availability")
      .upsert(insertData, { onConflict: "staff_id,date" });

    if (error) {
      console.error("Error adding availability:", error);
      throw error;
    }
  },

  // Delete availability entry
  async deleteAvailability(staffId: string, date: string): Promise<void> {
    const { error } = await supabase
      .from("availability")
      .delete()
      .eq("staff_id", staffId)
      .eq("date", date);

    if (error) {
      console.error("Error deleting availability:", error);
      throw error;
    }
  },

  // Clear all availability entries for a staff member
  async clearAllAvailability(staffId: string): Promise<void> {
    const { error } = await supabase
      .from("availability")
      .delete()
      .eq("staff_id", staffId);

    if (error) {
      console.error("Error clearing availability:", error);
      throw error;
    }
  },

  // Bulk import staff from CSV/Excel
  async bulkImportStaff(
    staffData: Array<{
      name: string;
      trainedTasks: string[];
      shiftStart?: string;
      shiftPattern?: string;
    }>
  ): Promise<void> {
    const insertData = staffData.map((s) => ({
      name: s.name,
      trained_tasks: s.trainedTasks,
      shift_start: s.shiftStart || "06:00",
      shift_pattern: s.shiftPattern || "All",
    }));

    const { error } = await supabase.from("staff").insert(insertData);

    if (error) {
      console.error("Error bulk importing staff:", error);
      throw error;
    }
  },
};