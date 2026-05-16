import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useNotifications } from "@/contexts/NotificationContext";

// Optimized icon imports
import Bell from "lucide-react";
import Trash2 from "lucide-react";
import CheckCircle from "lucide-react";
import AlertCircle from "lucide-react";
import Info from "lucide-react";
import UserPlus from "lucide-react";

export function NotificationCenter() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "assignment":
        return "📋";
      case "update":
        return "🔄";
      default:
        return "ℹ️";
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="relative gap-2">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-[10px] font-mono"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-[400px]">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="font-condensed text-xl">Notifications</SheetTitle>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={markAllAsRead}
                  className="gap-1 h-8"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  <span className="text-xs font-mono">Mark all</span>
                </Button>
              )}
              {notifications.length > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={clearAll}
                  className="gap-1 h-8"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="text-xs font-mono">Clear</span>
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          {notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-mono">
                No notifications
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-3 rounded-md border transition-colors ${
                    notification.read
                      ? "bg-muted/30 border-muted"
                      : "bg-accent/5 border-accent/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{getNotificationIcon(notification.type)}</span>
                        <span className="font-condensed text-sm font-semibold truncate">
                          {notification.staffName}
                        </span>
                        {!notification.read && (
                          <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                            NEW
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                        {notification.message}
                      </p>
                      {notification.weekStart && (
                        <p className="text-[10px] font-mono text-muted-foreground/70 mt-1">
                          Week of {new Date(notification.weekStart).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      )}
                      <p className="text-[10px] font-mono text-muted-foreground/60 mt-1.5">
                        {formatTime(notification.timestamp)}
                      </p>
                    </div>
                    {!notification.read && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => markAsRead(notification.id)}
                        className="h-7 w-7 p-0 shrink-0"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}