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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SEO } from "@/components/SEO";
import { useAudit } from "@/contexts/AuditContext";
import { useStaff, useAddStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useSupabaseQueries";
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, ShiftStart } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2, AlertCircle, Clock, Edit, X, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { staffService } from "@/services/staffService";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const SHIFT_STARTS: ShiftStart[] = ["06:00", "08:30", "09:00", "09:30", "10:00", "11:00"];

export default function StaffPage() {
  const [name, setName] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [shiftStart, setShiftStart] = useState<ShiftStart>("06:00");
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
  
  // Expanded staff IDs for collapsible sections
  const [expandedStaffIds, setExpandedStaffIds] = useState<Set<string>>(new Set());
  
  // Dropdown state for day selection
  const [openDayDropdown, setOpenDayDropdown] = useState<{ staffId: string; date: string } | null>(null);

  // React Query hooks
  const { data: staff = [], isLoading: staffLoading } = useStaff();
  const addStaffMutation = useAddStaff();
  const updateStaffMutation = useUpdateStaff();
  const deleteStaffMutation = useDeleteStaff();

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
      },
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
  };

  const handleCancelEdit = () => {
    setEditingStaffId(null);
    setEditName("");
    setEditTasks([]);
    setEditShift("06:00");
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
        },
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
      } else {
        newSet.add(staffId);
      }
      return newSet;
    });
  };

  const setDayAvailability = async (staffId: string, dateStr: string, type: AvailabilityType | "clear") => {
    try {
      if (type === "clear") {
        // Remove availability
        await staffService.deleteAvailability(staffId, dateStr);
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
        toast({
          title: "Cleared",
          description: "Day marked as working",
        });
      } else {
        // Add or update
        await staffService.addAvailability(staffId, [{
          date: dateStr,
          type: type,
          notes: `Marked as ${type}`,
        }]);
        await queryClient.invalidateQueries({ queryKey: ["staff"] });
        toast({
          title: "Updated",
          description: `Day marked as ${type}`,
        });
      }
      setOpenDayDropdown(null);
    } catch (error) {
      console.error("Error updating availability:", error);
      toast({
        title: "Error",
        description: "Failed to update availability",
        variant: "destructive",
      });
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

  return (
    <Layout>
      <SEO title="Staff Management - Warehouse Rota" description="Manage warehouse staff and their training certifications" />

      <div className="space-y-6">
        <div>
          <h1 className="font-condensed text-3xl font-bold tracking-tight">Staff Management</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Manage employees, training, and weekly availability
          </p>
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

            <Button onClick={handleAddStaff} className="rounded-lg shadow-sm hover:shadow-md transition-smooth" disabled={addStaffMutation.isPending || !name.trim() || selectedTasks.length === 0}>
              <Plus className="h-4 w-4 mr-2" />
              <span className="font-mono text-xs">{addStaffMutation.isPending ? "Adding..." : "Add Staff"}</span>
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
            <Select value={filterShift} onValueChange={(v) => setFilterShift(v as ShiftStart | "all")}>
              <SelectTrigger className="w-32 rounded-lg font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-mono text-xs">All Shifts</SelectItem>
                {SHIFT_STARTS.map((shift) => (
                  <SelectItem key={shift} value={shift} className="font-mono text-xs">{shift}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>

          <CardContent>
            {/* Week Navigation */}
            <div className="mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")} className="rounded-lg">
                  <ChevronDown className="h-4 w-4 rotate-90" />
                </Button>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-condensed font-semibold">
                    {weekDates[0].toLocaleDateString("en-GB", { day: "numeric", month: "short" })} - {weekDates[6].toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </div>
                <Button variant="outline" size="sm" onClick={() => navigateWeek("next")} className="rounded-lg">
                  <ChevronDown className="h-4 w-4 -rotate-90" />
                </Button>
              </div>
              
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map((date, idx) => (
                  <div key={idx} className="text-center">
                    <div className="font-mono text-[10px] text-muted-foreground mb-1">
                      {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"][idx]}
                    </div>
                    <div className="font-mono text-sm font-semibold">
                      {date.getDate()}
                    </div>
                  </div>
                ))}
              </div>
              
              <Button variant="ghost" size="sm" onClick={goToToday} className="w-full mt-3 rounded-lg font-mono text-xs">
                Today
              </Button>
            </div>

            {staff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-mono">No staff members yet</p>
                <p className="text-xs font-mono mt-1">Add staff above to get started</p>
              </div>
            ) : (
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
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" className="flex-1 justify-start p-0 h-auto hover:bg-transparent">
                                  <div className="flex items-center gap-3 w-full">
                                    <ChevronDown className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-180")} />
                                    <div className="flex-1 text-left">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-condensed font-semibold text-base">{member.name}</h3>
                                        {member.shiftStart && (
                                          <Badge variant="secondary" className="font-mono text-xs">
                                            <Clock className="h-3 w-3 mr-1" />
                                            {member.shiftStart}
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {member.trainedTasks.map((task) => (
                                          <Badge key={task} variant="outline" className="font-mono text-[10px]">
                                            {task}
                                          </Badge>
                                        ))}
                                      </div>
                                      <div className="flex gap-3 mt-2 text-xs font-mono">
                                        <span className="text-blue-600">Rest: {stats.rest}</span>
                                        <span className="text-purple-600">Holiday: {stats.holiday}</span>
                                        <span className="text-red-600">Sick: {stats.sick}</span>
                                      </div>
                                    </div>
                                  </div>
                                </Button>
                              </CollapsibleTrigger>
                              
                              <div className="flex gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEditStaff(member)}
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmId(member.id)}
                                  className="text-destructive h-8 w-8 p-0"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>

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
                                      className="rounded-lg text-destructive"
                                    >
                                      Confirm Delete
                                    </Button>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => setDeleteConfirmId(null)}
                                      className="rounded-lg"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                </div>
                              </Alert>
                            )}

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
                                <div className="flex gap-2">
                                  <Button onClick={handleSaveEdit} className="flex-1 rounded-lg">Save</Button>
                                  <Button variant="outline" onClick={handleCancelEdit} className="rounded-lg">Cancel</Button>
                                </div>
                              </div>
                            )}
                          </CardHeader>

                          <CollapsibleContent>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <div className="text-xs font-mono text-muted-foreground mb-2">
                                  Click any day to set availability
                                </div>
                                {/* Day of week labels */}
                                <div className="grid grid-cols-7 gap-1 mb-1">
                                  {["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"].map((day, idx) => (
                                    <div key={idx} className="text-center font-mono text-[10px] text-muted-foreground font-semibold">
                                      {day}
                                    </div>
                                  ))}
                                </div>
                                {/* Calendar grid */}
                                <div className="grid grid-cols-7 gap-1">
                                  {weekDates.map((date, idx) => {
                                    const availType = getAvailabilityForDate(member, date);
                                    const dateStr = date.toISOString().split("T")[0];
                                    const isOpen = openDayDropdown?.staffId === member.id && openDayDropdown?.date === dateStr;
                                    
                                    return (
                                      <DropdownMenu key={idx} open={isOpen} onOpenChange={(open) => {
                                        if (open) {
                                          setOpenDayDropdown({ staffId: member.id, date: dateStr });
                                        } else {
                                          setOpenDayDropdown(null);
                                        }
                                      }}>
                                        <DropdownMenuTrigger asChild>
                                          <button
                                            className={cn(
                                              "aspect-square rounded-lg border-2 transition-all font-mono text-xs font-bold flex items-center justify-center",
                                              getDayColor(availType)
                                            )}
                                          >
                                            {getDayLabel(availType)}
                                          </button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="center" className="w-40">
                                          <DropdownMenuItem
                                            onClick={() => setDayAvailability(member.id, dateStr, "rest")}
                                            className="font-mono text-xs"
                                          >
                                            <span className="w-3 h-3 rounded bg-blue-500 mr-2"></span>
                                            Rest Day
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => setDayAvailability(member.id, dateStr, "holiday")}
                                            className="font-mono text-xs"
                                          >
                                            <span className="w-3 h-3 rounded bg-purple-500 mr-2"></span>
                                            Holiday
                                          </DropdownMenuItem>
                                          <DropdownMenuItem
                                            onClick={() => setDayAvailability(member.id, dateStr, "sick")}
                                            className="font-mono text-xs"
                                          >
                                            <span className="w-3 h-3 rounded bg-red-500 mr-2"></span>
                                            Sick Leave
                                          </DropdownMenuItem>
                                          {availType && (
                                            <DropdownMenuItem
                                              onClick={() => setDayAvailability(member.id, dateStr, "clear")}
                                              className="font-mono text-xs text-muted-foreground"
                                            >
                                              Clear (Working)
                                            </DropdownMenuItem>
                                          )}
                                        </DropdownMenuContent>
                                      </DropdownMenu>
                                    );
                                  })}
                                </div>
                                <div className="flex gap-3 text-[10px] font-mono mt-3 flex-wrap">
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded border-2 bg-background text-[8px] flex items-center justify-center">—</span>
                                    Working
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded bg-blue-500 text-white text-[8px] font-bold flex items-center justify-center">R</span>
                                    Rest
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded bg-purple-500 text-white text-[8px] font-bold flex items-center justify-center">H</span>
                                    Holiday
                                  </span>
                                  <span className="flex items-center gap-1.5">
                                    <span className="w-4 h-4 rounded bg-red-500 text-white text-[8px] font-bold flex items-center justify-center">S</span>
                                    Sick
                                  </span>
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