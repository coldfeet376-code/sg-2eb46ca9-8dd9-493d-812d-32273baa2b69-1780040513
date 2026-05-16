import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import Link from "next/link";
import { LayoutGrid, BarChart3, LogOut, Menu, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [userRole, setUserRole] = useState<"manager" | "supervisor" | "staff">("manager");

  useEffect(() => {
    const role = localStorage.getItem("warehouse-user-role") || "manager";
    setUserRole(role as typeof userRole);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("warehouse-auth");
    router.push("/login");
  };

  const canAccessPage = (page: string) => {
    if (userRole === "manager") return true;
    if (userRole === "supervisor") return !["staff", "config"].includes(page);
    return page === "rota"; // Staff can only view rota
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
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
                    className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                  >
                    Rota
                  </Link>
                  {canAccessPage("staff") && (
                    <Link
                      href="/staff"
                      className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                    >
                      Staff
                    </Link>
                  )}
                  {canAccessPage("config") && (
                    <Link
                      href="/config"
                      className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                    >
                      Config
                    </Link>
                  )}
                  {canAccessPage("analytics") && (
                    <Link
                      href="/analytics"
                      className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                    >
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </Link>
                  )}
                  {canAccessPage("swaps") && (
                    <Link
                      href="/swaps"
                      className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Swaps
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg group-hover:shadow-xl transition-smooth">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <span className="font-condensed text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent hidden sm:inline-block">
                WAREHOUSE ROTA
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
              >
                Rota
              </Link>
              {canAccessPage("staff") && (
                <Link
                  href="/staff"
                  className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                >
                  Staff
                </Link>
              )}
              {canAccessPage("config") && (
                <Link
                  href="/config"
                  className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
                >
                  Config
                </Link>
              )}
              {canAccessPage("analytics") && (
                <Link
                  href="/analytics"
                  className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Link>
              )}
              {canAccessPage("swaps") && (
                <Link
                  href="/swaps"
                  className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Swaps
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-smooth hidden sm:flex"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-mono text-xs">Logout</span>
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
      </header>
      <main className="container py-4 md:py-8 px-4 md:px-8">{children}</main>
    </div>
  );
}