import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/router";
import { Upload, CheckCircle2, AlertCircle, Users, Clock, Phone, FileText, Calendar, RefreshCw } from "lucide-react";
import { useSupabaseMutation, useStaff } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import type { AvailabilityType, StaffMember } from "@/types";
import { Switch } from "@/components/ui/switch";

interface ParsedAvailability {
  date: string; // YYYY-MM-DD
  status: AvailabilityType;
}

interface ParsedStaff {
  name: string;
  phone: string;
  startTime: string;
  endTime: string;
  shift: string;
  availability: ParsedAvailability[];
}

export default function ImportPage() {
  const [pasteText, setPasteText] = useState("");
  const [parsedStaff, setParsedStaff] = useState<ParsedStaff[]>([]);
  const [updateMode, setUpdateMode] = useState(true);
  const [matchedStaff, setMatchedStaff] = useState<Map<string, string>>(new Map());
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [dateRange, setDateRange] = useState<string>("");
  const [debugInfo, setDebugInfo] = useState<string>("");
  const router = useRouter();
  const { toast } = useToast();

  const { data: existingStaff = [] } = useStaff();
  const createStaffMutation = useSupabaseMutation("staff", "insert");
  const createAvailabilityMutation = useSupabaseMutation("availability", "insert");

  const parseDateFromHeader = (headerCell: string): string | null => {
    // Try to match DD/MM/YYYY format
    const match = headerCell.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (match) {
      const [, day, month, year] = match;
      return `${year}-${month}-${day}`;
    }
    return null;
  };

  const handleParsePaste = () => {
    const lines = pasteText.split('\n').filter(l => l.trim());
    
    if (lines.length < 2) {
      toast({
        title: "Not enough data",
        description: "Please paste both the header row (with dates) and staff rows.",
        variant: "destructive",
      });
      return;
    }

    // First line should be the header with dates
    const headerCells = lines[0].split('\t');
    
    // Find date columns - skip first few columns (Name, Start, End, Phone)
    const dateColumns: { index: number; date: string }[] = [];
    for (let i = 0; i < headerCells.length; i++) {
      const date = parseDateFromHeader(headerCells[i]);
      if (date) {
        dateColumns.push({ index: i, date });
      }
    }

    if (dateColumns.length === 0) {
      toast({
        title: "No dates found in header",
        description: "Please ensure the first row contains date columns in DD/MM/YYYY format (e.g., 25/01/2026).",
        variant: "destructive",
      });
      return;
    }

    // Parse staff rows
    const newStaff: ParsedStaff[] = [];
    const matches = new Map<string, string>();
    const debugLines: string[] = [];

    for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
      const cells = lines[lineIdx].split('\t');
      
      if (cells.length < 4) continue;

      const name = cells[0]?.trim();
      const startTime = cells[1]?.trim();
      const endTime = cells[2]?.trim();
      const phone = cells[3]?.trim();

      if (!name || !startTime || !endTime) continue;

      // Build shift pattern (remove seconds if present)
      const start = startTime.substring(0, 5); // HH:MM
      const end = endTime.substring(0, 5);
      const shift = `${start}-${end}`;

      // Parse availability for all date columns
      const availability: ParsedAvailability[] = [];
      
      // Debug: Log first person's raw cell contents
      if (lineIdx === 1) {
        debugLines.push(`=== DEBUG: ${name} ===`);
        debugLines.push(`Total cells in row: ${cells.length}`);
        debugLines.push(`Date columns to check: ${dateColumns.length}`);
        debugLines.push(`First 20 cells after phone:`);
      }
      
      for (const { index, date } of dateColumns) {
        if (index < cells.length) {
          const rawCell = cells[index] || "";
          const statusText = rawCell.trim().toUpperCase();
          let status: AvailabilityType = "available";

          // Debug logging for first person
          if (lineIdx === 1 && dateColumns.indexOf({ index, date }) < 20) {
            debugLines.push(`  Cell ${index} (${date}): "${rawCell}" → "${statusText}" → ${status}`);
          }

          // More robust pattern matching for statuses
          if (statusText === "REST" || statusText === "R" || statusText.startsWith("REST")) {
            status = "rest";
          } else if (statusText === "HOLIDAY" || statusText === "HOL" || statusText.startsWith("HOLIDAY")) {
            status = "holiday";
          } else if (
            statusText === "SICK" || 
            statusText === "LEAVE" || 
            statusText === "ABSENT" || 
            statusText === "UNION" ||
            statusText.startsWith("SICK") ||
            statusText.startsWith("LEAVE")
          ) {
            status = "sick";
          } else if (statusText === "IN" || statusText === "WORK" || statusText === "") {
            status = "available";
          }

          // Update debug with final status
          if (lineIdx === 1 && dateColumns.indexOf({ index, date }) < 20) {
            debugLines[debugLines.length - 1] = `  Cell ${index} (${date}): "${rawCell}" → "${statusText}" → ${status}`;
          }

          // Store ALL days (including available) for preview purposes
          availability.push({ date, status });
        } else {
          // Debug: cell index out of range
          if (lineIdx === 1) {
            debugLines.push(`  Cell ${index} (${date}): OUT OF RANGE (row has ${cells.length} cells)`);
          }
        }
      }

      // Try to match with existing staff
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
        phone,
        startTime: start,
        endTime: end,
        shift,
        availability
      });
    }

    setParsedStaff(newStaff);
    setMatchedStaff(matches);
    setDebugInfo(debugLines.join('\n'));

    // Log to console for easy copying
    console.log("=== IMPORT DEBUG INFO ===");
    console.log(debugLines.join('\n'));

    if (newStaff.length > 0 && dateColumns.length > 0) {
      const firstDate = dateColumns[0].date;
      const lastDate = dateColumns[dateColumns.length - 1].date;
      setDateRange(`${firstDate} to ${lastDate}`);

      const matchCount = matches.size;
      const unmatchedCount = newStaff.length - matchCount;
      const totalDays = dateColumns.length;
      
      // Count total unavailable days across all staff
      const totalUnavailableDays = newStaff.reduce((sum, s) => 
        sum + s.availability.filter(a => a.status !== "available").length, 0
      );

      toast({
        title: "Data parsed successfully",
        description: updateMode 
          ? `Found ${newStaff.length} staff (${matchCount} matched, ${unmatchedCount} not found) - ${totalUnavailableDays} total unavailable days across ${totalDays} days`
          : `Found ${newStaff.length} staff with ${totalUnavailableDays} total unavailable days across ${totalDays} days`,
      });
    }
  };

  const handleImport = async () => {
    if (parsedStaff.length === 0) return;
    
    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;

    for (let i = 0; i < parsedStaff.length; i++) {
      const staff = parsedStaff[i];
      let staffId: string | undefined;
      
      try {
        if (updateMode) {
          staffId = matchedStaff.get(staff.name);
          
          if (!staffId) {
            console.log(`Skipping unmatched staff: ${staff.name}`);
            setImportProgress(((i + 1) / parsedStaff.length) * 100);
            continue;
          }
        } else {
          const newStaff = await createStaffMutation.mutateAsync({
            name: staff.name,
            trained_tasks: ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"],
            shift_start: staff.startTime,
            day_shift_pattern: staff.shift,
            shift_pattern: "All",
          } as any);
          staffId = newStaff.id;
        }
        
        // Create availability entries (only for non-available days)
        let importedAvailCount = 0;
        for (const avail of staff.availability) {
          // Only import non-available days (REST/Holiday/Sick)
          if (avail.status !== "available") {
            try {
              await createAvailabilityMutation.mutateAsync({
                staff_id: staffId,
                date: avail.date,
                type: avail.status,
              } as any);
              importedAvailCount++;
            } catch (error: any) {
              // Log but continue - might be duplicate entry
              console.warn(`Duplicate or error for ${staff.name} on ${avail.date}: ${error.message}`);
            }
          }
        }
        
        console.log(`✓ ${staff.name}: imported ${importedAvailCount} unavailable days`);
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
    
    const totalImportedDays = parsedStaff.reduce((sum, s) => 
      sum + s.availability.filter(a => a.status !== "available").length, 0
    );
    
    toast({
      title: "Import complete",
      description: updateMode 
        ? `Updated ${totalImportedDays} availability entries for ${successCount} staff members`
        : `Successfully imported ${successCount} staff with ${totalImportedDays} availability entries`,
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-condensed font-bold text-4xl mb-2">Calendar Rota Importer</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Import multi-week availability from tab-separated spreadsheet data
          </p>
        </div>

        <Card className="border-accent/30 bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-condensed font-semibold text-sm flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Update Existing Staff Mode
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {updateMode 
                    ? "Will only update availability for staff already in database (matched by name)"
                    : "Will create new staff members with availability data"
                  }
                </p>
              </div>
              <Switch
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
                  <FileText className="h-5 w-5" />
                  Paste Spreadsheet Data
                </CardTitle>
                <CardDescription className="font-mono text-xs space-y-2">
                  <div>Copy from your spreadsheet INCLUDING the header row with dates.</div>
                  <div className="bg-muted/50 p-2 rounded mt-2 space-y-1">
                    <div className="font-semibold">Expected format (tab-separated):</div>
                    <div className="text-[10px] text-muted-foreground">
                      Row 1 (Header): [ignore] [ignore] [ignore] [ignore] 25/01/2026 26/01/2026 27/01/2026...
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Row 2+: ADAMS L [tab] 06:00:00 [tab] 14:30:00 [tab] 38032171 [tab] Rest [tab] IN [tab] IN [tab] IN...
                    </div>
                  </div>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="Paste here (include header row with dates + all staff rows)"
                  className="min-h-[200px] font-mono text-xs"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                />
                <Button onClick={handleParsePaste} className="w-full" variant="secondary">
                  <Calendar className="h-4 w-4 mr-2" />
                  Parse Spreadsheet Data
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
                      Date range: {dateRange}
                    </AlertDescription>
                  </Alert>

                  {isImporting ? (
                    <div className="space-y-2">
                      <Progress value={importProgress} className="h-2" />
                      <p className="text-xs text-center text-muted-foreground font-mono">
                        Importing {importedCount} / {parsedStaff.length}...
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                        {parsedStaff.slice(0, 10).map((staff, idx) => {
                          const isMatched = matchedStaff.has(staff.name);
                          const willBeSkipped = updateMode && !isMatched;
                          const unavailableDays = staff.availability.filter(a => a.status !== "available");
                          const restDays = unavailableDays.filter(a => a.status === "rest").length;
                          const holidayDays = unavailableDays.filter(a => a.status === "holiday").length;
                          const sickDays = unavailableDays.filter(a => a.status === "sick").length;
                          
                          return (
                            <div 
                              key={idx} 
                              className={`border rounded p-2 space-y-1 ${
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
                                <div className="flex items-center gap-1">
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
                              
                              <div className="flex gap-1 flex-wrap items-center">
                                <span className="text-[10px] text-muted-foreground font-mono">Unavailable:</span>
                                {restDays > 0 && (
                                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4">
                                    {restDays} REST
                                  </Badge>
                                )}
                                {holidayDays > 0 && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 bg-orange-500">
                                    {holidayDays} HOLIDAY
                                  </Badge>
                                )}
                                {sickDays > 0 && (
                                  <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4">
                                    {sickDays} SICK
                                  </Badge>
                                )}
                                {unavailableDays.length === 0 && (
                                  <span className="text-[10px] text-muted-foreground font-mono">None (all available)</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {parsedStaff.length > 10 && (
                          <div className="text-xs text-center text-muted-foreground font-mono py-2">
                            ... and {parsedStaff.length - 10} more
                          </div>
                        )}
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

                      {debugInfo && (
                        <Alert className="bg-muted/50">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>
                            <div className="space-y-2">
                              <div className="font-semibold text-xs">Debug Info (First Person):</div>
                              <pre className="text-[9px] font-mono overflow-x-auto p-2 bg-background rounded max-h-[200px] overflow-y-auto whitespace-pre-wrap break-all">
{debugInfo}
                              </pre>
                              <div className="text-[10px] text-muted-foreground">
                                Check the browser console (F12) for full debug output
                              </div>
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}
                      
                      <Button
                        onClick={handleImport}
                        disabled={updateMode && matchedStaff.size === 0}
                        className="w-full mt-4"
                        size="lg"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {updateMode 
                          ? `Update Availability for ${matchedStaff.size} Matched Staff`
                          : `Import ${parsedStaff.length} Staff with Availability`
                        }
                      </Button>
                    </>
                  )}
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
                    Successfully imported {importedCount} staff with multi-week availability data.
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <Button
                  onClick={() => {
                    setImportComplete(false);
                    setParsedStaff([]);
                    setPasteText("");
                    setDateRange("");
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