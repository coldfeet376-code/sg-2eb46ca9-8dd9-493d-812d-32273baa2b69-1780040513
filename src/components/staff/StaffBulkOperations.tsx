import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Download, FileText } from "lucide-react";
import type { AvailabilityType } from "@/types";

interface StaffBulkOperationsProps {
  bulkData: string;
  bulkAvailability: AvailabilityType;
  onBulkDataChange: (data: string) => void;
  onBulkAvailabilityChange: (type: AvailabilityType) => void;
  onBulkImport: () => void;
  onExportTemplate: () => void;
}

export function StaffBulkOperations({
  bulkData,
  bulkAvailability,
  onBulkDataChange,
  onBulkAvailabilityChange,
  onBulkImport,
  onExportTemplate,
}: StaffBulkOperationsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-condensed text-xl flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Bulk Import Staff
        </CardTitle>
        <CardDescription className="font-mono text-xs">
          Paste CSV data or download template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="bulk-data" className="font-mono text-xs">
            CSV Data
          </Label>
          <Textarea
            id="bulk-data"
            value={bulkData}
            onChange={(e) => onBulkDataChange(e.target.value)}
            placeholder="Name,Tasks&#10;John Doe,Frozen,Milk&#10;Jane Smith,Twi,Inbound"
            className="font-mono text-xs h-32 mt-1.5"
          />
        </div>

        <div>
          <Label htmlFor="bulk-availability" className="font-mono text-xs">
            Default Availability
          </Label>
          <Select
            value={bulkAvailability}
            onValueChange={(value) => onBulkAvailabilityChange(value as AvailabilityType)}
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
          <Button onClick={onBulkImport} className="rounded-lg gap-2 flex-1">
            <Upload className="h-4 w-4" />
            Import Staff
          </Button>
          <Button
            variant="outline"
            onClick={onExportTemplate}
            className="rounded-lg gap-2"
          >
            <FileText className="h-4 w-4" />
            Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}