import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SEO } from "@/components/SEO";

// Optimized icon imports
import Save from "lucide-react/dist/esm/icons/save";
import Upload from "lucide-react/dist/esm/icons/upload";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import FileText from "lucide-react/dist/esm/icons/file-text";

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
  const [taskConfig, setTaskConfig] = useState<TaskConfig>({
    Frozen: [0, 0, 0, 0, 0, 0, 0],
    Milk: [0, 0, 0, 0, 0, 0, 0],
    TWI: [0, 0, 0, 0, 0, 0, 0],
    Inbound: [0, 0, 0, 0, 0, 0, 0],
    Outbound: [0, 0, 0, 0, 0, 0, 0],
    Marshaling: [0, 0, 0, 0, 0, 0, 0],
  });
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");

  useEffect(() => {
    const savedConfig = localStorage.getItem("warehouse-task-config");
    const savedTemplates = localStorage.getItem("warehouse-config-templates");
    
    if (savedConfig) {
      setTaskConfig(JSON.parse(savedConfig));
    }
    if (savedTemplates) {
      setTemplates(JSON.parse(savedTemplates));
    }
  }, []);

  const handleConfigChange = (task: string, dayIndex: number, value: string) => {
    const newConfig = { ...taskConfig };
    newConfig[task][dayIndex] = parseInt(value) || 0;
    setTaskConfig(newConfig);
  };

  const handleSaveConfig = () => {
    localStorage.setItem("warehouse-task-config", JSON.stringify(taskConfig));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;

    const newTemplate: ConfigTemplate = {
      id: Date.now().toString(),
      name: templateName.trim(),
      config: { ...taskConfig },
      createdAt: Date.now(),
    };

    const updatedTemplates = [...templates, newTemplate];
    setTemplates(updatedTemplates);
    localStorage.setItem("warehouse-config-templates", JSON.stringify(updatedTemplates));
    setTemplateName("");
  };

  const handleLoadTemplate = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      setTaskConfig(template.config);
      setSelectedTemplate(templateId);
    }
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updatedTemplates = templates.filter(t => t.id !== templateId);
    setTemplates(updatedTemplates);
    localStorage.setItem("warehouse-config-templates", JSON.stringify(updatedTemplates));
    if (selectedTemplate === templateId) {
      setSelectedTemplate("");
    }
  };

  return (
    <Layout>
      <SEO title="Task Configuration - Warehouse Rota" description="Configure daily task requirements" />

      <div className="space-y-6">
        <div>
          <h1 className="font-condensed text-3xl font-bold tracking-tight">Task Configuration</h1>
          <p className="text-sm text-muted-foreground font-mono mt-1">
            Set staff requirements for each task per day
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-xl">Daily Requirements</CardTitle>
                <CardDescription className="font-mono text-xs">
                  Enter the number of staff needed for each task on each day
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50 rounded-tl-lg">
                          Task
                        </th>
                        {DAYS.map((day, i) => (
                          <th 
                            key={i} 
                            className={`text-center p-3 font-mono text-xs font-medium bg-muted/50 ${i === 6 ? 'rounded-tr-lg' : ''}`}
                          >
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {TASKS.map((task) => (
                        <tr key={task} className="border-b border-border hover:bg-muted/30 transition-smooth">
                          <td className="p-3 font-condensed text-sm font-semibold">
                            {task}
                          </td>
                          {DAYS.map((_, dayIdx) => (
                            <td key={dayIdx} className="p-2 text-center">
                              <Input
                                type="number"
                                min="0"
                                max="99"
                                value={taskConfig[task][dayIdx]}
                                onChange={(e) => handleConfigChange(task, dayIdx, e.target.value)}
                                className="w-16 text-center font-mono text-sm rounded-lg"
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6 flex gap-3">
                  <Button 
                    onClick={handleSaveConfig} 
                    className="rounded-lg shadow-sm hover:shadow-md transition-smooth"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    <span className="font-mono text-xs">Save Configuration</span>
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
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="shadow-sm hover:shadow-md transition-smooth">
              <CardHeader>
                <CardTitle className="font-condensed text-lg flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Templates
                </CardTitle>
                <CardDescription className="font-mono text-xs">
                  Save and load configuration templates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs">Save Current as Template</Label>
                  <div className="flex gap-2">
                    <Input
                      value={templateName}
                      onChange={(e) => setTemplateName(e.target.value)}
                      placeholder="Template name..."
                      className="rounded-lg font-mono text-xs"
                    />
                    <Button
                      onClick={handleSaveTemplate}
                      disabled={!templateName.trim()}
                      size="sm"
                      className="rounded-lg"
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Load Template</Label>
                    <Select value={selectedTemplate} onValueChange={handleLoadTemplate}>
                      <SelectTrigger className="rounded-lg font-mono text-xs">
                        <SelectValue placeholder="Select template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map(template => (
                          <SelectItem key={template.id} value={template.id} className="font-mono text-xs">
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {templates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="font-mono text-xs">Saved Templates ({templates.length})</Label>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {templates.map(template => (
                        <div
                          key={template.id}
                          className="flex items-center justify-between p-3 border border-border rounded-lg hover:bg-muted/50 transition-smooth"
                        >
                          <div className="flex-1">
                            <p className="font-mono text-xs font-semibold">{template.name}</p>
                            <p className="font-mono text-[10px] text-muted-foreground mt-1">
                              {new Date(template.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTemplate(template.id)}
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {templates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-20" />
                    <p className="text-xs font-mono">No templates saved yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}