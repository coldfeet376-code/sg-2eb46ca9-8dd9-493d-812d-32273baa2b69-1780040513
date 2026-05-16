import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, RotateCcw } from "lucide-react";
import { SEO } from "@/components/SEO";
import type { Task } from "@/types";

const TASKS: Task[] = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface TaskConfig {
  [task: string]: number[]; // 7 numbers for Sun-Sat
}

const DEFAULT_CONFIG: TaskConfig = {
  Frozen: [1, 2, 2, 2, 2, 2, 1],
  Milk: [1, 2, 2, 2, 2, 2, 1],
  TWI: [0, 1, 1, 1, 1, 1, 0],
  Inbound: [1, 3, 3, 3, 3, 3, 1],
  Outbound: [1, 3, 3, 3, 3, 3, 1],
  Marshaling: [1, 2, 2, 2, 2, 2, 1],
};

export default function ConfigPage() {
  const [config, setConfig] = useState<TaskConfig>(DEFAULT_CONFIG);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("warehouse-task-config");
    if (saved) {
      setConfig(JSON.parse(saved));
    }
  }, []);

  const handleChange = (task: Task, dayIndex: number, value: string) => {
    const numValue = parseInt(value) || 0;
    const newConfig = {
      ...config,
      [task]: config[task].map((v, i) => (i === dayIndex ? numValue : v)),
    };
    setConfig(newConfig);
    setHasChanges(true);
  };

  const handleSave = () => {
    localStorage.setItem("warehouse-task-config", JSON.stringify(config));
    setHasChanges(false);
  };

  const handleReset = () => {
    setConfig(DEFAULT_CONFIG);
    setHasChanges(true);
  };

  const getTotalForDay = (dayIndex: number): number => {
    return TASKS.reduce((sum, task) => sum + config[task][dayIndex], 0);
  };

  const getTotalForTask = (task: Task): number => {
    return config[task].reduce((sum, count) => sum + count, 0);
  };

  return (
    <Layout>
      <SEO
        title="Task Configuration - Warehouse Rota"
        description="Configure daily staff requirements for each warehouse task"
      />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Task Configuration
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              Set daily staff requirements for each task
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              <span className="font-mono text-xs">Reset to Default</span>
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!hasChanges}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              <span className="font-mono text-xs">Save Changes</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Daily Requirements Grid</CardTitle>
            <CardDescription className="font-mono text-xs">
              Number of staff needed per task per day
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-3 font-condensed text-sm font-semibold bg-muted/50">
                      Task
                    </th>
                    {DAYS.map((day) => (
                      <th
                        key={day}
                        className="text-center p-3 font-mono text-xs font-medium bg-muted/50"
                      >
                        {day.slice(0, 3)}
                      </th>
                    ))}
                    <th className="text-center p-3 font-mono text-xs font-medium bg-muted/50">
                      Week
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((task) => (
                    <tr key={task} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-condensed text-sm font-semibold">
                        {task}
                      </td>
                      {config[task].map((count, dayIndex) => (
                        <td key={dayIndex} className="p-2">
                          <Input
                            type="number"
                            min="0"
                            max="20"
                            value={count}
                            onChange={(e) => handleChange(task, dayIndex, e.target.value)}
                            className="w-16 text-center font-mono text-sm tabular-nums"
                          />
                        </td>
                      ))}
                      <td className="p-3 text-center">
                        <div className="font-mono text-sm font-semibold tabular-nums">
                          {getTotalForTask(task)}
                        </div>
                      </td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/50">
                    <td className="p-3 font-condensed text-sm font-bold">
                      Daily Total
                    </td>
                    {DAYS.map((_, dayIndex) => (
                      <td key={dayIndex} className="p-3 text-center">
                        <div className="font-mono text-sm font-bold tabular-nums">
                          {getTotalForDay(dayIndex)}
                        </div>
                      </td>
                    ))}
                    <td className="p-3 text-center">
                      <div className="font-mono text-sm font-bold tabular-nums text-primary">
                        {TASKS.reduce((sum, task) => sum + getTotalForTask(task), 0)}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Highest Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-bold tabular-nums">
                {Math.max(...DAYS.map((_, i) => getTotalForDay(i)))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                staff required
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Lowest Day</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-bold tabular-nums">
                {Math.min(...DAYS.map((_, i) => getTotalForDay(i)))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                staff required
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Weekly Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-2xl font-bold tabular-nums text-primary">
                {TASKS.reduce((sum, task) => sum + getTotalForTask(task), 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                total shifts per week
              </p>
            </CardContent>
          </Card>
        </div>

        {hasChanges && (
          <div className="bg-warning/10 border border-warning rounded-md p-4">
            <p className="text-sm font-mono text-warning-foreground">
              You have unsaved changes. Click &quot;Save Changes&quot; to apply your configuration.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}