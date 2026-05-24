import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { SEO } from "@/components/SEO";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StaffBulkOperations } from "@/components/staff/StaffBulkOperations";
import { StaffAvailabilityPanel } from "@/components/staff/StaffAvailabilityPanel";
import { useAudit } from "@/contexts/AuditContext";
import { useStaff, useAddStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, ShiftStart, DayShiftPattern } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, AlertCircle, Clock, Edit, X, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { staffService } from "@/services/staffService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const SHIFT_STARTS: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

const DAY_SHIFT_PATTERNS: DayShiftPattern[] = [
  "06:00-14:30",
  "06:00-14:00",
  "08:30-17:00",
  "09:00-17:00",
  "09:30-18:00",
  "10:00-14:00",
  "10:00-16:30",
  "11:00-17:30",
];

export default function StaffPage() {
  const [name, setName] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [shiftStart, setShiftStart] = useState<ShiftStart>("06:00");
  const [dayShiftPattern, setDayShiftPattern] = useState<DayShiftPattern>("06:00-14:30");
  const [shiftPattern, setShiftPattern] = useState<"Early" | "Late" | "All">("All");
  const [filterShift, setFilterShift] = useState<ShiftStart | "all">("all");
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 0 : 7 - day; // Days until next Saturday
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + diff);
    saturday.setHours(0, 0, 0, 0);
    return saturday;
  });
  
  const { addAuditEntry } = useAudit();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Edit staff state
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState<Task[]>([]);
  const [editShift, setEditShift] = useState<ShiftStart>("06:00");
  const [editDayShiftPattern, setEditDayShiftPattern] = useState<DayShiftPattern>("06:00-14:30");
  const [editShiftPattern, setEditShiftPattern] = useState<"Early" | "Late" | "All">("All");
  
  // Expanded staff IDs for collapsible sections
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<string>>(new Set());
  
  // Dropdown state for day selection
  const [openDayDropdown, setOpenDayDropdown] = useState<{ staffId: string; date: string } | null>(null);
  
  // Loading state for specific cell being updated
  const [loadingCell, setLoadingCell] = useState<{ staffId: string; date: string } | null>(null);
  
  // Force re-render key - increments after successful cache updates
  const [renderKey, setRenderKey] = useState(0);
  
  // Bulk operations - multi-select state
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  // Batch availability state
  const [batchDate, setBatchDate] = useState<string>("");
  const [batchAvailability, setBatchAvailability] = useState<AvailabilityType>("rest");

  // Bulk operations state
  const [bulkData, setBulkData] = useState<string>("");
  const [bulkAvailability, setBulkAvailability] = useState<AvailabilityType>("available");

  // React Query hooks
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const addStaffMutation = useAddStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

  // Derived selected staff
  const selectedStaff = staff.filter(s => selectedStaffIds.has(s.id));

  // Get week dates (Saturday to Sunday)
  const getWeekDates = (weekStart: Date): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates(currentWeekStart);

  const navigateWeek = (direction: "prev" | "next") => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(currentWeekStart.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newStart);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    const saturday = new Date(today);
    saturday.setDate(today.getDate() + diff);
    saturday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(saturday);
  };

  const handleAddStaff = async () => {
    if (!name.trim() || selectedTasks.length === 0) return;

    addStaffMutation.mutate(
      {
        name: name.trim(),
        trainedTasks: selectedTasks,
        shiftStart,
        dayShiftPattern,
        shiftPattern,
      } as any,
      {
        onSuccess: (newStaff) => {
          addAuditEntry({
            user: "System",
            action: "created",
            entity: "staff",
            entityId: newStaff.id,
            details: `Added staff member: ${newStaff.name}`,
          });
          setName("");
          setSelectedTasks([]);
          setDayShiftPattern("06:00-14:30");
          setShiftPattern("All");
          toast({
            title: "Staff added",
            description: `${newStaff.name} has been added successfully`,
          });
        },
      }
    );
  };

  const handleEditStaff = (member: StaffMember) => {
    setEditingStaffId(member.id);
    setEditName(member.name);
    setEditTasks([...member.trainedTasks]);
    setEditShift(member.shiftStart || "06:00");
    setEditDayShiftPattern((member as any).dayShiftPattern || "06:00-14:30");
    setEditShiftPattern((member as any).shiftPattern || "All");
  };

  const handleCancelEdit = () => {
    setEditingStaffId(null);
    setEditName("");
    setEditTasks([]);
    setEditShift("06:00");
    setEditDayShiftPattern("06:00-14:30");
    setEditShiftPattern("All");
  };

  const handleSaveEdit = async () => {
    if (!editingStaffId || !editName.trim() || editTasks.length === 0) return;

    updateStaffMutation.mutate(
      {
        id: editingStaffId,
        updates: {
          name: editName.trim(),
          trainedTasks: editTasks,
          shiftStart: editShift,
          dayShiftPattern: editDayShiftPattern,
          shiftPattern: editShiftPattern,
        } as any,
      },
      {
        onSuccess: () => {
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
        },
      }
    );
  };

  const handleDeleteStaff = async (id: string) => {
    const staffMember = staff.find(s => s.id === id);
    
    deleteStaffMutation.mutate(id, {
      onSuccess: () => {
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
      },
    });
  };

  const handleTaskToggle = (task: Task) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleEditTaskToggle = (task: Task) => {
    if (editTasks.includes(task)) {
      setEditTasks(editTasks.filter((t) => t !== task));
    } else {
      setEditTasks([...editTasks, task]);
    }
  };

  const toggleStaffExpanded = (staffId: string) => {
    setExpandedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
        // Close any open dropdowns for this staff when collapsing
        if (openDayDropdown?.staffId === staffId) {
          setOpenDayDropdown(null);
        }
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const clearAllAvailability = async (staffId: string, staffName: string) => {
    try {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember?.availability || staffMember.availability.length === 0) {
        toast({
          title: "No data to clear",
          description: `${staffName} has no availability data`,
        });
        return;
      }

      // Delete all availability entries
      for (const entry of staffMember.availability) {
        await staffService.deleteAvailability(staffId, entry.date);
      }

      // Refresh data
      await queryClient.refetchQueries({ queryKey: ["staff"] });
      
      // Force re-render
      setRenderKey(prev => prev + 1);
      
      toast({
        title: "✓ All Cleared",
        description: `Removed ${staffMember.availability.length} availability entries for ${staffName}`,
      });
      
    } catch (error) {
      console.error("Error clearing availability:", error);
      toast({
        title: "❌ Error",
        description: "Failed to clear availability data",
        variant: "destructive",
      });
    }
  };

  const setDayAvailability = async (staffId: string, dateStr: string, type: AvailabilityType | "clear") => {
    // Close dropdown and show loading
    setOpenDayDropdown(null);
    setLoadingCell({ staffId, date: dateStr });
    
    try {
      // Find staff name for better feedback
      const staffMember = staff.find(s => s.id === staffId);
      const staffName = staffMember?.name || "Staff";
      
      // Format date for display (e.g., "Sat 17 May")
      const dateObj = new Date(dateStr + "T12:00:00");
      const dateDisplay = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      
      if (type === "clear") {
        // Remove availability
        await staffService.deleteAvailability(staffId, dateStr);
      } else {
        // Add or update (UPSERT)
        await staffService.addAvailability(staffId, [{
          date: dateStr,
          type: type,
          notes: `Marked as ${type}`,
        }]);
      }
      
      // AGGRESSIVE CACHE REFRESH - invalidate, refetch, and wait
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.refetchQueries({ queryKey: ["staff"], type: "active" });
      
      // Wait 800ms for cache to fully settle and propagate to component
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Force component re-render to show updated data
      setRenderKey(prev => prev + 1);
      
      // Another small delay to ensure re-render completes before clearing loading
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Show success toast
      if (type === "clear") {
        toast({
          title: "✓ Cleared",
          description: `${staffName} - ${dateDisplay} marked as WORKING`,
        });
      } else {
        const typeLabel = type.toUpperCase();
        toast({
          title: `✓ Saved ${typeLabel}`,
          description: `${staffName} - ${dateDisplay} = ${typeLabel}`,
        });
      }
      
    } catch (error) {
      console.error("Error updating availability:", error);
      toast({
        title: "❌ Database Error",
        description: `Failed to save. Error: ${error instanceof Error ? error.message : "Unknown"}`,
        variant: "destructive",
      });
    } finally {
      // Clear loading state after everything completes
      setLoadingCell(null);
    }
  };

  const getAvailabilityForDate = (staffMember: StaffMember, date: Date): AvailabilityType | null => {
    const dateStr = date.toISOString().split("T")[0];
    const entry = staffMember.availability?.find(a => a.date === dateStr);
    return entry ? entry.type : null;
  };

  const getAvailabilityStats = (staffMember: StaffMember) => {
    const availability = staffMember.availability || [];
    return {
      rest: availability.filter((a) => a.type === "rest").length,
      holiday: availability.filter((a) => a.type === "holiday").length,
      sick: availability.filter((a) => a.type === "sick").length,
    };
  };

  const getDayColor = (type: AvailabilityType | null) => {
    if (!type) return "bg-background hover:bg-muted border-muted-foreground/20";
    switch (type) {
      case "rest": return "bg-blue-500 hover:bg-blue-600 border-blue-600 text-white";
      case "holiday": return "bg-purple-500 hover:bg-purple-600 border-purple-600 text-white";
      case "sick": return "bg-red-500 hover:bg-red-600 border-red-600 text-white";
      default: return "bg-green-500 hover:bg-green-600 border-green-600 text-white";
    }
  };

  const getDayLabel = (type: AvailabilityType | null) => {
    if (!type) return "—";
    switch (type) {
      case "rest": return "R";
      case "holiday": return "H";
      case "sick": return "S";
      default: return "A";
    }
  };

  // Bulk operations handlers
  const toggleStaffSelection = (staffId: string) => {
    setSelectedStaffIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(staffId)) {
        newSet.delete(staffId);
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const selectAllStaff = () => {
    setSelectedStaffIds(new Set(staff.map(s => s.id)));
  };

  const clearStaffSelection = () => {
    setSelectedStaffIds(new Set());
  };

  const handleBulkSetAvailability = async (staffIds: string[], dates: string[], type: AvailabilityType) => {
    try {
      for (const staffId of staffIds) {
        for (const dateStr of dates) {
          await staffService.addAvailability(staffId, [{
            date: dateStr,
            type: type,
            notes: `Bulk set as ${type}`,
          }]);
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.refetchQueries({ queryKey: ["staff"], type: "active" });
      await new Promise(resolve => setTimeout(resolve, 800));
      setRenderKey(prev => prev + 1);
      
      toast({
        title: "✓ Bulk Update Complete",
        description: `Applied ${type.toUpperCase()} to ${staffIds.length} staff`,
      });
    } catch (error) {
      console.error("Error in bulk availability update:", error);
      toast({
        title: "❌ Error",
        description: "Failed to apply bulk changes",
        variant: "destructive",
      });
    }
  };

  const handleBatchAvailability = () => {
    if (!batchDate) {
      toast({ title: "Please select a date", variant: "destructive" });
      return;
    }
    handleBulkSetAvailability(Array.from(selectedStaffIds), [batchDate], batchAvailability);
  };

  const handleBulkImport = () => {
    toast({ title: "Import functionality coming soon" });
  };

  const downloadTemplate = () => {
    toast({ title: "Template download coming soon" });
  };

  const handleCopyWeek = async (fromWeek: Date, toWeek: Date, staffIds: string[]) => {
    try {
      for (const staffId of staffIds) {
        const staffMember = staff.find(s => s.id === staffId);
        if (!staffMember?.availability) continue;
        
        // Get availability for source week
        const sourceWeekDates = getWeekDates(fromWeek);
        const targetWeekDates = getWeekDates(toWeek);
        
        for (let i = 0; i < 7; i++) {
          const sourceDateStr = sourceWeekDates[i].toISOString().split("T")[0];
          const targetDateStr = targetWeekDates[i].toISOString().split("T")[0];
          
          const sourceEntry = staffMember.availability.find(a => a.date === sourceDateStr);
          if (sourceEntry) {
            await staffService.addAvailability(staffId, [{
              date: targetDateStr,
              type: sourceEntry.type,
              notes: `Copied from ${sourceDateStr}`,
            }]);
          }
        }
      }
      
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.refetchQueries({ queryKey: ["staff"], type: "active" });
      await new Promise(resolve => setTimeout(resolve, 800));
      setRenderKey(prev => prev + 1);
      
      toast({
        title: "✓ Week Copied",
        description: `Copied availability for ${staffIds.length} staff`,
      });
    } catch (error) {
      console.error("Error copying week:", error);
      toast({
        title: "❌ Error",
        description: "Failed to copy week",
        variant: "destructive",
      });
    }
  };

  const toggleTaskTraining = async (staffId: string, task: Task) => {
    try {
      const staffMember = staff.find(s => s.id === staffId);
      if (!staffMember) return;

      const currentTasks = staffMember.trainedTasks || [];
      const newTasks = currentTasks.includes(task)
        ? currentTasks.filter(t => t !== task)
        : [...currentTasks, task];

      await staffService.updateStaff(staffId, { trainedTasks: newTasks });
      
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      await queryClient.refetchQueries({ queryKey: ["staff"], type: "active" });
      
      toast({
        title: currentTasks.includes(task) ? "✓ Training Removed" : "✓ Training Added",
        description: `${staffMember.name} ${currentTasks.includes(task) ? "removed from" : "trained for"} ${task}`,
      });
    } catch (error) {
      console.error("Error updating training:", error);
      toast({
        title: "❌ Error",
        description: "Failed to update training",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <SEO title="Staff Management - Warehouse Rota" description="Manage warehouse staff and their training certifications" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
              Staff Management
            </h1>
            <p className="text-sm font-sans text-muted-foreground">
              Configure team members and training assignments
            </p>
          </div>
          <Button
            onClick={handleAddStaff}
            className="font-sans font-medium"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Staff
          </Button>
        </div>

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

            <div className="space-y-2">
              <Label htmlFor="dayShiftPattern" className="font-mono text-xs flex items-center gap-2">
                <Clock className="h-3.5 w-3.5" />
                Full Shift Pattern (Start - End)
              </Label>
              <Select value={dayShiftPattern} onValueChange={(v) => setDayShiftPattern(v as DayShiftPattern)}>
                <SelectTrigger id="dayShiftPattern" className="rounded-lg font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAY_SHIFT_PATTERNS.map((pattern) => (
                    <SelectItem key={pattern} value={pattern} className="font-mono text-xs">
                      {pattern}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">
                Complete shift hours from the Lenziemill dayshift schedule
              </p>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-condensed font-semibold">
                Shift Pattern
              </label>
              <Select
                value={shiftPattern}
                onValueChange={(value) =>
                  setShiftPattern(value as any)
                }
              >
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Select shift pattern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Day (Full Shift)</SelectItem>
                  <SelectItem value="Early">Early Shift</SelectItem>
                  <SelectItem value="Late">Late Shift</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground font-mono">
                Staff work pattern - affects scheduling
              </p>
            </div>

            <Button onClick={handleAddStaff} className="rounded-lg shadow-sm hover:shadow-md transition-smooth" disabled={addStaffMutation.isPending || !name.trim() || selectedTasks.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="font-mono text-xs">{addStaffMutation.isPending ? "Adding..." : "Add Staff"}</span>
            </Button>
          </CardContent>
        </Card>

        {/* Batch Availability Setting */}
        {selectedStaff.length > 0 && (
          <StaffAvailabilityPanel
            selectedStaff={selectedStaff}
            selectedDate={batchDate}
            selectedAvailability={batchAvailability}
            onDateChange={setBatchDate}
            onAvailabilityChange={setBatchAvailability}
            onApply={handleBatchAvailability}
            onClearSelection={() => setSelectedStaffIds(new Set())}
          />
        )}

        {/* Staff List */}

        {/* Bulk Operations */}
        {selectedStaff.length > 0 && (
          <Card className="shadow-sm bg-primary/5 border-primary/20" data-tour="bulk-operations">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-condensed font-bold tracking-tight">
                Bulk Operations
              </CardTitle>
              <CardDescription className="text-sm font-sans">
                {selectedStaff.length} staff members selected
              </CardDescription>
            </CardHeader>
          </Card>
        )}

        {/* Quick Shift Filter */}
        <Card className="shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-4">
              <Label className="font-mono text-xs font-semibold whitespace-nowrap">
                Quick Filter:
              </Label>
              <Select value={filterShift} onValueChange={(v) => setFilterShift(v as ShiftStart | "all")}>
                <SelectTrigger className="w-[180px] rounded-lg font-mono text-xs">
                  <SelectValue placeholder="All Shifts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-mono text-xs">All Shifts</SelectItem>
                  {SHIFT_STARTS.map((shift) => (
                    <SelectItem key={shift} value={shift} className="font-mono text-xs">
                      {shift} Shift
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground font-mono">
                Showing {staff.filter((member) => filterShift === "all" || member.shiftStart === filterShift).length} of {staff.length} staff
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm" data-tour="staff-table">
          <CardHeader className="border-b border-border/50 bg-muted/30">
            <CardTitle className="text-xl font-condensed font-bold tracking-tight">
              Team Members
            </CardTitle>
            <CardDescription className="text-sm font-sans">
              {staff.length} staff • Configure training and availability
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {staffLoading && (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            )}
            
            {!staffLoading && staff.length === 0 && (
              <EmptyState
                icon={Users}
                title="No Staff Members Yet"
                description="Add your first team member to start scheduling warehouse rotas and managing availability."
                action={{
                  label: "Add First Staff Member",
                  onClick: () => {
                    // Scroll to top form
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
              />
            )}

            {!staffLoading && staff.length > 0 && (
              <div className="space-y-2">
                {staff
                  .filter((member) => filterShift === "all" || member.shiftStart === filterShift)
                  .map((member) => {
                    const stats = getAvailabilityStats(member);
                    const isEditing = editingStaffId === member.id;
                    const isExpanded = expandedStaffIds.has(member.id);
                    
                    return (
                      <Collapsible key={member.id} open={isExpanded} onOpenChange={() => toggleStaffExpanded(member.id)}>
                        <Card className="shadow-sm border-l-4 border-l-primary/20">
                          <CardHeader className="pb-4 px-6 pt-5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <Checkbox
                                  checked={selectedStaffIds.has(member.id)}
                                  onCheckedChange={() => toggleStaffSelection(member.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="shrink-0"
                                />
                                <CollapsibleTrigger asChild>
                                  <Button variant="ghost" className="flex-1 justify-start p-0 h-auto hover:bg-transparent">
                                    <div className="flex items-center gap-4 w-full">
                                      <ChevronDown className={cn("h-5 w-5 transition-transform", isExpanded && "rotate-180")} />
                                      <div className="flex-1 text-left">
                                        <div className="flex items-center gap-3 mb-2">
                                          <h3 className="font-condensed font-semibold text-lg">{member.name}</h3>
                                          {member.shiftStart && (
                                            <Badge variant="secondary" className="font-mono text-xs">
                                              <Clock className="h-3 w-3 mr-1" />
                                              {member.shiftStart}
                                            </Badge>
                                          )}
                                          {(member as any).dayShiftPattern && (
                                            <Badge variant="outline" className="font-mono text-xs bg-accent/10 text-accent-foreground border-accent/30">
                                              {(member as any).dayShiftPattern}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {member.trainedTasks.map((task) => (
                                            <Badge key={task} variant="outline" className="font-mono text-xs px-2.5 py-0.5">
                                              {task}
                                            </Badge>
                                          ))}
                                        </div>
                                        <div className="flex gap-4 mt-3 text-xs font-mono">
                                          <span className="text-blue-600">Rest: {stats.rest}</span>
                                          <span className="text-purple-600">Holiday: {stats.holiday}</span>
                                          <span className="text-red-600">Sick: {stats.sick}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </Button>
                                </CollapsibleTrigger>
                              </div>
                            </div>

                            <ConfirmDialog
                              open={deleteConfirmId === member.id}
                              onOpenChange={(open) => !open && setDeleteConfirmId(null)}
                              title={`Delete ${member.name}?`}
                              description="This action cannot be undone. This staff member will be permanently removed from the system. Any existing assignments in generated rotas will remain, but you won't be able to generate new rotas including this person."
                              confirmLabel="Delete Staff"
                              cancelLabel="Cancel"
                              variant="destructive"
                              onConfirm={() => handleDeleteStaff(member.id)}
                            />

                            {isEditing && (
                              <div className="mt-4 p-4 space-y-4 bg-muted/30 rounded-lg">
                                <div className="space-y-2">
                                  <Label className="font-mono text-xs">Name</Label>
                                  <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="rounded-lg" />
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-mono text-xs">Trained Tasks</Label>
                                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {TASKS.map((task) => (
                                      <div key={task} className="flex items-center space-x-2">
                                        <Checkbox
                                          checked={editTasks.includes(task)}
                                          onCheckedChange={() => handleEditTaskToggle(task)}
                                        />
                                        <Label className="font-mono text-xs cursor-pointer">{task}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-mono text-xs">Shift Start</Label>
                                  <Select value={editShift} onValueChange={(v) => setEditShift(v as ShiftStart)}>
                                    <SelectTrigger className="rounded-lg font-mono text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {SHIFT_STARTS.map((shift) => (
                                        <SelectItem key={shift} value={shift} className="font-mono text-xs">{shift}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label className="font-mono text-xs">Full Shift Pattern</Label>
                                  <Select value={editDayShiftPattern} onValueChange={(v) => setEditDayShiftPattern(v as DayShiftPattern)}>
                                    <SelectTrigger className="rounded-lg font-mono text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DAY_SHIFT_PATTERNS.map((pattern) => (
                                        <SelectItem key={pattern} value={pattern} className="font-mono text-xs">
                                          {pattern}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid gap-2">
                                  <label className="text-sm font-condensed font-semibold">
                                    Shift Pattern
                                  </label>
                                  <Select
                                    value={editShiftPattern}
                                    onValueChange={(value) =>
                                      setEditShiftPattern(value as any)
                                    }
                                  >
                                    <SelectTrigger className="rounded-lg">
                                      <SelectValue placeholder="Select shift pattern" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="All">All Day (Full Shift)</SelectItem>
                                      <SelectItem value="Early">Early Shift</SelectItem>
                                      <SelectItem value="Late">Late Shift</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <p className="text-xs text-muted-foreground font-mono">
                                    Staff work pattern - affects scheduling
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button onClick={handleSaveEdit} className="flex-1 rounded-lg">Save</Button>
                                  <Button variant="outline" onClick={handleCancelEdit} className="rounded-lg">Cancel</Button>
                                </div>
                              </div>
                            )}
                          </CardHeader>

                          <CollapsibleContent>
                            <CardContent className="pt-2 px-6 pb-6">
                              <div className="space-y-3">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="text-xs font-mono text-muted-foreground">
                                    Click any day to set availability
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => clearAllAvailability(member.id, member.name)}
                                    className="h-7 text-xs font-mono text-destructive hover:text-destructive hover:bg-destructive/10"
                                  >
                                    <X className="h-3 w-3 mr-1" />
                                    Clear All Availability
                                  </Button>
                                </div>

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-2" key={`${member.id}-${renderKey}`}>
                                  {weekDates.map((date, idx) => {
                                    const availType = getAvailabilityForDate(member, date);
                                    const dateStr = date.toISOString().split("T")[0];
                                    const isOpen = openDayDropdown?.staffId === member.id && openDayDropdown?.date === dateStr;
                                    const isLoading = loadingCell?.staffId === member.id && loadingCell?.date === dateStr;
                                    const dayLabel = DAYS[date.getDay()];
                                    
                                    return (
                                      <Popover key={`${idx}-${renderKey}`} open={isOpen} onOpenChange={(open) => {
                                        if (open) {
                                          setOpenDayDropdown({ staffId: member.id, date: dateStr });
                                        } else if (openDayDropdown?.staffId === member.id && openDayDropdown?.date === dateStr) {
                                          setOpenDayDropdown(null);
                                        }
                                      }}>
                                        <PopoverTrigger asChild>
                                          <button
                                            disabled={isLoading}
                                            className={cn(
                                              "aspect-square rounded-lg border-2 transition-all font-mono text-xs font-bold flex flex-col items-center justify-center min-h-[56px] hover:scale-105 gap-0.5",
                                              getDayColor(availType),
                                              isLoading && "opacity-50 cursor-wait animate-pulse"
                                            )}
                                          >
                                            <span className="text-[10px] opacity-80 font-semibold">
                                              {dayLabel}
                                            </span>
                                            <span className="text-lg leading-none">
                                              {isLoading ? "..." : getDayLabel(availType)}
                                            </span>
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent align="center" className="w-56 p-2">
                                          <div className="space-y-1">
                                            <button
                                              onClick={() => setDayAvailability(member.id, dateStr, "rest")}
                                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-blue-500/10 transition-colors font-mono text-sm"
                                            >
                                              <span className="w-8 h-8 rounded bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">R</span>
                                              <span className="font-semibold">Rest Day</span>
                                            </button>
                                            <button
                                              onClick={() => setDayAvailability(member.id, dateStr, "holiday")}
                                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-purple-500/10 transition-colors font-mono text-sm"
                                            >
                                              <span className="w-8 h-8 rounded bg-purple-500 text-white text-xs font-bold flex items-center justify-center shrink-0">H</span>
                                              <span className="font-semibold">Holiday</span>
                                            </button>
                                            <button
                                              onClick={() => setDayAvailability(member.id, dateStr, "sick")}
                                              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-red-500/10 transition-colors font-mono text-sm"
                                            >
                                              <span className="w-8 h-8 rounded bg-red-500 text-white text-xs font-bold flex items-center justify-center shrink-0">S</span>
                                              <span className="font-semibold">Sick Leave</span>
                                            </button>
                                            {availType !== null && (
                                              <>
                                                <div className="border-t my-2"></div>
                                                <button
                                                  onClick={() => setDayAvailability(member.id, dateStr, "clear")}
                                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted transition-colors font-mono text-sm text-muted-foreground"
                                                >
                                                  <X className="h-5 w-5 shrink-0" />
                                                  <span className="font-semibold">Clear (Working)</span>
                                                </button>
                                              </>
                                            )}
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                    );
                                  })}
                                </div>

                                {/* Training Assignment Section */}
                                <div className="border-t pt-4">
                                  <h4 className="font-condensed font-semibold text-sm mb-3 flex items-center gap-2">
                                    <Users className="h-4 w-4" />
                                    Trained Tasks
                                  </h4>
                                  <div className="flex flex-wrap gap-2">
                                    {TASKS.map(task => {
                                      const isTrained = member.trainedTasks?.includes(task);
                                      return (
                                        <Button
                                          key={task}
                                          variant={isTrained ? "default" : "outline"}
                                          size="sm"
                                          onClick={() => toggleTaskTraining(member.id, task)}
                                          className={cn(
                                            "font-mono text-xs transition-all",
                                            isTrained ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                          )}
                                        >
                                          {task}
                                        </Button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    );
                  })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}