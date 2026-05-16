import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { useAudit } from "@/contexts/AuditContext";
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, ShiftStart } from "@/types";
import { Users, Upload, Plus, Trash2, Calendar as Calendar2, FileSpreadsheet, AlertCircle, Repeat, Clock, Edit, X, Monitor, Smartphone } from "lucide-react";
import * as XLSX from "xlsx";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const SHIFT_STARTS: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [shiftStart, setShiftStart] = useState<ShiftStart>("06:00");
  const [filterShift, setFilterShift] = useState<ShiftStart | "all">("all");
  const [bulkInput, setBulkInput] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("rest");
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [excelImport, setExcelImport] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  
  // Batch availability state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  // Mobile view state
  const [mobileView, setMobileView] = useState(false);
  
  // Annual rota state
  const [showAnnualRota, setShowAnnualRota] = useState(false);
  const [annualRestDay, setAnnualRestDay] = useState<number>(0); // 0 = Sunday
  const [annualStartDate, setAnnualStartDate] = useState<Date>(() => {
    const start = new Date();
    start.setMonth(0, 1); // January 1st of current year
    return start;
  });
  const [annualEndDate, setAnnualEndDate] = useState<Date>(() => {
    const end = new Date();
    end.setMonth(11, 31); // December 31st of current year
    return end;
  });
  
  const { addAuditEntry } = useAudit();
  
  // Edit staff state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState<Task[]>([]);
  const [editShift, setEditShift] = useState<ShiftStart>("06:00");
  
  // Recurring pattern state
  const [patternDayOfWeek, setPatternDayOfWeek] = useState<number>(1);
  const [patternType, setPatternType] = useState<AvailabilityType>("rest");
  const [patternStartDate, setPatternStartDate] = useState<Date>(new Date());
  const [patternEndDate, setPatternEndDate] = useState<Date>(() => {
    const end = new Date();
    end.setMonth(end.getMonth() + 3);
    return end;
  });
  const [patternNotes, setPatternNotes] = useState("");

  useEffect(() => {
    const savedStaff = localStorage.getItem("warehouse-staff");
    if (savedStaff) {
      setStaff(JSON.parse(savedStaff));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("warehouse-staff", JSON.stringify(staff));
  }, [staff]);

  const handleAddStaff = () => {
    if (!name.trim() || selectedTasks.length === 0) return;

    const newStaff: StaffMember = {
      id: Date.now().toString(),
      name: name.trim(),
      trainedTasks: selectedTasks,
      shiftStart,
      availability: [],
    };

    setStaff([...staff, newStaff]);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "staff",
      entityId: newStaff.id,
      details: `Added staff member: ${newStaff.name}`,
    });
    setName("");
    setSelectedTasks([]);
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setEditName(member.name);
    setEditTasks([...member.trainedTasks]);
    setEditShift(member.shiftStart || "06:00");
  };

  const handleCancelEdit = () => {
    setEditingStaffId(null);
    setEditName("");
    setEditTasks([]);
    setEditShift("06:00");
  };

  const handleSaveEdit = () => {
    if (!editingStaffId || !editName.trim() || editTasks.length === 0) return;

    const updatedStaff = staff.map((s) => {
      if (s.id === editingStaffId) {
        return {
          ...s,
          name: editName.trim(),
          trainedTasks: editTasks,
          shiftStart: editShift,
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    addAuditEntry({
      user: "System",
      action: "updated",
      entity: "staff",
      entityId: editingStaffId,
      details: `Updated staff member: ${editName.trim()}`,
    });
    setEditingStaffId(null);
  };

  // Quick action handlers
  const handleQuickSickToday = (staffId: string) => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    
    const updatedStaff = staff.map((s) => {
      if (s.id === staffId) {
        const newEntry: AvailabilityEntry = {
          date: dateStr,
          type: "sick",
          notes: "Marked sick",
        };
        return {
          ...s,
          availability: [...(s.availability || []), newEntry],
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "availability",
      entityId: staffId,
      details: `Marked sick for today`,
    });
  };

  const handleQuickRestTomorrow = (staffId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    
    const updatedStaff = staff.map((s) => {
      if (s.id === staffId) {
        const newEntry: AvailabilityEntry = {
          date: dateStr,
          type: "rest",
          notes: "Quick rest day",
        };
        return {
          ...s,
          availability: [...(s.availability || []), newEntry],
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "availability",
      entityId: staffId,
      details: `Added rest day for tomorrow`,
    });
  };

  // Batch availability handler
  const handleBatchAvailability = () => {
    if (!dateFrom || !dateTo || selectedStaffIds.length === 0) return;

    const dates: Date[] = [];
    const current = new Date(dateFrom);
    const end = new Date(dateTo);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const updatedStaff = staff.map((s) => {
      if (selectedStaffIds.includes(s.id)) {
        const newEntries: AvailabilityEntry[] = dates.map((date) => ({
          date: date.toISOString().split("T")[0],
          type: availabilityType,
          notes: availabilityNotes || "Batch entry",
        }));
        return {
          ...s,
          availability: [...(s.availability || []), ...newEntries],
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "availability",
      entityId: "batch",
      details: `Added ${dates.length} days for ${selectedStaffIds.length} staff`,
    });

    // Reset batch form
    setSelectedStaffIds([]);
    setDateFrom(undefined);
    setDateTo(undefined);
    setAvailabilityNotes("");
    setBatchMode(false);
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  // Annual rota handler
  const handleSetupAnnualRota = () => {
    if (!editingStaffId) return;

    const dates: Date[] = [];
    const current = new Date(annualStartDate);
    const end = new Date(annualEndDate);

    // Generate all dates matching the selected day of week
    while (current <= end) {
      if (current.getDay() === annualRestDay) {
        dates.push(new Date(current));
      }
      current.setDate(current.getDate() + 1);
    }

    const updatedStaff = staff.map((s) => {
      if (s.id === editingStaffId) {
        const newEntries: AvailabilityEntry[] = dates.map((date) => ({
          date: date.toISOString().split("T")[0],
          type: "rest",
          notes: `Annual rest day (${DAYS_OF_WEEK[annualRestDay]})`,
        }));
        
        // Merge with existing availability, avoid duplicates
        const existingDates = new Set(s.availability?.map(a => a.date) || []);
        const uniqueNewEntries = newEntries.filter(e => !existingDates.has(e.date));
        
        return {
          ...s,
          availability: [...(s.availability || []), ...uniqueNewEntries],
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "availability",
      entityId: editingStaffId,
      details: `Set up annual rota: ${dates.length} ${DAYS_OF_WEEK[annualRestDay]}s`,
    });

    setShowAnnualRota(false);
  };

  const handleEditTaskToggle = (task: Task) => {
    if (editTasks.includes(task)) {
      setEditTasks(editTasks.filter((t) => t !== task));
    } else {
      setEditTasks([...editTasks, task]);
    }
  };

  const handleDeleteStaff = (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    setStaff(staff.filter((s) => s.id !== id));
    if (staffMember) {
      addAuditEntry({
        user: "System",
        action: "deleted",
        entity: "staff",
        entityId: id,
        details: `Deleted staff member: ${staffMember.name}`,
      });
    }
  };

  const handleTaskToggle = (task: Task) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleBulkImport = () => {
    const lines = bulkInput.trim().split("\n");
    const newStaff: StaffMember[] = [];

    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;

      const staffName = parts[0];
      
      const lastPart = parts[parts.length - 1];
      let shift: ShiftStart = "06:00";
      let tasksEndIndex = parts.length;
      
      if (SHIFT_STARTS.includes(lastPart as ShiftStart)) {
        shift = lastPart as ShiftStart;
        tasksEndIndex = parts.length - 1;
      }
      
      const tasks = parts
        .slice(1, tasksEndIndex)
        .filter((t) => TASKS.includes(t as Task)) as Task[];

      if (staffName && tasks.length > 0) {
        newStaff.push({
          id: Date.now().toString() + Math.random(),
          name: staffName,
          trainedTasks: tasks,
          shiftStart: shift,
          availability: [],
        });
      }
    });

    if (newStaff.length > 0) {
      setStaff([...staff, ...newStaff]);
      setBulkInput("");
      setBulkSuccess(true);
      setTimeout(() => setBulkSuccess(false), 3000);
    }
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      
      // Check if it's an Excel file
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(firstSheet);
        setExcelImport(csvText);
      } else {
        // Plain text CSV
        const text = data as string;
        setExcelImport(text);
      }
    };

    // Read as binary for Excel files, text for CSV
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleAvailabilityImport = () => {
    if (!selectedStaff || !excelImport.trim()) return;

    const lines = excelImport.trim().split("\n");
    const newAvailability: AvailabilityEntry[] = [];

    // Expected format: Date,Type,Notes (e.g., "2026-01-15,holiday,Christmas leave")
    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;

      const dateStr = parts[0];
      const type = parts[1].toLowerCase();
      const notes = parts[2] || "";

      // Validate date format
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;

      // Validate type
      if (!["rest", "holiday", "sick", "available"].includes(type)) return;

      newAvailability.push({
        date: date.toISOString().split("T")[0],
        type: type as AvailabilityType,
        notes,
      });
    });

    if (newAvailability.length > 0) {
      const updatedStaff = staff.map((s) => {
        if (s.id === selectedStaff.id) {
          // Merge with existing availability, removing duplicates
          const existingDates = new Set(s.availability?.map((a) => a.date) || []);
          const filtered = newAvailability.filter((a) => !existingDates.has(a.date));
          return {
            ...s,
            availability: [...(s.availability || []), ...filtered],
          };
        }
        return s;
      });
      setStaff(updatedStaff);
      setSelectedStaff(updatedStaff.find((s) => s.id === selectedStaff.id) || null);
      setExcelImport("");
    }
  };

  const handleAddAvailability = () => {
    if (!selectedStaff || selectedDates.length === 0) return;

    const newEntries: AvailabilityEntry[] = selectedDates.map((date) => ({
      date: date.toISOString().split("T")[0],
      type: availabilityType,
      notes: availabilityNotes,
    }));

    const updatedStaff = staff.map((s) => {
      if (s.id === selectedStaff.id) {
        // Remove existing entries for these dates, then add new
        const existingDates = new Set(newEntries.map((e) => e.date));
        const filtered = (s.availability || []).filter((a) => !existingDates.has(a.date));
        return {
          ...s,
          availability: [...filtered, ...newEntries].sort((a, b) => a.date.localeCompare(b.date)),
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    setSelectedStaff(updatedStaff.find((s) => s.id === selectedStaff.id) || null);
    setSelectedDates([]);
    setAvailabilityNotes("");
  };

  const handleDeleteAvailability = (staffId: string, date: string) => {
    const updatedStaff = staff.map((s) => {
      if (s.id === staffId) {
        return {
          ...s,
          availability: (s.availability || []).filter((a) => a.date !== date),
        };
      }
      return s;
    });
    setStaff(updatedStaff);
    setSelectedStaff(updatedStaff.find((s) => s.id === staffId) || null);
  };

  const handleApplyPattern = () => {
    if (!selectedStaff) return;

    const entries: AvailabilityEntry[] = [];
    const current = new Date(patternStartDate);
    const end = new Date(patternEndDate);

    // Find all occurrences of the selected day between start and end
    while (current <= end) {
      if (current.getDay() === patternDayOfWeek) {
        entries.push({
          date: current.toISOString().split("T")[0],
          type: patternType,
          notes: patternNotes || `Every ${DAYS_OF_WEEK[patternDayOfWeek]}`,
        });
      }
      current.setDate(current.getDate() + 1);
    }

    if (entries.length === 0) return;

    const updatedStaff = staff.map((s) => {
      if (s.id === selectedStaff.id) {
        // Remove existing entries for these dates, then add new
        const existingDates = new Set(entries.map((e) => e.date));
        const filtered = (s.availability || []).filter((a) => !existingDates.has(a.date));
        return {
          ...s,
          availability: [...filtered, ...entries].sort((a, b) => a.date.localeCompare(b.date)),
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    setSelectedStaff(updatedStaff.find((s) => s.id === selectedStaff.id) || null);
    setPatternNotes("");
  };

  const getAvailabilityColor = (type: AvailabilityType) => {
    switch (type) {
      case "rest":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "holiday":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "sick":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-green-100 text-green-800 border-green-300";
    }
  };

  const getAvailabilityStats = (staffMember: StaffMember) => {
    const availability = staffMember.availability || [];
    return {
      rest: availability.filter((a) => a.type === "rest").length,
      holiday: availability.filter((a) => a.type === "holiday").length,
      sick: availability.filter((a) => a.type === "sick").length,
    };
  };

  return (
    <Layout>
      <SEO title="Staff Management - Warehouse Rota" description="Manage warehouse staff and their training certifications" />

      <div className="space-y-6">
        <div>
          <h1 className="font-condensed text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Manage employees, training, and availability
          </p>
        </div>

        <Tabs defaultValue="staff" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-2xl rounded-lg">
            <TabsTrigger value="staff" className="font-mono text-xs">
              <Users className="h-4 w-4 mr-2" />
              Staff List
            </TabsTrigger>
            <TabsTrigger value="bulk" className="font-mono text-xs">
              <Upload className="h-4 w-4 mr-2" />
              Bulk Import
            </TabsTrigger>
          </TabsList>

          <TabsContent value="staff" className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Add Staff Member</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Enter staff details and select their trained tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name" className="font-mono text-xs">
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Smith"
                    className="rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-xs">Trained Tasks</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {TASKS.map((task) => (
                      <div key={task} className="flex items-center space-x-2">
                        <Checkbox
                          id={task}
                          checked={selectedTasks.includes(task)}
                          onCheckedChange={() => handleTaskToggle(task)}
                        />
                        <Label htmlFor={task} className="font-mono text-xs cursor-pointer">
                          {task}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shift" className="font-mono text-xs flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Shift Start Time
                  </Label>
                  <Select value={shiftStart} onValueChange={(v) => setShiftStart(v as ShiftStart)}>
                    <SelectTrigger id="shift" className="rounded-lg font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SHIFT_STARTS.map((shift) => (
                        <SelectItem key={shift} value={shift} className="font-mono text-xs">
                          {shift}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleAddStaff} className="rounded-lg shadow-sm hover:shadow-md transition-smooth">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">Add Staff</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="font-condensed flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Staff Members
                  </CardTitle>
                  <CardDescription className="font-mono text-xs mt-1">
                    {staff.length} staff member{staff.length !== 1 ? "s" : ""}
                    {filterShift !== "all" && ` (${filterShift} shift)`}
                  </CardDescription>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setMobileView(!mobileView)}
                    className="rounded-lg"
                  >
                    {mobileView ? (
                      <>
                        <Monitor className="h-4 w-4 mr-2" />
                        <span className="font-mono text-xs hidden sm:inline">Desktop</span>
                      </>
                    ) : (
                      <>
                        <Smartphone className="h-4 w-4 mr-2" />
                        <span className="font-mono text-xs hidden sm:inline">Mobile</span>
                      </>
                    )}
                  </Button>
                  <Select value={filterShift} onValueChange={(v) => setFilterShift(v as ShiftStart | "all")}>
                    <SelectTrigger className="w-32 rounded-lg font-mono text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="font-mono text-xs">
                        All Shifts
                      </SelectItem>
                      {SHIFT_STARTS.map((shift) => (
                        <SelectItem key={shift} value={shift} className="font-mono text-xs">
                          {shift}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant={batchMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setBatchMode(!batchMode);
                      if (batchMode) setSelectedStaffIds([]);
                    }}
                    className="rounded-lg"
                  >
                    <Calendar2 className="h-4 w-4 mr-2" />
                    <span className="font-mono text-xs hidden sm:inline">Batch Add</span>
                  </Button>
                </div>
              </CardHeader>

              {/* Batch Availability Card */}
              {batchMode && (
                <div className="px-6 pb-4">
                  <Card className="border-2 border-primary/20 bg-primary/5">
                    <CardHeader className="pb-3">
                      <CardTitle className="font-condensed text-sm flex items-center gap-2">
                        <Calendar2 className="h-4 w-4" />
                        Batch Add Availability
                      </CardTitle>
                      <CardDescription className="font-mono text-xs">
                        Select staff below, then choose dates and type
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-mono text-xs">
                          {selectedStaffIds.length} staff selected. Click checkboxes below to select.
                        </AlertDescription>
                      </Alert>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">From Date</Label>
                          <Calendar
                            mode="single"
                            selected={dateFrom}
                            onSelect={setDateFrom}
                            className="rounded-lg border"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">To Date</Label>
                          <Calendar
                            mode="single"
                            selected={dateTo}
                            onSelect={setDateTo}
                            className="rounded-lg border"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">Type</Label>
                          <Select value={availabilityType} onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}>
                            <SelectTrigger className="rounded-lg font-mono text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="rest" className="font-mono text-xs">Rest Day</SelectItem>
                              <SelectItem value="holiday" className="font-mono text-xs">Holiday</SelectItem>
                              <SelectItem value="sick" className="font-mono text-xs">Sick Leave</SelectItem>
                              <SelectItem value="available" className="font-mono text-xs">Available</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">Notes (Optional)</Label>
                          <Input
                            value={availabilityNotes}
                            onChange={(e) => setAvailabilityNotes(e.target.value)}
                            placeholder="e.g., Christmas break"
                            className="rounded-lg font-mono text-xs"
                          />
                        </div>
                      </div>

                      <Button
                        onClick={handleBatchAvailability}
                        disabled={!dateFrom || !dateTo || selectedStaffIds.length === 0}
                        className="w-full rounded-lg"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        <span className="font-mono text-xs">
                          Add to {selectedStaffIds.length} Staff
                        </span>
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              <CardContent>
                {staff.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-mono">No staff members yet</p>
                    <p className="text-xs font-mono mt-1">Add staff above to get started</p>
                  </div>
                ) : (
                  <div className={mobileView ? "space-y-2" : "space-y-3"}>
                    {staff
                      .filter((member) => filterShift === "all" || member.shiftStart === filterShift)
                      .map((member) => {
                      const stats = getAvailabilityStats(member);
                      const isEditing = editingStaffId === member.id;
                      
                      if (mobileView && !isEditing) {
                        // Mobile-Optimized Card
                        return (
                          <div
                            key={member.id}
                            className="border border-border rounded-lg p-3 active:bg-muted/50 transition-smooth"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {batchMode && (
                                    <Checkbox
                                      checked={selectedStaffIds.includes(member.id)}
                                      onCheckedChange={() => toggleStaffSelection(member.id)}
                                    />
                                  )}
                                  <h3 className="font-condensed font-semibold text-base">{member.name}</h3>
                                </div>
                                {member.shiftStart && (
                                  <Badge variant="secondary" className="font-mono text-xs mb-2">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {member.shiftStart}
                                  </Badge>
                                )}
                              </div>
                              {!batchMode && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStaff(member.id)}
                                  className="text-destructive h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1.5 mb-3">
                              {member.trainedTasks.map((task) => (
                                <Badge key={task} variant="outline" className="font-mono text-xs">
                                  {task}
                                </Badge>
                              ))}
                            </div>

                            {(stats.rest > 0 || stats.holiday > 0 || stats.sick > 0) && (
                              <div className="flex gap-3 mb-3 text-sm font-mono">
                                {stats.rest > 0 && <span className="text-blue-600">Rest: {stats.rest}</span>}
                                {stats.holiday > 0 && <span className="text-purple-600">Holiday: {stats.holiday}</span>}
                                {stats.sick > 0 && <span className="text-red-600">Sick: {stats.sick}</span>}
                              </div>
                            )}

                            {!batchMode && (
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickSickToday(member.id)}
                                  className="rounded-lg h-9"
                                >
                                  <AlertCircle className="h-3.5 w-3.5 mr-1.5 text-destructive" />
                                  <span className="font-mono text-xs">Sick Today</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleQuickRestTomorrow(member.id)}
                                  className="rounded-lg h-9"
                                >
                                  <Calendar2 className="h-3.5 w-3.5 mr-1.5 text-blue-600" />
                                  <span className="font-mono text-xs">Rest Tomorrow</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditStaff(member)}
                                  className="rounded-lg h-9"
                                >
                                  <Edit className="h-3.5 w-3.5 mr-1.5" />
                                  <span className="font-mono text-xs">Edit Skills</span>
                                </Button>
                                <Sheet>
                                  <SheetTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedStaff(member)}
                                      className="rounded-lg h-9"
                                    >
                                      <Calendar2 className="h-3.5 w-3.5 mr-1.5" />
                                      <span className="font-mono text-xs">Availability</span>
                                    </Button>
                                  </SheetTrigger>
                                  <SheetContent className="w-full sm:max-w-2xl">
                                    <SheetHeader>
                                      <SheetTitle className="font-condensed">
                                        {member.name} - Availability
                                      </SheetTitle>
                                      <SheetDescription className="font-mono text-xs">
                                        Manage rest days, holidays, and sickness
                                      </SheetDescription>
                                    </SheetHeader>

                                    <ScrollArea className="h-[calc(100vh-120px)] mt-6">
                                      <Tabs defaultValue="calendar" className="space-y-4">
                                        <TabsList className="grid w-full grid-cols-3 rounded-lg">
                                          <TabsTrigger value="calendar" className="font-mono text-xs">
                                            Calendar
                                          </TabsTrigger>
                                          <TabsTrigger value="pattern" className="font-mono text-xs">
                                            <Repeat className="h-3.5 w-3.5 mr-1.5" />
                                            Pattern
                                          </TabsTrigger>
                                          <TabsTrigger value="import" className="font-mono text-xs">
                                            Excel Import
                                          </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="calendar" className="space-y-4">
                                          {/* Current Entries Card */}
                                          {selectedStaff && selectedStaff.availability && selectedStaff.availability.length > 0 && (
                                            <Card className="shadow-sm">
                                              <CardHeader className="pb-3">
                                                <CardTitle className="font-condensed text-sm">Current Entries</CardTitle>
                                                <CardDescription className="font-mono text-xs">
                                                  Click X to remove an entry
                                                </CardDescription>
                                              </CardHeader>
                                              <CardContent>
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                  {selectedStaff.availability
                                                    .sort((a, b) => a.date.localeCompare(b.date))
                                                    .map((entry, idx) => (
                                                      <div
                                                        key={idx}
                                                        className={`flex items-center justify-between p-2 rounded-lg border ${getAvailabilityColor(entry.type)}`}
                                                      >
                                                        <div className="flex-1">
                                                          <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold">
                                                              {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                              })}
                                                            </span>
                                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                              {entry.type}
                                                            </Badge>
                                                          </div>
                                                          {entry.notes && (
                                                            <p className="text-[10px] font-mono mt-1 opacity-75">
                                                              {entry.notes}
                                                            </p>
                                                          )}
                                                        </div>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => handleDeleteAvailability(selectedStaff.id, entry.date)}
                                                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                                                        >
                                                          <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                </div>
                                              </CardContent>
                                            </Card>
                                          )}

                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm">Add Dates</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Type</Label>
                                                <Select
                                                  value={availabilityType}
                                                  onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="rest" className="font-mono text-xs">
                                                      Rest Day
                                                    </SelectItem>
                                                    <SelectItem value="holiday" className="font-mono text-xs">
                                                      Holiday
                                                    </SelectItem>
                                                    <SelectItem value="sick" className="font-mono text-xs">
                                                      Sick Leave
                                                    </SelectItem>
                                                    <SelectItem value="available" className="font-mono text-xs">
                                                      Available
                                                    </SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Select Dates</Label>
                                                <Calendar
                                                  mode="multiple"
                                                  selected={selectedDates}
                                                  onSelect={(dates) => setSelectedDates(dates || [])}
                                                  className="rounded-lg border"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Notes (Optional)</Label>
                                                <Input
                                                  value={availabilityNotes}
                                                  onChange={(e) => setAvailabilityNotes(e.target.value)}
                                                  placeholder="e.g., Annual leave"
                                                  className="rounded-lg font-mono text-xs"
                                                />
                                              </div>

                                              <Button
                                                onClick={handleAddAvailability}
                                                disabled={selectedDates.length === 0}
                                                className="w-full rounded-lg"
                                              >
                                                <Plus className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">
                                                  Add {selectedDates.length} Date{selectedDates.length !== 1 ? "s" : ""}
                                                </span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>

                                        <TabsContent value="pattern" className="space-y-4">
                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                                <Repeat className="h-4 w-4" />
                                                Recurring Pattern
                                              </CardTitle>
                                              <CardDescription className="font-mono text-xs">
                                                Set up repeating availability (e.g., every Monday)
                                              </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Day of Week</Label>
                                                <Select
                                                  value={patternDayOfWeek.toString()}
                                                  onValueChange={(v) => setPatternDayOfWeek(parseInt(v))}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {DAYS_OF_WEEK.map((day, idx) => (
                                                      <SelectItem key={idx} value={idx.toString()} className="font-mono text-xs">
                                                        {day}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Type</Label>
                                                <Select
                                                  value={patternType}
                                                  onValueChange={(v) => setPatternType(v as AvailabilityType)}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="rest" className="font-mono text-xs">
                                                      Rest Day
                                                    </SelectItem>
                                                    <SelectItem value="holiday" className="font-mono text-xs">
                                                      Holiday
                                                    </SelectItem>
                                                    <SelectItem value="sick" className="font-mono text-xs">
                                                      Sick Leave
                                                    </SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label className="font-mono text-xs">Start Date</Label>
                                                  <Calendar
                                                    mode="single"
                                                    selected={patternStartDate}
                                                    onSelect={(date) => date && setPatternStartDate(date)}
                                                    className="rounded-lg border"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label className="font-mono text-xs">End Date</Label>
                                                  <Calendar
                                                    mode="single"
                                                    selected={patternEndDate}
                                                    onSelect={(date) => date && setPatternEndDate(date)}
                                                    className="rounded-lg border"
                                                  />
                                                </div>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Notes (Optional)</Label>
                                                <Input
                                                  value={patternNotes}
                                                  onChange={(e) => setPatternNotes(e.target.value)}
                                                  placeholder="e.g., Regular rest day"
                                                  className="rounded-lg font-mono text-xs"
                                                />
                                              </div>

                                              <Button onClick={handleApplyPattern} className="w-full rounded-lg">
                                                <Repeat className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">Apply Pattern</span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>

                                        <TabsContent value="import" className="space-y-4">
                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                                <FileSpreadsheet className="h-4 w-4" />
                                                CSV/Excel Import
                                              </CardTitle>
                                              <CardDescription className="font-mono text-xs">
                                                Upload a CSV file or paste data directly
                                              </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                              <div className="text-xs font-mono text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                                <p className="font-semibold mb-2">Required Format:</p>
                                                <p>Date,Type,Notes</p>
                                                <p className="mt-1">2026-01-15,holiday,Christmas</p>
                                                <p>2026-02-20,rest,Regular rest</p>
                                                <p>2026-03-10,sick,Flu</p>
                                                <p className="mt-2 text-muted-foreground/70">
                                                  Types: rest, holiday, sick, available
                                                </p>
                                              </div>

                                              {/* File Upload Option */}
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs font-semibold">
                                                  Option 1: Upload File
                                                </Label>
                                                <div className="flex gap-2">
                                                  <Button
                                                    variant="outline"
                                                    className="w-full rounded-lg relative"
                                                    onClick={() => document.getElementById('csv-upload')?.click()}
                                                  >
                                                    <Upload className="h-4 w-4 mr-2" />
                                                    <span className="font-mono text-xs">
                                                      {csvFileName || "Choose CSV or Excel File"}
                                                    </span>
                                                  </Button>
                                                  <input
                                                    id="csv-upload"
                                                    type="file"
                                                    accept=".csv,.txt,.xlsx,.xls"
                                                    onChange={handleCsvFileUpload}
                                                    className="hidden"
                                                  />
                                                  {csvFileName && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        setCsvFileName("");
                                                        setExcelImport("");
                                                        const input = document.getElementById('csv-upload') as HTMLInputElement;
                                                        if (input) input.value = "";
                                                      }}
                                                      className="text-destructive hover:text-destructive"
                                                    >
                                                      <X className="h-4 w-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                                <p className="text-[10px] font-mono text-muted-foreground">
                                                  Supports: .csv, .xlsx, .xls files
                                                </p>
                                              </div>

                                              {/* Paste Option */}
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs font-semibold">
                                                  Option 2: Paste Data
                                                </Label>
                                                <Textarea
                                                  value={excelImport}
                                                  onChange={(e) => setExcelImport(e.target.value)}
                                                  placeholder="Date,Type,Notes&#10;2026-01-15,holiday,Christmas&#10;2026-02-20,rest,Regular rest"
                                                  className="font-mono text-xs h-32 rounded-lg"
                                                />
                                              </div>

                                              <Button
                                                onClick={handleAvailabilityImport}
                                                className="w-full rounded-lg"
                                                disabled={!excelImport.trim()}
                                              >
                                                <Upload className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">
                                                  Import {excelImport.trim().split('\n').filter(l => l.trim()).length} Entries
                                                </span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>
                                      </Tabs>
                                    </ScrollArea>
                                  </SheetContent>
                                </Sheet>
                              </div>
                            )}
                          </div>
                        ) : (
                          // Display Mode
                          <div className="flex items-start gap-3 p-4 hover:bg-muted/50 transition-smooth">
                            {/* Batch Selection Checkbox */}
                            {batchMode && (
                              <Checkbox
                                checked={selectedStaffIds.includes(member.id)}
                                onCheckedChange={() => toggleStaffSelection(member.id)}
                                className="mt-1"
                              />
                            )}
                            
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-condensed font-semibold text-sm">{member.name}</h3>
                                {member.shiftStart && (
                                  <Badge variant="secondary" className="font-mono text-[10px] flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {member.shiftStart}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {member.trainedTasks.map((task) => (
                                  <Badge key={task} variant="outline" className="font-mono text-[10px]">
                                    {task}
                                  </Badge>
                                ))}
                              </div>
                              {(stats.rest > 0 || stats.holiday > 0 || stats.sick > 0) && (
                                <div className="flex gap-2 mt-2 text-xs font-mono">
                                  {stats.rest > 0 && (
                                    <span className="text-blue-600">Rest: {stats.rest}</span>
                                  )}
                                  {stats.holiday > 0 && (
                                    <span className="text-purple-600">Holiday: {stats.holiday}</span>
                                  )}
                                  {stats.sick > 0 && (
                                    <span className="text-red-600">Sick: {stats.sick}</span>
                                  )}
                                </div>
                              )}

                              {/* Quick Actions */}
                              {!batchMode && (
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickSickToday(member.id)}
                                    className="rounded-lg h-7"
                                  >
                                    <AlertCircle className="h-3 w-3 mr-1.5 text-destructive" />
                                    <span className="font-mono text-[10px]">Sick Today</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickRestTomorrow(member.id)}
                                    className="rounded-lg h-7"
                                  >
                                    <Calendar2 className="h-3 w-3 mr-1.5 text-blue-600" />
                                    <span className="font-mono text-[10px]">Rest Tomorrow</span>
                                  </Button>
                                </div>
                              )}
                            </div>
                            
                            {!batchMode && (
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditStaff(member)}
                                  className="rounded-lg"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  <span className="font-mono text-xs">Edit</span>
                                </Button>
                                <Sheet>
                                  <SheetTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setSelectedStaff(member)}
                                      className="rounded-lg"
                                    >
                                      <Calendar2 className="h-4 w-4 mr-2" />
                                      <span className="font-mono text-xs">Availability</span>
                                    </Button>
                                  </SheetTrigger>
                                  <SheetContent className="w-full sm:max-w-2xl">
                                    <SheetHeader>
                                      <SheetTitle className="font-condensed">
                                        {member.name} - Availability
                                      </SheetTitle>
                                      <SheetDescription className="font-mono text-xs">
                                        Manage rest days, holidays, and sickness
                                      </SheetDescription>
                                    </SheetHeader>

                                    <ScrollArea className="h-[calc(100vh-120px)] mt-6">
                                      <Tabs defaultValue="calendar" className="space-y-4">
                                        <TabsList className="grid w-full grid-cols-3 rounded-lg">
                                          <TabsTrigger value="calendar" className="font-mono text-xs">
                                            Calendar
                                          </TabsTrigger>
                                          <TabsTrigger value="pattern" className="font-mono text-xs">
                                            <Repeat className="h-3.5 w-3.5 mr-1.5" />
                                            Pattern
                                          </TabsTrigger>
                                          <TabsTrigger value="import" className="font-mono text-xs">
                                            Excel Import
                                          </TabsTrigger>
                                        </TabsList>

                                        <TabsContent value="calendar" className="space-y-4">
                                          {/* Current Entries Card */}
                                          {selectedStaff && selectedStaff.availability && selectedStaff.availability.length > 0 && (
                                            <Card className="shadow-sm">
                                              <CardHeader className="pb-3">
                                                <CardTitle className="font-condensed text-sm">Current Entries</CardTitle>
                                                <CardDescription className="font-mono text-xs">
                                                  Click X to remove an entry
                                                </CardDescription>
                                              </CardHeader>
                                              <CardContent>
                                                <div className="space-y-2 max-h-48 overflow-y-auto">
                                                  {selectedStaff.availability
                                                    .sort((a, b) => a.date.localeCompare(b.date))
                                                    .map((entry, idx) => (
                                                      <div
                                                        key={idx}
                                                        className={`flex items-center justify-between p-2 rounded-lg border ${getAvailabilityColor(entry.type)}`}
                                                      >
                                                        <div className="flex-1">
                                                          <div className="flex items-center gap-2">
                                                            <span className="font-mono text-xs font-semibold">
                                                              {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB", {
                                                                day: "2-digit",
                                                                month: "short",
                                                                year: "numeric",
                                                              })}
                                                            </span>
                                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                              {entry.type}
                                                            </Badge>
                                                          </div>
                                                          {entry.notes && (
                                                            <p className="text-[10px] font-mono mt-1 opacity-75">
                                                              {entry.notes}
                                                            </p>
                                                          )}
                                                        </div>
                                                        <Button
                                                          variant="ghost"
                                                          size="sm"
                                                          onClick={() => handleDeleteAvailability(selectedStaff.id, entry.date)}
                                                          className="h-6 w-6 p-0 hover:bg-destructive/20"
                                                        >
                                                          <X className="h-3.5 w-3.5" />
                                                        </Button>
                                                      </div>
                                                    ))}
                                                </div>
                                              </CardContent>
                                            </Card>
                                          )}

                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm">Add Dates</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Type</Label>
                                                <Select
                                                  value={availabilityType}
                                                  onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="rest" className="font-mono text-xs">
                                                      Rest Day
                                                    </SelectItem>
                                                    <SelectItem value="holiday" className="font-mono text-xs">
                                                      Holiday
                                                    </SelectItem>
                                                    <SelectItem value="sick" className="font-mono text-xs">
                                                      Sick Leave
                                                    </SelectItem>
                                                    <SelectItem value="available" className="font-mono text-xs">
                                                      Available
                                                    </SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Select Dates</Label>
                                                <Calendar
                                                  mode="multiple"
                                                  selected={selectedDates}
                                                  onSelect={(dates) => setSelectedDates(dates || [])}
                                                  className="rounded-lg border"
                                                />
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Notes (Optional)</Label>
                                                <Input
                                                  value={availabilityNotes}
                                                  onChange={(e) => setAvailabilityNotes(e.target.value)}
                                                  placeholder="e.g., Annual leave"
                                                  className="rounded-lg font-mono text-xs"
                                                />
                                              </div>

                                              <Button
                                                onClick={handleAddAvailability}
                                                disabled={selectedDates.length === 0}
                                                className="w-full rounded-lg"
                                              >
                                                <Plus className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">
                                                  Add {selectedDates.length} Date{selectedDates.length !== 1 ? "s" : ""}
                                                </span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>

                                        <TabsContent value="pattern" className="space-y-4">
                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                                <Repeat className="h-4 w-4" />
                                                Recurring Pattern
                                              </CardTitle>
                                              <CardDescription className="font-mono text-xs">
                                                Set up repeating availability (e.g., every Monday)
                                              </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-4">
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Day of Week</Label>
                                                <Select
                                                  value={patternDayOfWeek.toString()}
                                                  onValueChange={(v) => setPatternDayOfWeek(parseInt(v))}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {DAYS_OF_WEEK.map((day, idx) => (
                                                      <SelectItem key={idx} value={idx.toString()} className="font-mono text-xs">
                                                        {day}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Type</Label>
                                                <Select
                                                  value={patternType}
                                                  onValueChange={(v) => setPatternType(v as AvailabilityType)}
                                                >
                                                  <SelectTrigger className="rounded-lg font-mono text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="rest" className="font-mono text-xs">
                                                      Rest Day
                                                    </SelectItem>
                                                    <SelectItem value="holiday" className="font-mono text-xs">
                                                      Holiday
                                                    </SelectItem>
                                                    <SelectItem value="sick" className="font-mono text-xs">
                                                      Sick Leave
                                                    </SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>

                                              <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                  <Label className="font-mono text-xs">Start Date</Label>
                                                  <Calendar
                                                    mode="single"
                                                    selected={patternStartDate}
                                                    onSelect={(date) => date && setPatternStartDate(date)}
                                                    className="rounded-lg border"
                                                  />
                                                </div>
                                                <div className="space-y-2">
                                                  <Label className="font-mono text-xs">End Date</Label>
                                                  <Calendar
                                                    mode="single"
                                                    selected={patternEndDate}
                                                    onSelect={(date) => date && setPatternEndDate(date)}
                                                    className="rounded-lg border"
                                                  />
                                                </div>
                                              </div>

                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs">Notes (Optional)</Label>
                                                <Input
                                                  value={patternNotes}
                                                  onChange={(e) => setPatternNotes(e.target.value)}
                                                  placeholder="e.g., Regular rest day"
                                                  className="rounded-lg font-mono text-xs"
                                                />
                                              </div>

                                              <Button onClick={handleApplyPattern} className="w-full rounded-lg">
                                                <Repeat className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">Apply Pattern</span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>

                                        <TabsContent value="import" className="space-y-4">
                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                                <FileSpreadsheet className="h-4 w-4" />
                                                CSV/Excel Import
                                              </CardTitle>
                                              <CardDescription className="font-mono text-xs">
                                                Upload a CSV file or paste data directly
                                              </CardDescription>
                                            </CardHeader>
                                            <CardContent className="space-y-3">
                                              <div className="text-xs font-mono text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                                <p className="font-semibold mb-2">Required Format:</p>
                                                <p>Date,Type,Notes</p>
                                                <p className="mt-1">2026-01-15,holiday,Christmas</p>
                                                <p>2026-02-20,rest,Regular rest</p>
                                                <p>2026-03-10,sick,Flu</p>
                                                <p className="mt-2 text-muted-foreground/70">
                                                  Types: rest, holiday, sick, available
                                                </p>
                                              </div>

                                              {/* File Upload Option */}
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs font-semibold">
                                                  Option 1: Upload File
                                                </Label>
                                                <div className="flex gap-2">
                                                  <Button
                                                    variant="outline"
                                                    className="w-full rounded-lg relative"
                                                    onClick={() => document.getElementById('csv-upload')?.click()}
                                                  >
                                                    <Upload className="h-4 w-4 mr-2" />
                                                    <span className="font-mono text-xs">
                                                      {csvFileName || "Choose CSV or Excel File"}
                                                    </span>
                                                  </Button>
                                                  <input
                                                    id="csv-upload"
                                                    type="file"
                                                    accept=".csv,.txt,.xlsx,.xls"
                                                    onChange={handleCsvFileUpload}
                                                    className="hidden"
                                                  />
                                                  {csvFileName && (
                                                    <Button
                                                      variant="ghost"
                                                      size="sm"
                                                      onClick={() => {
                                                        setCsvFileName("");
                                                        setExcelImport("");
                                                        const input = document.getElementById('csv-upload') as HTMLInputElement;
                                                        if (input) input.value = "";
                                                      }}
                                                      className="text-destructive hover:text-destructive"
                                                    >
                                                      <X className="h-4 w-4" />
                                                    </Button>
                                                  )}
                                                </div>
                                                <p className="text-[10px] font-mono text-muted-foreground">
                                                  Supports: .csv, .xlsx, .xls files
                                                </p>
                                              </div>

                                              {/* Paste Option */}
                                              <div className="space-y-2">
                                                <Label className="font-mono text-xs font-semibold">
                                                  Option 2: Paste Data
                                                </Label>
                                                <Textarea
                                                  value={excelImport}
                                                  onChange={(e) => setExcelImport(e.target.value)}
                                                  placeholder="Date,Type,Notes&#10;2026-01-15,holiday,Christmas&#10;2026-02-20,rest,Regular rest"
                                                  className="font-mono text-xs h-32 rounded-lg"
                                                />
                                              </div>

                                              <Button
                                                onClick={handleAvailabilityImport}
                                                className="w-full rounded-lg"
                                                disabled={!excelImport.trim()}
                                              >
                                                <Upload className="h-4 w-4 mr-2" />
                                                <span className="font-mono text-xs">
                                                  Import {excelImport.trim().split('\n').filter(l => l.trim()).length} Entries
                                                </span>
                                              </Button>
                                            </CardContent>
                                          </Card>
                                        </TabsContent>
                                      </Tabs>
                                    </ScrollArea>
                                  </SheetContent>
                                </Sheet>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteStaff(member.id)}
                                  className="text-destructive hover:text-destructive rounded-lg"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        )}
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Bulk Import</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Paste CSV-style data to import multiple staff members at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="font-mono text-xs text-blue-800">
                    Format: <span className="font-semibold">Name, Task1, Task2, ShiftTime (optional)</span>
                    <br />
                    Example: John Smith, Frozen, Milk, Inbound, 06:00
                    <br />
                    If no shift time is provided, defaults to 06:00
                    <br />
                    Valid shift times: 06:00, 08:30, 09:00, 09:30, 10:00, 11:00
                  </AlertDescription>
                </Alert>

                <Textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="John Smith, Frozen, Milk, 06:00&#10;Jane Doe, TWI, Outbound, Marshaling, 08:30&#10;Mike Brown, Frozen, Inbound"
                  className="font-mono text-xs h-48 rounded-lg"
                />

                <Button
                  onClick={handleBulkImport}
                  disabled={!bulkInput.trim()}
                  className="w-full rounded-lg shadow-sm hover:shadow-md transition-smooth"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">Import Staff</span>
                </Button>

                {bulkSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="font-mono text-xs text-green-800">
                      Staff members imported successfully!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}