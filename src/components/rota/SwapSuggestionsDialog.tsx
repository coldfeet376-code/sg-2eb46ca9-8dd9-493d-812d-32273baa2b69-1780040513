import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check } from "lucide-react";

interface SwapSuggestion {
  fromStaffId: string;
  fromStaffName: string;
  toStaffId: string;
  toStaffName: string;
  task: string;
  date: string;
  reason: string;
  impact: number;
}

interface SwapSuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suggestions: SwapSuggestion[];
  onImplementSwap: (swap: SwapSuggestion) => void;
  onImplementAll: (swaps: SwapSuggestion[]) => void;
}

export function SwapSuggestionsDialog({
  open,
  onOpenChange,
  suggestions,
  onImplementSwap,
  onImplementAll,
}: SwapSuggestionsDialogProps) {
  if (suggestions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-condensed text-2xl">Smart Swap Suggestions</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {suggestions.length} optimizations to improve fairness
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Implement All Button */}
          <div className="flex justify-end gap-2 pb-2 border-b">
            <Button
              onClick={() => {
                onImplementAll(suggestions);
                onOpenChange(false);
              }}
              className="font-mono text-sm"
              size="sm"
            >
              <Check className="h-4 w-4 mr-2" />
              Implement All {suggestions.length} Swaps
            </Button>
          </div>

          {/* Individual Suggestions */}
          {suggestions.map((swap, idx) => (
            <div
              key={`${swap.fromStaffId}-${swap.toStaffId}-${swap.task}-${swap.date}-${idx}`}
              className="p-4 border rounded-lg bg-muted/30 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="text-sm font-mono">
                    <span className="font-semibold">{swap.fromStaffName}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="text-sm font-mono">
                    <span className="font-semibold">{swap.toStaffName}</span>
                  </div>
                </div>
                <Badge variant="secondary" className="font-mono text-xs">
                  {swap.task}
                </Badge>
              </div>

              <div className="text-xs text-muted-foreground font-mono">
                {new Date(swap.date).toLocaleDateString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}
              </div>

              <div className="text-sm font-sans">{swap.reason}</div>

              <div className="flex items-center justify-between">
                <div className="text-xs font-mono text-muted-foreground">
                  Impact: +{swap.impact.toFixed(1)}% fairness
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onImplementSwap(swap);
                  }}
                  className="font-mono text-xs"
                >
                  Apply This Swap
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}