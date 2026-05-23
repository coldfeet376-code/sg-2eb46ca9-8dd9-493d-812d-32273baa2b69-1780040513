import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User, LogOut, ShieldCheck, ChevronDown } from "lucide-react";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";

export function UserProfileDropdown() {
  const router = useRouter();
  const { toast } = useToast();
  const [user, setUser] = useState<{ email: string; name: string; isAdmin: boolean } | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authService.getCurrentUser();
      const isAdmin = await authService.isAdmin();
      
      if (currentUser) {
        setUser({
          email: currentUser.email || "",
          name: authService.getUserDisplayName(currentUser),
          isAdmin,
        });
      }
    };
    loadUser();
  }, []);

  const handleLogout = async () => {
    try {
      await authService.signOut();
      toast({
        title: "Logged out",
        description: "See you next time!",
      });
      router.push("/login");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    }
  };

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="gap-2 h-10 px-2 font-sans"
        >
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-condensed font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden md:flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{user.name}</span>
              {user.isAdmin && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-condensed">
                  ADMIN
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden md:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 font-sans">
        <DropdownMenuLabel>
          <div className="flex flex-col space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              {user.isAdmin && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-condensed">
                  ADMIN
                </Badge>
              )}
            </div>
            <p className="text-xs leading-none text-muted-foreground font-mono">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.isAdmin && (
          <>
            <DropdownMenuItem onClick={() => router.push("/admin/invites")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              <span>Admin Panel</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}