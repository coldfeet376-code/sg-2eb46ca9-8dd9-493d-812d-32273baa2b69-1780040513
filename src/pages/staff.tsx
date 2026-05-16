import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Upload, Calendar } from "lucide-react";
import { SEO } from "@/components/SEO";
import type { StaffMember, Task } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffTasks, setNewStaffTasks] = useState<Task[]>([]);
  const [bulkInput, setBulkInput] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("warehouse-staff");
    if (saved) {
      setStaff(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    if (staff.length > 0) {
      localStorage.setItem("warehouse-staff", JSON.stringify(staff));
    }
  }, [staff]);

  const handleAddStaff = () => {
    if (!newStaffName.trim() || newStaffTasks.length === 0) return;

    const newStaff: StaffMember = {
      id: Date.now().toString(),
      name: newStaffName.trim(),
      trainedTasks: newStaffTasks,
      restDays: [],
      absences: [],
      holidays: [],
    };

    setStaff([...staff, newStaff]);
    setNewStaffName("");
    setNewStaffTasks([]);
    setShowAddDialog(false);
  };

  const handleBulkImport = () => {
    const lines = bulkInput.split("\n").filter(line => line.trim());
    const newStaffMembers: StaffMember[] = [];

    lines.forEach(line => {
      const parts = line.split(",").map(p => p.trim());
      if (parts.length < 2) return;

      const name = parts[0];
      const tasks = parts.slice(1).filter(t => 
        TASKS.includes(t as Task)
      ) as Task[];

      if (name && tasks.length > 0) {
        newStaffMembers.push({
          id: Date.now().toString() + Math.random(),
          name,
          trainedTasks: tasks,
          restDays: [],
          absences: [],
          holidays: [],
        });
      }
    });

    setStaff([...staff, ...newStaffMembers]);
    setBulkInput("");
    setShowBulkDialog(false);
  };

  const handleDeleteStaff = (id: string) => {
    setStaff(staff.filter(s => s.id !== id));
  };

  const toggleTask = (task: Task) => {
    setNewStaffTasks(prev =>
      prev.includes(task)
        ? prev.filter(t => t !== task)
        : [...prev, task]
    );
  };

  return (
    <Layout>
      <SEO
        title="Staff Management - Warehouse Rota"
        description="Manage staff members and their training assignments"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Staff Management
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {staff.length} staff members configured
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="font-mono text-xs">Bulk Import</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-condensed">Bulk Import Staff</DialogTitle>
                  <DialogDescription className="font-mono text-xs">
                    Format: Name, Task1, Task2, Task3 (one per line)
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="bulk-input" className="font-mono text-xs">
                      Paste staff data
                    </Label>
                    <Textarea
                      id="bulk-input"
                      placeholder="John Smith, Frozen, Inbound, Outbound&#10;Jane Doe, Milk, TWI, Marshaling"
                      value={bulkInput}
                      onChange={(e) => setBulkInput(e.target.value)}
                      rows={8}
                      className="font-mono text-xs"
                    />
                  </div>
                  <div className="text-xs text-muted-foreground font-mono">
                    Valid tasks: {TASKS.join(", ")}
                  </div>
                  <Button onClick={handleBulkImport} className="w-full">
                    Import {bulkInput.split("\n").filter(l => l.trim()).length} entries
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2">
                  <Plus className="h-4 w-4" />
                  <span className="font-mono text-xs">Add Staff</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-condensed">Add New Staff Member</DialogTitle>
                  <DialogDescription className="font-mono text-xs">
                    Enter staff details and training assignments
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="staff-name" className="font-mono text-xs">
                      Name
                    </Label>
                    <Input
                      id="staff-name"
                      placeholder="John Smith"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Trained Tasks</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {TASKS.map(task => (
                        <div key={task} className="flex items-center space-x-2">
                          <Checkbox
                            id={`task-${task}`}
                            checked={newStaffTasks.includes(task)}
                            onCheckedChange={() => toggleTask(task)}
                          />
                          <label
                            htmlFor={`task-${task}`}
                            className="text-sm font-mono cursor-pointer"
                          >
                            {task}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                  <Button onClick={handleAddStaff} className="w-full" disabled={!newStaffName.trim() || newStaffTasks.length === 0}>
                    Add Staff Member
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Staff List</CardTitle>
            <CardDescription className="font-mono text-xs">
              All warehouse staff and their training certifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            {staff.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground font-mono text-sm">
                No staff members added yet. Click &quot;Add Staff&quot; or &quot;Bulk Import&quot; to get started.
              </div>
            ) : (
              <div className="space-y-2">
                {staff.map(member => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 border border-border rounded hover:bg-muted/30"
                  >
                    <div className="space-y-2">
                      <div className="font-condensed font-semibold">{member.name}</div>
                      <div className="flex flex-wrap gap-1">
                        {member.trainedTasks.map(task => (
                          <Badge key={task} variant="secondary" className="font-mono text-xs">
                            {task}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-mono text-xs">Availability</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteStaff(member.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}