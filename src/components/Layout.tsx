import Link from "next/link";
import { Calendar, Users, Settings, LayoutGrid, BarChart3 } from "lucide-react";
import { NotificationCenter } from "@/components/NotificationCenter";

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
              <Link
                href="/"
                className="px-3 py-1.5 text-sm font-mono rounded-md hover:bg-muted transition-colors"
              >
                Rota
              </Link>
              <Link
                href="/staff"
                className="px-3 py-1.5 text-sm font-mono rounded-md hover:bg-muted transition-colors"
              >
                Staff
              </Link>
              <Link
                href="/config"
                className="px-3 py-1.5 text-sm font-mono rounded-md hover:bg-muted transition-colors"
              >
                Config
              </Link>
              <Link
                href="/analytics"
                className="px-3 py-1.5 text-sm font-mono rounded-md hover:bg-muted transition-colors flex items-center gap-1.5"
              >
                <BarChart3 className="h-3.5 w-3.5" />
                Analytics
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <NotificationCenter />
          </div>
        </div>
      </header>
      <main className="container py-6">{children}</main>
    </div>
  );
}