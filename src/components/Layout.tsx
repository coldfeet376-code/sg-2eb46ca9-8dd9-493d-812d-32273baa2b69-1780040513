import { useRouter } from "next/router";
import Link from "next/link";
import { LayoutGrid, BarChart3, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationCenter } from "@/components/NotificationCenter";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem("warehouse-auth");
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-background gradient-mesh">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="h-10 w-10 rounded-xl gradient-primary flex items-center justify-center shadow-lg group-hover:shadow-xl transition-smooth">
                <LayoutGrid className="h-5 w-5 text-white" />
              </div>
              <span className="font-condensed text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                WAREHOUSE ROTA
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                href="/"
                className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
              >
                Rota
              </Link>
              <Link
                href="/staff"
                className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
              >
                Staff
              </Link>
              <Link
                href="/config"
                className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth"
              >
                Config
              </Link>
              <Link
                href="/analytics"
                className="px-4 py-2 text-sm font-mono rounded-xl hover:bg-primary/10 hover:text-primary transition-smooth flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <NotificationCenter />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2 rounded-xl hover:bg-destructive/10 hover:text-destructive transition-smooth"
            >
              <LogOut className="h-4 w-4" />
              <span className="font-mono text-xs">Logout</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="container py-8">{children}</main>
    </div>
  );
}