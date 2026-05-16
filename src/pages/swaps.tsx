import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, Check, X, Clock } from "lucide-react";
import { SEO } from "@/components/SEO";
import { useAudit } from "@/contexts/AuditContext";
import { useNotifications } from "@/contexts/NotificationContext";
import type { ShiftSwap, StaffMember, Assignment } from "@/types";

export default function SwapsPage() {
  const [swaps, setSwaps] = useState<ShiftSwap[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const { addAuditEntry } = useAudit();
  const { addNotification } = useNotifications();

  useEffect(() => {
    const savedSwaps = localStorage.getItem("warehouse-shift-swaps");
    const savedStaff = localStorage.getItem("warehouse-staff");
    const savedHistory = localStorage.getItem("warehouse-rota-history");

    if (savedSwaps) setSwaps(JSON.parse(savedSwaps));
    if (savedStaff) setStaff(JSON.parse(savedStaff));
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      const allAssignments = history.flatMap((h: any) => h.assignments || []);
      setAssignments(allAssignments);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("warehouse-shift-swaps", JSON.stringify(swaps));
  }, [swaps]);

  const handleApprove = (swapId: string) => {
    const swap = swaps.find(s => s.id === swapId);
    if (!swap) return;

    // Update swap status
    const updatedSwaps = swaps.map(s =>
      s.id === swapId
        ? { ...s, status: "approved" as const, reviewedAt: Date.now(), reviewedBy: "Manager" }
        : s
    );
    setSwaps(updatedSwaps);

    // Update assignments in rota history
    const history = JSON.parse(localStorage.getItem("warehouse-rota-history") || "[]");
    const updatedHistory = history.map((h: any) => ({
      ...h,
      assignments: h.assignments.map((a: Assignment) =>
        a.date === swap.date && a.task === swap.task && a.staffId === swap.fromStaffId
          ? { ...a, staffId: swap.toStaffId, staffName: swap.toStaffName }
          : a
      ),
    }));
    localStorage.setItem("warehouse-rota-history", JSON.stringify(updatedHistory));

    addAuditEntry({
      user: "Manager",
      action: "approved",
      entity: "shift-swap",
      entityId: swapId,
      details: `Approved swap: ${swap.fromStaffName} → ${swap.toStaffName} for ${swap.task} on ${swap.date}`,
    });

    addNotification({
      staffName: swap.fromStaffName,
      message: `Swap approved: ${swap.task} on ${new Date(swap.date).toLocaleDateString()}`,
      type: "update",
    });

    addNotification({
      staffName: swap.toStaffName,
      message: `You're now assigned: ${swap.task} on ${new Date(swap.date).toLocaleDateString()}`,
      type: "assignment",
    });
  };

  const handleReject = (swapId: string) => {
    const swap = swaps.find(s => s.id === swapId);
    if (!swap) return;

    const updatedSwaps = swaps.map(s =>
      s.id === swapId
        ? { ...s, status: "rejected" as const, reviewedAt: Date.now(), reviewedBy: "Manager" }
        : s
    );
    setSwaps(updatedSwaps);

    addAuditEntry({
      user: "Manager",
      action: "rejected",
      entity: "shift-swap",
      entityId: swapId,
      details: `Rejected swap: ${swap.fromStaffName} → ${swap.toStaffName} for ${swap.task} on ${swap.date}`,
    });

    addNotification({
      staffName: swap.fromStaffName,
      message: `Swap rejected: ${swap.task} on ${new Date(swap.date).toLocaleDateString()}`,
      type: "info",
    });
  };

  const filteredSwaps = swaps.filter(s => filter === "all" || s.status === filter);

  const getStatusColor = (status: ShiftSwap["status"]) => {
    switch (status) {
      case "pending":
        return "bg-warning/10 text-warning border-warning";
      case "approved":
        return "bg-success/10 text-success border-success";
      case "rejected":
        return "bg-destructive/10 text-destructive border-destructive";
    }
  };

  const getStatusIcon = (status: ShiftSwap["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-3.5 w-3.5" />;
      case "approved":
        return <Check className="h-3.5 w-3.5" />;
      case "rejected":
        return <X className="h-3.5 w-3.5" />;
    }
  };

  return (
    <Layout>
      <SEO title="Shift Swaps - Warehouse Rota" description="Manage shift swap requests" />

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-condensed text-3xl font-bold tracking-tight">Shift Swaps</h1>
            <p className="text-sm text-muted-foreground font-mono mt-1">
              Review and manage shift swap requests
            </p>
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-40 rounded-lg font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-mono text-xs">All Swaps</SelectItem>
              <SelectItem value="pending" className="font-mono text-xs">Pending</SelectItem>
              <SelectItem value="approved" className="font-mono text-xs">Approved</SelectItem>
              <SelectItem value="rejected" className="font-mono text-xs">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-warning" />
                Pending
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-warning">
                {swaps.filter(s => s.status === "pending").length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <Check className="h-4 w-4 text-success" />
                Approved
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-success">
                {swaps.filter(s => s.status === "approved").length}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm card-hover">
            <CardHeader className="pb-3">
              <CardTitle className="font-condensed text-sm flex items-center gap-2">
                <X className="h-4 w-4 text-destructive" />
                Rejected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="font-mono text-3xl font-bold tabular-nums text-destructive">
                {swaps.filter(s => s.status === "rejected").length}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm hover:shadow-md transition-smooth">
          <CardHeader>
            <CardTitle className="font-condensed text-xl">Swap Requests ({filteredSwaps.length})</CardTitle>
            <CardDescription className="font-mono text-xs">
              Manage staff shift swap requests
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSwaps.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-12 w-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm font-mono">No {filter === "all" ? "" : filter} swap requests</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredSwaps.sort((a, b) => b.requestedAt - a.requestedAt).map(swap => (
                  <div
                    key={swap.id}
                    className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-smooth"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="outline" className={`${getStatusColor(swap.status)} font-mono text-xs`}>
                            {getStatusIcon(swap.status)}
                            <span className="ml-1.5 capitalize">{swap.status}</span>
                          </Badge>
                          <Badge variant="outline" className="font-mono text-xs">
                            {swap.task}
                          </Badge>
                        </div>
                        <div className="font-mono text-sm mb-1">
                          <span className="font-semibold">{swap.fromStaffName}</span>
                          <span className="mx-2 text-muted-foreground">→</span>
                          <span className="font-semibold">{swap.toStaffName}</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">
                          Date: {new Date(swap.date).toLocaleDateString("en-GB", {
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                        <p className="text-xs font-mono text-muted-foreground mt-0.5">
                          Requested: {new Date(swap.requestedAt).toLocaleString()}
                        </p>
                        {swap.reviewedAt && (
                          <p className="text-xs font-mono text-muted-foreground mt-0.5">
                            Reviewed: {new Date(swap.reviewedAt).toLocaleString()} by {swap.reviewedBy}
                          </p>
                        )}
                        {swap.notes && (
                          <p className="text-xs font-mono text-muted-foreground mt-2 bg-muted/30 p-2 rounded">
                            {swap.notes}
                          </p>
                        )}
                      </div>
                      {swap.status === "pending" && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(swap.id)}
                            className="gap-2 rounded-lg text-success hover:text-success"
                          >
                            <Check className="h-4 w-4" />
                            <span className="font-mono text-xs">Approve</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReject(swap.id)}
                            className="gap-2 rounded-lg text-destructive hover:text-destructive"
                          >
                            <X className="h-4 w-4" />
                            <span className="font-mono text-xs">Reject</span>
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}