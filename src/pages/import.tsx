import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/router";
import { Upload, CheckCircle2, AlertCircle, Users, Clock, Phone } from "lucide-react";
import { useSupabaseMutation } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import type { DayShiftPattern } from "@/types";

// Complete LENZIEMILL DAYSHIFT staff from spreadsheet (all pages)
const DAYSHIFT_STAFF = [
  // Page 1
  { name: "Alan Cameron", phone: "07825807946", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Alan Mckee", phone: "07851264966", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Alexander Brawley", phone: "07773404205", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Alistair Love", phone: "07791735738", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Andrew Jack", phone: "07788743387", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Andrew Smith", phone: "07707635035", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Angela Russell", phone: "07791735748", shift: "08:30-17:00" as DayShiftPattern },
  { name: "Ashley Aitken", phone: "07745086502", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Calum Burns", phone: "07470451009", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Calum Mccallum", phone: "07483321486", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Chris Mc Murray", phone: "07902503850", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Christopher Currie", phone: "07746257486", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Colin Docherty", phone: "07745088154", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Colin Smith", phone: "07706410028", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Craig Laidlaw", phone: "07745087706", shift: "06:00-14:30" as DayShiftPattern },
  { name: "David Arthur", phone: "07725476945", shift: "06:00-14:30" as DayShiftPattern },
  { name: "David Howie", phone: "07746257485", shift: "06:00-14:30" as DayShiftPattern },
  { name: "David Williams", phone: "07512373750", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Dean Gibson", phone: "07745086521", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Declan Higgins", phone: "07889093770", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Derek Allan", phone: "07706410042", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Donna Smith", phone: "07788522155", shift: "10:00-16:30" as DayShiftPattern },
  { name: "Emma Allan", phone: "07889093804", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Gary Bain", phone: "07889093796", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Gary Canning", phone: "07872605831", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Gary Gardiner", phone: "07706410029", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Graeme Baird", phone: "07729208488", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Graeme Bryson", phone: "07521388652", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Graeme Mcvey", phone: "07725476951", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Grant Duncan", phone: "07745088157", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Hannah Harty", phone: "07368461646", shift: "10:00-16:30" as DayShiftPattern },
  { name: "Harry Currie", phone: "07707635036", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Hugh Mcinnes", phone: "07707635021", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Hugh Mclean", phone: "07725476947", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Ian Bald", phone: "07791735749", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Ian Mccallum", phone: "07725476952", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jack Ferguson", phone: "07745088171", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jack Kirby", phone: "07889093800", shift: "06:00-14:30" as DayShiftPattern },
  { name: "James Arthur", phone: "07746257487", shift: "06:00-14:00" as DayShiftPattern },
  { name: "James Mcfarlane", phone: "07706410036", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jamie Burns", phone: "07889093792", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jamie Sneddon", phone: "07706410026", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jason Hendry", phone: "07745086504", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Joe Mclaren", phone: "07729208485", shift: "06:00-14:30" as DayShiftPattern },
  { name: "John Boag", phone: "07889093794", shift: "06:00-14:00" as DayShiftPattern },
  { name: "John Cairns", phone: "07791735742", shift: "06:00-14:00" as DayShiftPattern },
  { name: "John Clark", phone: "07745088149", shift: "06:00-14:00" as DayShiftPattern },
  { name: "John Logan", phone: "07745087708", shift: "06:00-14:30" as DayShiftPattern },
  { name: "John Mckay", phone: "07745088148", shift: "06:00-14:30" as DayShiftPattern },
  { name: "John Welsh", phone: "07788743384", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Jordan Love", phone: "07889093806", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Joseph Cairns", phone: "07889093802", shift: "06:00-14:00" as DayShiftPattern },
  
  // Page 2 continuation
  { name: "Keith Purves", phone: "07746257488", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Kevin Gourlay", phone: "07791735741", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Kevin Kerr", phone: "07791735747", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Lewis Stewart", phone: "07889093798", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Liam Brawley", phone: "07725476946", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Liam Gardiner", phone: "07889093799", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Marc Allan", phone: "07889093808", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Mark Aitken", phone: "07889093791", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Mark Docherty", phone: "07889093805", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Mark Miller", phone: "07707635022", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Martin Sharkey", phone: "07746257490", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Matthew Allan", phone: "07725476950", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Matthew Ferguson", phone: "07791735745", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Michael Anderson", phone: "07729208487", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Michael Docherty", phone: "07745088156", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Michael Kennedy", phone: "07745088158", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Michael Wallace", phone: "07706410040", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Nathan Love", phone: "07889093807", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Neil Mckay", phone: "07707635025", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Paul Anderson", phone: "07725476948", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Paul Boyle", phone: "07746257489", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Paul Mccallum", phone: "07745088155", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Paul Mckay", phone: "07745088165", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Paul Simpson", phone: "07706410027", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Peter Boyle", phone: "07745088151", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Peter Cameron", phone: "07745086503", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Philip Cameron", phone: "07791735744", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Raymond Love", phone: "07791735739", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Robert Jack", phone: "07889093795", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Robert Mccallum", phone: "07889093793", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Robert Murray", phone: "07745088163", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Ross Cameron", phone: "07791735746", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Ross Mclean", phone: "07745088150", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Ryan Docherty", phone: "07889093801", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Scott Bryson", phone: "07745088152", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Scott Cameron", phone: "07745088169", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Scott Love", phone: "07791735740", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Scott Mccartney", phone: "07706410039", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Scott Mcinnes", phone: "07706410030", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Scott Morrison", phone: "07745086505", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Scott Wallace", phone: "07707635024", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Sean Mckenzie", phone: "07707635023", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Shaun Baird", phone: "07745088159", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Stephen Mccallum", phone: "07745088153", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Stuart Cameron", phone: "07707635020", shift: "06:00-14:30" as DayShiftPattern },
  { name: "Stuart Mckay", phone: "07706410038", shift: "06:00-14:00" as DayShiftPattern },
  { name: "Thomas Docherty", phone: "07889093797", shift: "06:00-14:00" as DayShiftPattern },
  { name: "William Boyle", phone: "07745088162", shift: "06:00-14:30" as DayShiftPattern },
  { name: "William Logan", phone: "07706410041", shift: "06:00-14:00" as DayShiftPattern },
];

export default function ImportPage() {
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const createStaffMutation = useSupabaseMutation("staff", "insert");

  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;

    for (let i = 0; i < DAYSHIFT_STAFF.length; i++) {
      const staff = DAYSHIFT_STAFF[i];
      
      try {
        await createStaffMutation.mutateAsync({
          name: staff.name,
          trained_tasks: ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"],
          shift_start: staff.shift.split("-")[0],
          day_shift_pattern: staff.shift,
          shift_pattern: "All",
        } as any);
        
        successCount++;
        setImportedCount(successCount);
      } catch (error) {
        console.error(`Failed to import ${staff.name}:`, error);
      }

      setImportProgress(((i + 1) / DAYSHIFT_STAFF.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    setIsImporting(false);
    setImportComplete(true);
    toast({
      title: "Import complete",
      description: `Successfully imported ${successCount} of ${DAYSHIFT_STAFF.length} staff members`,
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-condensed font-bold text-4xl mb-2">Bulk Staff Import</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Import Lenziemill dayshift staff from spreadsheet
          </p>
        </div>

        <Alert>
          <Upload className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">
            <strong className="block mb-2">Ready to import {DAYSHIFT_STAFF.length} Lenziemill dayshift staff members</strong>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>All staff will be trained on all 6 tasks by default</li>
              <li>Shift patterns preserved from spreadsheet</li>
              <li>Phone numbers included for reference</li>
              <li>You can edit individual training and availability after import</li>
            </ul>
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed flex items-center gap-2">
              <Users className="h-5 w-5" />
              Staff Preview (First 10)
            </CardTitle>
            <CardDescription className="font-mono text-xs">
              Sample of staff to be imported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {DAYSHIFT_STAFF.slice(0, 10).map((staff, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="flex-1">
                  <div className="font-semibold">{staff.name}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="outline" className="font-mono text-xs">
                      <Phone className="h-3 w-3 mr-1" />
                      {staff.phone}
                    </Badge>
                    <Badge variant="secondary" className="font-mono text-xs">
                      <Clock className="h-3 w-3 mr-1" />
                      {staff.shift}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
            {DAYSHIFT_STAFF.length > 10 && (
              <div className="text-center text-muted-foreground font-mono text-xs pt-2">
                ... and {DAYSHIFT_STAFF.length - 10} more staff members
              </div>
            )}
          </CardContent>
        </Card>

        {!importComplete ? (
          <Card>
            <CardContent className="pt-6 space-y-4">
              {isImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm font-mono">
                    <span>Importing staff...</span>
                    <span>{importedCount} / {DAYSHIFT_STAFF.length}</span>
                  </div>
                  <Progress value={importProgress} />
                </div>
              )}
              
              <Button
                onClick={handleImport}
                disabled={isImporting}
                className="w-full"
                size="lg"
              >
                <Upload className="h-4 w-4 mr-2" />
                {isImporting ? "Importing..." : `Import ${DAYSHIFT_STAFF.length} Staff Members`}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-primary bg-primary/5">
            <CardContent className="pt-6 space-y-4">
              <div className="flex items-center gap-3 text-primary">
                <CheckCircle2 className="h-8 w-8" />
                <div>
                  <div className="font-semibold text-lg">Import Complete!</div>
                  <div className="text-sm text-muted-foreground font-mono">
                    Successfully imported {importedCount} staff members
                  </div>
                </div>
              </div>
              
              <Button
                onClick={() => router.push("/staff")}
                className="w-full"
                size="lg"
              >
                <Users className="h-4 w-4 mr-2" />
                Go to Staff Management
              </Button>
            </CardContent>
          </Card>
        )}

        <Alert variant="default">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-mono text-xs">
            <strong>After import:</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Edit individual staff to adjust task training</li>
              <li>Set rest days and holidays on the Staff page</li>
              <li>Configure shift patterns if needed</li>
              <li>Generate rotas to see the new staff in action</li>
            </ul>
          </AlertDescription>
        </Alert>
      </div>
    </Layout>
  );
}