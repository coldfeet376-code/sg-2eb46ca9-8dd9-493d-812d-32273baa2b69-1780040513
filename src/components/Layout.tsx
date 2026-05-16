import Link from "next/link";
import { Calendar, Users, Settings, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <LayoutGrid className="h-5 w-5 text-primary" />
              <span className="font-condensed text-lg font-bold tracking-tight">
                WAREHOUSE ROTA
              </span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link href="/">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-mono text-xs">Rota</span>
                </Button>
              </Link>
              <Link href="/staff">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Users className="h-4 w-4" />
                  <span className="font-mono text-xs">Staff</span>
                </Button>
              </Link>
              <Link href="/config">
                <Button variant="ghost" size="sm" className="gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="font-mono text-xs">Config</span>
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}