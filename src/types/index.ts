export type Task = "Frozen" | "Milk" | "TWI" | "Inbound" | "Outbound" | "Marshaling";

export interface StaffMember {
  id: string;
  name: string;
  trainedTasks: Task[];
  restDays: string[]; // ISO date strings
  absences: { start: string; end: string }[];
  holidays: { start: string; end: string }[];
}

export interface TaskRequirement {
  task: Task;
  requirements: {
    [day: string]: number; // day: 0-6 (Sun-Sat), value: number of staff needed
  };
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