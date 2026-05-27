import { supabase } from "@/integrations/supabase/client";
import type { StaffMember, AvailabilityEntry, Task, ShiftStart, ShiftPattern } from "@/types";

export const staffService = {
  // Fetch all staff members with their availability (12-week window)
  async getAllStaff(): Promise<StaffMember[]> {
    console.log("📡 staffService.getAllStaff - Fetching from Supabase...");
    
    const { data, error } = await supabase
      .from("staff")
      .select(`
        *,
        availability:staff_availability(date, type, notes)
      `)
      .order("name");

    if (error) {
      console.error("❌ Error fetching staff:", error);
      throw error;
    }

    console.log(`✅ Fetched ${data?.length || 0} staff from database`);
    
    if (data && data.length > 0) {
      console.log("📦 First staff member structure:", {
        name: data[0].name,
        availabilityCount: data[0].availability?.length || 0,
        availabilityIsArray: Array.isArray(data[0].availability),
        firstAvailability: data[0].availability?.[0]
      });
    }

    // Ensure availability is always an array
    return (data || []).map((staff: any) => ({
      id: staff.id,
      name: staff.name,
      trainedTasks: staff.trained_tasks || [],
      shiftStart: staff.shift_start,
      dayShiftPattern: staff.day_shift_pattern,
      shiftPattern: staff.shift_pattern,
      restDays: staff.rest_days || [],
      availability: Array.isArray(staff.availability) ? staff.availability : [],
      createdAt: staff.created_at,
      updatedAt: staff.updated_at,
    }));
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
        rest_days: staff.restDays || [],
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
      shiftPattern: (data.shift_pattern || "All") as ShiftPattern,
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
    if (updates.restDays !== undefined) updateData.rest_days = updates.restDays;
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

  // Bulk import staff from CSV/Excel with transaction-like behavior
  async bulkImportStaff(
    staffData: Array<{
      name: string;
      trainedTasks: string[];
      shiftStart?: string;
      shiftPattern?: string;
    }>
  ): Promise<{ success: boolean; error?: string; importedCount?: number }> {
    try {
      // Validate all entries first
      const errors: string[] = [];
      staffData.forEach((staff, index) => {
        if (!staff.name || staff.name.trim() === "") {
          errors.push(`Row ${index + 1}: Name is required`);
        }
        if (!staff.trainedTasks || staff.trainedTasks.length === 0) {
          errors.push(`Row ${index + 1}: At least one trained task is required`);
        }
      });

      if (errors.length > 0) {
        return { 
          success: false, 
          error: `Validation failed:\n${errors.join('\n')}` 
        };
      }

      // Insert all at once (Supabase will rollback all if any fail)
      const insertData = staffData.map((s) => ({
        name: s.name,
        trained_tasks: s.trainedTasks,
        shift_start: s.shiftStart || "06:00",
        shift_pattern: s.shiftPattern || "All",
      }));

      const { data, error } = await supabase
        .from("staff")
        .insert(insertData)
        .select();

      if (error) {
        console.error("Error bulk importing staff:", error);
        return { 
          success: false, 
          error: `Failed to import staff: ${error.message}` 
        };
      }

      return { 
        success: true, 
        importedCount: data?.length || 0 
      };
    } catch (error: any) {
      console.error("Unexpected error during bulk import:", error);
      return { 
        success: false, 
        error: error.message || "Unknown error occurred" 
      };
    }
  },

  // Bulk update availability with transaction-like behavior
  async bulkUpdateAvailability(
    staffId: string,
    entries: AvailabilityEntry[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (entries.length === 0) {
        return { success: true };
      }

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
        console.error("Error bulk updating availability:", error);
        return { 
          success: false, 
          error: `Failed to update availability: ${error.message}` 
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error("Unexpected error during bulk availability update:", error);
      return { 
        success: false, 
        error: error.message || "Unknown error occurred" 
      };
    }
  },
};