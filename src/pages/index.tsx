import { useState, useEffect } from "react";
import { SEO } from "@/components/SEO";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, RefreshCw, Calendar } from "lucide-react";
import { OnboardingTour } from "@/components/OnboardingTour";

const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface StaffMember {
  id: string;
  name: string;
  trained_tasks: string[];
  shift_start: string;
  shift_pattern: string;
}

interface Assignment {
  id: string;
  staff_id: string;
  staff_name: string;
  task: string;
  date: string;
}

interface Availability {
  staff_id: string;
  date: string;
  type: string;
}

export default function RotaPage() {
  const { toast } = useToast();

  // Week navigation - Start on SUNDAY
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    return sunday;
  });

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  // Get week dates (Sun-Sat)
  const getWeekDates = (): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayDate = (date: Date): string => {
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  useEffect(() => {
    loadData();
  }, [currentWeekStart]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load staff
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("*")
        .order("name");

      if (staffError) throw staffError;
      setStaff(staffData || []);

      // Load assignments for this week
      const weekStartStr = formatDate(currentWeekStart);
      const { data: assignData, error: assignError } = await supabase
        .from("assignments")
        .select("*")
        .eq("week_start", weekStartStr);

      if (assignError) throw assignError;
      setAssignments(assignData || []);

      // Load availability for this week
      const weekDates = getWeekDates();
      const dateStrings = weekDates.map(formatDate);
      
      const { data: availData, error: availError } = await supabase
        .from("availability")
        .select("*")
        .in("date", dateStrings);

      if (availError) throw availError;
      setAvailability(availData || []);

    } catch (error) {
      console.error("Failed to load data:", error);
      toast({
        title: "❌ Failed to Load",
        description: "Could not load rota data",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const navigateWeek = (direction: "prev" | "next") => {
    const newDate = new Date(currentWeekStart);
    newDate.setDate(newDate.getDate() + (direction === "next" ? 7 : -7));
    setCurrentWeekStart(newDate);
  };

  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - day);
    sunday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(sunday);
  };

  const generateRota = async () => {
    setIsGenerating(true);
    try {
      // Clear existing assignments for this week
      const weekStartStr = formatDate(currentWeekStart);
      await supabase
        .from("assignments")
        .delete()
        .eq("week_start", weekStartStr);

      // Simple round-robin assignment
      const newAssignments: any[] = [];
      
      for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
        const date = weekDates[dayIndex];
        const dateStr = formatDate(date);

        // Get available staff for this day
        const availableStaff = staff.filter((s) => {
          const avail = availability.find(
            (a) => a.staff_id === s.id && a.date === dateStr
          );
          return !avail || avail.type === "available";
        });

        // Assign tasks
        TASKS.forEach((task) => {
          // Find staff trained for this task
          const trainedStaff = availableStaff.filter((s) =>
            s.trained_tasks.includes(task)
          );

          if (trainedStaff.length > 0) {
            // Pick first available (simple round-robin)
            const assigned = trainedStaff[0];
            newAssignments.push({
              week_start: weekStartStr,
              staff_id: assigned.id,
              staff_name: assigned.name,
              task,
              date: dateStr,
              shift_pattern: assigned.shift_pattern,
            });
          }
        });
      }

      // Insert new assignments
      const { error } = await supabase
        .from("assignments")
        .insert(newAssignments);

      if (error) throw error;

      toast({ title: "✅ Rota Generated" });
      loadData();
    } catch (error: any) {
      console.error("Failed to generate rota:", error);
      toast({
        title: "❌ Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const getAssignment = (task: string, date: Date): Assignment | undefined => {
    const dateStr = formatDate(date);
    return assignments.find((a) => a.task === task && a.date === dateStr);
  };

  const getAvailabilityStatus = (staffId: string, date: Date): string | null => {
    const dateStr = formatDate(date);
    const avail = availability.find(
      (a) => a.staff_id === staffId && a.date === dateStr
    );
    if (avail && avail.type !== "available") {
      return avail.type;
    }
    return null;
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading rota...</div>;
  }

  return (
    <>
      <OnboardingTour />
      <SEO
        title="Warehouse Rota System"
        description="Fair distribution work rotation system for warehouse operations"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Weekly Rota</h1>
          
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigateWeek("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              <Calendar className="h-4 w-4 mr-2" />
              Today
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigateWeek("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={generateRota} disabled={isGenerating}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? "animate-spin" : ""}`} />
              Generate Rota
            </Button>
          </div>
        </div>

        <Card className="p-6">
          <div className="text-center mb-4">
            <h2 className="text-xl font-semibold">
              Week of {formatDisplayDate(weekDates[0])} - {formatDisplayDate(weekDates[6])}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="border p-2 bg-muted font-semibold text-left">Task</th>
                  {weekDates.map((date, idx) => (
                    <th key={idx} className="border p-2 bg-muted font-semibold text-center min-w-[120px]">
                      <div>{DAYS[idx]}</div>
                      <div className="text-xs font-normal text-muted-foreground">
                        {formatDisplayDate(date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TASKS.map((task) => (
                  <tr key={task}>
                    <td className="border p-2 font-medium">{task}</td>
                    {weekDates.map((date, idx) => {
                      const assignment = getAssignment(task, date);
                      const availStatus = assignment
                        ? getAvailabilityStatus(assignment.staff_id, date)
                        : null;

                      return (
                        <td key={idx} className="border p-2 text-center">
                          {assignment ? (
                            <div className="space-y-1">
                              <div className="font-medium text-sm">
                                {assignment.staff_name}
                              </div>
                              {availStatus && (
                                <Badge variant="secondary" className="text-xs">
                                  {availStatus}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {staff.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground">
            <p className="mb-4">No staff members found.</p>
            <p className="text-sm">
              Go to the <strong>Staff</strong> page to add staff members first.
            </p>
          </Card>
        )}
      </div>
    </>
  );
}