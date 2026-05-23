import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { History, Users, Calendar, Lock, Unlock, Zap } from "lucide-react";
import { rotaRealtimeService, type AuditLogEntry } from "@/services/rotaRealtimeService";
import type { RealtimeChannel } from "@supabase/supabase-js";

export function RecentChangesPanel() {
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    // Load initial audit log
    const loadAuditLog = async () => {
      try {
        const log = await rotaRealtimeService.getRecentAuditLog(15);
        setAuditLog(log);
      } catch (error) {
        console.error("Error loading audit log:", error);
      } finally {
        setLoading(false);
      }
    };

    loadAuditLog();

    // Subscribe to real-time updates
    const auditChannel = rotaRealtimeService.subscribeToAuditLog((entry) => {
      setAuditLog((prev) => [entry, ...prev].slice(0, 15));
    });

    setChannel(auditChannel);

    return () => {
      if (auditChannel) {
        rotaRealtimeService.unsubscribe(auditChannel);
      }
    };
  }, []);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "generated":
        return <Zap className="h-4 w-4 text-primary" />;
      case "locked":
        return <Lock className="h-4 w-4 text-warning" />;
      case "unlocked":
      case "unlocked_all":
        return <Unlock className="h-4 w-4 text-muted-foreground" />;
      case "created":
        return <Users className="h-4 w-4 text-green-600" />;
      case "updated":
        return <Calendar className="h-4 w-4 text-blue-600" />;
      case "deleted":
        return <Users className="h-4 w-4 text-destructive" />;
      default:
        return <History className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "generated":
        return "bg-primary/10 text-primary";
      case "locked":
        return "bg-warning/10 text-warning";
      case "unlocked":
      case "unlocked_all":
        return "bg-muted-foreground/10 text-muted-foreground";
      case "created":
        return "bg-green-600/10 text-green-600";
      case "updated":
        return "bg-blue-600/10 text-blue-600";
      case "deleted":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border/50 bg-muted/30 pb-4">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" />
          <div>
            <CardTitle className="text-lg font-condensed font-bold tracking-tight">
              Recent Changes
            </CardTitle>
            <CardDescription className="text-xs font-sans mt-1">
              Live activity from all users
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 px-0">
        <ScrollArea className="h-[320px] px-6">
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
              ))}
            </div>
          )}

          {!loading && auditLog.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-sans">No recent activity</p>
            </div>
          )}

          {!loading && auditLog.length > 0 && (
            <div className="space-y-2">
              {auditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="shrink-0 mt-0.5">{getActionIcon(entry.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono font-bold ${getActionColor(entry.action)}`}
                      >
                        {entry.action.toUpperCase()}
                      </Badge>
                      <span className="text-xs font-mono text-muted-foreground">
                        {formatTimestamp(entry.created_at)}
                      </span>
                    </div>
                    {entry.details && (
                      <p className="text-sm font-sans text-foreground line-clamp-2">
                        {entry.details}
                      </p>
                    )}
                    {entry.user_name && (
                      <p className="text-xs font-mono text-muted-foreground mt-1">
                        by {entry.user_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}