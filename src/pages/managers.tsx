import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface Manager {
  id: string;
  name: string;
  can_admin: boolean;
  can_floor: boolean;
  can_intake: boolean;
  can_out_loading: boolean;
  preferred_shift: string;
  recurring_rest_days: number[];
}

export default function ManagersPage() {
  const { toast } = useToast();
  
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState("");
  const [canAdmin, setCanAdmin] = useState(false);
  const [canFloor, setCanFloor] = useState(false);
  const [canIntake, setCanIntake] = useState(false);
  const [canOutLoading, setCanOutLoading] = useState(false);
  const [preferredShift, setPreferredShift] = useState("06:00");
  const [restDays, setRestDays] = useState<number[]>([]);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCanAdmin, setEditCanAdmin] = useState(false);
  const [editCanFloor, setEditCanFloor] = useState(false);
  const [editCanIntake, setEditCanIntake] = useState(false);
  const [editCanOutLoading, setEditCanOutLoading] = useState(false);
  const [editPreferredShift, setEditPreferredShift] = useState("06:00");
  const [editRestDays, setEditRestDays] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("managers")
        .select("*")
        .order("name");

      if (error) throw error;
      setManagers(data || []);
    } catch (error) {
      console.error("Failed to load managers:", error);
      toast({
        title: "❌ Failed to Load",
        description: "Could not load managers",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("managers").insert({
        name: name.trim(),
        can_admin: canAdmin,
        can_floor: canFloor,
        can_intake: canIntake,
        can_out_loading: canOutLoading,
        preferred_shift: preferredShift,
        recurring_rest_days: restDays,
      });

      if (error) throw error;

      toast({ title: "✅ Manager Added" });
      setName("");
      setCanAdmin(false);
      setCanFloor(false);
      setCanIntake(false);
      setCanOutLoading(false);
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
    setEditCanAdmin(manager.can_admin);
    setEditCanFloor(manager.can_floor);
    setEditCanIntake(manager.can_intake);
    setEditCanOutLoading(manager.can_out_loading);
    setEditPreferredShift(manager.preferred_shift);
    setEditRestDays(manager.recurring_rest_days || []);
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = async () => {
    if (!editId || !editName.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("managers")
        .update({
          name: editName.trim(),
          can_admin: editCanAdmin,
          can_floor: editCanFloor,
          can_intake: editCanIntake,
          can_out_loading: editCanOutLoading,
          preferred_shift: editPreferredShift,
          recurring_rest_days: editRestDays,
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
    return <div className="text-center py-8">Loading managers...</div>;
  }

  return (
    <>
      <SEO title="Manager Management" />
      
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Manager Management</h1>

        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Add New Manager</h2>
          
          <div className="space-y-4">
            <Input
              placeholder="Manager Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />

            <div>
              <label className="text-sm font-medium mb-2 block">Duties</label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={canIntake ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCanIntake(!canIntake)}
                >
                  Intake
                </Badge>
                <Badge
                  variant={canOutLoading ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCanOutLoading(!canOutLoading)}
                >
                  Out-loading
                </Badge>
                <Badge
                  variant={canAdmin ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCanAdmin(!canAdmin)}
                >
                  Admin
                </Badge>
                <Badge
                  variant={canFloor ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCanFloor(!canFloor)}
                >
                  Floor
                </Badge>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Preferred Shift</label>
              <select
                value={preferredShift}
                onChange={(e) => setPreferredShift(e.target.value)}
                className="w-full p-2 border rounded"
              >
                <option value="06:00">06:00</option>
                <option value="08:00">08:00</option>
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

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Managers ({managers.length})</h2>
          
          {managers.map((manager) => (
            <Card key={manager.id} className="p-4">
              {editId === manager.id ? (
                <div className="space-y-4">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />

                  <div>
                    <label className="text-sm font-medium mb-2 block">Duties</label>
                    <div className="flex flex-wrap gap-2">
                      <Badge
                        variant={editCanIntake ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditCanIntake(!editCanIntake)}
                      >
                        Intake
                      </Badge>
                      <Badge
                        variant={editCanOutLoading ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditCanOutLoading(!editCanOutLoading)}
                      >
                        Out-loading
                      </Badge>
                      <Badge
                        variant={editCanAdmin ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditCanAdmin(!editCanAdmin)}
                      >
                        Admin
                      </Badge>
                      <Badge
                        variant={editCanFloor ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => setEditCanFloor(!editCanFloor)}
                      >
                        Floor
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Preferred Shift</label>
                    <select
                      value={editPreferredShift}
                      onChange={(e) => setEditPreferredShift(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      <option value="06:00">06:00</option>
                      <option value="08:00">08:00</option>
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
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <h3 className="font-semibold text-lg">{manager.name}</h3>
                    
                    <div className="flex flex-wrap gap-2">
                      {manager.can_intake && <Badge variant="secondary">Intake</Badge>}
                      {manager.can_out_loading && <Badge variant="secondary">Out-loading</Badge>}
                      {manager.can_admin && <Badge variant="secondary">Admin</Badge>}
                      {manager.can_floor && <Badge variant="secondary">Floor</Badge>}
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      Shift: {manager.preferred_shift}
                      {manager.recurring_rest_days && manager.recurring_rest_days.length > 0 && (
                        <> • Rest: {manager.recurring_rest_days.map(d => DAYS[d]).join(", ")}</>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
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