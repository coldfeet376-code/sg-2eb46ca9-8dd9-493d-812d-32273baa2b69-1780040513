export type Task = 
  | "Frozen" 
  | "Milk" 
  | "TWI" 
  | "Inbound" 
  | "Inbound Late" 
  | "Outbound" 
  | "Marshaling" 
  | "Marshal Late"
  | "Housekeeping"
  | "Equipment";

export type TaskWeights = {
  [key in Task]: number;
};

export const TASK_WEIGHTS: TaskWeights = {
  "Frozen": 0.5,
  "Milk": 1.0,
  "TWI": 1.0,
  "Inbound": 1.0,
  "Inbound Late": 0.5,
  "Outbound": 1.0,
  "Marshaling": 1.0,
  "Marshal Late": 0.5,
  "Housekeeping": 1.0,
  "Equipment": 1.0,
};

export type ShiftType = "Day" | "Night";

export type ShiftStart = 
  | "06:00" 
  | "07:00"
  | "08:00"
  | "08:30" 
  | "09:00" 
  | "09:30" 
  | "10:00" 
  | "11:00";

export type DayShiftPattern = 
  | "06:00-14:30"
  | "06:00-14:00"
  | "07:00-15:30"
  | "08:00-16:30"
  | "08:30-17:00"
  | "09:00-17:00"
  | "09:00-17:30"
  | "09:30-18:00"
  | "10:00-14:00"
  | "10:00-16:30"
  | "10:00-18:30"
  | "11:00-17:30";

export type ManagerShiftStart = "06:00" | "08:00";

export type ManagerDuty = "Supervisor" | "Manager" | "Intake" | "Out-loading" | "Admin" | "Floor";

export type ShiftPattern = "Early" | "Late" | "All";

export type AvailabilityType = "rest" | "holiday" | "sick" | "available";

export interface AvailabilityEntry {
  id?: string;
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
  shift?: ShiftType; // Day or Night shift
  shiftStart?: ShiftStart;
  shiftPattern?: ShiftPattern;
  dayShiftPattern?: DayShiftPattern; // Full shift pattern with end time
  restDays?: number[]; // Day of week (0-6)
  availability?: AvailabilityEntry[]; // Date-specific availability
  preferences?: StaffPreferences; // Task preferences
  role?: "manager" | "supervisor" | "staff"; // User role
  createdAt?: string;
  updatedAt?: string;
}

export interface Assignment {
  staffId: string;
  staffName: string;
  task: Task;
  date: string; // ISO date string
  shift?: ShiftType; // Day or Night
  shiftPattern?: ShiftPattern;
}

export interface ManagerAssignment {
  managerId: string;
  managerName: string;
  duty: ManagerDuty;
  shiftStart: ManagerShiftStart;
  date: string; // ISO date string
}

export interface WeekRota {
  weekStart: string; // ISO date string (Sunday)
  assignments: Assignment[];
}

export interface ShiftSwap {
  id: string;
  fromStaffId: string;
  fromStaffName: string;
  toStaffId: string;
  toStaffName: string;
  task: Task;
  date: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  notes?: string;
}

export interface RotaBackup {
  id: string;
  weekStart: string;
  assignments: Assignment[];
  lockedAssignments: Assignment[];
  createdAt: string;
  createdBy?: string;
}

export interface FairnessMetrics {
  overallScore: number; // 0-100, higher is more fair
  taskFairness: Record<Task, number>;
  staffWeightedTotals: Record<string, number>;
  staffTotalAssignments: Record<string, number>;
  weightedAverage: number;
  weightedStdDev: number;
  staffWorkload?: {
    staffId: string;
    staffName: string;
    totalAssignments: number;
    weightedTotal: number;
    taskBreakdown: Record<Task, number>;
    availableDays: number;
  }[];
  standardDeviation?: number;
}