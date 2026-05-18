import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Check, X } from "lucide-react";
import type { Staff, AvailabilityType } from "@/types";

interface StaffAvailabilityPanelProps {
  selectedStaff: Staff[];
  selectedDate: string;
  selectedAvailability: AvailabilityType;
  onDateChange: (date: string) => void;
  onAvailabilityChange: (type: AvailabilityType) => void;
  onApply: () => void;
  onClearSelection: () => void;
}

export function StaffAvailabilityPanel({
  selectedStaff,
  selectedDate,
  selectedAvailability,
  onDateChange,
  onAvailabilityChange,
  onApply,
  onClearSelection,
}: StaffAvailabilityPanelProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-condensed text-xl flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Batch Availability ({selectedStaff.length} selected)
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Set availability for multiple staff members
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="batch-date" className="font-mono text-xs">
            Date
          </Label>
          <Input
            id="batch-date"
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="font-mono mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="batch-availability" className="font-mono text-xs">
            Status
          </Label>
          <Select
            value={selectedAvailability}
            onValueChange={(value) => onAvailabilityChange(value as AvailabilityType)}
          >
            <SelectTrigger className="font-mono mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="rest">Rest Day</SelectItem>
              <SelectItem value="holiday">Holiday</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button onClick={onApply} className="rounded-lg gap-2 flex-1">
            <Check className="h-4 w-4" />
            Apply to Selected
          </Button>
          <Button
            variant="outline"
            onClick={onClearSelection}
            className="rounded-lg"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="text-xs text-muted-foreground font-mono">
          Selected: {selectedStaff.map(s => s.name).join(", ")}
        </div>
      </CardContent>
    </Card>
  );
}