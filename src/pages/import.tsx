import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/router";
import { Upload, CheckCircle2, AlertCircle, Users, Clock, Phone, FileText, Calendar, RefreshCw } from "lucide-react";
import { useSupabaseMutation, useStaff } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import type { DayShiftPattern, AvailabilityType, StaffMember } from "@/types";
import { Switch } from "@/components/ui/switch";

interface ParsedStaff {
  name: string;
  phone: string;
  shift: string;
  availability: {
    day: string; // day name: Sun, Mon, Tue, etc.
    status: AvailabilityType;
  }[];
}

export default function ImportPage() {
  const [pasteText, setPasteText] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(""); // User inputs the Sunday date
  const [parsedStaff, setParsedStaff] = useState<ParsedStaff[]>([]);
  const [updateMode, setUpdateMode] = useState(true); // Default to update mode
  const [matchedStaff, setMatchedStaff] = useState<Map<string, string>>(new Map()); // parsedName -> staffId
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const { data: existingStaff = [] } = useStaff();
  const createStaffMutation = useSupabaseMutation("staff", "insert");
  const createAvailabilityMutation = useSupabaseMutation("availability", "insert");

  const handleParsePaste = () => {
    if (!weekStartDate) {
      toast({
        title: "Week start date required",
        description: "Please enter the Sunday date for this rota week (e.g., 2026-05-18).",
        variant: "destructive",
      });
      return;
    }

    const lines = pasteText.split('\n');
    const newStaff: ParsedStaff[] = [];
    const matches = new Map<string, string>();
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Look for shift pattern HH:MM-HH:MM
      const shiftMatch = line.match(/\b\d{2}:\d{2}-\d{2}:\d{2}\b/);
      
      if (shiftMatch) {
        // Look for phone number (optional) - standard UK mobile format 07...
        const phoneMatch = line.match(/\b07\d{8,9}\b/);
        
        // Extract name
        let name = line;
        name = name.replace(shiftMatch[0], '');
        if (phoneMatch) name = name.replace(phoneMatch[0], '');
        
        // Get the part after shift pattern - this should contain the daily statuses
        const afterShift = line.split(shiftMatch[0])[1] || "";
        
        // Parse daily availability (expecting 7 entries after the shift for Sun-Sat)
        const availability: { day: string; status: AvailabilityType }[] = [];
        const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        
        // Split by whitespace and look for status indicators
        const tokens = afterShift.trim().split(/\s+/);
        const statusTokens = tokens.filter(t => 
          /^(IN|REST|Holiday|Sick|Leave|Absent|Union)$/i.test(t)
        );
        
        // Map to availability type
        for (let i = 0; i < 7 && i < statusTokens.length; i++) {
          const token = statusTokens[i];
          let status: AvailabilityType = "available";
          
          if (/^IN$/i.test(token)) {
            status = "available";
          } else if (/^REST$/i.test(token)) {
            status = "rest";
          } else if (/^Holiday$/i.test(token)) {
            status = "holiday";
          } else if (/^(Sick|Leave|Absent|Union)$/i.test(token)) {
            status = "sick";
          }
          
          availability.push({ day: days[i], status });
        }
        
        // Clean up name
        name = name.replace(/\b(IN|REST|Holiday|Sick|Union|Absent|Leave|Lenziemill|Westfield|Dayshift|Nightshift)\b/gi, '');
        name = name.replace(/[0-9]/g, ''); 
        name = name.replace(/[^\w\s-]/g, '');
        name = name.trim().replace(/\s+/g, ' ');
        
        if (name.length > 2) {
          // Try to match with existing staff in update mode
          if (updateMode && existingStaff.length > 0) {
            const matchedExisting = existingStaff.find((s: StaffMember) => 
              s.name.toLowerCase().trim() === name.toLowerCase().trim()
            );
            if (matchedExisting) {
              matches.set(name, matchedExisting.id);
            }
          }
          
          newStaff.push({
            name,
            phone: phoneMatch ? phoneMatch[0] : "",
            shift: shiftMatch[0],
            availability
          });
        }
      }
    }
    
    setParsedStaff(newStaff);
    setMatchedStaff(matches);
    
    if (newStaff.length > 0) {
      const matchCount = matches.size;
      const unmatchedCount = newStaff.length - matchCount;
      
      toast({
        title: "Data parsed successfully",
        description: updateMode 
          ? `Found ${newStaff.length} staff (${matchCount} matched, ${unmatchedCount} not found)`
          : `Found ${newStaff.length} staff members with availability data.`,
      });
    } else {
      toast({
        title: "No staff found",
        description: "Could not find any rows with shift times (e.g., 06:00-14:30).",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (parsedStaff.length === 0 || !weekStartDate) return;
    
    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;

    // Parse the week start date
    const baseDate = new Date(weekStartDate + "T00:00:00");
    if (isNaN(baseDate.getTime())) {
      toast({
        title: "Invalid date",
        description: "Please enter a valid date in YYYY-MM-DD format.",
        variant: "destructive",
      });
      setIsImporting(false);
      return;
    }

    for (let i = 0; i < parsedStaff.length; i++) {
      const staff = parsedStaff[i];
      let staffId: string | undefined;
      
      try {
        if (updateMode) {
          // Update mode: only add availability for matched staff
          staffId = matchedStaff.get(staff.name);
          
          if (!staffId) {
            console.log(`Skipping unmatched staff: ${staff.name}`);
            setImportProgress(((i + 1) / parsedStaff.length) * 100);
            continue;
          }
        } else {
          // Create mode: create new staff member
          const newStaff = await createStaffMutation.mutateAsync({
            name: staff.name,
            trained_tasks: ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"],
            shift_start: staff.shift.split("-")[0],
            day_shift_pattern: staff.shift,
            shift_pattern: "All",
          } as any);
          staffId = newStaff.id;
        }
        
        // Create availability entries for each day
        for (let dayIdx = 0; dayIdx < staff.availability.length; dayIdx++) {
          const avail = staff.availability[dayIdx];
          
          // Only create entries for non-available days (REST/Holiday/Sick)
          if (avail.status !== "available") {
            const date = new Date(baseDate);
            date.setDate(date.getDate() + dayIdx);
            const dateStr = date.toISOString().split('T')[0];
            
            await createAvailabilityMutation.mutateAsync({
              staff_id: staffId,
              date: dateStr,
              type: avail.status,
            } as any);
          }
        }
        
        successCount++;
        setImportedCount(successCount);
      } catch (error) {
        console.error(`Failed to import ${staff.name}:`, error);
      }

      setImportProgress(((i + 1) / parsedStaff.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    setIsImporting(false);
    setImportComplete(true);
    toast({
      title: "Import complete",
      description: updateMode 
        ? `Updated availability for ${successCount} existing staff`
        : `Successfully imported ${successCount} staff with availability data`,
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-condensed font-bold text-4xl mb-2">Smart Rota Importer</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Import staff with full weekly availability (IN/REST/Holiday/Sick)
          </p>
        </div>

        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="updateMode" className="font-condensed font-semibold text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Update Existing Staff Mode
                </Label>
                <p className="text-xs text-muted-foreground font-mono">
                  {updateMode 
                    ? "Will only update availability for staff already in database (matched by name)"
                    : "Will create new staff members with availability data"
                  }
                </p>
              </div>
              <Switch
                id="updateMode"
                checked={updateMode}
                onCheckedChange={setUpdateMode}
              />
            </div>
          </CardContent>
        </Card>

        {!importComplete ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-condensed flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Week Configuration
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Enter the Sunday date for the week you're importing (YYYY-MM-DD format)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="weekStart" className="font-mono text-xs">
                    Sunday Date (Week Start)
                  </Label>
                  <Input
                    id="weekStart"
                    type="date"
                    value={weekStartDate}
                    onChange={(e) => setWeekStartDate(e.target.value)}
                    className="font-mono"
                    placeholder="2026-05-18"
                  />
                  <p className="text-xs text-muted-foreground font-mono">
                    Example: If your rota week is May 18-24, 2026, enter 2026-05-18 (Sunday)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="font-condensed flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Paste Spreadsheet Data
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Copy rows from your rota with format: Name | Phone | Shift | Sun | Mon | Tue | Wed | Thu | Fri | Sat
                  <br />
                  Daily status: IN (available), REST (rest day), Holiday, Sick/Leave
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="Example: John Doe 07123456789 06:00-14:30 IN IN REST IN IN IN REST"
                  className="min-h-[200px] font-mono text-xs"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button onClick={handleParsePaste} className="w-full" variant="secondary">
                  Scan Pasted Text
                </Button>
              </CardContent>
            </Card>

            {parsedStaff.length > 0 && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle className="font-condensed flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Ready to Import ({parsedStaff.length} Staff)
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Alert>
                    <Calendar className="h-4 w-4" />
                    <AlertDescription className="text-xs font-mono">
                      Week starting: {weekStartDate ? new Date(weekStartDate + "T00:00:00").toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : "Not set"}
                    </AlertDescription>
                  </Alert>

                  <div className="max-h-[400px] overflow-y-auto space-y-3 pr-2">
                    {parsedStaff.map((staff, idx) => {
                      const isMatched = matchedStaff.has(staff.name);
                      const willBeSkipped = updateMode && !isMatched;
                      
                      return (
                        <div 
                          key={idx} 
                          className={`border rounded p-3 space-y-2 ${
                            willBeSkipped 
                              ? "bg-muted/10 opacity-50" 
                              : "bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="font-semibold text-sm">{staff.name}</div>
                              {updateMode && (
                                <Badge 
                                  variant={isMatched ? "default" : "destructive"} 
                                  className="text-[9px] px-1.5 py-0 h-4"
                                >
                                  {isMatched ? "MATCHED" : "NOT FOUND"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {staff.phone && (
                                <Badge variant="outline" className="font-mono text-[10px] px-1 py-0 h-4">
                                  <Phone className="h-2 w-2 mr-1" />
                                  {staff.phone}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="font-mono text-[10px] px-1 py-0 h-4 bg-primary/10 text-primary">
                                <Clock className="h-2 w-2 mr-1" />
                                {staff.shift}
                              </Badge>
                            </div>
                          </div>
                          
                          {staff.availability.length > 0 && (
                            <div className="flex gap-1 flex-wrap">
                              {staff.availability.map((avail, dayIdx) => (
                                <Badge 
                                  key={dayIdx} 
                                  variant={avail.status === "available" ? "default" : avail.status === "rest" ? "secondary" : "destructive"}
                                  className="font-mono text-[9px] px-1.5 py-0 h-5"
                                >
                                  {avail.day}: {avail.status === "available" ? "IN" : avail.status.toUpperCase()}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {updateMode && matchedStaff.size < parsedStaff.length && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="text-xs font-mono">
                        {parsedStaff.length - matchedStaff.size} staff will be skipped (not found in database). 
                        Turn off "Update Mode" to create them as new staff.
                      </AlertDescription>
                    </Alert>
                  )}
                  
                  <Button
                    onClick={handleImport}
                    disabled={isImporting || !weekStartDate || (updateMode && matchedStaff.size === 0)}
                    className="w-full mt-4"
                    size="lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting 
                      ? "Importing..." 
                      : updateMode 
                        ? `Update Availability for ${matchedStaff.size} Matched Staff`
                        : `Import ${parsedStaff.length} Staff with Availability`
                    }
                  </Button>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <div className="font-semibold text-lg">Import Complete!</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    Successfully imported {importedCount} staff with weekly availability data.
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => {
                    setImportComplete(false);
                    setParsedStaff([]);
                    setPasteText("");
                  }}
                  variant="outline"
                  className="w-full"
                >
                  Import More
                </Button>
                <Button
                  onClick={() => router.push("/staff")}
                  className="w-full"
                >
                  <Users className="h-4 w-4 mr-2" />
                  View Staff Roster
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}