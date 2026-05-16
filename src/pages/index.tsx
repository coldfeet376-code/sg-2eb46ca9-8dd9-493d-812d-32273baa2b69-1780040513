import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { SEO } from "@/components/SEO";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const TASKS = ["Frozen", "Milk", "TWI", "Inbound", "Outbound", "Marshaling"];

export default function Home() {
  const currentDate = new Date();
  const weekStart = new Date(currentDate);
  weekStart.setDate(currentDate.getDate() - currentDate.getDay());

  const weekDates = DAYS.map((_, i) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + i);
    return date;
  });

  return (
    <Layout>
      <SEO
        title="Warehouse Rota System"
        description="Fair distribution work rotation system for warehouse operations"
      />
      
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">
              Weekly Rota
            </h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              {weekDates[0].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })} - {weekDates[6].toLocaleDateString("en-GB", { 
                day: "2-digit", 
                month: "short", 
                year: "numeric" 
              })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="default" size="sm" className="gap-2 ml-4">
              <Download className="h-4 w-4" />
              <span className="font-mono text-xs">Export PDF</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Current Week Schedule</CardTitle>
            <CardDescription className="font-mono text-xs">
              Staff assignments by task and day
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
                    {weekDates.map((date, i) => (
                      <th 
                        key={i} 
                        className="text-center p-3 font-mono text-xs font-medium bg-muted/50"
                      >
                        <div>{DAYS[i]}</div>
                        <div className="text-muted-foreground mt-1">
                          {date.getDate()}/{date.getMonth() + 1}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((task, taskIdx) => (
                    <tr key={task} className="border-b border-border hover:bg-muted/30">
                      <td className="p-3 font-condensed text-sm font-semibold">
                        {task}
                      </td>
                      {DAYS.map((_, dayIdx) => (
                        <td 
                          key={dayIdx} 
                          className="p-3 text-center align-top"
                        >
                          <div className="text-xs font-mono text-muted-foreground">
                            No assignments
                          </div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Total Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums">0</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active employees
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Tasks Configured</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums">6</div>
              <p className="text-xs text-muted-foreground mt-1">
                Warehouse tasks
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-condensed text-base">Week Coverage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-warning">0%</div>
              <p className="text-xs text-muted-foreground mt-1">
                Assignments complete
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}