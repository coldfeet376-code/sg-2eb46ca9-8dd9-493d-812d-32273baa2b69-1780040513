import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckSquare, Square, Copy, Lock, Unlock, X, AlertCircle } from "lucide-react";
import type { StaffMember, AvailabilityType } from "@/types";
import { cn } from "@/lib/utils";

interface BulkOperationsPanelProps {
  staff: StaffMember[];
  selectedStaffIds: Set<string>;
  onToggleStaff: (staffId: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkSetAvailability: (staffIds: string[], dates: string[], type: AvailabilityType) => Promise<void>;
  onCopyWeek: (fromWeek: Date, toWeek: Date, staffIds: string[]) => Promise<void>;
  weekStart: Date;
}

export function BulkOperationsPanel({
  staff,
  selectedStaffIds,
  onToggleStaff,
  onSelectAll,
  onClearSelection,
  onBulkSetAvailability,
  onCopyWeek,
  weekStart,
}: BulkOperationsPanelProps) {
  const [bulkAvailType, setBulkAvailType] = useState<AvailabilityType>("rest");
  const [bulkDayIndex, setBulkDayIndex] = useState<number>(0);
  const [copyToWeekOffset, setCopyToWeekOffset] = useState<number>(1);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"availability" | "copy" | null>(null);
  
  const selectedCount = selectedStaffIds.size;
  const DAYS = ["Sat", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];

  const handleBulkAvailability = () => {
    if (selectedCount === 0) return;
    setConfirmAction("availability");
    setShowConfirm(true);
  };

  const handleCopyWeek = () => {
    if (selectedCount === 0) return;
    setConfirmAction("copy");
    setShowConfirm(true);
  };

  const executeAction = async () => {
    if (confirmAction === "availability") {
      const targetDate = new Date(weekStart);
      targetDate.setDate(weekStart.getDate() + bulkDayIndex);
      const dateStr = targetDate.toISOString().split("T")[0];
      
      await onBulkSetAvailability(
        Array.from(selectedStaffIds),
        [dateStr],
        bulkAvailType
      );
    } else if (confirmAction === "copy") {
      const toWeek = new Date(weekStart);
      toWeek.setDate(weekStart.getDate() + (copyToWeekOffset * 7));
      
      await onCopyWeek(
        weekStart,
        toWeek,
        Array.from(selectedStaffIds)
      );
    }
    
    setShowConfirm(false);
    setConfirmAction(null);
  };

  return (
    <Card className="shadow-md border-l-4 border-l-accent">
      <CardHeader>
        <CardTitle className="font-condensed text-xl flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-accent" />
          Bulk Operations
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          {selectedCount} staff selected · Select staff cards below to enable bulk actions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Selection Controls */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSelectAll}
            className="flex-1 gap-2"
            disabled={staff.length === 0}
          >
            <CheckSquare className="h-4 w-4" />
            Select All ({staff.length})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onClearSelection}
            className="flex-1 gap-2"
            disabled={selectedCount === 0}
          >
            <X className="h-4 w-4" />
            Clear Selection
          </Button>
        </div>

        {/* Bulk Set Availability */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-condensed font-semibold text-sm">Set Availability for Selected Staff</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground">Day</label>
              <Select value={bulkDayIndex.toString()} onValueChange={(v) => setBulkDayIndex(parseInt(v))}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DAYS.map((day, idx) => (
                    <SelectItem key={idx} value={idx.toString()} className="font-mono text-xs">
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground">Type</label>
              <Select value={bulkAvailType} onValueChange={(v) => setBulkAvailType(v as AvailabilityType)}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rest" className="font-mono text-xs">Rest Day</SelectItem>
                  <SelectItem value="holiday" className="font-mono text-xs">Holiday</SelectItem>
                  <SelectItem value="sick" className="font-mono text-xs">Sick Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={handleBulkAvailability}
            disabled={selectedCount === 0}
            className="w-full gap-2"
            size="sm"
          >
            Apply to {selectedCount} Staff
          </Button>
        </div>

        {/* Copy Week */}
        <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
          <h3 className="font-condensed font-semibold text-sm">Copy Week Availability</h3>
          <div className="space-y-2">
            <label className="text-xs font-mono text-muted-foreground">Copy to week</label>
            <Select value={copyToWeekOffset.toString()} onValueChange={(v) => setCopyToWeekOffset(parseInt(v))}>
              <SelectTrigger className="font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1" className="font-mono text-xs">Next week (+1)</SelectItem>
                <SelectItem value="2" className="font-mono text-xs">2 weeks ahead (+2)</SelectItem>
                <SelectItem value="3" className="font-mono text-xs">3 weeks ahead (+3)</SelectItem>
                <SelectItem value="4" className="font-mono text-xs">4 weeks ahead (+4)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleCopyWeek}
            disabled={selectedCount === 0}
            variant="secondary"
            className="w-full gap-2"
            size="sm"
          >
            <Copy className="h-4 w-4" />
            Copy for {selectedCount} Staff
          </Button>
        </div>

        {/* Confirmation Dialog */}
        {showConfirm && (
          <Alert className="bg-warning/10 border-warning">
            <AlertCircle className="h-4 w-4 text-warning" />
            <div className="flex-1">
              <AlertDescription className="text-sm text-warning-foreground mb-3">
                {confirmAction === "availability" && (
                  <>Apply <strong>{bulkAvailType.toUpperCase()}</strong> to <strong>{DAYS[bulkDayIndex]}</strong> for <strong>{selectedCount}</strong> staff?</>
                )}
                {confirmAction === "copy" && (
                  <>Copy availability for <strong>{selectedCount}</strong> staff to <strong>{copyToWeekOffset} week{copyToWeekOffset > 1 ? "s" : ""} ahead</strong>?</>
                )}
              </AlertDescription>
              <div className="flex gap-2">
                <Button size="sm" onClick={executeAction} className="bg-warning hover:bg-warning/90">
                  Confirm
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowConfirm(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}