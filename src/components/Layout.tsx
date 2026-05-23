import { ReactNode, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { Home, Users, Calendar, RefreshCw, BarChart3, ShieldCheck, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { authService } from "@/services/authService";
import { useToast } from "@/hooks/use-toast";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  useEffect(() => {
    const checkAdmin = async () => {
      const admin = await authService.isAdmin();
      setIsAdmin(admin);
      const user = await authService.getCurrentUser();
      if (user?.email) {
        setUserEmail(user.email);
      }
    };
    checkAdmin();
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

  const navItems = [
    { href: "/", label: "Rota", icon: Home },
    { href: "/staff", label: "Staff", icon: Users },
    { href: "/managers", label: "Managers", icon: Calendar },
    { href: "/swaps", label: "Swaps", icon: RefreshCw },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
  ];

  // Add Admin tab only for admin users
  if (isAdmin) {
    navItems.push({
      href: "/admin/invites",
      label: "Admin",
      icon: ShieldCheck,
    });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-xl font-condensed font-bold tracking-tight">
              GIST WAREHOUSE ROTA
            </h1>
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href;
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? "default" : "ghost"}
                      size="sm"
                      className="gap-2 font-sans"
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            {userEmail && (
              <div className="hidden sm:block text-sm font-mono text-muted-foreground">
                {userEmail}
              </div>
            )}
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 font-sans"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation */}
      <div className="md:hidden border-b border-border/50 bg-background">
        <nav className="container px-4 py-2 flex gap-1 overflow-x-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = router.pathname === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="gap-2 font-sans whitespace-nowrap"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">{children}</main>
    </div>
  );
}