import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DialogFooter } from "@/components/ui/dialog";
import { Check, X } from "lucide-react";
import type { Manager, ManagerDuty } from "@/types";

interface ManagerFormProps {
  editingManager: Manager | null;
  formData: {
    name: string;
    can_intake: boolean;
    can_out_loading: boolean;
    can_admin: boolean;
    can_floor: boolean;
    recurring_rest_days: string;
  };
  onInputChange: (field: keyof Manager, value: string | boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function ManagerForm({
  editingManager,
  formData,
  onInputChange,
  onSubmit,
  onCancel,
}: ManagerFormProps) {
  const duties: { key: keyof Manager; label: string }[] = [
    { key: "can_intake", label: "Intake" },
    { key: "can_out_loading", label: "Out-loading" },
    { key: "can_admin", label: "Admin" },
    { key: "can_floor", label: "Floor" },
  ];

  return (
    <div className="space-y-4 py-4">
      <div>
        <Label htmlFor="manager-name" className="font-mono text-xs">
          Manager Name
        </Label>
        <Input
          id="manager-name"
          value={formData.name}
          onChange={(e) => onInputChange("name", e.target.value)}
          placeholder="Enter manager name"
          className="font-mono mt-1.5"
        />
      </div>

      <div>
        <Label className="font-mono text-xs mb-3 block">Training</Label>
        <div className="space-y-3">
          {duties.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between">
              <Label htmlFor={key} className="font-mono text-xs">
                {label}
              </Label>
              <Switch
                id={key}
                checked={formData[key] as boolean}
                onCheckedChange={(checked) => onInputChange(key, checked)}
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="recurring-rest" className="font-mono text-xs">
          Recurring Rest Days
        </Label>
        <Input
          id="recurring-rest"
          value={formData.recurring_rest_days}
          onChange={(e) => onInputChange("recurring_rest_days", e.target.value)}
          placeholder="e.g., Sun,Mon or leave empty"
          className="font-mono mt-1.5"
        />
        <p className="text-xs text-muted-foreground mt-1.5 font-mono">
          Enter days separated by commas (Sun, Mon, Tue, Wed, Thu, Fri, Sat)
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          onClick={onCancel}
          className="rounded-lg"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={onSubmit} className="rounded-lg gap-2">
          <Check className="h-4 w-4" />
          {editingManager ? "Update" : "Add"} Manager
        </Button>
      </DialogFooter>
    </div>
  );
}