import { useState, useCallback } from "react";
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
import type { AvailabilityType, StaffMember, ShiftStart, ShiftPattern } from "@/types";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

interface ParsedAvailability {
  date: string; // YYYY-MM-DD
  type: AvailabilityType;
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
  const [isDeletingStaff, setIsDeletingStaff] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const { data: existingStaff = [] } = useStaff();
  const createStaffMutation = useSupabaseMutation("staff", "insert");
  const createAvailabilityMutation = useSupabaseMutation("availability", "insert");
  const deleteAvailabilityMutation = useSupabaseMutation("availability", "delete");

  const handleDeleteAllStaff = async () => {
    if (!confirm("⚠️ This will DELETE ALL STAFF MEMBERS and their availability entries. This cannot be undone. Continue?")) {
      return;
    }

    if (!confirm("⚠️⚠️ FINAL WARNING: You are about to permanently delete ALL staff data. Type 'DELETE' in the next prompt to confirm.")) {
      return;
    }

    const confirmation = prompt("Type DELETE (all caps) to confirm:");
    if (confirmation !== "DELETE") {
      toast({
        title: "Cancelled",
        description: "Staff deletion cancelled",
      });
      return;
    }

    setIsDeletingStaff(true);
    try {
      // First delete all availability (foreign key constraint)
      const { error: availError } = await supabase
        .from('availability')
        .delete()
        .gte('created_at', '1970-01-01'); // Match all records
      
      if (availError) {
        throw new Error(`Failed to delete availability: ${availError.message}`);
      }

      // Then delete all staff
      const { error: staffError } = await supabase
        .from('staff')
        .delete()
        .gte('created_at', '1970-01-01'); // Match all records
      
      if (staffError) {
        throw new Error(`Failed to delete staff: ${staffError.message}`);
      }
      
      toast({
        title: "✓ Deleted all staff",
        description: "All staff members and their availability have been removed from the database",
      });

      // Reset import state
      setParsedStaff([]);
      setPasteText("");
      setDateRange("");
      setImportComplete(false);
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to delete staff data",
        variant: "destructive",
      });
    } finally {
      setIsDeletingStaff(false);
    }
  };

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

      // Always use 06:00 as default shift start
      // Database only allows: '06:00', '07:00', '08:00', '08:30', '09:00', '09:30', '10:00', '11:00'
      const validShiftStart: ShiftStart = "06:00";

      const endShort = endTime.substring(0, 5); // HH:MM
      const shift = `${validShiftStart}-${endShort}`;

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
            status = "rest";
          } else if (statusText === "HOLIDAY" || statusText === "HOL" || statusText === "H" || statusText.startsWith("HOLIDAY")) {
            status = "holiday";
          } else if (
            statusText === "SICK" || 
            statusText === "LEAVE" || 
            statusText === "ABSENT" || 
            statusText === "UNION" ||
            statusText === "S" ||
            statusText.startsWith("SICK") ||
            statusText.startsWith("LEAVE")
          ) {
            status = "sick";
          } else if (statusText === "IN" || statusText === "WORK" || statusText === "A" || statusText === "") {
            status = "available";
          } else {
            // Unknown status - log and default to available
            console.warn(`⚠️ Unknown status "${statusText}" on ${date} - defaulting to 'available'`);
            status = "available";
          }

          // Debug logging for first person, first 20 days
          if (newStaff.length === 0 && dcIdx < 20) {
            debugLines.push(`  Cell ${index} (${date}): "${rawCell}" → ${status}`);
          }

          // Store ALL days (including available) for preview purposes
          availability.push({ date, type: status });
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
        startTime: validShiftStart,
        endTime: endShort,
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
        sum + s.availability.filter(a => a.type !== "available").length, 0
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

  const parseExcelFile = useCallback(async (file: File) => {
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      console.log("📊 Excel rows:", rows.length);
      console.log("📋 First 3 rows:", rows.slice(0, 3));

      if (rows.length < 2) {
        throw new Error("Excel file must have at least a header row and one data row");
      }

      // Parse header row - format: "Sunday 28/12/2025", "Monday 29/12/2025", etc.
      const headerRow = rows[0];
      const dateColumns: { index: number; date: string }[] = [];

      console.log("🔍 Parsing header row:", headerRow);

      // Find date columns (start after Name, Start Time, End Time, Clock Number)
      for (let i = 4; i < headerRow.length; i++) {
        const cell = headerRow[i];
        if (typeof cell === "string" && cell.trim()) {
          // Extract date from "DayName DD/MM/YYYY" format
          const match = cell.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (match) {
            const [, day, month, year] = match;
            // Convert DD/MM/YYYY to YYYY-MM-DD
            const dateStr = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
            dateColumns.push({ index: i, date: dateStr });
          }
        }
      }

      console.log(`📅 Found ${dateColumns.length} date columns`);
      console.log("📅 Date range:", dateColumns[0]?.date, "to", dateColumns[dateColumns.length - 1]?.date);

      const newStaff: ParsedStaff[] = [];
      const matches = new Map<string, string>();

      // Parse staff rows
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];
        
        // Skip empty rows
        if (!row || !row[0] || typeof row[0] !== "string" || !row[0].trim()) {
          continue;
        }

        const staffName = row[0].trim();
        const startTimeRaw = row[1] || "06:00:00";
        const endTimeRaw = row[2] || "14:30:00";
        const clockNumber = row[3] || "";

        // Convert endTime to string if it's an Excel serial number
        const endTime = typeof endTimeRaw === "string" 
          ? endTimeRaw 
          : "14:30:00"; // Default if it's a number

        // Always use 06:00 as default shift start
        // Database only allows: '06:00', '07:00', '08:00', '08:30', '09:00', '09:30', '10:00', '11:00'
        // Excel shift times are unreliable - user can adjust individual times in Staff page
        const shiftStart: ShiftStart = "06:00";

        console.log(`👤 Parsing staff: ${staffName} (clock: ${clockNumber || 'none'}, shift: ${shiftStart})`);

        // Parse availability for each date column
        const staffAvailability: ParsedAvailability[] = [];
        
        dateColumns.forEach(({ index, date }) => {
          const cellValue = row[index];
          
          if (cellValue) {
            const status = (typeof cellValue === "string" ? cellValue : String(cellValue)).trim().toUpperCase();
            let availabilityType: AvailabilityType;

            // Map Excel status to database availability type
            // Database expects: 'rest', 'holiday', 'sick', 'available'
            if (status === "REST" || status === "R") {
              availabilityType = "rest";
            } else if (status === "HOLIDAY" || status === "HOL" || status === "H") {
              availabilityType = "holiday";
            } else if (status === "SICK" || status === "LEAVE" || status === "ABSENT" || status === "S") {
              availabilityType = "sick";
            } else if (status === "IN" || status === "AVAILABLE" || status === "A" || status === "") {
              // Default to available (IN, empty cells, etc.)
              availabilityType = "available";
            } else {
              // Unknown status - log it and default to available
              console.warn(`⚠️ Unknown status "${status}" for ${staffName} on ${date} - defaulting to 'available'`);
              availabilityType = "available";
            }

            staffAvailability.push({
              date,
              type: availabilityType,
            });
          } else {
            // Empty cell = available
            staffAvailability.push({
              date,
              type: "available",
            });
          }
        });

        console.log(`   📅 Parsed ${staffAvailability.length} availability entries for ${staffName}`);

        // Try to match with existing staff
        if (updateMode && existingStaff.length > 0) {
          const matchedExisting = existingStaff.find((s: StaffMember) => 
            s.name.toLowerCase().trim() === staffName.toLowerCase().trim()
          );
          if (matchedExisting) {
            matches.set(staffName, matchedExisting.id);
          }
        }

        // Add to parsed staff (same format as paste parser)
        newStaff.push({
          name: staffName,
          phone: clockNumber,
          startTime: shiftStart, // Now using valid ShiftStart value
          endTime: endTime.substring(0, 5),
          shift: `${shiftStart}-${endTime.substring(0, 5)}`,
          availability: staffAvailability,
        });
      }

      console.log(`✅ Parsed ${newStaff.length} staff members`);

      // Set the same state variables as paste parser
      setParsedStaff(newStaff);
      setMatchedStaff(matches);

      if (newStaff.length > 0 && dateColumns.length > 0) {
        const firstDate = dateColumns[0].date;
        const lastDate = dateColumns[dateColumns.length - 1].date;
        setDateRange(`${firstDate} to ${lastDate}`);

        const matchCount = matches.size;
        const unmatchedCount = newStaff.length - matchCount;
        const totalDays = dateColumns.length;
        
        // Count total unavailable days across all staff
        const totalUnavailableDays = newStaff.reduce((sum, s) => 
          sum + s.availability.filter(a => a.type !== "available").length, 0
        );

        toast({
          title: "File parsed successfully",
          description: updateMode 
            ? `Found ${newStaff.length} staff (${matchCount} matched, ${unmatchedCount} not found) - ${totalUnavailableDays} total unavailable days across ${totalDays} days`
            : `Found ${newStaff.length} staff with ${totalUnavailableDays} total unavailable days across ${totalDays} days`,
        });
      }
    } catch (error: any) {
      console.error("❌ Parse error:", error);
      toast({
        title: "Parse error",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [toast, updateMode, existingStaff]);

  const handleImport = async () => {
    if (parsedStaff.length === 0) return;
    
    // VERIFY AUTHENTICATION BEFORE IMPORT
    console.log("\n=== AUTHENTICATION CHECK ===");
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error("❌ NOT AUTHENTICATED:", authError);
      toast({
        title: "❌ Authentication Required",
        description: "You must be logged in to import data. Please refresh the page or log in again.",
        variant: "destructive",
      });
      return;
    }
    
    console.log("✅ AUTHENTICATED as:", user.email);
    console.log("   User ID:", user.id);
    
    // CRITICAL TEST: Try to write ONE availability record directly
    // BUT ONLY if we're in UPDATE MODE or staff already exist
    // In CREATE MODE with empty DB, we'll create staff first, then test won't be needed
    
    const { data: staffCount, error: countError } = await supabase
      .from('staff')
      .select('id', { count: 'exact', head: true });
    
    const hasExistingStaff = !countError && staffCount && (staffCount as any).count > 0;
    
    console.log("\n=== DATABASE STATE CHECK ===");
    console.log(`Existing staff in database: ${hasExistingStaff ? 'YES' : 'NO'}`);
    console.log(`Update mode: ${updateMode ? 'ON' : 'OFF'}`);
    
    if (!updateMode && !hasExistingStaff) {
      console.log("✓ CREATE MODE with empty database - will create staff first, then availability");
      console.log("  Skipping availability test - staff don't exist yet");
      
      // Skip the test - staff will be created during import
      setTestResult({
        success: true,
        message: "CREATE MODE - Staff will be created first, then availability",
        details: { mode: "create", staffCount: 0 }
      });
    } else {
      // Test availability writes ONLY if staff exist
      console.log("\n=== DIRECT DATABASE WRITE TEST ===");
      console.log("Testing if availability table accepts writes from your session...");
      
      // Get first staff member
      const firstStaff = await supabase
        .from('staff')
        .select('id, name')
        .limit(1)
        .single();
      
      if (firstStaff.error || !firstStaff.data) {
        toast({
          title: "❌ No staff found",
          description: "Import staff members first before importing availability",
          variant: "destructive",
        });
        return;
      }
      
      console.log("Using staff:", firstStaff.data.name, "(ID:", firstStaff.data.id, ")");
      
      // Try to insert a test availability record
      const testDate = '2026-06-01';
      const { data: testInsert, error: testError, count, status, statusText } = await supabase
        .from('availability')
        .insert({
          staff_id: firstStaff.data.id,
          date: testDate,
          type: 'rest'
        })
        .select()
        .single();
      
      console.log("Test insert result:");
      console.log("  - Status:", status, statusText);
      console.log("  - Data:", testInsert);
      console.log("  - Error:", testError);
      console.log("  - Count:", count);
      
      if (testError) {
        console.error("❌ TEST WRITE FAILED - This is why import fails!");
        console.error("Error code:", testError.code);
        console.error("Error message:", testError.message);
        console.error("Error details:", testError.details);
        console.error("Error hint:", testError.hint);
        
        // SET VISIBLE ERROR STATE
        setTestResult({
          success: false,
          message: testError.message,
          details: {
            code: testError.code,
            details: testError.details,
            hint: testError.hint,
          }
        });
        
        toast({
          title: "❌ Database Write Test Failed",
          description: `${testError.message} - See error panel below for details.`,
          variant: "destructive",
        });
        
        // Clean up test record if it somehow got through
        await supabase
          .from('availability')
          .delete()
          .eq('staff_id', firstStaff.data.id)
          .eq('date', testDate);
        
        return; // STOP - don't proceed with import
      }
      
      console.log("✅ TEST WRITE SUCCESSFUL - availability table is writable");
      console.log("   Test record created:", testInsert);
      
      // SET SUCCESS STATE
      setTestResult({
        success: true,
        message: "Availability table is writable - proceeding with import",
        details: testInsert
      });
      
      // Clean up test record
      await supabase
        .from('availability')
        .delete()
        .eq('staff_id', firstStaff.data.id)
        .eq('date', testDate);
      
      console.log("   Test record cleaned up");
      console.log("=== DATABASE IS READY FOR IMPORT ===\n");
    }
    
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

    // Process staff in batches for better performance
    const BATCH_SIZE = 500; // Process 500 availability records per batch

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
              shift_start: staff.startTime as ShiftStart, // Type cast to ShiftStart
              shift_pattern: "All" as ShiftPattern,
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
        
        // BATCH UPSERT availability entries for better performance
        let importedAvailCount = 0;
        let failedAvailCount = 0;
        
        // Only import non-available days (rest_day, holiday, sick)
        const unavailableDays = staff.availability.filter(a => a.type !== "available");
        
        console.log(`\n--- AVAILABILITY IMPORT ---`);
        console.log(`Staff ID being used: ${staffId}`);
        console.log(`Total availability entries: ${staff.availability.length}`);
        console.log(`Unavailable days (will import): ${unavailableDays.length}`);
        console.log(`  Rest: ${unavailableDays.filter(a => a.type === "rest").length}`);
        console.log(`  Holiday: ${unavailableDays.filter(a => a.type === "holiday").length}`);
        console.log(`  Sick: ${unavailableDays.filter(a => a.type === "sick").length}`);
        
        // Show first 5 unavailable days for debugging
        if (unavailableDays.length > 0) {
          console.log(`\nFirst 5 unavailable days to import:`);
          unavailableDays.slice(0, 5).forEach((avail, idx) => {
            console.log(`  ${idx + 1}. ${avail.date} = ${avail.type.toUpperCase()}`);
          });
        }
        
        // Process in batches of BATCH_SIZE for efficiency
        const batches = [];
        for (let j = 0; j < unavailableDays.length; j += BATCH_SIZE) {
          batches.push(unavailableDays.slice(j, j + BATCH_SIZE));
        }
        
        console.log(`\nProcessing ${batches.length} batch(es) of up to ${BATCH_SIZE} records each...`);
        
        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
          const batch = batches[batchIndex];
          
          // Prepare batch data with correct type values
          const batchData = batch.map(avail => ({
            staff_id: staffId,
            date: avail.date,
            type: avail.type, // Now using 'rest', 'holiday', 'sick'
          }));
          
          // Debug: log the first batch data structure
          if (batchIndex === 0) {
            console.log(`\n📦 First batch structure (${batchData.length} records):`);
            console.log(JSON.stringify(batchData.slice(0, 3), null, 2));
            
            // CRITICAL: Check the EXACT type values being sent
            console.log(`\n🔍 CRITICAL TYPE VALUE INSPECTION:`);
            batchData.slice(0, 5).forEach((record, idx) => {
              console.log(`Record ${idx + 1}:`);
              console.log(`  staff_id: "${record.staff_id}" (type: ${typeof record.staff_id})`);
              console.log(`  date: "${record.date}" (type: ${typeof record.date})`);
              console.log(`  type: "${record.type}" (type: ${typeof record.type})`);
              console.log(`  type length: ${record.type.length}`);
              console.log(`  type char codes: ${Array.from(String(record.type)).map(c => c.charCodeAt(0)).join(', ')}`);
              console.log(`  exact match test:`);
              console.log(`    === "rest": ${record.type === "rest"}`);
              console.log(`    === "holiday": ${record.type === "holiday"}`);
              console.log(`    === "sick": ${record.type === "sick"}`);
              console.log(`    === "available": ${record.type === "available"}`);
              
              // Check for hidden characters or encoding issues
              const validTypes = ['rest', 'holiday', 'sick', 'available'];
              if (!validTypes.includes(record.type)) {
                console.error(`❌ INVALID TYPE DETECTED: "${record.type}"`);
                console.error(`   This value will be REJECTED by database constraint!`);
                console.error(`   Allowed values: ${validTypes.join(', ')}`);
              }
            });
          }
          
          try {
            // BULK UPSERT: Insert or update all records in one query
            const { error: batchError, count, status, statusText } = await supabase
              .from('availability')
              .upsert(batchData, {
                onConflict: 'staff_id,date',
                count: 'exact'
              });
            
            // Log FULL response details
            console.log(`\n📊 Batch ${batchIndex + 1} response:`);
            console.log(`  - Status: ${status} ${statusText || ''}`);
            console.log(`  - Count: ${count}`);
            console.log(`  - Error: ${batchError ? JSON.stringify(batchError) : 'null'}`);
            
            if (batchError) {
              console.error(`❌ Batch ${batchIndex + 1} failed:`, batchError);
              failedAvailCount += batch.length;
              errors.push(`${staff.name} batch ${batchIndex + 1}: ${batchError.message}`);
            } else if (count === 0 || count === null) {
              // Silent failure - no error but also no records saved
              console.error(`❌ Batch ${batchIndex + 1} SILENT FAILURE: No error returned but count = ${count}`);
              console.error(`   This usually means RLS policy is blocking the insert`);
              failedAvailCount += batch.length;
              errors.push(`${staff.name} batch ${batchIndex + 1}: Silent failure (RLS policy blocking?)`);
            } else {
              importedAvailCount += batch.length;
              console.log(`  ✓ Batch ${batchIndex + 1}/${batches.length}: ${batch.length} records upserted`);
            }
          } catch (error: any) {
            console.error(`❌ Batch ${batchIndex + 1} exception:`, error);
            console.error(`   Error details:`, JSON.stringify(error, null, 2));
            failedAvailCount += batch.length;
            errors.push(`${staff.name} batch ${batchIndex + 1}: ${error.message}`);
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
      
      // Small delay every 10 staff to prevent overwhelming the database
      if ((i + 1) % 10 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
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
    console.log(`Performance: ~${Math.round(parsedStaff.length / ((Date.now() - performance.now()) / 1000))} staff/sec`);
    
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
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-1 mb-4">
              <div className="font-condensed font-semibold text-sm flex items-center gap-2 text-destructive">
                <AlertCircle className="h-4 w-4" />
                Danger Zone
              </div>
              <p className="text-xs text-muted-foreground font-mono">
                Permanent deletions - these actions cannot be undone
              </p>
            </div>

            <div className="flex items-center justify-between border-b border-destructive/20 pb-4">
              <div className="space-y-1">
                <div className="font-semibold text-sm">Delete All Staff</div>
                <p className="text-xs text-muted-foreground font-mono">
                  Removes all staff members and their availability data
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleDeleteAllStaff}
                disabled={isDeletingStaff}
                size="sm"
              >
                {isDeletingStaff ? "Deleting..." : "Delete All Staff"}
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="font-semibold text-sm">Clear All Availability</div>
                <p className="text-xs text-muted-foreground font-mono">
                  Removes availability data but keeps staff members
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={handleClearAllAvailability}
                disabled={isClearing}
                size="sm"
              >
                {isClearing ? "Clearing..." : "Clear Availability"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {testResult && (
          <Alert className={testResult.success ? "border-green-500 bg-green-500/10" : "border-destructive bg-destructive/10"}>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-3">
                <div className="font-semibold text-sm flex items-center gap-2">
                  {testResult.success ? "✅ Database Write Test: PASSED" : "❌ Database Write Test: FAILED"}
                </div>
                
                <div className="text-xs font-mono bg-background/50 p-3 rounded">
                  <div className="font-semibold mb-2">Error Message:</div>
                  <div className="text-destructive">{testResult.message}</div>
                </div>

                {testResult.details && !testResult.success && (
                  <div className="text-xs font-mono bg-background/50 p-3 rounded space-y-2">
                    <div className="font-semibold">Technical Details:</div>
                    {testResult.details.code && <div>Code: {testResult.details.code}</div>}
                    {testResult.details.details && <div>Details: {testResult.details.details}</div>}
                    {testResult.details.hint && <div>Hint: {testResult.details.hint}</div>}
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  {testResult.success 
                    ? "Availability writes are working - you can proceed with import"
                    : "⚠️ SCREENSHOT THIS ERROR and send it to get help fixing the issue"
                  }
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground font-mono">
                  Or upload Excel file
                </span>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="font-condensed flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Upload Excel File
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Upload .xlsx file with staff names and availability dates
                </CardDescription>
              </CardHeader>
              <CardContent>
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer bg-muted/10 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <Upload className="w-8 h-8 mb-2 text-muted-foreground" />
                    <p className="mb-2 text-sm text-muted-foreground font-mono">
                      <span className="font-semibold">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">.xlsx files only</p>
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        parseExcelFile(file);
                      }
                    }}
                  />
                </label>
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
                          const unavailableDays = staff.availability.filter(a => a.type !== "available");
                          const restDays = unavailableDays.filter(a => a.type === "rest").length;
                          const holidayDays = unavailableDays.filter(a => a.type === "holiday").length;
                          const sickDays = unavailableDays.filter(a => a.type === "sick").length;
                          
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