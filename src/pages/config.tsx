import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";

export default function ConfigPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Task requirements
  const [taskRequirements, setTaskRequirements] = useState<Record<string, Record<string, number>>>({});

  // Shift settings
  const [shiftSettings, setShiftSettings] = useState({
    startTime: "06:00",
    endTime: "14:00",
    breakDuration: 30,
  });

  useEffect(() => {
    checkAuth();
    loadConfig();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push("/login");
    }
  };

  const loadConfig = async () => {
    try {
      // Load task requirements
      const { data: requirements } = await supabase
        .from("task_requirements")
        .select("*");

      if (requirements) {
        const formatted: Record<string, Record<string, number>> = {};
        requirements.forEach((req: any) => {
          if (!formatted[req.day]) {
            formatted[req.day] = {};
          }
          formatted[req.day][req.task] = req.required_count;
        });
        setTaskRequirements(formatted);
      }
    } catch (error) {
      console.error("Error loading config:", error);
      toast({
        variant: "destructive",
        title: "Error loading configuration",
        description: "Could not load system settings",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      // Save task requirements
      const requirementsToSave = [];
      for (const day in taskRequirements) {
        for (const task in taskRequirements[day]) {
          requirementsToSave.push({
            day,
            task,
            required_count: taskRequirements[day][task],
          });
        }
      }

      // Delete existing and insert new
      await supabase.from("task_requirements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (requirementsToSave.length > 0) {
        await supabase.from("task_requirements").insert(requirementsToSave);
      }

      toast({
        title: "Configuration saved",
        description: "Settings have been updated successfully",
      });
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        variant: "destructive",
        title: "Error saving configuration",
        description: "Could not save settings",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateTaskRequirement = (day: string, task: string, value: number) => {
    setTaskRequirements(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [task]: value,
      },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Settings className="w-12 h-12 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading configuration...</p>
        </div>
      </div>
    );
  }

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const tasks = ["frozen", "milk", "twi", "inbound", "outbound", "marshaling"];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">System Configuration</h1>
          <p className="text-muted-foreground">Configure task requirements and system settings</p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="tasks" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tasks">Task Requirements</TabsTrigger>
          <TabsTrigger value="shifts">Shift Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Task Requirements</CardTitle>
              <CardDescription>
                Set how many staff members are required for each task on each day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {days.map(day => (
                  <div key={day} className="space-y-3">
                    <h3 className="font-semibold text-lg">{day}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {tasks.map(task => (
                        <div key={`${day}-${task}`} className="space-y-2">
                          <Label htmlFor={`${day}-${task}`} className="capitalize">
                            {task}
                          </Label>
                          <Input
                            id={`${day}-${task}`}
                            type="number"
                            min="0"
                            value={taskRequirements[day]?.[task] || 0}
                            onChange={(e) => updateTaskRequirement(day, task, parseInt(e.target.value) || 0)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="shifts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Shift Time Settings</CardTitle>
              <CardDescription>
                Configure default shift times and break durations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Shift Start Time</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={shiftSettings.startTime}
                    onChange={(e) => setShiftSettings(prev => ({ ...prev, startTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Shift End Time</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={shiftSettings.endTime}
                    onChange={(e) => setShiftSettings(prev => ({ ...prev, endTime: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="breakDuration">Break Duration (minutes)</Label>
                  <Input
                    id="breakDuration"
                    type="number"
                    min="0"
                    value={shiftSettings.breakDuration}
                    onChange={(e) => setShiftSettings(prev => ({ ...prev, breakDuration: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Disable static generation for this page since it requires authentication
export async function getServerSideProps() {
  return {
    props: {},
  };
}