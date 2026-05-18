import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, X } from "lucide-react";
import type { AvailabilityType } from "@/types";
import type { Manager } from "@/services/managerService";

interface ManagerAvailabilityDialogProps {
  open: boolean;
  manager: Manager | null;
  selectedDate: string;
  availabilityType: AvailabilityType;
  onOpenChange: (open: boolean) => void;
  onDateChange: (date: string) => void;
  onTypeChange: (type: AvailabilityType) => void;
  onSubmit: () => void;
}

export function ManagerAvailabilityDialog({
  open,
  manager,
  selectedDate,
  availabilityType,
  onOpenChange,
  onDateChange,
  onTypeChange,
  onSubmit,
}: ManagerAvailabilityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="font-condensed text-xl">
            Set Availability - {manager?.name}
          </DialogTitle>
          <DialogDescription className="font-mono text-xs">
            Select a date and availability status
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div>
            <Label htmlFor="date" className="font-mono text-xs">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => onDateChange(e.target.value)}
              className="font-mono mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="availability-type" className="font-mono text-xs">
              Status
            </Label>
            <Select
              value={availabilityType}
              onValueChange={(value) => onTypeChange(value as AvailabilityType)}
            >
              <SelectTrigger className="font-mono mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">Available</SelectItem>
                <SelectItem value="rest">Rest Day</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg"
          >
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={onSubmit} className="rounded-lg gap-2">
            <Check className="h-4 w-4" />
            Set Availability
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}