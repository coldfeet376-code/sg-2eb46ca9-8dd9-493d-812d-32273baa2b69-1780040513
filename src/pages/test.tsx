import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function TestPage() {
  const [results, setResults] = useState({
    envVarsLoaded: false,
    supabaseUrl: "",
    supabaseKeyPrefix: "",
    connectionTest: "pending" as "pending" | "success" | "error",
    connectionError: "",
    dataFetchTest: "pending" as "pending" | "success" | "error",
    dataFetchError: "",
    staffCount: 0,
  });

  useEffect(() => {
    runDiagnostics();
  }, []);

  const runDiagnostics = async () => {
    const newResults = { ...results };

    // Test 1: Check environment variables
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
    
    newResults.envVarsLoaded = !!(url && key);
    newResults.supabaseUrl = url;
    newResults.supabaseKeyPrefix = key ? key.substring(0, 20) + "..." : "MISSING";

    // Test 2: Test basic connection
    try {
      const { error } = await supabase.from("staff").select("count", { count: "exact", head: true });
      if (error) {
        newResults.connectionTest = "error";
        newResults.connectionError = error.message;
      } else {
        newResults.connectionTest = "success";
      }
    } catch (err: any) {
      newResults.connectionTest = "error";
      newResults.connectionError = err.message || "Unknown connection error";
    }

    // Test 3: Try to fetch actual data
    try {
      const { data, error } = await supabase
        .from("staff")
        .select("id")
        .limit(10);
      
      if (error) {
        newResults.dataFetchTest = "error";
        newResults.dataFetchError = error.message;
      } else {
        newResults.dataFetchTest = "success";
        newResults.staffCount = data?.length || 0;
      }
    } catch (err: any) {
      newResults.dataFetchTest = "error";
      newResults.dataFetchError = err.message || "Unknown data fetch error";
    }

    setResults(newResults);
  };

  const TestResult = ({ 
    title, 
    status, 
    message 
  }: { 
    title: string; 
    status: "pending" | "success" | "error"; 
    message: string;
  }) => {
    const Icon = status === "success" ? CheckCircle : status === "error" ? XCircle : AlertCircle;
    const color = status === "success" ? "text-green-500" : status === "error" ? "text-red-500" : "text-yellow-500";

    return (
      <div className="flex items-start gap-3 p-4 border rounded-lg">
        <Icon className={`h-5 w-5 mt-0.5 ${color}`} />
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          <div className="text-sm text-muted-foreground mt-1">{message}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Supabase Connection Diagnostics
            </CardTitle>
            <CardDescription>
              Testing connection to Supabase and data access
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <TestResult
              title="Environment Variables"
              status={results.envVarsLoaded ? "success" : "error"}
              message={
                results.envVarsLoaded
                  ? `✓ Loaded successfully\nURL: ${results.supabaseUrl}\nKey: ${results.supabaseKeyPrefix}`
                  : "✗ Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
              }
            />

            <TestResult
              title="Supabase Connection"
              status={results.connectionTest}
              message={
                results.connectionTest === "success"
                  ? "✓ Successfully connected to Supabase"
                  : results.connectionTest === "error"
                  ? `✗ Connection failed: ${results.connectionError}`
                  : "⏳ Testing connection..."
              }
            />

            <TestResult
              title="Data Fetch Test"
              status={results.dataFetchTest}
              message={
                results.dataFetchTest === "success"
                  ? `✓ Successfully fetched data (${results.staffCount} staff members found)`
                  : results.dataFetchTest === "error"
                  ? `✗ Data fetch failed: ${results.dataFetchError}`
                  : "⏳ Testing data fetch..."
              }
            />

            <div className="pt-4 space-y-2 border-t">
              <h3 className="font-semibold">Current Configuration</h3>
              <div className="grid gap-2 text-sm font-mono">
                <div>
                  <Badge variant="outline">URL</Badge>
                  <span className="ml-2">{results.supabaseUrl || "Not loaded"}</span>
                </div>
                <div>
                  <Badge variant="outline">Key Prefix</Badge>
                  <span className="ml-2">{results.supabaseKeyPrefix}</span>
                </div>
                <div>
                  <Badge variant="outline">Browser</Badge>
                  <span className="ml-2">{typeof window !== "undefined" ? "Client Side" : "Server Side"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Next Steps</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!results.envVarsLoaded && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                <strong>Action Required:</strong> Environment variables are missing. Add them in Vercel:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                </ul>
              </div>
            )}
            
            {results.connectionTest === "error" && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded">
                <strong>Connection Issue:</strong> The app can't reach Supabase. This could be:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Wrong Supabase URL</li>
                  <li>Wrong API key</li>
                  <li>Network/CORS issue</li>
                  <li>Supabase project paused or deleted</li>
                </ul>
              </div>
            )}

            {results.dataFetchTest === "error" && results.connectionTest === "success" && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded">
                <strong>Data Access Issue:</strong> Connected to Supabase but can't fetch data:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  <li>Row Level Security (RLS) may be blocking access</li>
                  <li>Tables may not exist yet</li>
                  <li>No data in the database</li>
                </ul>
              </div>
            )}

            {results.dataFetchTest === "success" && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded">
                <strong>✓ All Good!</strong> Supabase is connected and working. Your app should load data correctly.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}