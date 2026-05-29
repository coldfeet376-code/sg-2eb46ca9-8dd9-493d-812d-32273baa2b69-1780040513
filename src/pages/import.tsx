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
import { supabase } from "@/integrations/supabase/client";

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
  const [isClearing, setIsClearing] = useState(false);
  const [currentProcessingStaff, setCurrentProcessingStaff] = useState<string>("");
  const [importStats, setImportStats] = useState({ success: 0, skipped: 0, errors: 0 });
  const router = useRouter();
  const { toast } = useToast();

  const { data: existingStaff = [] } = useStaff();
  const createStaffMutation = useSupabaseMutation("staff", "insert");
  const createAvailabilityMutation = useSupabaseMutation("availability", "insert");
  const deleteAvailabilityMutation = useSupabaseMutation("availability", "delete");

  const handleClearAllAvailability = async () => {
    if (!confirm("⚠️ This will DELETE ALL availability entries for ALL staff members. This cannot be undone. Continue?")) {
      return;
    }

    setIsClearing(true);
    try {
      // Delete all availability records using direct Supabase query
      const { error } = await supabase
        .from('availability')
        .delete()
        .gte('created_at', '1970-01-01'); // Match all records
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "✓ Cleared all availability",
        description: "All availability entries have been removed from the database",
      });
    } catch (error: any) {
      console.error("Error clearing availability:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to clear availability data",
        variant: "destructive",
      });
    } finally {
      setIsClearing(false);
    }
  };

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
    
    const earlyDebug: string[] = [];
    earlyDebug.push(`=== EARLY PARSING DEBUG ===`);
    earlyDebug.push(`Total lines: ${lines.length}`);
    earlyDebug.push(`First 5 lines:`);
    lines.slice(0, 5).forEach((line, i) => {
      const preview = line.length > 100 ? line.substring(0, 100) + "..." : line;
      earlyDebug.push(`  Line ${i}: ${preview}`);
    });
    
    if (lines.length < 2) {
      toast({
        title: "Not enough data",
        description: "Please paste both the header row (with dates) and staff rows.",
        variant: "destructive",
      });
      return;
    }

    // Search ALL lines for the one with dates (not just first line)
    let headerLineIndex = -1;
    let headerCells: string[] = [];
    const dateColumns: { index: number; date: string }[] = [];
    
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const cells = lines[i].split('\t');
      let dateCount = 0;
      
      for (let j = 0; j < cells.length; j++) {
        if (parseDateFromHeader(cells[j])) {
          dateCount++;
        }
      }
      
      if (dateCount > 5) { // Found header with multiple dates
        headerLineIndex = i;
        headerCells = cells;
        earlyDebug.push(`\n✓ Found date header at line ${i} (${dateCount} dates detected)`);
        
        // Extract date columns
        for (let j = 0; j < cells.length; j++) {
          const date = parseDateFromHeader(cells[j]);
          if (date) {
            dateColumns.push({ index: j, date });
          }
        }
        break;
      }
    }

    if (headerLineIndex === -1 || dateColumns.length === 0) {
      earlyDebug.push(`\n✗ ERROR: No date header found in first 10 lines`);
      console.log(earlyDebug.join('\n'));
      setDebugInfo(earlyDebug.join('\n'));
      
      toast({
        title: "No dates found in header",
        description: "Could not find a row with dates in DD/MM/YYYY format. Check the debug panel below.",
        variant: "destructive",
      });
      return;
    }

    earlyDebug.push(`Date columns found: ${dateColumns.length}`);
    earlyDebug.push(`First date: ${dateColumns[0].date}, Last date: ${dateColumns[dateColumns.length - 1].date}`);

    // Parse staff rows (start after header line)
    const newStaff: ParsedStaff[] = [];
    const matches = new Map<string, string>();
    const debugLines: string[] = [...earlyDebug];
    
    debugLines.push(`\n=== STAFF ROW PARSING ===`);
    debugLines.push(`Starting from line ${headerLineIndex + 1}`);

    for (let lineIdx = headerLineIndex + 1; lineIdx < lines.length; lineIdx++) {
      const cells = lines[lineIdx].split('\t');
      
      // Skip section headers or rows with too few cells
      if (cells.length < 4) {
        debugLines.push(`Line ${lineIdx}: SKIPPED (only ${cells.length} cells)`);
        continue;
      }

      const name = cells[0]?.trim();
      const startTime = cells[1]?.trim();
      const endTime = cells[2]?.trim();
      const phone = cells[3]?.trim();

      // Skip section headers like "LENZIEMILL DAYSHIFT"
      if (!name || name.includes("DAYSHIFT") || name.includes("NIGHTSHIFT")) {
        debugLines.push(`Line ${lineIdx}: SKIPPED (section header: "${name}")`);
        continue;
      }

      // Skip if missing required fields
      if (!startTime || !endTime) {
        debugLines.push(`Line ${lineIdx}: SKIPPED "${name}" (missing shift times)`);
        continue;
      }

      // Build shift pattern (remove seconds if present)
      const start = startTime.substring(0, 5); // HH:MM
      const end = endTime.substring(0, 5);
      const shift = `${start}-${end}`;

      // Parse availability for all date columns
      const availability: ParsedAvailability[] = [];
      
      // Debug: Log first person's raw cell contents
      if (newStaff.length === 0) {
        debugLines.push(`\n=== FIRST PERSON DETAIL: ${name} ===`);
        debugLines.push(`Shift: ${shift}, Phone: ${phone || "none"}`);
        debugLines.push(`Total cells in row: ${cells.length}`);
        debugLines.push(`Date columns to check: ${dateColumns.length}`);
        debugLines.push(`First 20 availability cells:`);
      }
      
      for (let dcIdx = 0; dcIdx < dateColumns.length; dcIdx++) {
        const { index, date } = dateColumns[dcIdx];
        
        if (index < cells.length) {
          const rawCell = cells[index] || "";
          const statusText = rawCell.trim().toUpperCase();
          let status: AvailabilityType = "available";

          // More robust pattern matching for statuses
          if (statusText === "REST" || statusText === "R" || statusText.startsWith("REST")) {
            status = "rest_day";
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
            status = "absent";
          } else if (statusText === "IN" || statusText === "WORK" || statusText === "") {
            status = "available";
          }

          // Debug logging for first person, first 20 days
          if (newStaff.length === 0 && dcIdx < 20) {
            debugLines.push(`  Cell ${index} (${date}): "${rawCell}" → ${status}`);
          }

          // Store ALL days (including available) for preview purposes
          availability.push({ date, status });
        } else {
          // Debug: cell index out of range
          if (newStaff.length === 0 && dcIdx < 20) {
            debugLines.push(`  Cell ${index} (${date}): OUT OF RANGE (row has only ${cells.length} cells)`);
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

      debugLines.push(`Line ${lineIdx}: ✓ PARSED "${name}"`);

      newStaff.push({
        name,
        phone,
        startTime: start,
        endTime: end,
        shift,
        availability
      });
    }

    debugLines.push(`\n=== SUMMARY ===`);
    debugLines.push(`Total staff parsed: ${newStaff.length}`);
    if (updateMode) {
      debugLines.push(`Matched to database: ${matches.size}`);
      debugLines.push(`Not found: ${newStaff.length - matches.size}`);
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
    } else if (newStaff.length === 0) {
      toast({
        title: "No staff found",
        description: "Could not parse any staff rows. Check the debug panel below for details.",
        variant: "destructive",
      });
    }
  };

  const handleImport = async () => {
    if (parsedStaff.length === 0) return;
    
    setIsImporting(true);
    setImportProgress(0);
    setImportStats({ success: 0, skipped: 0, errors: 0 });
    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const availabilityStats: { name: string; imported: number; failed: number }[] = [];

    console.log("\n\n=== STARTING IMPORT PROCESS ===");
    console.log(`Total staff to process: ${parsedStaff.length}`);
    console.log(`Update mode: ${updateMode}`);

    for (let i = 0; i < parsedStaff.length; i++) {
      const staff = parsedStaff[i];
      setCurrentProcessingStaff(staff.name);
      let staffId: string | undefined;
      
      console.log(`\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`PROCESSING STAFF ${i + 1}/${parsedStaff.length}: ${staff.name}`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      
      try {
        if (updateMode) {
          staffId = matchedStaff.get(staff.name);
          
          console.log(`[UPDATE MODE] Looking for match: "${staff.name}"`);
          console.log(`Matched ID: ${staffId || "NOT FOUND"}`);
          
          if (!staffId) {
            console.log(`❌ SKIPPED: ${staff.name} (not found in database)`);
            skippedCount++;
            setImportStats({ success: successCount, skipped: skippedCount, errors: errors.length });
            setImportProgress(((i + 1) / parsedStaff.length) * 100);
            continue;
          }
        } else {
          // FRESH DATABASE QUERY - Check for duplicates in real-time
          console.log(`[CREATE MODE] Checking database for existing staff: "${staff.name}"`);
          
          const { data: existingCheck, error: checkError } = await supabase
            .from('staff')
            .select('id, name')
            .ilike('name', staff.name.trim())
            .maybeSingle();
          
          if (checkError) {
            console.error(`⚠️ Database check error:`, checkError);
          }
          
          if (existingCheck) {
            console.log(`✓ FOUND existing staff in database:`);
            console.log(`  Name in DB: "${existingCheck.name}"`);
            console.log(`  Staff ID: ${existingCheck.id}`);
            staffId = existingCheck.id;
          } else {
            // Create new staff member
            const staffData = {
              name: staff.name,
              trained_tasks: ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling", "Equipment"],
              shift_start: staff.startTime,
              shift_pattern: "All",
            };
            
            console.log(`➕ CREATING NEW staff with data:`, staffData);
            
            try {
              const newStaff = await createStaffMutation.mutateAsync(staffData as any);
              staffId = newStaff.id;
              console.log(`✓ Created staff successfully, ID: ${staffId}`);
            } catch (createError: any) {
              const errorMsg = `Failed to create ${staff.name}: ${createError.message || createError}`;
              console.error(`❌ CREATE FAILED:`, createError);
              errors.push(errorMsg);
              setImportStats({ success: successCount, skipped: skippedCount, errors: errors.length });
              setImportProgress(((i + 1) / parsedStaff.length) * 100);
              continue;
            }
          }
        }
        
        // UPSERT availability entries (handles duplicates properly)
        let importedAvailCount = 0;
        let failedAvailCount = 0;
        
        const unavailableDays = staff.availability.filter(a => a.status !== "available");
        
        console.log(`\n--- AVAILABILITY IMPORT ---`);
        console.log(`Staff ID being used: ${staffId}`);
        console.log(`Total availability entries: ${staff.availability.length}`);
        console.log(`Unavailable days (will import): ${unavailableDays.length}`);
        console.log(`  Rest: ${unavailableDays.filter(a => a.status === "rest").length}`);
        console.log(`  Holiday: ${unavailableDays.filter(a => a.status === "holiday").length}`);
        console.log(`  Sick: ${unavailableDays.filter(a => a.status === "sick").length}`);
        
        // Show first 5 unavailable days for debugging
        if (unavailableDays.length > 0) {
          console.log(`\nFirst 5 unavailable days to import:`);
          unavailableDays.slice(0, 5).forEach((avail, idx) => {
            console.log(`  ${idx + 1}. ${avail.date} = ${avail.status.toUpperCase()}`);
          });
        }
        
        console.log(`\nStarting UPSERT operations...`);
        
        for (const avail of staff.availability) {
          // Only import non-available days (REST/Holiday/Sick)
          if (avail.status !== "available") {
            try {
              // UPSERT: Insert or update if duplicate
              const { error: upsertError } = await supabase
                .from('availability')
                .upsert({
                  staff_id: staffId,
                  date: avail.date,
                  type: avail.status,
                }, {
                  onConflict: 'staff_id,date'
                });
              
              if (upsertError) {
                throw upsertError;
              }
              
              importedAvailCount++;
              
              // Log first 3 successful upserts for verification
              if (importedAvailCount <= 3) {
                console.log(`  ✓ Upserted: ${avail.date} = ${avail.status}`);
              }
            } catch (error: any) {
              // Track real failures (not duplicates anymore)
              failedAvailCount++;
              console.error(`  ❌ FAILED: ${avail.date} = ${avail.status}`);
              console.error(`     Error: ${error.message}`);
              if (failedAvailCount <= 3) {
                console.error(`     Full error:`, error);
              }
            }
          }
        }
        
        availabilityStats.push({
          name: staff.name,
          imported: importedAvailCount,
          failed: failedAvailCount
        });
        
        console.log(`\n✅ COMPLETED ${staff.name}:`);
        console.log(`   Imported: ${importedAvailCount} days`);
        console.log(`   Failed: ${failedAvailCount} days`);
        
        if (importedAvailCount === 0 && unavailableDays.length > 0) {
          console.error(`\n⚠️⚠️⚠️ WARNING ⚠️⚠️⚠️`);
          console.error(`${staff.name} has ${unavailableDays.length} unavailable days but ZERO were imported!`);
          console.error(`Possible causes:`);
          console.error(`  - Database connection issue`);
          console.error(`  - RLS policy blocking inserts`);
          console.error(`  - Invalid staff_id: ${staffId}`);
          console.error(`  - Invalid date format in parsed data`);
        }
        
        successCount++;
        setImportedCount(successCount);
        setImportStats({ success: successCount, skipped: skippedCount, errors: errors.length });
      } catch (error: any) {
        const errorMsg = `Failed to import ${staff.name}: ${error.message || error}`;
        console.error(`\n❌ EXCEPTION for ${staff.name}:`, error);
        errors.push(errorMsg);
        setImportStats({ success: successCount, skipped: skippedCount, errors: errors.length });
      }

      setImportProgress(((i + 1) / parsedStaff.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 100)); // Slightly longer delay for console readability
    }

    setIsImporting(false);
    setImportComplete(true);
    setCurrentProcessingStaff("");
    
    // Show detailed availability stats
    console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("FINAL SUMMARY - AVAILABILITY IMPORT");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    availabilityStats.forEach(stat => {
      const status = stat.imported > 0 ? "✅" : stat.failed > 0 ? "❌" : "⚠️";
      console.log(`${status} ${stat.name}: ${stat.imported} imported, ${stat.failed} failed`);
    });
    
    const totalImported = availabilityStats.reduce((sum, s) => sum + s.imported, 0);
    const totalFailed = availabilityStats.reduce((sum, s) => sum + s.failed, 0);
    const zeroImported = availabilityStats.filter(s => s.imported === 0 && s.failed > 0).map(s => s.name);
    
    console.log(`\nTotals: ${totalImported} imported, ${totalFailed} failed`);
    
    if (zeroImported.length > 0) {
      console.error("\n⚠️ STAFF WITH ZERO AVAILABILITY IMPORTED (but had failures):");
      zeroImported.forEach(name => console.error(`  - ${name}`));
    }
    
    // Show errors if any
    if (errors.length > 0 || totalFailed > 0) {
      console.error("\n=== IMPORT ERRORS ===");
      errors.forEach(err => console.error(err));
      
      toast({
        title: "Import completed with errors",
        description: `${successCount} staff processed, ${totalImported} availability saved, ${totalFailed} failed. Check console (F12) for details.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "✅ Import complete",
        description: updateMode 
          ? `Updated ${totalImported} availability entries for ${successCount} staff members`
          : `Successfully imported ${successCount} staff with ${totalImported} availability entries`,
      });
    }
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

        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-condensed font-semibold text-sm flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  Danger Zone
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  Clear all availability data for all staff members (cannot be undone)
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleClearAllAvailability}
                disabled={isClearing}
              >
                {isClearing ? "Clearing..." : "Clear All Availability"}
              </Button>
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

            {debugInfo && (
              <Alert className="bg-muted/50">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <div className="font-semibold text-xs">Parsing Debug Info:</div>
                    <pre className="text-[9px] font-mono overflow-x-auto p-2 bg-background rounded max-h-[300px] overflow-y-auto whitespace-pre-wrap break-all">
{debugInfo}
                    </pre>
                    <div className="text-[10px] text-muted-foreground">
                      Full output also in browser console (F12)
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

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
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm font-mono">
                          <span className="text-muted-foreground">Progress</span>
                          <span className="font-semibold">{Math.round(importProgress)}%</span>
                        </div>
                        <Progress value={importProgress} className="h-3" />
                      </div>

                      <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="relative flex h-4 w-4">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-4 w-4 bg-primary"></span>
                          </div>
                          <span className="text-sm font-mono text-muted-foreground">Processing:</span>
                          <span className="text-sm font-semibold">{currentProcessingStaff}</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-green-500/10 border border-green-500/30 rounded p-2">
                            <div className="text-xs text-muted-foreground font-mono">Success</div>
                            <div className="text-2xl font-bold text-green-600">{importStats.success}</div>
                          </div>
                          
                          {importStats.skipped > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-2">
                              <div className="text-xs text-muted-foreground font-mono">Skipped</div>
                              <div className="text-2xl font-bold text-yellow-600">{importStats.skipped}</div>
                            </div>
                          )}
                          
                          {importStats.errors > 0 && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded p-2">
                              <div className="text-xs text-muted-foreground font-mono">Errors</div>
                              <div className="text-2xl font-bold text-red-600">{importStats.errors}</div>
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="text-xs text-center text-muted-foreground font-mono">
                        Importing {importedCount} of {parsedStaff.length} staff members...
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