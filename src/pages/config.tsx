import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";
import { useTaskConfig, useUpdateTaskConfig } from "@/hooks/useSupabaseQueries";
import { useToast } from "@/hooks/use-toast";
import { Save, Upload, Trash2, AlertCircle, FileText, RefreshCw, CheckCircle } from "lucide-react";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

interface TaskConfig {
  [task: string]: number[];
}

interface ConfigTemplate {
  id: string;
  name: string;
  config: TaskConfig;
  createdAt: number;
}

export default function ConfigPage() {
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const { toast } = useToast();

  // React Query hooks - cached data
  const { data: taskConfig, isLoading } = useTaskConfig();
  const updateConfigMutation = useUpdateTaskConfig();
  
  // Local editable state
  const [editableConfig, setEditableConfig] = useState<TaskConfig>({
    Frozen: [0, 0, 0, 0, 0, 0, 0],
    Milk: [0, 0, 0, 0, 0, 0, 0],
    TWI: [0, 0, 0, 0, 0, 0, 0],
    Inbound: [0, 0, 0, 0, 0, 0, 0],
    Outbound: [0, 0, 0, 0, 0, 0, 0],
    Marshaling: [0, 0, 0, 0, 0, 0, 0],
  });

  useEffect(() => {
    const savedTemplates = localStorage.getItem("warehouse-config-templates");
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    }
  }, []);

  // Sync taskConfig from React Query to local editable state
  useEffect(() => {
    if (taskConfig) {
      setEditableConfig(taskConfig);
    }
  }, [taskConfig]);

  const handleConfigChange = (task: string, dayIndex: number, value: string) => {
    const newConfig = { ...editableConfig };
    newConfig[task][dayIndex] = parseInt(value) || 0;
    setEditableConfig(newConfig);
  };

  const handleSaveConfig = async () => {
    updateConfigMutation.mutate(editableConfig, {
      onSuccess: () => {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        toast({
          title: "Configuration saved",
          description: "Task requirements updated successfully",
        });
      },
      onError: (error) => {
        console.error("Error saving task config:", error);
        toast({
          title: "Error",
          description: "Failed to save configuration",
          variant: "destructive",
        });
      },
    });
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    const newTemplate: ConfigTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      config: { ...editableConfig },
      createdAt: Date.now(),
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem("warehouse-config-templates", JSON.stringify(updatedTemplates));
    setTemplateName("");
    toast({
      title: "Template saved",
      description: `Template "${newTemplate.name}" saved successfully`,
    });
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setEditableConfig(template.config);
      setSelectedTemplate(templateId);
      toast({
        title: "Template loaded",
        description: `Loaded template "${template.name}"`,
      });
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem("warehouse-config-templates", JSON.stringify(updatedTemplates));
    if (selectedTemplate === templateId) {
      setSelectedTemplate("");
    }
    if (template) {
      toast({
        title: "Template deleted",
        description: `Template "${template.name}" removed`,
      });
    }
  };

  return (
    <Layout>
      <SEO
        title="Task Configuration - Warehouse Rota"
        description="Configure daily task requirements for warehouse operations"
      />
      
      <div className="space-y-8">
        <div className="space-y-3">
          <h1 className="font-condensed text-3xl font-bold tracking-tight">
            Task Configuration
          </h1>
          <p className="text-base text-muted-foreground font-mono">
            Set how many staff you need for each task on each day of the week
          </p>
          <div className="flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-primary"></div>
              Enter 0 if task not needed that day
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-accent"></div>
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
                {error.message}
              </p>
            </div>
          </Alert>
        )}

        <Card className="shadow-sm hover:shadow-md transition-smooth">
          <CardHeader className="pb-6">
            <CardTitle className="font-condensed text-2xl">Weekly Task Requirements</CardTitle>
            <CardDescription className="font-mono text-sm mt-2">
              Configure staff needed for each warehouse task across the week (Saturday - Friday)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50 rounded-tl-lg">
                        Task
                      </th>
                      {DAYS.map((day, dayIndex) => (
                        <div key={dayIndex} className="space-y-2">
                          <label className="text-sm font-mono font-semibold text-foreground flex items-center justify-center">
                            {day}
                          </label>
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={config[task][dayIndex] || 0}
                            onChange={(e) => updateConfig(task, dayIndex, parseInt(e.target.value) || 0)}
                            className="font-mono text-base text-center tabular-nums h-12 border-2 focus:border-primary focus:ring-2 focus:ring-primary/20 shadow-sm"
                          />
                        </div>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TASKS.map((task) => (
                      <tr key={task} className="border-b border-border hover:bg-muted/30 transition-smooth">
                        <td className="p-3 font-condensed text-sm font-semibold">
                          {task}
                        </td>
                        {DAYS.map((day, dayIndex) => (
                          <div key={dayIndex} className="space-y-1.5">
                            <label className="text-xs font-mono font-medium text-muted-foreground">
                              {day}
                            </label>
                            <Input
                              type="number"
                              min="0"
                              max="20"
                              value={config[task][dayIndex] || 0}
                              onChange={(e) => updateConfig(task, dayIndex, parseInt(e.target.value) || 0)}
                              className="font-mono text-sm text-center tabular-nums"
                            />
                          </div>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-between items-center gap-4 pt-4 border-t">
                <div className="text-sm font-mono text-muted-foreground">
                  {hasChanges ? (
                    <span className="text-warning flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      You have unsaved changes
                    </span>
                  ) : (
                    <span className="text-success flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      All changes saved
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || !hasChanges}
                  size="lg"
                  className="gap-2 rounded-lg shadow-md hover:shadow-lg transition-all font-condensed text-base px-8"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-5 w-5" />
                      <span>Save Configuration</span>
                    </>
                  )}
                </Button>
              </div>

              {saveSuccess && (
                <Alert className="mt-4 bg-green-50 border-green-200">
                  <AlertCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="font-mono text-xs text-green-800">
                    Configuration saved successfully!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}