import React, { useState, useEffect } from "react";
import Head from "next/head";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp, TrendingDown, AlertTriangle, RefreshCw, Sparkles, Target, Calendar } from "lucide-react";
import { 
  getHistoricalTrends, 
  analyzeAbsencePatterns, 
  getSeasonalPatterns,
  predictHighRiskPeriods,
  type TrendData,
  type AbsencePattern,
  type SeasonalPattern,
  type HighRiskPrediction
} from "@/services/analyticsService";
import { 
  generateOptimizedScenarios,
  type RotaScenario 
} from "@/services/optimizationService";
import { getAllManagers, type Manager } from "@/services/managerService";
import { toast } from "@/hooks/use-toast";

export default function AnalyticsPage() {
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [absencePatterns, setAbsencePatterns] = useState<AbsencePattern[]>([]);
  const [seasonalPatterns, setSeasonalPatterns] = useState<SeasonalPattern[]>([]);
  const [highRiskPeriods, setHighRiskPeriods] = useState<HighRiskPrediction[]>([]);
  const [scenarios, setScenarios] = useState<RotaScenario[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
    loadManagers();
  }, []);

  const loadManagers = async () => {
    const data = await getAllManagers();
    setManagers(data);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 84); // 12 weeks

      const [trendsData, patternsData, seasonalData, riskData] = await Promise.all([
        getHistoricalTrends(startDate, endDate),
        analyzeAbsencePatterns(),
        getSeasonalPatterns(),
        predictHighRiskPeriods()
      ]);

      setTrends(trendsData);
      setAbsencePatterns(patternsData);
      setSeasonalPatterns(seasonalData);
      setHighRiskPeriods(riskData);
    } catch (error) {
      console.error("Error loading analytics data:", error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive"
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
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay()); // Go to Sunday

      const optimizedScenarios = await generateOptimizedScenarios(weekStart, managers);
      setScenarios(optimizedScenarios);

      toast({
        title: "✓ Scenarios Generated",
        description: `Created ${optimizedScenarios.length} optimized rota scenarios`,
      });
    } catch (error) {
      console.error("Error generating scenarios:", error);
      toast({
        title: "Error",
        description: "Failed to generate optimized scenarios",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high": return "bg-destructive/20 text-destructive border-destructive";
      case "medium": return "bg-amber-500/20 text-amber-500 border-amber-500";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  const getRiskColor = (level: string): "destructive" | "default" | "secondary" => {
    switch (level) {
      case "high": return "destructive";
      case "medium": return "default";
      default: return "secondary";
    }
  };

  return (
    <>
      <Head>
        <title>Analytics - Warehouse Rota System</title>
      </Head>
      <Layout>
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-condensed font-bold tracking-tight text-foreground mb-2">
                Analytics Dashboard
              </h1>
              <p className="text-sm font-sans text-muted-foreground">
                AI-powered insights and predictive workforce intelligence
              </p>
            </div>
            <Button
              onClick={loadData}
              disabled={loading}
              className="font-sans font-medium"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Refresh Data
            </Button>
          </div>

          <Tabs defaultValue="trends" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="trends" className="font-sans font-medium">
                Historical Trends
              </TabsTrigger>
              <TabsTrigger value="patterns" className="font-sans font-medium">
                Absence Patterns
              </TabsTrigger>
              <TabsTrigger value="optimization" className="font-sans font-medium">
                AI Optimization
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
                    12-Week Assignment Trends
                  </CardTitle>
                  <CardDescription className="text-sm font-sans">
                    Historical assignment patterns and week-over-week changes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {trends.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No historical data available</p>
                  ) : (
                    <div className="space-y-2">
                      {trends.map((trend, idx) => {
                        const prevValue = idx > 0 ? trends[idx - 1].value : trend.value;
                        const change = trend.value - prevValue;
                        const isIncrease = change > 0;

                        return (
                          <div
                            key={trend.period}
                            className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-mono font-semibold w-24">
                                {trend.label}
                              </span>
                              <span className="text-2xl font-condensed font-bold">
                                {trend.value}
                              </span>
                              <span className="text-xs text-muted-foreground">shifts</span>
                            </div>
                            {idx > 0 && (
                              <div className="flex items-center gap-2">
                                {isIncrease ? (
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                                <span className={`text-sm font-mono ${isIncrease ? "text-green-500" : "text-red-500"}`}>
                                  {isIncrease ? "+" : ""}{change}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Seasonal Patterns
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Monthly absence trends and peak days
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {seasonalPatterns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No seasonal data available</p>
                  ) : (
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                      {seasonalPatterns.map((pattern) => (
                        <div
                          key={pattern.month}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="font-mono font-semibold text-lg mb-2">
                            {pattern.month}
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">Avg Absences</span>
                              <span className="text-sm font-mono font-semibold">
                                {pattern.averageAbsences}
                              </span>
                            </div>
                            {pattern.peakDays.length > 0 && (
                              <div>
                                <span className="text-xs text-muted-foreground block mb-1">Peak Days</span>
                                <div className="flex flex-wrap gap-1">
                                  {pattern.peakDays.map(day => (
                                    <Badge key={day} variant="secondary" className="text-xs font-mono">
                                      {day}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-6">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border/50 bg-muted/30">
                  <CardTitle className="text-2xl font-condensed font-bold tracking-tight">
                    Absence Pattern Analysis
                  </CardTitle>
                  <CardDescription className="text-sm font-sans">
                    ML-based detection of sick day patterns by manager and day
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {absencePatterns.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No patterns detected</p>
                  ) : (
                    <div className="space-y-2">
                      {absencePatterns.map((pattern, idx) => (
                        <div
                          key={`${pattern.managerId}-${pattern.dayOfWeek}`}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex-1">
                            <p className="text-sm font-mono">{pattern.reason}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-xs font-mono">
                                {pattern.totalAbsences} absences
                              </Badge>
                              <Badge className={`text-xs font-mono ${getSeverityColor(pattern.severity)}`}>
                                {pattern.severity.toUpperCase()}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="font-condensed flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    High-Risk Predictions
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Next 4 weeks with elevated absence probability
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {highRiskPeriods.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No high-risk periods identified</p>
                  ) : (
                    <div className="space-y-3">
                      {highRiskPeriods.map((period) => (
                        <div
                          key={period.weekStart}
                          className="p-4 rounded-lg border bg-card"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <div className="font-mono text-sm font-semibold">
                                Week of {new Date(period.weekStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                              </div>
                              <div className="text-xs text-muted-foreground font-mono">
                                Expected {period.expectedAbsences} absence{period.expectedAbsences !== 1 ? "s" : ""}
                              </div>
                            </div>
                            <Badge variant={getRiskColor(period.riskLevel)} className="font-mono text-xs">
                              {period.riskLevel.toUpperCase()} RISK
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {period.managers.map(manager => (
                              <div
                                key={manager.name}
                                className="flex items-center justify-between p-2 rounded bg-muted/50"
                              >
                                <span className="text-xs font-mono">{manager.name}</span>
                                <span className="text-xs font-mono font-semibold text-destructive">
                                  {manager.probability}% chance
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="optimization" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-condensed font-bold tracking-tight">
                    AI-Powered Rota Optimization
                  </h2>
                  <p className="text-sm font-sans text-muted-foreground mt-1">
                    Generate and compare optimized scenarios scored on fairness metrics
                  </p>
                </div>
                <Button
                  onClick={generateScenarios}
                  disabled={loading || managers.length === 0}
                  className="font-sans font-medium"
                >
                  <Sparkles className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
                  Generate 3 Optimized Scenarios
                </Button>
              </div>

              {scenarios.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Click above to generate AI-optimized scenarios
                </p>
              ) : (
                <div className="space-y-4">
                  {scenarios.map((scenario) => (
                    <div
                      key={scenario.id}
                      className={`p-4 rounded-lg border ${scenario.score >= 85 ? "border-primary bg-primary/5" : "bg-card"}`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-condensed text-lg font-bold">
                              Scenario {scenario.id}
                            </span>
                            {scenario.score >= 85 && (
                              <span className="text-primary">⭐</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {scenario.recommendation}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-condensed font-bold">
                            {scenario.score}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            score
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
                        <div className="p-2 rounded bg-muted/50">
                          <div className="text-xs text-muted-foreground font-mono">Shift Balance</div>
                          <div className="text-lg font-mono font-semibold">{scenario.metrics.shiftBalance}</div>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <div className="text-xs text-muted-foreground font-mono">Duty Balance</div>
                          <div className="text-lg font-mono font-semibold">{scenario.metrics.dutyBalance}</div>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <div className="text-xs text-muted-foreground font-mono">Weekend Balance</div>
                          <div className="text-lg font-mono font-semibold">{scenario.metrics.weekendBalance}</div>
                        </div>
                        <div className="p-2 rounded bg-muted/50">
                          <div className="text-xs text-muted-foreground font-mono">Difficulty Balance</div>
                          <div className="text-lg font-mono font-semibold">{scenario.metrics.difficultyBalance}</div>
                        </div>
                      </div>

                      {scenario.strengths.length > 0 && (
                        <div className="mb-2">
                          <div className="text-xs text-muted-foreground font-mono mb-1">Strengths</div>
                          <div className="space-y-1">
                            {scenario.strengths.map((strength, idx) => (
                              <div key={idx} className="text-xs font-mono flex items-center gap-2">
                                <span className="text-green-500">✓</span>
                                {strength}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {scenario.weaknesses.length > 0 && (
                        <div>
                          <div className="text-xs text-muted-foreground font-mono mb-1">Areas for Improvement</div>
                          <div className="space-y-1">
                            {scenario.weaknesses.map((weakness, idx) => (
                              <div key={idx} className="text-xs font-mono flex items-center gap-2">
                                <span className="text-destructive">!</span>
                                {weakness}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </>
  );
}