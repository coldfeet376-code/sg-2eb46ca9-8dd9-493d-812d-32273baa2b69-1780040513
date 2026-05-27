import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SEO } from "@/components/SEO";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { StaffBulkOperations } from "@/components/staff/StaffBulkOperations";
import { StaffAvailabilityPanel } from "@/components/staff/StaffAvailabilityPanel";
import { RotaWeekNavigator } from "@/components/rota/RotaWeekNavigator";
import { useAudit } from "@/contexts/AuditContext";
import { useStaff, useAddStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, ShiftStart, DayShiftPattern } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, AlertCircle, Clock, Edit, X, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { staffService } from "@/services/staffService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Inbound Late", "Outbound", "Marshaling", "Housekeeping"];
const SHIFT_STARTS: ShiftStart[] = ["06:00", "07:00", "08:00", "09:00", "10:00"];
const SHIFT_PATTERNS = ["4on4off", "5on3off"];

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

  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [batchDate, setBatchDate] = useState<string>("");
  const [batchAvailability, setBatchAvailability] = useState<AvailabilityType>("rest");
  
  const [editAvailabilityStaff, setEditAvailabilityStaff] = useState<{ id: string; name: string } | null>(null);
  const [editAvailabilityDate, setEditAvailabilityDate] = useState<string>("");
  const [editAvailabilityType, setEditAvailabilityType] = useState<AvailabilityType | "clear">("rest");
  
  // Week navigation - Start on SUNDAY of the current week
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay(); // 0 = Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day); // Go back to Sunday of current week
    sunday.setHours(0, 0, 0, 0);
    return sunday;
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

  // Consistent date string formatting
  const getLocalDateString = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // React Query hooks
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const addStaffMutation = useAddStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

  // DEBUG: Log staff data when it changes
  useEffect(() => {
    console.log('🚨 STAFF DATA UPDATED in component');
    console.log(`   Total staff: ${staff.length}`);
    if (staff.length > 0) {
      console.log(`   First staff member:`, staff[0]);
      console.log(`   First staff availability:`, staff[0].availability);
      console.log(`   Is availability an array?`, Array.isArray(staff[0].availability));
      
      // Check a few specific people
      const brian = staff.find(s => s.name.includes('BRIAN'));
      const abbo = staff.find(s => s.name.includes('ABBO'));
      
      if (brian) {
        console.log(`   BRIAN MURRAY availability:`, brian.availability?.length || 0, 'entries');
        if (brian.availability && brian.availability.length > 0) {
          console.log(`   Sample:`, brian.availability.slice(0, 3));
        }
      }
      
      if (abbo) {
        console.log(`   ABBO availability:`, abbo.availability?.length || 0, 'entries');
        if (abbo.availability && abbo.availability.length > 0) {
          console.log(`   Sample:`, abbo.availability.slice(0, 3));
        }
      }
    }
  }, [staff]);

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
    const day = today.getDay(); // 0 = Sunday
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day); // Go back to Sunday of current week
    sunday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(sunday);
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
      await queryClient.refetchQueries({ queryKey: ["staff", "full"] });
      
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
    setOpenDayDropdown(null);
    setLoadingCell({ staffId, date: dateStr });
    
    try {
      const staffMember = staff.find(s => s.id === staffId);
      const staffName = staffMember?.name || "Staff";
      
      // Parse date for display
      const [year, month, day] = dateStr.split('-').map(Number);
      const dateObj = new Date(year, month - 1, day);
      const dateDisplay = dateObj.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
      
      if (type === "clear") {
        await staffService.deleteAvailability(staffId, dateStr);
      } else {
        await staffService.addAvailability(staffId, [{
          date: dateStr,
          type: type,
          notes: `Set as ${type}`,
        }]);
      }
      
      // Immediate refresh
      await queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
      await queryClient.refetchQueries({ queryKey: ["staff", "full"] });
      setRenderKey(prev => prev + 1);
      
      // Success feedback
      if (type === "clear") {
        toast({
          title: "✓ Cleared",
          description: `${staffName} - ${dateDisplay} marked as WORKING`,
        });
      } else {
        toast({
          title: `✓ ${type.toUpperCase()}`,
          description: `${staffName} - ${dateDisplay}`,
        });
      }
      
    } catch (error) {
      console.error("Error updating availability:", error);
      toast({
        title: "❌ Error",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setLoadingCell(null);
    }
  };

  const getAvailabilityForDate = (staffMember: StaffMember, date: Date): AvailabilityType | null => {
    // Format date as YYYY-MM-DD
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    // DEBUG: Log for first staff member only to avoid spam
    if (staffMember.name.includes('ABBO') || staffMember.name.includes('BRIAN')) {
      console.log(`🔍 getAvailabilityForDate: ${staffMember.name} on ${dateStr}`);
      console.log(`   Total availability entries: ${staffMember.availability?.length || 0}`);
      if (staffMember.availability && staffMember.availability.length > 0) {
        console.log(`   First 3 entries:`, staffMember.availability.slice(0, 3));
        console.log(`   Looking for exact match: ${dateStr}`);
      }
    }
    
    const entry = staffMember.availability?.find(a => a.date === dateStr);
    
    if (staffMember.name.includes('ABBO') || staffMember.name.includes('BRIAN')) {
      console.log(`   Match found:`, entry || 'NONE');
    }
    
    if (!entry) return null;
    
    // Normalize type
    const type = entry.type.toString().toLowerCase().trim();
    if (type.includes('rest')) return 'rest';
    if (type.includes('holiday')) return 'holiday';
    if (type.includes('sick')) return 'sick';
    if (type.includes('available')) return 'available';
    
    return entry.type;
  };

  const getAvailabilityStats = (staffMember: StaffMember) => {
    const availability = staffMember.availability || [];
    
    // DEBUG: Log for first few staff
    if (staffMember.name.includes('ABBO') || staffMember.name.includes('BRIAN')) {
      console.log(`📊 getAvailabilityStats: ${staffMember.name}`);
      console.log(`   Raw availability array:`, availability);
      console.log(`   Array length: ${availability.length}`);
      console.log(`   Array is array? ${Array.isArray(availability)}`);
    }
    
    const stats = {
      rest: availability.filter((a) => a.type === "rest").length,
      holiday: availability.filter((a) => a.type === "holiday").length,
      sick: availability.filter((a) => a.type === "sick").length,
    };
    
    if (staffMember.name.includes('ABBO') || staffMember.name.includes('BRIAN')) {
      console.log(`   Calculated stats:`, stats);
    }
    
    return stats;
  };

  const getDayColor = (type: AvailabilityType | null) => {
    if (!type) return "bg-muted/40 hover:bg-muted/60 border-border text-muted-foreground";
    switch (type) {
      case "rest": return "bg-blue-500 hover:bg-blue-600 border-blue-600 text-white";
      case "holiday": return "bg-purple-500 hover:bg-purple-600 border-purple-600 text-white";
      case "sick": return "bg-red-500 hover:bg-red-600 border-red-600 text-white";
      case "available": return "bg-green-500 hover:bg-green-600 border-green-600 text-white";
      default: return "bg-muted/40 hover:bg-muted/60 border-border text-muted-foreground";
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
      
      await queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
      await queryClient.refetchQueries({ queryKey: ["staff", "full"], type: "active" });
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
      
      await queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
      await queryClient.refetchQueries({ queryKey: ["staff", "full"], type: "active" });
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
      
      await queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
      await queryClient.refetchQueries({ queryKey: ["staff", "full"], type: "active" });
      
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

  const openEditAvailabilityDialog = (staffId: string, staffName: string) => {
    setEditAvailabilityStaff({ id: staffId, name: staffName });
    // Set default date to today
    const today = new Date().toISOString().split("T")[0];
    setEditAvailabilityDate(today);
    setEditAvailabilityType("rest");
  };

  const closeEditAvailabilityDialog = () => {
    setEditAvailabilityStaff(null);
    setEditAvailabilityDate("");
    setEditAvailabilityType("rest");
  };

  const handleSaveEditAvailability = async () => {
    if (!editAvailabilityStaff || !editAvailabilityDate) {
      toast({
        title: "Missing information",
        description: "Please select a date",
        variant: "destructive",
      });
      return;
    }

    await setDayAvailability(editAvailabilityStaff.id, editAvailabilityDate, editAvailabilityType);
    closeEditAvailabilityDialog();
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
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                toast({ title: "🔄 Refreshing data...", description: "Loading latest from database" });
                await queryClient.invalidateQueries({ queryKey: ["staff", "full"] });
                await queryClient.refetchQueries({ queryKey: ["staff", "full"], type: "active" });
                await new Promise(resolve => setTimeout(resolve, 1000));
                setRenderKey(prev => prev + 1);
                toast({ title: "✅ Data Refreshed", description: "Loaded latest availability data" });
              }}
              className="font-sans font-medium"
            >
              🔄 Refresh Data
            </Button>
            <Button
              onClick={handleAddStaff}
              className="font-sans font-medium"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </div>
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

        {/* Week Navigation */}
        <Card className="shadow-sm bg-accent/5 border-accent/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-accent" />
                <span className="font-condensed font-semibold text-sm">Availability Calendar</span>
              </div>
              <RotaWeekNavigator
                weekStart={currentWeekStart}
                onPreviousWeek={() => navigateWeek("prev")}
                onNextWeek={() => navigateWeek("next")}
                onTodayClick={goToToday}
              />
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
                              <div className="flex gap-2 shrink-0">
                                {!isEditing && (
                                  <>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditStaff(member);
                                      }}
                                      className="h-8 px-3 font-mono text-xs"
                                    >
                                      <Edit className="h-3.5 w-3.5 mr-1" />
                                      Edit
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeleteConfirmId(member.id);
                                      }}
                                      className="h-8 px-3 font-mono text-xs"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                                      Delete
                                    </Button>
                                  </>
                                )}
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
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openEditAvailabilityDialog(member.id, member.name)}
                                      className="h-7 text-xs font-mono"
                                    >
                                      <Edit className="h-3 w-3 mr-1" />
                                      Edit Availability
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => clearAllAvailability(member.id, member.name)}
                                      className="h-7 text-xs font-mono text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                      <X className="h-3 w-3 mr-1" />
                                      Clear All
                                    </Button>
                                  </div>
                                </div>

                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-2" key={`${member.id}-${renderKey}`}>
                                  {weekDates.map((date, dayIndex) => {
                                    const availability = getAvailabilityForDate(member, date);
                                    const isLoadingThisCell = loadingCell?.staffId === member.id && loadingCell?.date === getLocalDateString(date);
                                    
                                    // Get visual badge based on availability type
                                    const getBadge = () => {
                                      if (isLoadingThisCell) {
                                        return <span className="text-xs">⏳</span>;
                                      }
                                  
                                      if (!availability) {
                                        return <span className="text-xs text-muted-foreground">-</span>;
                                      }
                                  
                                      switch (availability) {
                                        case 'rest':
                                          return <Badge variant="outline" className="px-1.5 py-0 h-5 text-xs font-mono font-bold bg-blue-500/20 text-blue-700 border-blue-500">R</Badge>;
                                        case 'holiday':
                                          return <Badge variant="outline" className="px-1.5 py-0 h-5 text-xs font-mono font-bold bg-purple-500/20 text-purple-700 border-purple-500">H</Badge>;
                                        case 'sick':
                                          return <Badge variant="outline" className="px-1.5 py-0 h-5 text-xs font-mono font-bold bg-red-500/20 text-red-700 border-red-500">S</Badge>;
                                        case 'available':
                                          return <Badge variant="outline" className="px-1.5 py-0 h-5 text-xs font-mono font-bold bg-green-500/20 text-green-700 border-green-500">A</Badge>;
                                        default:
                                          return <span className="text-xs text-muted-foreground">-</span>;
                                      }
                                    };

                                    return (
                                      <div key={dayIndex} className="p-1 text-center relative border border-border/50 rounded flex flex-col justify-between min-h-[4rem]">
                                        <div className="text-[10px] font-mono mb-1 text-muted-foreground">
                                          {date.toLocaleDateString("en-GB", { weekday: "short" })}
                                        </div>
                                        <DropdownMenu 
                                          open={openDayDropdown?.staffId === member.id && openDayDropdown?.date === getLocalDateString(date)}
                                          onOpenChange={(open) => {
                                            if (open) {
                                              setOpenDayDropdown({ staffId: member.id, date: getLocalDateString(date) });
                                            } else {
                                              setOpenDayDropdown(null);
                                            }
                                          }}
                                        >
                                          <DropdownMenuTrigger asChild>
                                            <button 
                                              className="w-full h-8 flex items-center justify-center hover:bg-accent/50 rounded transition-colors"
                                              disabled={isLoadingThisCell}
                                            >
                                              {getBadge()}
                                            </button>
                                          </DropdownMenuTrigger>
                                          <DropdownMenuContent align="center" className="w-36">
                                            <DropdownMenuLabel className="font-mono text-xs">
                                              {date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                                            </DropdownMenuLabel>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                              onClick={() => setDayAvailability(member.id, getLocalDateString(date), "rest")}
                                              className="font-mono text-xs gap-2 cursor-pointer"
                                            >
                                              <span className="w-4 h-4 rounded bg-blue-500 text-white text-xs font-bold flex items-center justify-center">R</span>
                                              Rest Day
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              onClick={() => setDayAvailability(member.id, getLocalDateString(date), "holiday")}
                                              className="font-mono text-xs gap-2 cursor-pointer"
                                            >
                                              <span className="w-4 h-4 rounded bg-purple-500 text-white text-xs font-bold flex items-center justify-center">H</span>
                                              Holiday
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              onClick={() => setDayAvailability(member.id, getLocalDateString(date), "sick")}
                                              className="font-mono text-xs gap-2 cursor-pointer"
                                            >
                                              <span className="w-4 h-4 rounded bg-red-500 text-white text-xs font-bold flex items-center justify-center">S</span>
                                              Sick Leave
                                            </DropdownMenuItem>
                                            <DropdownMenuItem 
                                              onClick={() => setDayAvailability(member.id, getLocalDateString(date), "available")}
                                              className="font-mono text-xs gap-2 cursor-pointer"
                                            >
                                              <span className="w-4 h-4 rounded bg-green-500 text-white text-xs font-bold flex items-center justify-center">A</span>
                                              Available
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem 
                                              onClick={() => setDayAvailability(member.id, getLocalDateString(date), "clear")}
                                              className="font-mono text-xs text-muted-foreground cursor-pointer"
                                            >
                                              Clear (Working)
                                            </DropdownMenuItem>
                                          </DropdownMenuContent>
                                        </DropdownMenu>
                                      </div>
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

      {/* Edit Availability Dialog */}
      <Dialog open={editAvailabilityStaff !== null} onOpenChange={(open) => !open && closeEditAvailabilityDialog()}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="font-condensed text-xl">
              Set Availability - {editAvailabilityStaff?.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs">
              Choose a specific date and set availability status
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label htmlFor="edit-date" className="font-mono text-sm font-semibold flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Select Date
              </Label>
              <Input
                id="edit-date"
                type="date"
                value={editAvailabilityDate}
                onChange={(e) => setEditAvailabilityDate(e.target.value)}
                className="rounded-lg font-mono text-base h-11"
              />
              {editAvailabilityDate && (
                <div className="text-xs text-muted-foreground font-mono bg-muted/50 p-2 rounded">
                  Setting availability for:{" "}
                  <span className="font-semibold text-foreground">
                    {new Date(editAvailabilityDate + 'T00:00:00').toLocaleDateString("en-GB", { 
                      weekday: "long", 
                      day: "numeric", 
                      month: "long",
                      year: "numeric"
                    })}
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label className="font-mono text-sm font-semibold">Status</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setEditAvailabilityType("rest")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105",
                    editAvailabilityType === "rest"
                      ? "border-blue-500 bg-blue-500/20 shadow-md"
                      : "border-border hover:border-blue-500/50 hover:bg-blue-500/5"
                  )}
                >
                  <span className="w-12 h-12 rounded-lg bg-blue-500 text-white text-lg font-bold flex items-center justify-center">
                    R
                  </span>
                  <span className="font-mono font-semibold text-sm">Rest Day</span>
                </button>

                <button
                  onClick={() => setEditAvailabilityType("holiday")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105",
                    editAvailabilityType === "holiday"
                      ? "border-purple-500 bg-purple-500/20 shadow-md"
                      : "border-border hover:border-purple-500/50 hover:bg-purple-500/5"
                  )}
                >
                  <span className="w-12 h-12 rounded-lg bg-purple-500 text-white text-lg font-bold flex items-center justify-center">
                    H
                  </span>
                  <span className="font-mono font-semibold text-sm">Holiday</span>
                </button>

                <button
                  onClick={() => setEditAvailabilityType("sick")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105",
                    editAvailabilityType === "sick"
                      ? "border-red-500 bg-red-500/20 shadow-md"
                      : "border-border hover:border-red-500/50 hover:bg-red-500/5"
                  )}
                >
                  <span className="w-12 h-12 rounded-lg bg-red-500 text-white text-lg font-bold flex items-center justify-center">
                    S
                  </span>
                  <span className="font-mono font-semibold text-sm">Sick Leave</span>
                </button>

                <button
                  onClick={() => setEditAvailabilityType("available")}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all hover:scale-105",
                    editAvailabilityType === "available"
                      ? "border-green-500 bg-green-500/20 shadow-md"
                      : "border-border hover:border-green-500/50 hover:bg-green-500/5"
                  )}
                >
                  <span className="w-12 h-12 rounded-lg bg-green-500 text-white text-lg font-bold flex items-center justify-center">
                    A
                  </span>
                  <span className="font-mono font-semibold text-sm">Available</span>
                </button>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeEditAvailabilityDialog} className="font-mono">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEditAvailability} 
              disabled={!editAvailabilityDate}
              className="font-mono"
            >
              {!editAvailabilityDate ? "Select a date" : "Save Availability"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}