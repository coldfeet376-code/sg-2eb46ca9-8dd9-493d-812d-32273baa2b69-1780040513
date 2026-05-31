import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Calendar } from "lucide-react";
import { ManagerDuty, ManagerShiftStart } from "@/types";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";

const DUTIES: ManagerDuty[] = ["Intake", "Out-loading", "Admin", "Floor"];
const SHIFTS: ManagerShiftStart[] = ["06:00", "08:00"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Manager {
  id: string;
  name: string;
  email: string;
  duties: ManagerDuty[];
  shift_start: ManagerShiftStart;
  rest_days: number[];
}

interface ManagerAvailability {
  id: string;
  manager_id: string;
  date: string;
  type: "rest" | "holiday" | "sick" | "available";
  notes?: string;
}

export default function ManagersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Data
  const [managers, setManagers] = useState<Manager[]>([]);
  const [availability, setAvailability] = useState<ManagerAvailability[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Add form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedDuties, setSelectedDuties] = useState<ManagerDuty[]>([]);
  const [shiftStart, setShiftStart] = useState<ManagerShiftStart>("06:00");
  const [restDays, setRestDays] = useState<number[]>([]);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDuties, setEditDuties] = useState<ManagerDuty[]>([]);
  const [editShift, setEditShift] = useState<ManagerShiftStart>("06:00");
  const [editRestDays, setEditRestDays] = useState<number[]>([]);

  // Availability calendar
  const [showAvailabilityFor, setShowAvailabilityFor] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availabilityType, setAvailabilityType] = useState<"rest" | "holiday" | "sick">("rest");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: managersData, error: managersError } = await supabase
        .from("managers")
        .select("*")
        .order("name");

      if (managersError) throw managersError;
      setManagers(managersData || []);

      const { data: availData, error: availError } = await supabase
        .from("manager_availability")
        .select("*");

      if (availError) throw availError;
      setAvailability(availData || []);
    } catch (error) {
      console.error("Failed to load managers:", error);
      toast({
        title: "❌ Failed to Load",
        description: "Could not load managers data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!name.trim() || !email.trim() || selectedDuties.length === 0) {
      toast({
        title: "Validation Error",
        description: "Name, email, and at least one duty required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("managers").insert({
        name: name.trim(),
        email: email.trim(),
        duties: selectedDuties,
        shift_start: shiftStart,
        rest_days: restDays,
      });

      if (error) throw error;

      toast({ title: "✅ Manager Added" });
      setName("");
      setEmail("");
      setSelectedDuties([]);
      setRestDays([]);
      loadData();
    } catch (error: any) {
      toast({
        title: "❌ Failed to Add",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startEdit = (manager: Manager) => {
    setEditId(manager.id);
    setEditName(manager.name);
    setEditEmail(manager.email);
    setEditDuties(manager.duties);
    setEditShift(manager.shift_start);
    setEditRestDays(manager.rest_days || []);
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim() || !editEmail.trim() || editDuties.length === 0) {
      toast({
        title: "Validation Error",
        description: "Name, email, and at least one duty required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("managers")
        .update({
          name: editName.trim(),
          email: editEmail.trim(),
          duties: editDuties,
          shift_start: editShift,
          rest_days: editRestDays,
        })
        .eq("id", editId);

      if (error) throw error;

      toast({ title: "✅ Manager Updated" });
      setEditId(null);
      loadData();
    } catch (error: any) {
      toast({
        title: "❌ Update Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete ${name}?`)) return;

    try {
      const { error } = await supabase.from("managers").delete().eq("id", id);
      if (error) throw error;

      toast({ title: "✅ Manager Deleted" });
      loadData();
    } catch (error: any) {
      toast({
        title: "❌ Delete Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleDuty = (duty: ManagerDuty, isEdit: boolean) => {
    if (isEdit) {
      setEditDuties((prev) =>
        prev.includes(duty) ? prev.filter((d) => d !== duty) : [...prev, duty]
      );
    } else {
      setSelectedDuties((prev) =>
        prev.includes(duty) ? prev.filter((d) => d !== duty) : [...prev, duty]
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

  const handleSetAvailability = async () => {
    if (!showAvailabilityFor || !selectedDate) return;

    const dateStr = format(selectedDate, "yyyy-MM-dd");

    try {
      const { error } = await supabase.from("manager_availability").upsert(
        {
          manager_id: showAvailabilityFor,
          date: dateStr,
          type: availabilityType,
        },
        { onConflict: "manager_id,date" }
      );

      if (error) throw error;

      toast({ title: "✅ Availability Set" });
      loadData();
      setSelectedDate(undefined);
    } catch (error: any) {
      toast({
        title: "❌ Failed to Set Availability",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getManagerAvailability = (managerId: string, date: Date): string | null => {
    const dateStr = format(date, "yyyy-MM-dd");
    const entry = availability.find(
      (a) => a.manager_id === managerId && a.date === dateStr
    );
    return entry ? entry.type : null;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading managers...</div>;
  }

  return (
    <>
      <SEO title="Manager Management" />
      
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Manager Management</h1>

        {/* Add Manager Form */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Manager</h2>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                placeholder="Manager Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Duties</label>
              <div className="flex flex-wrap gap-2">
                {DUTIES.map((duty) => (
                  <Badge
                    key={duty}
                    variant={selectedDuties.includes(duty) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleDuty(duty, false)}
                  >
                    {duty}
                  </Badge>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Shift Start</label>
              <select
                value={shiftStart}
                onChange={(e) => setShiftStart(e.target.value as ManagerShiftStart)}
                className="w-full p-2 border rounded"
              >
                {SHIFTS.map((shift) => (
                  <option key={shift} value={shift}>{shift}</option>
                ))}
              </select>
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

            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Add Manager
            </Button>
          </div>
        </Card>

        {/* Managers List */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Managers ({managers.length})</h2>
          
          {managers.map((manager) => (
            <Card key={manager.id} className="p-4">
              {editId === manager.id ? (
                // Edit Mode
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                    <Input
                      value={editEmail}
                      type="email"
                      onChange={(e) => setEditEmail(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Duties</label>
                    <div className="flex flex-wrap gap-2">
                      {DUTIES.map((duty) => (
                        <Badge
                          key={duty}
                          variant={editDuties.includes(duty) ? "default" : "outline"}
                          className="cursor-pointer"
                          onClick={() => toggleDuty(duty, true)}
                        >
                          {duty}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Shift Start</label>
                    <select
                      value={editShift}
                      onChange={(e) => setEditShift(e.target.value as ManagerShiftStart)}
                      className="w-full p-2 border rounded"
                    >
                      {SHIFTS.map((shift) => (
                        <option key={shift} value={shift}>{shift}</option>
                      ))}
                    </select>
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
                    <Button onClick={saveEdit}>
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
                    <h3 className="font-semibold text-lg">{manager.name}</h3>
                    <p className="text-sm text-muted-foreground">{manager.email}</p>
                    
                    <div className="flex flex-wrap gap-2">
                      {manager.duties.map((duty) => (
                        <Badge key={duty} variant="secondary">{duty}</Badge>
                      ))}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Shift: {manager.shift_start}
                      {manager.rest_days && manager.rest_days.length > 0 && (
                        <> • Rest: {manager.rest_days.map(d => DAYS[d]).join(", ")}</>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowAvailabilityFor(manager.id)}
                        >
                          <Calendar className="h-4 w-4" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-4">
                        <div className="space-y-4">
                          <h4 className="font-semibold">Set Availability</h4>
                          
                          <CalendarComponent
                            mode="single"
                            selected={selectedDate}
                            onSelect={setSelectedDate}
                            className="rounded-md border"
                          />

                          {selectedDate && (
                            <>
                              <select
                                value={availabilityType}
                                onChange={(e) => setAvailabilityType(e.target.value as "rest" | "holiday" | "sick")}
                                className="w-full p-2 border rounded"
                              >
                                <option value="rest">Rest Day</option>
                                <option value="holiday">Holiday</option>
                                <option value="sick">Sick</option>
                              </select>

                              <Button onClick={handleSetAvailability} className="w-full">
                                Set Availability
                              </Button>
                            </>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startEdit(manager)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(manager.id, manager.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}

          {managers.length === 0 && (
            <Card className="p-8 text-center text-muted-foreground">
              No managers yet. Add your first one above.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}