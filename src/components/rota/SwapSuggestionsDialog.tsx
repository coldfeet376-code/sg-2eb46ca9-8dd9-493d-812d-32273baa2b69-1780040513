import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shuffle, Target, ArrowLeftRight, Check, Zap } from "lucide-react";
import type { SwapSuggestion } from "@/lib/swapSuggester";

interface SwapSuggestionsDialogProps {
  open: boolean;
  onClose: () => void;
  suggestions: SwapSuggestion[];
  onApplySwap: (swap: SwapSuggestion) => void;
  onImplementAll: (swaps: SwapSuggestion[]) => void;
}

export function SwapSuggestionsDialog({
  open,
  onClose,
  suggestions,
  onApplySwap,
  onImplementAll,
}: SwapSuggestionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-condensed text-2xl flex items-center gap-2">
            <Shuffle className="h-6 w-6 text-primary" />
            Smart Swap Suggestions
          </DialogTitle>
          <DialogDescription className="font-mono text-sm">
            {suggestions.length} optimization opportunities found
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          {suggestions.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-success/10 mb-4">
                <Target className="h-8 w-8 text-success" />
              </div>
              <h3 className="font-condensed text-lg font-semibold mb-2">
                Rota is Optimal
              </h3>
              <p className="text-sm text-muted-foreground font-mono">
                No beneficial swaps detected. Current assignments are well-balanced.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {suggestions.map((suggestion) => (
                <div key={suggestion.id} className="border-l-4 border-l-primary/50 border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {new Date(suggestion.date).toLocaleDateString("en-GB", { weekday: "short", day: "numeric" })}
                        </Badge>
                        <span className="text-sm font-medium">{suggestion.task}</span>
                        <Badge variant="secondary" className="ml-2 text-xs bg-primary/10 text-primary">
                          +{suggestion.improvement.toFixed(1)} Fairness
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                          <span className="text-sm font-semibold">{suggestion.fromStaffName}</span>
                        </div>
                        <ArrowLeftRight className="h-4 w-4 text-primary" />
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded">
                          <span className="text-sm font-semibold">{suggestion.toStaffName}</span>
                        </div>
                      </div>
                      
                      <p className="text-xs text-muted-foreground font-mono">
                        {suggestion.reason}
                      </p>
                    </div>
                    
                    <Button
                      size="sm"
                      onClick={() => onApplySwap(suggestion)}
                      className="gap-2 shrink-0"
                    >
                      <Check className="h-4 w-4" />
                      Apply Swap
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {suggestions.length > 0 && (
          <DialogFooter className="gap-2 sm:gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              onClick={() => onImplementAll(suggestions)}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Implement All ({suggestions.length})
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}