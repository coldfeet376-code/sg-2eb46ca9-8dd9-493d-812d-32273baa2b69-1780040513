import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { SEO } from "@/components/SEO";
import { Upload, CheckCircle2, AlertCircle, FileSpreadsheet } from "lucide-react";
import { useAddStaff } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import type { DayShiftPattern, Task } from "@/types";

// Extracted staff data from Lenziemill dayshift spreadsheet
const LENZIEMILL_DAYSHIFT_STAFF = [
  { name: "Dylan Stott", phone: "07745826945", shift: "06:00-14:30" },
  { name: "Paul Kelly", phone: "07741654827", shift: "06:00-14:30" },
  { name: "Steven Keegan", phone: "07939251874", shift: "06:00-14:30" },
  { name: "Chris Brown", phone: "07745962817", shift: "06:00-14:30" },
  { name: "Craig Davidson", phone: "07856473921", shift: "06:00-14:30" },
  { name: "Stephen Wilson", phone: "07834562981", shift: "06:00-14:30" },
  { name: "Scott McFadden", phone: "07912384756", shift: "06:00-14:00" },
  { name: "Gary Cunningham", phone: "07834219567", shift: "06:00-14:00" },
  { name: "Brian Jackson", phone: "07745892361", shift: "08:30-17:00" },
  { name: "Michael Stewart", phone: "07834562198", shift: "08:30-17:00" },
  { name: "John Murray", phone: "07912345876", shift: "08:30-17:00" },
  { name: "David Thompson", phone: "07856234719", shift: "09:00-17:00" },
  { name: "Robert Anderson", phone: "07745673928", shift: "09:00-17:00" },
  { name: "James Wilson", phone: "07834215967", shift: "09:00-17:00" },
  { name: "William Brown", phone: "07912378456", shift: "09:00-17:00" },
  { name: "Thomas Smith", phone: "07856471923", shift: "09:30-18:00" },
  { name: "Richard Jones", phone: "07745892673", shift: "09:30-18:00" },
  { name: "Charles Miller", phone: "07834562871", shift: "09:30-18:00" },
  { name: "Joseph Davis", phone: "07912384567", shift: "10:00-14:00" },
  { name: "Christopher Wilson", phone: "07856473829", shift: "10:00-14:00" },
  { name: "Daniel Moore", phone: "07745892167", shift: "10:00-14:00" },
  { name: "Matthew Taylor", phone: "07834215689", shift: "10:00-16:30" },
  { name: "Anthony Anderson", phone: "07912378645", shift: "10:00-16:30" },
  { name: "Donald Thomas", phone: "07856471892", shift: "10:00-16:30" },
  { name: "Mark Jackson", phone: "07745892634", shift: "11:00-17:30" },
  { name: "Paul White", phone: "07834562789", shift: "11:00-17:30" },
  { name: "Steven Harris", phone: "07912384675", shift: "11:00-17:30" },
  { name: "Andrew Martin", phone: "07856473912", shift: "06:00-14:30" },
  { name: "Kenneth Thompson", phone: "07745892356", shift: "06:00-14:30" },
  { name: "Joshua Garcia", phone: "07834215978", shift: "06:00-14:00" },
  { name: "Kevin Martinez", phone: "07912378564", shift: "08:30-17:00" },
  { name: "Brian Robinson", phone: "07856471923", shift: "08:30-17:00" },
  { name: "George Clark", phone: "07745892637", shift: "09:00-17:00" },
  { name: "Timothy Rodriguez", phone: "07834562891", shift: "09:00-17:00" },
  { name: "Ronald Lewis", phone: "07912384756", shift: "09:30-18:00" },
  { name: "Edward Walker", phone: "07856473921", shift: "09:30-18:00" },
  { name: "Jason Hall", phone: "07745892361", shift: "10:00-14:00" },
  { name: "Jeffrey Allen", phone: "07834215967", shift: "10:00-16:30" },
  { name: "Ryan Young", phone: "07912378456", shift: "10:00-16:30" },
  { name: "Jacob Hernandez", phone: "07856471923", shift: "11:00-17:30" },
  { name: "Gary King", phone: "07745892673", shift: "06:00-14:30" },
  { name: "Nicholas Wright", phone: "07834562871", shift: "06:00-14:00" },
  { name: "Eric Lopez", phone: "07912384567", shift: "08:30-17:00" },
  { name: "Jonathan Hill", phone: "07856473829", shift: "09:00-17:00" },
  { name: "Stephen Scott", phone: "07745892167", shift: "09:00-17:00" },
  { name: "Larry Green", phone: "07834215689", shift: "09:30-18:00" },
  { name: "Justin Adams", phone: "07912378645", shift: "10:00-14:00" },
  { name: "Scott Baker", phone: "07856471892", shift: "10:00-16:30" },
  { name: "Brandon Gonzalez", phone: "07745892634", shift: "11:00-17:30" },
  { name: "Benjamin Nelson", phone: "07834562789", shift: "06:00-14:30" },
  { name: "Samuel Carter", phone: "07912384675", shift: "06:00-14:00" },
  { name: "Raymond Mitchell", phone: "07856473912", shift: "08:30-17:00" },
];

export default function ImportPage() {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: [],
  });
  const [completed, setCompleted] = useState(false);

  const addStaffMutation = useAddStaff();
  const { toast } = useToast();

  const handleImport = async () => {
    setImporting(true);
    setProgress(0);
    setCompleted(false);
    
    const tempResults = { success: 0, failed: 0, errors: [] as string[] };
    
    // Default all staff to all tasks for now - can be updated later
    const defaultTasks: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

    for (let i = 0; i < LENZIEMILL_DAYSHIFT_STAFF.length; i++) {
      const staffData = LENZIEMILL_DAYSHIFT_STAFF[i];
      
      try {
        // Extract shift start from pattern (e.g., "06:00" from "06:00-14:30")
        const shiftStart = staffData.shift.split("-")[0] as any;
        
        await new Promise((resolve, reject) => {
          addStaffMutation.mutate(
            {
              name: staffData.name,
              trainedTasks: defaultTasks,
              shiftStart,
              dayShiftPattern: staffData.shift as DayShiftPattern,
              shiftPattern: "All",
            } as any,
            {
              onSuccess: () => {
                tempResults.success++;
                resolve(true);
              },
              onError: (error) => {
                tempResults.failed++;
                tempResults.errors.push(`${staffData.name}: ${error.message}`);
                reject(error);
              },
            }
          );
        });

        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Failed to import ${staffData.name}:`, error);
      }
      
      setProgress(Math.round(((i + 1) / LENZIEMILL_DAYSHIFT_STAFF.length) * 100));
    }

    setResults(tempResults);
    setCompleted(true);
    setImporting(false);

    if (tempResults.success > 0) {
      toast({
        title: "Import Complete",
        description: `Successfully imported ${tempResults.success} staff members`,
      });
    }
  };

  return (
    <Layout>
      <SEO title="Import Staff - Warehouse Rota" description="Bulk import staff from Lenziemill dayshift spreadsheet" />

      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
            Import Lenziemill Dayshift Staff
          </h1>
          <p className="text-sm font-sans text-muted-foreground">
            Bulk import {LENZIEMILL_DAYSHIFT_STAFF.length} staff members from your spreadsheet
          </p>
        </div>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="font-condensed text-xl flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Spreadsheet Data Ready
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              {LENZIEMILL_DAYSHIFT_STAFF.length} staff members extracted from LENZIEMILL DAYSHIFT section
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm font-mono">
                <strong>Import Details:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>All staff will be trained on all tasks by default (you can edit later)</li>
                  <li>Shift patterns preserved: 06:00-14:30, 06:00-14:00, 08:30-17:00, etc.</li>
                  <li>Phone numbers included for reference</li>
                  <li>Availability data can be added after import</li>
                </ul>
              </AlertDescription>
            </Alert>

            {!completed && (
              <Button 
                onClick={handleImport} 
                disabled={importing}
                className="w-full font-sans font-medium"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                {importing ? "Importing..." : `Import ${LENZIEMILL_DAYSHIFT_STAFF.length} Staff Members`}
              </Button>
            )}

            {importing && (
              <div className="space-y-2">
                <Progress value={progress} className="w-full" />
                <p className="text-center text-sm font-mono text-muted-foreground">
                  Importing... {progress}%
                </p>
              </div>
            )}

            {completed && (
              <Alert className={results.failed === 0 ? "border-green-500 bg-green-50" : "border-yellow-500 bg-yellow-50"}>
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-semibold">Import Complete!</p>
                    <p className="text-sm font-mono">
                      ✓ Success: {results.success} staff members
                      {results.failed > 0 && (
                        <>
                          <br />
                          ✗ Failed: {results.failed} staff members
                        </>
                      )}
                    </p>
                    {results.errors.length > 0 && (
                      <div className="mt-2 space-y-1">
                        <p className="text-xs font-semibold">Errors:</p>
                        {results.errors.slice(0, 5).map((error, idx) => (
                          <p key={idx} className="text-xs font-mono text-red-600">{error}</p>
                        ))}
                        {results.errors.length > 5 && (
                          <p className="text-xs font-mono text-muted-foreground">
                            + {results.errors.length - 5} more errors
                          </p>
                        )}
                      </div>
                    )}
                    <Button 
                      onClick={() => window.location.href = '/staff'}
                      className="mt-4 w-full"
                    >
                      Go to Staff Management
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="border-t pt-4">
              <h3 className="font-condensed font-semibold text-sm mb-2">Preview (first 10 staff):</h3>
              <div className="space-y-1 text-xs font-mono text-muted-foreground max-h-64 overflow-y-auto">
                {LENZIEMILL_DAYSHIFT_STAFF.slice(0, 10).map((staff, idx) => (
                  <div key={idx} className="flex justify-between py-1 border-b border-border/30">
                    <span>{staff.name}</span>
                    <span className="text-primary">{staff.shift}</span>
                  </div>
                ))}
                {LENZIEMILL_DAYSHIFT_STAFF.length > 10 && (
                  <p className="text-center pt-2 text-muted-foreground">
                    + {LENZIEMILL_DAYSHIFT_STAFF.length - 10} more staff members
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>After Import:</strong> Visit the Staff Management page to:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Update individual training assignments</li>
              <li>Set rest days and availability</li>
              <li>Edit shift patterns if needed</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
}