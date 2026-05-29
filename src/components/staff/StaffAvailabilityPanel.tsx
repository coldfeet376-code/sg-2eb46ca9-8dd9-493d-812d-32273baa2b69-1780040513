import React, { useState } from "react";
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
import { Calendar } from "lucide-react";
import type { AvailabilityType, StaffMember, AvailabilityEntry } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

interface StaffAvailabilityPanelProps {
  staffMember: StaffMember;
  onUpdate: (staffId: string, availability: AvailabilityEntry[]) => Promise<void>;
}

export function StaffAvailabilityPanel({
  staffMember,
  onUpdate,
}: StaffAvailabilityPanelProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedType, setSelectedType] = useState<AvailabilityType>("rest_day");
  const [notes, setNotes] = useState("");

  const handleSubmit = async () => {
    if (!selectedDate) return;

    const dateStr = selectedDate.toISOString().split("T")[0];
    
    const newAvailability: AvailabilityEntry = {
      date: dateStr,
      type: selectedType,
      notes: notes || undefined,
    };

    const updatedAvailability = [
      ...(staffMember.availability || []).filter(a => a.date !== dateStr),
      newAvailability,
    ];

    await onUpdate(staffMember.id, updatedAvailability);
    
    setOpen(false);
    setSelectedDate(undefined);
    setSelectedType("rest_day");
    setNotes("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calendar className="h-4 w-4" />
          Set Availability
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-condensed text-xl">
            Set Availability - {staffMember.name}
          </DialogTitle>
          <DialogDescription>
            Set rest days, holidays, or sick leave for any date
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate ? selectedDate.toISOString().split("T")[0] : ""}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value + "T00:00:00"));
                } else {
                  setSelectedDate(undefined);
                }
              }}
              className="font-mono"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Status</Label>
            <Select value={selectedType} onValueChange={(value) => setSelectedType(value as AvailabilityType)}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rest_day">Rest Day</SelectItem>
                <SelectItem value="holiday">Holiday</SelectItem>
                <SelectItem value="absent">Absent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason or additional notes..."
              className="font-mono text-sm"
            />
          </div>

          <Button onClick={handleSubmit} disabled={!selectedDate} className="w-full">
            Apply Status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}