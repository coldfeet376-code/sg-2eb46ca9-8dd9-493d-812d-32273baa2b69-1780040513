import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NotificationCenter } from "@/components/NotificationCenter";
import { UserProfileDropdown } from "@/components/UserProfileDropdown";
import { Home, Users, UserCog, Settings, BarChart3, ArrowLeftRight, Upload } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Optional: Try to get current user, but don't require it
  useEffect(() => {
    const loadUser = async () => {
      try {
        const { authService } = await import("@/services/authService");
        const user = await authService.getCurrentUser();
        setCurrentUser(user);
      } catch (error) {
        // Ignore - app works without auth
        console.log("No user logged in");
      }
    };
    loadUser();
  }, []);

  const navItems = [
    { href: "/", icon: Home, label: "Rota" },
    { href: "/staff", icon: Users, label: "Staff" },
    { href: "/managers", icon: UserCog, label: "Managers" },
    { href: "/config", icon: Settings, label: "Config" },
    { href: "/analytics", icon: BarChart3, label: "Analytics" },
    { href: "/swaps", icon: ArrowLeftRight, label: "Swaps" },
    { href: "/import", icon: Upload, label: "Import" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <span className="font-condensed text-lg font-bold tracking-tight">
                GIST ROTA
              </span>
            </Link>
          </div>

          <nav className="flex items-center space-x-1 text-sm font-sans flex-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = router.pathname === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="hidden sm:inline">{item.label}</span>
                  </Button>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <NotificationCenter />
            {currentUser ? (
              <UserProfileDropdown user={currentUser} />
            ) : (
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Login
                </Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="container py-6">{children}</main>
    </div>
  );
}