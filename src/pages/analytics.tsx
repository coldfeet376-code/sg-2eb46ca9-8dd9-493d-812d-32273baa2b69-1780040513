import React, { useState, useEffect } from "react";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Calendar, 
  Users,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  getHistoricalTrends,
  analyzeAbsencePatterns,
  predictAbsenceRisks,
  getSeasonalPatterns,
  type AbsencePattern,
  type SeasonalPattern,
  type TrendData,
} from "@/services/analyticsService";
import { generateOptimizedScenarios, type RotaScenario } from "@/services/optimizationService";
import { getAllManagers, type Manager } from "@/services/managerService";
import { useToast } from "@/hooks/use-toast";

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
  // Historical trends
  const [trends, setTrends] = useState<TrendData[]>([]);
  
  // Absence patterns
  const [patterns, setPatterns] = useState<AbsencePattern[]>([]);
  const [risks, setRisks] = useState<Array<{ date: string; riskScore: number; reasons: string[] }>>([]);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  
  // Optimization scenarios
  const [scenarios, setScenarios] = useState<RotaScenario[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      // Load historical trends (last 12 weeks)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - (12 * 7));
      const trendsData = await getHistoricalTrends(startDate, endDate);
      setTrends(trendsData);

      // Load absence patterns
      const patternsData = await analyzeAbsencePatterns();
      setPatterns(patternsData);

      // Load absence risk predictions
      const risksData = await predictAbsenceRisks(4);
      setRisks(risksData);

      // Load seasonal patterns
      const seasonalData = await getSeasonalPatterns();
      setSeasonalPatterns(seasonalData);

      // Load managers for optimization
      const managersData = await getAllManagers();
      setManagers(managersData);

    } catch (error) {
      console.error("Error loading analytics:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const generateScenarios = async () => {
    if (managers.length === 0) {
      toast({
        title: "No Managers",
        description: "Add managers before generating scenarios",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const weekStart = new Date(today);
      const day = today.getDay();
      const diff = day === 0 ? 0 : 7 - day;
      weekStart.setDate(today.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);

      const scenariosData = await generateOptimizedScenarios(managers, weekStart, 3);
      setScenarios(scenariosData);

      toast({
        title: "✓ Scenarios Generated",
        description: `Created ${scenariosData.length} optimized rota scenarios`,
      });
    } catch (error) {
      console.error("Error generating scenarios:", error);
      toast({
        title: "Error",
        description: "Failed to generate scenarios",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Analytics - Warehouse Rota System</title>
      </Head>
      <Layout>
        <div className="container mx-auto p-6 max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold font-condensed text-foreground">
                Analytics & Insights
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-1">
                Historical trends, absence patterns, and AI optimization
              </p>
            </div>
            <Button
              onClick={loadAllData}
              disabled={loading}
              variant="outline"
              className="rounded-lg gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>

          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="trends" className="font-mono text-xs">
                <TrendingUp className="h-4 w-4 mr-2" />
                Historical Trends
              </TabsTrigger>
              <TabsTrigger value="patterns" className="font-mono text-xs">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Absence Patterns
              </TabsTrigger>
              <TabsTrigger value="optimization" className="font-mono text-xs">
                <BarChart3 className="h-4 w-4 mr-2" />
                AI Optimization
              </TabsTrigger>
            </TabsList>

            {/* Historical Trends Tab */}
            <TabsContent value="trends" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed">Assignment Trends (12 Weeks)</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Weekly assignment counts over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 font-mono text-sm">
                      No historical data available
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {trends.map((trend, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <span className="font-mono text-xs">{trend.label}</span>
                          <div className="flex items-center gap-3">
                            <span className="font-condensed text-lg">{trend.value} shifts</span>
                            {idx > 0 && (
                              <Badge variant={trend.value > trends[idx - 1].value ? "default" : "secondary"}>
                                {trend.value > trends[idx - 1].value ? (
                                  <TrendingUp className="h-3 w-3" />
                                ) : (
                                  <TrendingDown className="h-3 w-3" />
                                )}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Seasonal Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed">Seasonal Patterns</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Monthly absence trends and peak days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {seasonalPatterns.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 font-mono text-sm">
                      No seasonal data available
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {seasonalPatterns.map((pattern, idx) => (
                        <div key={idx} className="p-4 bg-muted/30 rounded-lg">
                          <div className="font-condensed text-lg mb-2">{pattern.month}</div>
                          <div className="space-y-1 font-mono text-xs">
                            <div>Avg Absences: {pattern.averageAbsences}</div>
                            <div className="text-muted-foreground">
                              Peak: {pattern.peakDays.join(", ")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Absence Patterns Tab */}
            <TabsContent value="patterns" className="space-y-4">
              {/* Pattern Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed">Absence Pattern Analysis</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    ML-detected patterns by manager and day of week
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {patterns.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 font-mono text-sm">
                      No absence patterns detected
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {patterns.slice(0, 10).map((pattern, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div className="space-y-1">
                            <div className="font-mono text-sm">
                              {pattern.managerName} - {pattern.dayName}s
                            </div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {pattern.totalAbsences} absences in {pattern.totalPossibleDays} possible {pattern.dayName}s
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              variant={
                                pattern.severity === "high"
                                  ? "destructive"
                                  : pattern.severity === "medium"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {Math.round(pattern.absenceRate * 100)}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risk Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" />
                    High-Risk Absence Predictions (Next 4 Weeks)
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Days with elevated absence probability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {risks.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 font-mono text-sm">
                      No high-risk periods detected
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {risks.slice(0, 5).map((risk, idx) => (
                        <div key={idx} className="p-4 bg-muted/30 rounded-lg space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-mono text-sm">
                              {new Date(risk.date).toLocaleDateString("en-US", { 
                                weekday: "long",
                                month: "short",
                                day: "numeric"
                              })}
                            </span>
                            <Badge variant="destructive">
                              {Math.round(risk.riskScore)}% risk
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono space-y-1">
                            {risk.reasons.map((reason, ridx) => (
                              <div key={ridx}>• {reason}</div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* AI Optimization Tab */}
            <TabsContent value="optimization" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed">AI Rota Optimization</CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Generate and compare optimal rota scenarios
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Button
                    onClick={generateScenarios}
                    disabled={loading || managers.length === 0}
                    className="w-full rounded-lg gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Generate 3 Optimized Scenarios
                  </Button>

                  {scenarios.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8 font-mono text-sm">
                      Click above to generate optimized rota scenarios
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {scenarios.map((scenario, idx) => (
                        <Card key={scenario.id} className="border-2">
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="font-condensed text-lg">
                                Scenario {idx + 1}
                              </CardTitle>
                              <Badge variant={idx === 0 ? "default" : "secondary"} className="text-lg px-3 py-1">
                                {scenario.fairnessScore}/100
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-4">
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <div className="text-xs text-muted-foreground font-mono mb-1">
                                  Avg Shifts/Manager
                                </div>
                                <div className="text-xl font-condensed">
                                  {scenario.metrics.avgShiftsPerManager}
                                </div>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <div className="text-xs text-muted-foreground font-mono mb-1">
                                  Duty Variance
                                </div>
                                <div className="text-xl font-condensed">
                                  {scenario.metrics.dutyDistributionVariance.toFixed(2)}
                                </div>
                              </div>
                              <div className="p-3 bg-muted/30 rounded-lg">
                                <div className="text-xs text-muted-foreground font-mono mb-1">
                                  Weekend Balance
                                </div>
                                <div className="text-xl font-condensed">
                                  {scenario.metrics.weekendBalance}%
                                </div>
                              </div>
                            </div>

                            {/* Strengths */}
                            {scenario.strengths.length > 0 && (
                              <div>
                                <div className="text-sm font-condensed mb-2 text-primary">
                                  ✓ Strengths
                                </div>
                                <div className="space-y-1">
                                  {scenario.strengths.map((strength, sidx) => (
                                    <div key={sidx} className="text-xs font-mono text-muted-foreground">
                                      • {strength}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Weaknesses */}
                            {scenario.weaknesses.length > 0 && (
                              <div>
                                <div className="text-sm font-condensed mb-2 text-destructive">
                                  ⚠ Areas for Improvement
                                </div>
                                <div className="space-y-1">
                                  {scenario.weaknesses.map((weakness, widx) => (
                                    <div key={widx} className="text-xs font-mono text-muted-foreground">
                                      • {weakness}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {idx === 0 && (
                              <Badge variant="default" className="w-full justify-center py-2">
                                ⭐ Recommended Scenario
                              </Badge>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}