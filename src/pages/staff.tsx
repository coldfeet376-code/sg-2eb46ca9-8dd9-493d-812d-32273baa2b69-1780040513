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
import type { StaffMember, Task, AvailabilityEntry, AvailabilityType, Certification } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Users, Upload, Plus, Trash2, Calendar as Calendar2, FileSpreadsheet, AlertCircle, Repeat, Award, AlertTriangle } from "lucide-react";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DAYS_OF_WEEK = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [name, setName] = useState("");
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const [bulkInput, setBulkInput] = useState("");
  const [bulkSuccess, setBulkSuccess] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<Date[]>([]);
  const [availabilityType, setAvailabilityType] = useState<AvailabilityType>("rest");
  const [availabilityNotes, setAvailabilityNotes] = useState("");
  const [excelImport, setExcelImport] = useState("");
  const { addAuditEntry } = useAudit();
  
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

  // Certification state
  const [certTask, setCertTask] = useState<Task>("Frozen");
  const [certIssuedDate, setCertIssuedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [certExpiryDate, setCertExpiryDate] = useState<string>(() => {
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 1);
    return expiry.toISOString().split("T")[0];
  });
  const [certNotes, setCertNotes] = useState("");

  useEffect(() => {
    const savedStaff = localStorage.getItem("warehouse-staff");
    if (savedStaff) {
      const loaded = JSON.parse(savedStaff);
      // Check and auto-remove expired certifications
      const updated = loaded.map((s: StaffMember) => {
        if (s.certifications) {
          const today = new Date().toISOString().split("T")[0];
          const validCerts = s.certifications.filter(c => c.expiryDate >= today);
          const expiredCerts = s.certifications.filter(c => c.expiryDate < today);
          
          // Remove tasks with expired certs from trainedTasks
          const expiredTasks = expiredCerts.map(c => c.task);
          const updatedTasks = s.trainedTasks.filter(t => !expiredTasks.includes(t));
          
          return {
            ...s,
            trainedTasks: updatedTasks,
            certifications: validCerts,
          };
        }
        return s;
      });
      setStaff(updated);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("warehouse-staff", JSON.stringify(staff));
  }, [staff]);

  const handleAddStaff = () => {
    if (!name.trim() || selectedTasks.length === 0) return;

    const newStaff: StaffMember = {
      id: Date.now().toString(),
      name: name.trim(),
      trainedTasks: selectedTasks,
      availability: [],
      certifications: [],
    };

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
  };

  const handleDeleteStaff = (id: string) => {
    const staffMember = staff.find(s => s.id === id);
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
  };

  const handleTaskToggle = (task: Task) => {
    if (selectedTasks.includes(task)) {
      setSelectedTasks(selectedTasks.filter((t) => t !== task));
    } else {
      setSelectedTasks([...selectedTasks, task]);
    }
  };

  const handleBulkImport = () => {
    const lines = bulkInput.trim().split("\n");
    const newStaff: StaffMember[] = [];

    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;

      const staffName = parts[0];
      const tasks = parts
        .slice(1)
        .filter((t) => TASKS.includes(t as Task)) as Task[];

      if (staffName && tasks.length > 0) {
        newStaff.push({
          id: Date.now().toString() + Math.random(),
          name: staffName,
          trainedTasks: tasks,
          availability: [],
        });
      }
    });

    if (newStaff.length > 0) {
      setStaff([...staff, ...newStaff]);
      setBulkInput("");
      setBulkSuccess(true);
      setTimeout(() => setBulkSuccess(false), 3000);
    }
  };

  const handleAvailabilityImport = () => {
    if (!selectedStaff || !excelImport.trim()) return;

    const lines = excelImport.trim().split("\n");
    const newAvailability: AvailabilityEntry[] = [];

    // Expected format: Date,Type,Notes (e.g., "2026-01-15,holiday,Christmas leave")
    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 2) return;

      const dateStr = parts[0];
      const type = parts[1].toLowerCase();
      const notes = parts[2] || "";

      // Validate date format
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return;

      // Validate type
      if (!["rest", "holiday", "sick", "available"].includes(type)) return;

      newAvailability.push({
        date: date.toISOString().split("T")[0],
        type: type as AvailabilityType,
        notes,
      });
    });

    if (newAvailability.length > 0) {
      const updatedStaff = staff.map((s) => {
        if (s.id === selectedStaff.id) {
          // Merge with existing availability, removing duplicates
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
    }
  };

  const handleAddAvailability = () => {
    if (!selectedStaff || selectedDates.length === 0) return;

    const newEntries: AvailabilityEntry[] = selectedDates.map((date) => ({
      date: date.toISOString().split("T")[0],
      type: availabilityType,
      notes: availabilityNotes,
    }));

    const updatedStaff = staff.map((s) => {
      if (s.id === selectedStaff.id) {
        // Remove existing entries for these dates, then add new
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
  };

  const handleDeleteAvailability = (staffId: string, date: string) => {
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
  };

  const handleApplyPattern = () => {
    if (!selectedStaff) return;

    const entries: AvailabilityEntry[] = [];
    const current = new Date(patternStartDate);
    const end = new Date(patternEndDate);

    // Find all occurrences of the selected day between start and end
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

    const updatedStaff = staff.map((s) => {
      if (s.id === selectedStaff.id) {
        // Remove existing entries for these dates, then add new
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
  };

  const handleAddCertification = () => {
    if (!selectedStaff) return;

    const newCert: Certification = {
      task: certTask,
      issuedDate: certIssuedDate,
      expiryDate: certExpiryDate,
      notes: certNotes,
    };

    const updatedStaff = staff.map(s => {
      if (s.id === selectedStaff.id) {
        // Add cert and ensure task is in trainedTasks
        const updatedCerts = [...(s.certifications || []), newCert];
        const updatedTasks = s.trainedTasks.includes(certTask)
          ? s.trainedTasks
          : [...s.trainedTasks, certTask];
        
        return {
          ...s,
          certifications: updatedCerts,
          trainedTasks: updatedTasks,
        };
      }
      return s;
    });

    setStaff(updatedStaff);
    setSelectedStaff(updatedStaff.find(s => s.id === selectedStaff.id) || null);
    addAuditEntry({
      user: "System",
      action: "created",
      entity: "certification",
      entityId: selectedStaff.id,
      details: `Added ${certTask} certification for ${selectedStaff.name}, expires ${certExpiryDate}`,
    });
    setCertNotes("");
  };

  const handleDeleteCertification = (staffId: string, task: Task, issuedDate: string) => {
    const updatedStaff = staff.map(s => {
      if (s.id === staffId) {
        const updatedCerts = (s.certifications || []).filter(
          c => !(c.task === task && c.issuedDate === issuedDate)
        );
        return {
          ...s,
          certifications: updatedCerts,
        };
      }
      return s;
    });
    setStaff(updatedStaff);
    setSelectedStaff(updatedStaff.find(s => s.id === staffId) || null);
    
    const staffMember = staff.find(s => s.id === staffId);
    if (staffMember) {
      addAuditEntry({
        user: "System",
        action: "deleted",
        entity: "certification",
        entityId: staffId,
        details: `Removed ${task} certification for ${staffMember.name}`,
      });
    }
  };

  const getCertificationStatus = (cert: Certification) => {
    const today = new Date();
    const expiry = new Date(cert.expiryDate);
    const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (daysUntilExpiry < 0) return { status: "expired", color: "text-destructive", days: daysUntilExpiry };
    if (daysUntilExpiry <= 30) return { status: "expiring-soon", color: "text-warning", days: daysUntilExpiry };
    return { status: "valid", color: "text-success", days: daysUntilExpiry };
  };

  const getExpiringCertifications = () => {
    const expiring: { staff: StaffMember; cert: Certification; days: number }[] = [];
    
    staff.forEach(s => {
      (s.certifications || []).forEach(cert => {
        const status = getCertificationStatus(cert);
        if (status.status === "expiring-soon" || status.status === "expired") {
          expiring.push({ staff: s, cert, days: status.days });
        }
      });
    });

    return expiring.sort((a, b) => a.days - b.days);
  };

  const getAvailabilityColor = (type: AvailabilityType) => {
    switch (type) {
      case "rest":
        return "bg-blue-100 text-blue-800 border-blue-300";
      case "holiday":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "sick":
        return "bg-red-100 text-red-800 border-red-300";
      default:
        return "bg-green-100 text-green-800 border-green-300";
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
                  <Label htmlFor="name" className="font-mono text-xs">
                    Name
                  </Label>
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
                        <Label htmlFor={task} className="font-mono text-xs cursor-pointer">
                          {task}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleAddStaff} className="rounded-lg shadow-sm hover:shadow-md transition-smooth">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">Add Staff</span>
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Staff List ({staff.length})</CardTitle>
                <CardDescription className="font-mono text-xs">
                  View and manage all warehouse staff
                </CardDescription>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                    <p className="text-sm font-mono">No staff members yet</p>
                    <p className="text-xs font-mono mt-1">Add staff above to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {staff.map((member) => {
                      const stats = getAvailabilityStats(member);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition-smooth"
                        >
                          <div className="flex-1">
                            <h3 className="font-condensed font-semibold text-sm">{member.name}</h3>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {member.trainedTasks.map((task) => (
                                <Badge key={task} variant="outline" className="font-mono text-[10px]">
                                  {task}
                                </Badge>
                              ))}
                            </div>
                            {(stats.rest > 0 || stats.holiday > 0 || stats.sick > 0) && (
                              <div className="flex gap-2 mt-2 text-xs font-mono">
                                {stats.rest > 0 && (
                                  <span className="text-blue-600">Rest: {stats.rest}</span>
                                )}
                                {stats.holiday > 0 && (
                                  <span className="text-purple-600">Holiday: {stats.holiday}</span>
                                )}
                                {stats.sick > 0 && (
                                  <span className="text-red-600">Sick: {stats.sick}</span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Sheet>
                              <SheetTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setSelectedStaff(member)}
                                  className="rounded-lg"
                                >
                                  <Calendar2 className="h-4 w-4 mr-2" />
                                  <span className="font-mono text-xs">Availability</span>
                                </Button>
                              </SheetTrigger>
                              <SheetContent className="w-full sm:max-w-2xl">
                                <SheetHeader>
                                  <SheetTitle className="font-condensed">
                                    {member.name} - Availability
                                  </SheetTitle>
                                  <SheetDescription className="font-mono text-xs">
                                    Manage rest days, holidays, and sickness
                                  </SheetDescription>
                                </SheetHeader>

                                <div className="mt-6 space-y-6">
                                  <Tabs defaultValue="single" className="w-full">
                                    <TabsList className="grid w-full grid-cols-3">
                                      <TabsTrigger value="single" className="font-mono text-xs">Single Entry</TabsTrigger>
                                      <TabsTrigger value="repeating" className="font-mono text-xs">Repeating</TabsTrigger>
                                      <TabsTrigger value="import" className="font-mono text-xs">Excel Import</TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="single" className="space-y-4">
                                      <Card className="shadow-sm">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="font-condensed text-sm">
                                            Manual Entry
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Type</Label>
                                            <Select
                                              value={availabilityType}
                                              onValueChange={(v) => setAvailabilityType(v as AvailabilityType)}
                                            >
                                              <SelectTrigger className="rounded-lg font-mono text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="rest" className="font-mono text-xs">
                                                  Rest Day
                                                </SelectItem>
                                                <SelectItem value="holiday" className="font-mono text-xs">
                                                  Holiday
                                                </SelectItem>
                                                <SelectItem value="sick" className="font-mono text-xs">
                                                  Sick Leave
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Select Dates</Label>
                                            <Calendar
                                              mode="multiple"
                                              selected={selectedDates}
                                              onSelect={(dates) => setSelectedDates(dates || [])}
                                              className="rounded-lg border"
                                            />
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Notes (optional)</Label>
                                            <Input
                                              value={availabilityNotes}
                                              onChange={(e) => setAvailabilityNotes(e.target.value)}
                                              placeholder="Reason or notes..."
                                              className="rounded-lg font-mono text-xs"
                                            />
                                          </div>

                                          <Button
                                            onClick={handleAddAvailability}
                                            className="w-full rounded-lg"
                                            disabled={selectedDates.length === 0}
                                          >
                                            <Plus className="h-4 w-4 mr-2" />
                                            <span className="font-mono text-xs">
                                              Add {selectedDates.length} {selectedDates.length === 1 ? "Day" : "Days"}
                                            </span>
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    </TabsContent>

                                    <TabsContent value="repeating" className="space-y-4">
                                      <Card className="shadow-sm">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                            <Repeat className="h-4 w-4" />
                                            Recurring Pattern
                                          </CardTitle>
                                          <CardDescription className="font-mono text-xs">
                                            Apply same availability to all matching days in a date range
                                          </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Day of Week</Label>
                                            <Select
                                              value={patternDayOfWeek.toString()}
                                              onValueChange={(v) => setPatternDayOfWeek(parseInt(v))}
                                            >
                                              <SelectTrigger className="rounded-lg font-mono text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {DAYS_OF_WEEK.map((day, idx) => (
                                                  <SelectItem key={idx} value={idx.toString()} className="font-mono text-xs">
                                                    {day}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Type</Label>
                                            <Select
                                              value={patternType}
                                              onValueChange={(v) => setPatternType(v as AvailabilityType)}
                                            >
                                              <SelectTrigger className="rounded-lg font-mono text-xs">
                                                <SelectValue />
                                              </SelectTrigger>
                                              <SelectContent>
                                                <SelectItem value="rest" className="font-mono text-xs">
                                                  Rest Day
                                                </SelectItem>
                                                <SelectItem value="holiday" className="font-mono text-xs">
                                                  Holiday
                                                </SelectItem>
                                                <SelectItem value="sick" className="font-mono text-xs">
                                                  Sick Leave
                                                </SelectItem>
                                              </SelectContent>
                                            </Select>
                                          </div>

                                          <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-2">
                                              <Label className="font-mono text-xs">Start Date</Label>
                                              <Input
                                                type="date"
                                                value={patternStartDate.toISOString().split("T")[0]}
                                                onChange={(e) => setPatternStartDate(new Date(e.target.value))}
                                                className="rounded-lg font-mono text-xs"
                                              />
                                            </div>
                                            <div className="space-y-2">
                                              <Label className="font-mono text-xs">End Date</Label>
                                              <Input
                                                type="date"
                                                value={patternEndDate.toISOString().split("T")[0]}
                                                onChange={(e) => setPatternEndDate(new Date(e.target.value))}
                                                className="rounded-lg font-mono text-xs"
                                              />
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            <Label className="font-mono text-xs">Notes (optional)</Label>
                                            <Input
                                              value={patternNotes}
                                              onChange={(e) => setPatternNotes(e.target.value)}
                                              placeholder="e.g., Regular rest day"
                                              className="rounded-lg font-mono text-xs"
                                            />
                                          </div>

                                          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                                            <p className="text-xs font-mono text-blue-800 dark:text-blue-300">
                                              This will mark all <span className="font-semibold">{DAYS_OF_WEEK[patternDayOfWeek]}s</span> between{" "}
                                              {patternStartDate.toLocaleDateString()} and {patternEndDate.toLocaleDateString()} as{" "}
                                              <span className="font-semibold capitalize">{patternType}</span>
                                            </p>
                                          </div>

                                          <Button
                                            onClick={handleApplyPattern}
                                            className="w-full rounded-lg"
                                          >
                                            <Repeat className="h-4 w-4 mr-2" />
                                            <span className="font-mono text-xs">Apply Pattern</span>
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    </TabsContent>

                                    <TabsContent value="import" className="space-y-4">
                                      <Card className="shadow-sm">
                                        <CardHeader className="pb-3">
                                          <CardTitle className="font-condensed text-sm flex items-center gap-2">
                                            <FileSpreadsheet className="h-4 w-4" />
                                            Excel Import
                                          </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                          <div className="text-xs font-mono text-muted-foreground bg-muted/50 p-3 rounded-lg">
                                            <p className="font-semibold mb-2">Format:</p>
                                            <p>Date,Type,Notes</p>
                                            <p className="mt-1">2026-01-15,holiday,Christmas</p>
                                            <p>2026-02-20,rest,Regular rest</p>
                                            <p>2026-03-10,sick,Flu</p>
                                          </div>
                                          <Textarea
                                            value={excelImport}
                                            onChange={(e) => setExcelImport(e.target.value)}
                                            placeholder="Paste Excel data here..."
                                            className="font-mono text-xs h-32 rounded-lg"
                                          />
                                          <Button
                                            onClick={handleAvailabilityImport}
                                            className="w-full rounded-lg"
                                            disabled={!excelImport.trim()}
                                          >
                                            <Upload className="h-4 w-4 mr-2" />
                                            <span className="font-mono text-xs">Import Data</span>
                                          </Button>
                                        </CardContent>
                                      </Card>
                                    </TabsContent>
                                  </Tabs>
                                </div>
                              </SheetContent>
                            </Sheet>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteStaff(member.id)}
                              className="text-destructive hover:text-destructive rounded-lg"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="bulk" className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Bulk Import</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Paste CSV-style data to import multiple staff members at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-blue-50 border-blue-200">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <AlertDescription className="font-mono text-xs text-blue-800">
                    Format: <span className="font-semibold">Name, Task1, Task2, Task3</span>
                    <br />
                    Example: John Smith, Frozen, Milk, Inbound
                  </AlertDescription>
                </Alert>

                <Textarea
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  placeholder="John Smith, Frozen, Milk&#10;Jane Doe, TWI, Outbound, Marshaling&#10;Mike Brown, Frozen, Inbound"
                  className="font-mono text-xs h-48 rounded-lg"
                />

                <Button
                  onClick={handleBulkImport}
                  disabled={!bulkInput.trim()}
                  className="w-full rounded-lg shadow-sm hover:shadow-md transition-smooth"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  <span className="font-mono text-xs">Import Staff</span>
                </Button>

                {bulkSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <AlertCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="font-mono text-xs text-green-800">
                      Staff members imported successfully!
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}