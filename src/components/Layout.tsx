import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Calendar, Users, Settings, BarChart3, ArrowLeftRight, UserCog, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { UserProfileDropdown } from "./UserProfileDropdown";
import { supabase } from "@/integrations/supabase/client";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setIsAdmin(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .maybeSingle();

      setIsAdmin(profile?.is_admin === true);
    } catch (error) {
      console.error("Error checking admin status:", error);
      setIsAdmin(false);
    }
  };

  const navigation = [
    { name: "Rota", href: "/", icon: Calendar },
    { name: "Staff", href: "/staff", icon: Users },
    { name: "Managers", href: "/managers", icon: UserCog },
    { name: "Swaps", href: "/swaps", icon: ArrowLeftRight },
    { name: "Import", href: "/import", icon: Upload },
    { name: "Config", href: "/config", icon: Settings },
    { name: "Analytics", href: "/analytics", icon: BarChart3 },
  ];

  if (isAdmin) {
    navigation.push({ name: "Admin", href: "/admin/setup", icon: Settings });
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2 group">
                <Calendar className="h-6 w-6 text-primary transition-transform group-hover:scale-110" />
                <span className="font-bold text-xl tracking-tight">Warehouse Rota</span>
              </Link>

              <div className="hidden md:flex items-center gap-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = router.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>

            <UserProfileDropdown />
          </div>
        </div>
      </nav>

      <main className="container mx-auto py-8 px-4 max-w-7xl">
        {children}
      </main>
    </div>
  );
}