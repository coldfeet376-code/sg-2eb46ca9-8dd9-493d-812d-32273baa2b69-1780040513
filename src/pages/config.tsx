import { useState, useEffect, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { SEO } from "@/components/SEO";
import { useTaskConfig, useUpdateTaskConfig } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import { AlertCircle, RefreshCw, CheckCircle, Save } from "lucide-react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling", "Equipment"];

interface TaskConfig {
  [task: string]: number[];
}

export default function ConfigPage() {
  const { toast } = useToast();

  // React Query hooks - cached data
  const { data: taskConfig, isLoading, error } = useTaskConfig();
  const updateConfigMutation = useUpdateTaskConfig();
  
  // Local editable state
  const [editableConfig, setEditableConfig] = useState<TaskConfig>({
    Frozen: [0, 0, 0, 0, 0, 0, 0],
    Milk: [0, 0, 0, 0, 0, 0, 0],
    TWI: [0, 0, 0, 0, 0, 0, 0],
    Inbound: [0, 0, 0, 0, 0, 0, 0],
    Outbound: [0, 0, 0, 0, 0, 0, 0],
    Marshaling: [0, 0, 0, 0, 0, 0, 0],
    Equipment: [0, 0, 0, 0, 0, 0, 0],
  });

  // Sync taskConfig from React Query to local editable state
  useEffect(() => {
    if (taskConfig) {
      setEditableConfig(taskConfig);
    }
  }, [taskConfig]);

  const handleConfigChange = (task: string, dayIndex: number, value: string) => {
    const newConfig = { ...editableConfig };
    newConfig[task] = [...(newConfig[task] || [0, 0, 0, 0, 0, 0, 0])];
    newConfig[task][dayIndex] = parseInt(value) || 0;
    setEditableConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    updateConfigMutation.mutate(editableConfig, {
      onSuccess: () => {
        toast({
          title: "Configuration saved",
          description: "Task requirements updated successfully",
        });
      },
      onError: (err) => {
        console.error("Error saving task config:", err);
        toast({
          title: "Error",
          description: "Failed to save configuration",
          variant: "destructive",
        });
      },
    });
  };

  const hasChanges = useMemo(() => {
    if (!taskConfig) return false;
    return JSON.stringify(editableConfig) !== JSON.stringify(taskConfig);
  }, [editableConfig, taskConfig]);

  const saving = updateConfigMutation.isPending;

  return (
    <Layout>
      <SEO
        title="Task Configuration - Warehouse Rota"
        description="Configure daily task requirements for warehouse operations"
      />
      
      <div className="space-y-8 pb-20">
        <div className="space-y-3">
          <h1 className="font-condensed text-3xl font-bold tracking-tight">
            Task Configuration
          </h1>
          <p className="text-base text-muted-foreground font-mono">
            Set how many staff you need for each task on each day of the week
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-primary"></div>
              Enter 0 if task not needed that day
            </span>
            <span className="flex items-center gap-1.5 bg-muted/50 px-2 py-1 rounded-md">
              <div className="w-2 h-2 rounded-full bg-accent"></div>
              Numbers show staff count required
            </span>
          </div>
        </div>

        {error && (
          <Alert className="bg-destructive/10 border-destructive">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <h3 className="font-condensed font-semibold text-destructive mb-2">
                Error Loading Configuration
              </h3>
              <p className="text-sm text-destructive/90 font-mono">
                {error instanceof Error ? error.message : "Unknown error occurred"}
              </p>
            </div>
          </Alert>
        )}

        <div className="space-y-6">
          {TASKS.map((task) => (
            <Card key={task} className="border-l-4 border-l-primary/30 shadow-sm hover:shadow-md transition-all hover:border-l-primary">
              <CardHeader className="pb-4">
                <h3 className="font-condensed text-lg font-bold text-foreground flex items-center gap-2">
                  <div className="w-1.5 h-6 rounded-full bg-primary"></div>
                  {task}
                </h3>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
                  {DAYS.map((day, dayIndex) => (
                    <div key={dayIndex} className="space-y-2">
                      <label className="text-sm font-mono font-semibold text-muted-foreground flex items-center justify-center">
                        {day}
                      </label>
                      <Input
                        type="number"
                        min="0"
                        max="20"
                        value={editableConfig[task]?.[dayIndex] ?? 0}
                        onChange={(e) => handleConfigChange(task, dayIndex, e.target.value)}
                        className="font-mono text-base text-center tabular-nums h-12 border-2 focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm bg-background"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 md:pl-64 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4 border-t flex flex-col sm:flex-row justify-between items-center gap-4 z-50">
          <div className="text-sm font-mono text-muted-foreground w-full sm:w-auto text-center sm:text-left">
            {hasChanges ? (
              <span className="text-warning flex items-center justify-center sm:justify-start gap-2">
                <AlertCircle className="h-4 w-4" />
                You have unsaved changes
              </span>
            ) : (
              <span className="text-success flex items-center justify-center sm:justify-start gap-2">
                <CheckCircle className="h-4 w-4" />
                All changes saved
              </span>
            )}
          </div>
          <Button
            onClick={handleSaveConfig}
            disabled={saving || !hasChanges}
            size="lg"
            className="gap-2 rounded-lg shadow-md hover:shadow-lg transition-all font-condensed text-base px-8 w-full sm:w-auto"
          >
            {saving ? (
              <>
                <RefreshCw className="h-5 w-5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>Save Configuration</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
}