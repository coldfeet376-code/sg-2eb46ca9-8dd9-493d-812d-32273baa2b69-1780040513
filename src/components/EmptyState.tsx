import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  children?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action, children }: EmptyStateProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <Icon className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="mb-2 text-lg font-condensed font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mb-6 text-sm text-muted-foreground font-sans max-w-sm">
          {description}
        </p>
        {action && (
          <Button onClick={action.onClick} className="font-sans">
            {action.label}
          </Button>
        )}
        {children}
      </CardContent>
    </Card>
  );
}