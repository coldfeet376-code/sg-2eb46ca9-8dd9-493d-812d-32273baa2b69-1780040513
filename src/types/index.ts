export type Task = "Frozen" | "Milk" | "TWI" | "Inbound" | "Outbound" | "Marshaling";

export type AvailabilityType = "available" | "rest" | "holiday" | "sick";

export interface AvailabilityEntry {
  date: string; // ISO date string
  type: AvailabilityType;
  notes?: string;
}

export interface StaffPreferences {
  preferredTasks?: Task[]; // Tasks they prefer to do
  avoidTasks?: Task[]; // Tasks they prefer to avoid
}

export interface StaffMember {
  id: string;
  name: string;
  trainedTasks: Task[];
  restDays?: number[]; // Day of week (0-6)
  availability?: AvailabilityEntry[]; // Date-specific availability
  preferences?: StaffPreferences; // Task preferences
}

export interface Assignment {
  staffId: string;
  staffName: string;
  task: Task;
  date: string; // ISO date string
}

export interface WeekRota {
  weekStart: string; // ISO date string (Sunday)
  assignments: Assignment[];
}