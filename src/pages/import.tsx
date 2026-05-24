import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/router";
import { Upload, CheckCircle2, AlertCircle, Users, Clock, Phone, FileText } from "lucide-react";
import { useSupabaseMutation } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import type { DayShiftPattern } from "@/types";

interface ParsedStaff {
  name: string;
  phone: string;
  shift: string;
}

export default function ImportPage() {
  const [pasteText, setPasteText] = useState("");
  const [parsedStaff, setParsedStaff] = useState<ParsedStaff[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importComplete, setImportComplete] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const router = useRouter();
  const { toast } = useToast();

  const createStaffMutation = useSupabaseMutation("staff", "insert");

  const handleParsePaste = () => {
    const lines = pasteText.split('\n');
    const newStaff: ParsedStaff[] = [];
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      // Look for shift pattern HH:MM-HH:MM
      const shiftMatch = line.match(/\b\d{2}:\d{2}-\d{2}:\d{2}\b/);
      
      if (shiftMatch) {
        // Look for phone number (optional) - standard UK mobile format 07...
        const phoneMatch = line.match(/\b07\d{8,9}\b/);
        
        let name = line;
        // Remove shift and phone from name
        name = name.replace(shiftMatch[0], '');
        if (phoneMatch) name = name.replace(phoneMatch[0], '');
        
        // Remove typical status words
        name = name.replace(/\b(IN|REST|Holiday|Sick|Union|Absent|Lenziemill|Westfield|Dayshift|Nightshift)\b/gi, '');
        
        // Clean up name by removing numbers, special chars, and extra spaces
        name = name.replace(/[0-9]/g, ''); 
        name = name.replace(/[^\w\s-]/g, '');
        name = name.trim().replace(/\s+/g, ' ');
        
        if (name.length > 2) {
          newStaff.push({
            name,
            phone: phoneMatch ? phoneMatch[0] : "",
            shift: shiftMatch[0]
          });
        }
      }
    }
    
    setParsedStaff(newStaff);
    
    if (newStaff.length > 0) {
      toast({
        title: "Data parsed successfully",
        description: `Found ${newStaff.length} staff members from pasted text.`,
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
    if (parsedStaff.length === 0) return;
    
    setIsImporting(true);
    setImportProgress(0);
    let successCount = 0;

    for (let i = 0; i < parsedStaff.length; i++) {
      const staff = parsedStaff[i];
      
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

      setImportProgress(((i + 1) / parsedStaff.length) * 100);
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    setIsImporting(false);
    setImportComplete(true);
    toast({
      title: "Import complete",
      description: `Successfully imported ${successCount} of ${parsedStaff.length} staff members`,
    });
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="font-condensed font-bold text-4xl mb-2">Smart Data Importer</h1>
          <p className="text-muted-foreground font-mono text-sm">
            Paste rows directly from your rota spreadsheet to import staff
          </p>
        </div>

        {!importComplete ? (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="font-condensed flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Paste Spreadsheet Data
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Copy rows from your spreadsheet (Excel, PDF, or Google Sheets) and paste them below. 
                  The system will automatically find names, phone numbers, and shift times (like 06:00-14:30).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea 
                  placeholder="Paste rows here... e.g. John Doe 07123456789 06:00-14:30 IN IN REST..."
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
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {parsedStaff.map((staff, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2 border rounded bg-muted/30">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">{staff.name}</div>
                          <div className="flex items-center gap-2 mt-1">
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
                      </div>
                    ))}
                  </div>

                  {isImporting && (
                    <div className="space-y-2 pt-4 border-t">
                      <div className="flex justify-between text-xs font-mono">
                        <span>Importing to database...</span>
                        <span>{importedCount} / {parsedStaff.length}</span>
                      </div>
                      <Progress value={importProgress} />
                    </div>
                  )}
                  
                  <Button
                    onClick={handleImport}
                    disabled={isImporting}
                    className="w-full mt-4"
                    size="lg"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? "Importing..." : `Finalize Import of ${parsedStaff.length} Staff`}
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
                    Successfully saved {importedCount} staff members.
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