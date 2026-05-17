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
import { SEO } from "@/components/SEO";
import { useAudit } from "@/contexts/AuditContext";
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, ShiftStart } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Users, Upload, Plus, Trash2, Calendar as Calendar2, FileSpreadsheet, AlertCircle, Repeat, Clock, Edit, X } from "lucide-react";
import * as XLSX from "xlsx";
import { staffService } from "@/services/staffService";
import { useToast } from "@/hooks/use-toast";

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
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("rest");
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [excelImport, setExcelImport] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Batch availability state
  const [batchMode, setBatchMode] = useState(false);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  
  const { addAuditEntry } = useAudit();
  const { toast } = useToast();
  
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

  // Load staff from Supabase on mount
  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const data = await staffService.getAllStaff();
      setStaff(data);
    } catch (error) {
      console.error("Error loading staff:", error);
      toast({
        title: "Error loading staff",
        description: "Failed to load staff from database",
        variant: "destructive",
      });
    }
  };

  const handleAddStaff = async () => {
    if (!name.trim() || selectedTasks.length === 0) return;

    setIsLoading(true);
    try {
      const newStaff = await staffService.addStaff({
        name: name.trim(),
        trainedTasks: selectedTasks,
        shiftStart,
      });

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
      toast({
        title: "Staff added",
        description: `${newStaff.name} has been added successfully`,
      });
    } catch (error) {
      console.error("Error adding staff:", error);
      toast({
        title: "Error",
        description: "Failed to add staff member",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
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

  const handleSaveEdit = async () => {
    if (!editingStaffId || !editName.trim() || editTasks.length === 0) return;

    try {
      await staffService.updateStaff(editingStaffId, {
        name: editName.trim(),
        trainedTasks: editTasks,
        shiftStart: editShift,
      });

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
      toast({
        title: "Staff updated",
        description: "Changes saved successfully",
      });
    } catch (error) {
      console.error("Error updating staff:", error);
      toast({
        title: "Error",
        description: "Failed to update staff member",
        variant: "destructive",
      });
    }
  };

  // Quick action handlers
  const handleQuickSickToday = async (staffId: string) => {
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    
    try {
      await staffService.addAvailability(staffId, [{
        date: dateStr,
        type: "sick",
        notes: "Marked sick",
      }]);

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
      toast({
        title: "Marked sick",
        description: "Staff member marked as sick for today",
      });
    } catch (error) {
      console.error("Error marking sick:", error);
      toast({
        title: "Error",
        description: "Failed to mark as sick",
        variant: "destructive",
      });
    }
  };

  const handleQuickRestTomorrow = async (staffId: string) => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split("T")[0];
    
    try {
      await staffService.addAvailability(staffId, [{
        date: dateStr,
        type: "rest",
        notes: "Quick rest day",
      }]);

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
      toast({
        title: "Rest day added",
        description: "Rest day added for tomorrow",
      });
    } catch (error) {
      console.error("Error adding rest day:", error);
      toast({
        title: "Error",
        description: "Failed to add rest day",
        variant: "destructive",
      });
    }
  };

  // Batch availability handler
  const handleBatchAvailability = async () => {
    if (!dateFrom || !dateTo || selectedStaffIds.length === 0) return;

    const dates: Date[] = [];
    const current = new Date(dateFrom);
    const end = new Date(dateTo);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    const newEntries: AvailabilityEntry[] = dates.map((date) => ({
      date: date.toISOString().split("T")[0],
      type: availabilityType,
      notes: availabilityNotes || "Batch entry",
    }));

    try {
      for (const staffId of selectedStaffIds) {
        await staffService.addAvailability(staffId, newEntries);
      }

      const updatedStaff = staff.map((s) => {
        if (selectedStaffIds.includes(s.id)) {
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
      toast({
        title: "Batch availability added",
        description: `Added ${dates.length} days for ${selectedStaffIds.length} staff members`,
      });
    } catch (error) {
      console.error("Error adding batch availability:", error);
      toast({
        title: "Error",
        description: "Failed to add batch availability",
        variant: "destructive",
      });
    }
  };

  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  };

  const handleEditTaskToggle = (task: Task) => {
    if (editTasks.includes(task)) {
      setEditTasks(editTasks.filter((t) => t !== task));
    } else {
      setEditTasks([...editTasks, task]);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    
    setIsLoading(true);
    try {
      await staffService.deleteStaff(id);
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
      toast({
        title: "Staff deleted",
        description: `${staffMember?.name} has been removed`,
      });
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Error deleting staff:", error);
      toast({
        title: "Error",
        description: "Failed to delete staff member",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskToggle = (task: Task) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleBulkImport = async () => {
    const lines = bulkInput.trim().split("\n");
    const staffData: Array<{
      name: string;
      trainedTasks: string[];
      shiftStart?: string;
    }> = [];

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
        staffData.push({
          name: staffName,
          trainedTasks: tasks,
          shiftStart: shift,
        });
      }
    });

    if (staffData.length > 0) {
      try {
        await staffService.bulkImportStaff(staffData);
        await loadStaff(); // Reload all staff from database
        setBulkInput("");
        setBulkSuccess(true);
        setTimeout(() => setBulkSuccess(false), 3000);
        toast({
          title: "Import successful",
          description: `Imported ${staffData.length} staff members`,
        });
      } catch (error) {
        console.error("Error bulk importing:", error);
        toast({
          title: "Error",
          description: "Failed to import staff",
          variant: "destructive",
        });
      }
    }
  };

  const handleCsvFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setCsvFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = e.target?.result;
      
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const csvText = XLSX.utils.sheet_to_csv(firstSheet);
        setExcelImport(csvText);
      } else {
        const text = data as string;
        setExcelImport(text);
      }
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsBinaryString(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleAvailabilityImport = async () => {
    if (!selectedStaff || !excelImport.trim()) return;

    const lines = excelImport.trim().split("\n");
    const newAvailability: AvailabilityEntry[] = [];

    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;

      const dateStr = parts[0];
      const type = parts[1].toLowerCase();
      const notes = parts[2] || "";

      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;

      if (!["rest", "holiday", "sick", "available"].includes(type)) return;

      newAvailability.push({
        date: date.toISOString().split("T")[0],
        type: type as AvailabilityType,
        notes,
      });
    });

    if (newAvailability.length > 0) {
      try {
        await staffService.addAvailability(selectedStaff.id, newAvailability);

        const updatedStaff = staff.map((s) => {
          if (s.id === selectedStaff.id) {
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
        setCsvFileName("");
        toast({
          title: "Import successful",
          description: `Imported ${newAvailability.length} availability entries`,
        });
      } catch (error) {
        console.error("Error importing availability:", error);
        toast({
          title: "Error",
          description: "Failed to import availability",
          variant: "destructive",
        });
      }
    }
  };

  const handleAddAvailability = async () => {
    if (!selectedStaff || selectedDates.length === 0) return;

    const newEntries: AvailabilityEntry[] = selectedDates.map((date) => ({
      date: date.toISOString().split("T")[0],
      type: availabilityType,
      notes: availabilityNotes,
    }));

    try {
      await staffService.addAvailability(selectedStaff.id, newEntries);

      const updatedStaff = staff.map((s) => {
        if (s.id === selectedStaff.id) {
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
      toast({
        title: "Availability added",
        description: `Added ${newEntries.length} availability entries`,
      });
    } catch (error) {
      console.error("Error adding availability:", error);
      toast({
        title: "Error",
        description: "Failed to add availability",
        variant: "destructive",
      });
    }
  };

  const handleDeleteAvailability = async (staffId: string, date: string) => {
    try {
      await staffService.deleteAvailability(staffId, date);

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
      toast({
        title: "Entry deleted",
        description: "Availability entry removed",
      });
    } catch (error) {
      console.error("Error deleting availability:", error);
      toast({
        title: "Error",
        description: "Failed to delete availability",
        variant: "destructive",
      });
    }
  };

  const handleApplyPattern = async () => {
    if (!selectedStaff) return;

    const entries: AvailabilityEntry[] = [];
    const current = new Date(patternStartDate);
    const end = new Date(patternEndDate);

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

    try {
      await staffService.addAvailability(selectedStaff.id, entries);

      const updatedStaff = staff.map((s) => {
        if (s.id === selectedStaff.id) {
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
      toast({
        title: "Pattern applied",
        description: `Added ${entries.length} recurring entries`,
      });
    } catch (error) {
      console.error("Error applying pattern:", error);
      toast({
        title: "Error",
        description: "Failed to apply pattern",
        variant: "destructive",
      });
    }
  };

  const getAvailabilityColor = (type: AvailabilityType) => {
    switch (type) {
      case "rest": return "bg-blue-100 text-blue-800 border-blue-300";
      case "holiday": return "bg-purple-100 text-purple-800 border-purple-300";
      case "sick": return "bg-red-100 text-red-800 border-red-300";
      default: return "bg-green-100 text-green-800 border-green-300";
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
                  <Label htmlFor="name" className="font-mono text-xs">Name</Label>
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
                        <Label htmlFor={task} className="font-mono text-xs cursor-pointer">{task}</Label>
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
                        <SelectItem key={shift} value={shift} className="font-mono text-xs">{shift}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={handleAddStaff} className="rounded-lg shadow-sm hover:shadow-md transition-smooth" disabled={isLoading || !name.trim() || selectedTasks.length === 0}>
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">{isLoading ? "Adding..." : "Add Staff"}</span>
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
                <div className="flex gap-2">
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
                    <span className="font-mono text-xs">Batch Dates</span>
                  </Button>
                </div>
              </CardHeader>

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
                          <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} className="rounded-lg border" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">To Date</Label>
                          <Calendar mode="single" selected={dateTo} onSelect={setDateTo} className="rounded-lg border" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-mono text-xs">Type</Label>
                          <Select value={availabilityType} onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}>
                            <SelectTrigger className="rounded-lg font-mono text-xs"><SelectValue /></SelectTrigger>
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
                          <Input value={availabilityNotes} onChange={(e) => setAvailabilityNotes(e.target.value)} className="rounded-lg font-mono text-xs" />
                        </div>
                      </div>

                      <Button onClick={handleBatchAvailability} disabled={!dateFrom || !dateTo || selectedStaffIds.length === 0} className="w-full rounded-lg">
                        <Plus className="h-4 w-4 mr-2" />
                        <span className="font-mono text-xs">Add to {selectedStaffIds.length} Staff</span>
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
                  <div className="space-y-3">
                    {staff
                      .filter((member) => filterShift === "all" || member.shiftStart === filterShift)
                      .map((member) => {
                      const stats = getAvailabilityStats(member);
                      const isEditing = editingStaffId === member.id;
                      
                      return (
                        <div
                          key={member.id}
                          className="border border-border rounded-lg hover:shadow-sm transition-smooth"
                        >
                          {isEditing ? (
                            // Inline Edit Mode
                            <div className="p-4 space-y-4 bg-muted/30">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-condensed font-semibold text-sm">Editing: {member.name}</h3>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={handleCancelEdit}
                                  className="text-muted-foreground"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`edit-name-${member.id}`} className="font-mono text-xs">
                                  Name
                                </Label>
                                <Input
                                  id={`edit-name-${member.id}`}
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  className="rounded-lg"
                                />
                              </div>

                              <div className="space-y-2">
                                <Label className="font-mono text-xs">Trained Tasks</Label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                  {TASKS.map((task) => (
                                    <div key={task} className="flex items-center space-x-2">
                                      <Checkbox
                                        id={`edit-${member.id}-${task}`}
                                        checked={editTasks.includes(task)}
                                        onCheckedChange={() => handleEditTaskToggle(task)}
                                      />
                                      <Label htmlFor={`edit-${member.id}-${task}`} className="font-mono text-xs cursor-pointer">
                                        {task}
                                      </Label>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor={`edit-shift-${member.id}`} className="font-mono text-xs flex items-center gap-2">
                                  <Clock className="h-3.5 w-3.5" />
                                  Shift Start Time
                                </Label>
                                <Select value={editShift} onValueChange={(v) => setEditShift(v as ShiftStart)}>
                                  <SelectTrigger id={`edit-shift-${member.id}`} className="rounded-lg font-mono text-xs">
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

                              <div className="flex gap-2 pt-2">
                                <Button
                                  onClick={handleSaveEdit}
                                  className="flex-1 rounded-lg"
                                  disabled={!editName.trim() || editTasks.length === 0}
                                >
                                  <span className="font-mono text-xs">Save Changes</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  onClick={handleCancelEdit}
                                  className="rounded-lg"
                                >
                                  <span className="font-mono text-xs">Cancel</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            // Display Mode - Single unified responsive layout
                            <div className="p-4">
                              <div className="flex items-start gap-3 mb-3">
                                {batchMode && (
                                  <Checkbox
                                    checked={selectedStaffIds.includes(member.id)}
                                    onCheckedChange={() => toggleStaffSelection(member.id)}
                                    className="mt-1"
                                  />
                                )}
                                
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-condensed font-semibold text-base">{member.name}</h3>
                                    {member.shiftStart && (
                                      <Badge variant="secondary" className="font-mono text-xs">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {member.shiftStart}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    {member.trainedTasks.map((task) => (
                                      <Badge key={task} variant="outline" className="font-mono text-xs">
                                        {task}
                                      </Badge>
                                    ))}
                                  </div>
                                  {(stats.rest > 0 || stats.holiday > 0 || stats.sick > 0) && (
                                    <div className="flex gap-3 mt-2 text-sm font-mono">
                                      {stats.rest > 0 && <span className="text-blue-600">Rest: {stats.rest}</span>}
                                      {stats.holiday > 0 && <span className="text-purple-600">Holiday: {stats.holiday}</span>}
                                      {stats.sick > 0 && <span className="text-red-600">Sick: {stats.sick}</span>}
                                    </div>
                                  )}
                                </div>
                                
                                {!batchMode && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setDeleteConfirmId(member.id)}
                                    className="text-destructive h-8 w-8 p-0"
                                    disabled={isLoading}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>

                              {/* Delete Confirmation Alert */}
                              {deleteConfirmId === member.id && (
                                <Alert className="mt-3 bg-destructive/10 border-destructive">
                                  <AlertCircle className="h-4 w-4 text-destructive" />
                                  <div className="flex-1">
                                    <p className="text-sm text-destructive mb-2">
                                      Delete {member.name}? This action cannot be undone.
                                    </p>
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteStaff(member.id)}
                                        disabled={isLoading}
                                        className="rounded-lg text-destructive hover:text-destructive"
                                      >
                                        {isLoading ? "Deleting..." : "Confirm Delete"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setDeleteConfirmId(null)}
                                        disabled={isLoading}
                                        className="rounded-lg"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </Alert>
                              )}

                              {!batchMode && (
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickSickToday(member.id)}
                                    className="rounded-lg"
                                  >
                                    <AlertCircle className="h-4 w-4 mr-2" />
                                    <span className="font-mono text-xs">Sick Today</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickRestTomorrow(member.id)}
                                    className="rounded-lg"
                                  >
                                    <Calendar2 className="h-4 w-4 mr-2" />
                                    <span className="font-mono text-xs">Rest Tomorrow</span>
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleEditStaff(member)}
                                    className="rounded-lg"
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    <span className="font-mono text-xs">Edit Skills</span>
                                  </Button>
                                  <Sheet>
                                    <SheetTrigger asChild>
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setSelectedStaff(member)}
                                        className="rounded-lg"
                                      >
                                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                                        <span className="font-mono text-xs">Import Rota</span>
                                      </Button>
                                    </SheetTrigger>
                                    <SheetContent className="w-full sm:max-w-lg">
                                      <SheetHeader>
                                        <SheetTitle className="font-condensed">
                                          {member.name} - Import Availability
                                        </SheetTitle>
                                        <SheetDescription className="font-mono text-xs">
                                          Quick import from Excel/CSV file
                                        </SheetDescription>
                                      </SheetHeader>

                                      <div className="mt-6 space-y-4">
                                        <Card className="shadow-sm">
                                          <CardHeader className="pb-3">
                                            <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                              <FileSpreadsheet className="h-4 w-4" />
                                              Excel/CSV Import
                                            </CardTitle>
                                          </CardHeader>
                                          <CardContent className="space-y-4">
                                            <div className="text-xs font-mono bg-muted p-3 rounded-lg space-y-1">
                                              <p className="font-semibold">Format:</p>
                                              <p className="text-muted-foreground">Date,Type,Notes</p>
                                              <p className="text-muted-foreground">2026-05-20,rest,Weekly rest</p>
                                              <p className="text-muted-foreground">2026-05-25,holiday,Bank holiday</p>
                                              <p className="mt-2 text-xs">Types: rest, holiday, sick</p>
                                            </div>

                                            <div className="space-y-2">
                                              <Label className="font-mono text-xs font-semibold">Upload File</Label>
                                              <div className="flex gap-2">
                                                <Button
                                                  variant="outline"
                                                  className="w-full rounded-lg"
                                                  onClick={() => document.getElementById(`csv-upload-${member.id}`)?.click()}
                                                >
                                                  <Upload className="h-4 w-4 mr-2" />
                                                  <span className="font-mono text-xs">
                                                    {csvFileName || "Choose File (.csv, .xlsx)"}
                                                  </span>
                                                </Button>
                                                <input
                                                  id={`csv-upload-${member.id}`}
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
                                                      const input = document.getElementById(`csv-upload-${member.id}`) as HTMLInputElement;
                                                      if (input) input.value = "";
                                                    }}
                                                    className="text-destructive"
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                )}
                                              </div>
                                            </div>

                                            <div className="space-y-2">
                                              <Label className="font-mono text-xs font-semibold">Or Paste Data</Label>
                                              <Textarea
                                                value={excelImport}
                                                onChange={(e) => setExcelImport(e.target.value)}
                                                placeholder="Date,Type,Notes&#10;2026-05-20,rest,Weekly rest"
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
                                                Import {excelImport.trim() ? excelImport.trim().split('\n').filter(l => l.trim() && !l.startsWith('Date')).length : 0} Dates
                                              </span>
                                            </Button>
                                          </CardContent>
                                        </Card>

                                        {selectedStaff && selectedStaff.availability && selectedStaff.availability.length > 0 && (
                                          <Card className="shadow-sm">
                                            <CardHeader className="pb-3">
                                              <CardTitle className="font-condensed text-sm">Current Entries ({selectedStaff.availability.length})</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                              <ScrollArea className="h-48">
                                                <div className="space-y-2">
                                                  {selectedStaff.availability
                                                    .sort((a, b) => a.date.localeCompare(b.date))
                                                    .map((entry, idx) => (
                                                      <div
                                                        key={idx}
                                                        className="flex items-center justify-between p-2 rounded-lg border text-xs"
                                                      >
                                                        <div className="flex-1">
                                                          <div className="flex items-center gap-2">
                                                            <span className="font-mono font-semibold">
                                                              {new Date(entry.date + "T00:00:00").toLocaleDateString("en-GB")}
                                                            </span>
                                                            <Badge variant="secondary" className="font-mono text-[10px]">
                                                              {entry.type}
                                                            </Badge>
                                                          </div>
                                                          {entry.notes && (
                                                            <p className="text-[10px] font-mono mt-1 text-muted-foreground">
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
                                              </ScrollArea>
                                            </CardContent>
                                          </Card>
                                        )}
                                      </div>
                                    </SheetContent>
                                  </Sheet>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-4">
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Bulk Import Staff</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Paste a CSV list of staff and their tasks
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-xs font-mono text-muted-foreground bg-muted/50 p-4 rounded-lg">
                  <p className="font-semibold mb-2">Required Format:</p>
                  <p>Name, Task1, Task2, ..., ShiftTime</p>
                  <p className="mt-2 text-muted-foreground/70">Examples:</p>
                  <p>John Smith, Frozen, Milk, 06:00</p>
                  <p>Jane Doe, TWI, Inbound, Outbound, 08:30</p>
                  <p>Bob Wilson, Marshaling, 06:00</p>
                </div>

                <Textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="Paste CSV data here..."
                  className="font-mono text-xs h-64 rounded-lg"
                />

                {bulkSuccess && (
                  <Alert className="bg-green-50 text-green-900 border-green-200">
                    <AlertDescription className="font-mono text-xs font-semibold">
                      Successfully imported staff members!
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  onClick={handleBulkImport}
                  className="w-full rounded-lg"
                  disabled={!bulkInput.trim()}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">Import Data</span>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}