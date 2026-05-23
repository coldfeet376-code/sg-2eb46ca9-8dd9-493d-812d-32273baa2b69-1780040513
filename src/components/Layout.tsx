import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useTour } from "@/contexts/TourContext";
import { usePWAInstall } from "@/components/InstallPrompt";
import { LayoutGrid, LogOut, Menu, RefreshCw, HelpCircle, Download, BarChart3 } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"manager" | "supervisor" | "staff">("manager");
  const { resetAllTours } = useTour();
  const { isInstallable, install } = usePWAInstall();

  useEffect(() => {
    const role = localStorage.getItem("warehouse-user-role") || "manager";
    setUserRole(role as typeof userRole);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("warehouse-auth");
    router.push("/login");
  };

  const handleRestartTour = () => {
    resetAllTours();
    if (router.pathname === "/") {
      // Restart tour immediately if on main page
      if ((window as any).restartTour) {
        (window as any).restartTour();
      }
    } else {
      // Navigate to main page to start tour
      router.push("/");
      setTimeout(() => {
        if ((window as any).restartTour) {
          (window as any).restartTour();
        }
      }, 500);
    }
  };

  const canAccessPage = (page: string) => {
    if (userRole === "manager") return true;
    if (userRole === "supervisor") return !["staff", "config"].includes(page);
    return page === "rota"; // Staff can only view rota
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Mobile menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px]">
                <SheetHeader>
                  <SheetTitle className="font-condensed flex items-center gap-2">
                    <LayoutGrid className="h-5 w-5 text-primary" />
                    WAREHOUSE ROTA
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-2 mt-8">
                  <Link
                    href="/"
                    className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                  >
                    Rota
                  </Link>
                  {canAccessPage("staff") && (
                    <Link
                      href="/staff"
                      className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                    >
                      Staff
                    </Link>
                  )}
                  {canAccessPage("config") && (
                    <Link
                      href="/config"
                      className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                    >
                      Config
                    </Link>
                  )}
                  {canAccessPage("swaps") && (
                    <Link
                      href="/swaps"
                      className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Swaps
                    </Link>
                  )}
                  {canAccessPage("managers") && (
                    <Link
                      href="/managers"
                      className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                    >
                      Managers
                    </Link>
                  )}
                  <Link
                    href="/analytics"
                    className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Analytics
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>

            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LayoutGrid className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-condensed font-bold tracking-tight text-foreground">
                  GIST Rota
                </h1>
                <p className="text-xs font-sans text-muted-foreground">
                  Warehouse Work System
                </p>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-2">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
              >
                Rota
              </Link>
              <Link
                href="/staff"
                className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                data-tour="staff-nav"
              >
                Staff
              </Link>
              {canAccessPage("config") && (
                <Link
                  href="/config"
                  className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                >
                  Config
                </Link>
              )}
              {canAccessPage("swaps") && (
                <Link
                  href="/swaps"
                  className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Swaps
                </Link>
              )}
              {canAccessPage("managers") && (
                <Link
                  href="/managers"
                  className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                  data-tour="managers-nav"
                >
                  Managers
                </Link>
              )}
              <Link
                href="/analytics"
                className="px-4 py-2 text-sm font-sans font-medium rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                data-tour="analytics-nav"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-2 md:gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRestartTour}
                className="rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                title="Restart Onboarding Tour"
              >
                <HelpCircle className="h-5 w-5" />
              </Button>
              {isInstallable && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={install}
                  className="rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                  title="Download App"
                >
                  <Download className="h-5 w-5" />
                </Button>
              )}
              <ThemeToggle />
              <div data-tour="notifications">
                <NotificationCenter />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="gap-2 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-smooth hidden sm:flex"
              >
                <LogOut className="h-4 w-4" />
                <span className="font-sans text-xs">Logout</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleLogout}
                className="rounded-xl hover:bg-destructive/10 hover:text-destructive transition-smooth sm:hidden"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="container py-4 md:py-8 px-4 md:px-8">{children}</main>
    </div>
  );
}