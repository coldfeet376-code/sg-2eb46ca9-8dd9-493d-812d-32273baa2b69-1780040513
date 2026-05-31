import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useStaffData, useAddStaff, useUpdateStaff, useDeleteStaff } from "@/hooks/useSupabaseQueries";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { Task, ShiftStart, ShiftPattern } from "@/types";

const TASKS: Task[] = ["Frozen", "Milk", "Twi", "Inbound", "Outbound", "Marshaling"];
const SHIFTS: ShiftStart[] = ["06:00", "10:00", "14:00"];
const PATTERNS: ShiftPattern[] = ["All", "Mon-Fri", "Sat-Sun"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function StaffPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Data
  const { data: staff = [], isLoading } = useStaffData();
  const addStaff = useAddStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  // Add form
  const [name, setName] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [shiftStart, setShiftStart] = useState<ShiftStart>("06:00");
  const [shiftPattern, setShiftPattern] = useState<ShiftPattern>("All");
  const [restDays, setRestDays] = useState<number[]>([]);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTasks, setEditTasks] = useState<Task[]>([]);
  const [editShift, setEditShift] = useState<ShiftStart>("06:00");
  const [editPattern, setEditPattern] = useState<ShiftPattern>("All");
  const [editRestDays, setEditRestDays] = useState<number[]>([]);

  const handleAdd = async () => {
    if (!name.trim() || selectedTasks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Name and at least one task required",
        variant: "destructive",
      });
      return;
    }

    addStaff.mutate(
      {
        name: name.trim(),
        trainedTasks: selectedTasks,
        shiftStart,
        shiftPattern,
        restDays,
      },
      {
        onSuccess: () => {
          toast({ title: "✅ Staff Added" });
          setName("");
          setSelectedTasks([]);
          setRestDays([]);
        },
        onError: (error: Error) => {
          toast({
            title: "❌ Failed to Add",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const startEdit = (member: typeof staff[0]) => {
    setEditId(member.id);
    setEditName(member.name);
    setEditTasks(member.trainedTasks);
    setEditShift(member.shiftStart);
    setEditPattern(member.shiftPattern || "All");
    setEditRestDays(member.restDays || []);
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim() || editTasks.length === 0) {
      toast({
        title: "Validation Error",
        description: "Name and at least one task required",
        variant: "destructive",
      });
      return;
    }

    updateStaff.mutate(
      {
        id: editId,
        updates: {
          name: editName.trim(),
          trainedTasks: editTasks,
          shiftStart: editShift,
          shiftPattern: editPattern,
          restDays: editRestDays,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "✅ Staff Updated" });
          setEditId(null);
        },
        onError: (error: Error) => {
          toast({
            title: "❌ Update Failed",
            description: error.message,
            variant: "destructive",
          });
        },
      }
    );
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;

    deleteStaff.mutate(id, {
      onSuccess: () => {
        toast({ title: "✅ Staff Deleted" });
      },
      onError: (error: Error) => {
        toast({
          title: "❌ Delete Failed",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  const toggleTask = (task: Task, isEdit: boolean) => {
    if (isEdit) {
      setEditTasks((prev) =>
        prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
      );
    } else {
      setSelectedTasks((prev) =>
        prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
      );
    }
  };

  const toggleRestDay = (day: number, isEdit: boolean) => {
    if (isEdit) {
      setEditRestDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      );
    } else {
      setRestDays((prev) =>
        prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
      );
    }
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading staff...</div>;
  }

  return (
    <>
      <SEO title="Staff Management" />
      
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Staff Management</h1>

        {/* Add Staff Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Staff</h2>
          
          <div className="space-y-4">
            <Input
              placeholder="Staff Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div>
              <label className="text-sm font-medium mb-2 block">Trained Tasks</label>
              <div className="flex flex-wrap gap-2">
                {TASKS.map((task) => (
                  <Badge
                    key={task}
                    variant={selectedTasks.includes(task) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTask(task, false)}
                  >
                    {task}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Shift Start</label>
                <select
                  value={shiftStart}
                  onChange={(e) => setShiftStart(e.target.value as ShiftStart)}
                  className="w-full p-2 border rounded"
                >
                  {SHIFTS.map((shift) => (
                    <option key={shift} value={shift}>{shift}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Pattern</label>
                <select
                  value={shiftPattern}
                  onChange={(e) => setShiftPattern(e.target.value as ShiftPattern)}
                  className="w-full p-2 border rounded"
                >
                  {PATTERNS.map((pattern) => (
                    <option key={pattern} value={pattern}>{pattern}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Recurring Rest Days</label>
              <div className="flex gap-2">
                {DAYS.map((day, idx) => (
                  <Badge
                    key={idx}
                    variant={restDays.includes(idx) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleRestDay(idx, false)}
                  >
                    {day}
                  </Badge>
                ))}
              </div>
            </div>

            <Button onClick={handleAdd} disabled={addStaff.isPending}>
              <Plus className="h-4 w-4 mr-2" />
              Add Staff
            </Button>
          </div>
        </Card>

        {/* Staff List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Staff Members ({staff.length})</h2>
          
          {staff.map((member) => (
            <Card key={member.id} className="p-4">
              {editId === member.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />

                  <div>
                    <label className="text-sm font-medium mb-2 block">Trained Tasks</label>
                    <div className="flex flex-wrap gap-2">
                      {TASKS.map((task) => (
                        <Badge
                          key={task}
                          variant={editTasks.includes(task) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleTask(task, true)}
                        >
                          {task}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Shift Start</label>
                      <select
                        value={editShift}
                        onChange={(e) => setEditShift(e.target.value as ShiftStart)}
                        className="w-full p-2 border rounded"
                      >
                        {SHIFTS.map((shift) => (
                          <option key={shift} value={shift}>{shift}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">Pattern</label>
                      <select
                        value={editPattern}
                        onChange={(e) => setEditPattern(e.target.value as ShiftPattern)}
                        className="w-full p-2 border rounded"
                      >
                        {PATTERNS.map((pattern) => (
                          <option key={pattern} value={pattern}>{pattern}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Recurring Rest Days</label>
                    <div className="flex gap-2">
                      {DAYS.map((day, idx) => (
                        <Badge
                          key={idx}
                          variant={editRestDays.includes(idx) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleRestDay(idx, true)}
                        >
                          {day}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button onClick={saveEdit} disabled={updateStaff.isPending}>
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button variant="outline" onClick={cancelEdit}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {member.trainedTasks.map((task) => (
                        <Badge key={task} variant="secondary">{task}</Badge>
                      ))}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Shift: {member.shiftStart} • Pattern: {member.shiftPattern || "All"}
                      {member.restDays && member.restDays.length > 0 && (
                        <> • Rest: {member.restDays.map(d => DAYS[d]).join(", ")}</>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(member)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(member.id, member.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {staff.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              No staff members yet. Add your first one above.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}