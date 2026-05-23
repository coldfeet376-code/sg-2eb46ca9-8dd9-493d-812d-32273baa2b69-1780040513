import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TourProvider } from "@/contexts/TourContext";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { authService } from "@/services/authService";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    // Check authentication on mount
    const checkAuth = async () => {
      try {
        const session = await authService.getSession();
        
        // Public routes that don't require auth
        const publicRoutes = ["/login", "/forgot-password", "/reset-password"];
        const isPublicRoute = publicRoutes.includes(router.pathname);

        if (!session && !isPublicRoute) {
          router.push("/login");
        } else if (session && router.pathname === "/login") {
          router.push("/");
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsAuthChecking(false);
      }
    };

    checkAuth();

    // Subscribe to auth changes
    const { data: authListener } = authService.onAuthStateChange((session) => {
      if (!session && router.pathname !== "/login") {
        router.push("/login");
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [router.pathname]);

  // Show loading state while checking auth
  if (isAuthChecking && router.pathname !== "/login") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-8 w-8 mx-auto border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground font-sans">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <TourProvider>
            <UndoRedoProvider>
              <AuditProvider>
                <Component {...pageProps} />
                <Toaster />
              </AuditProvider>
            </UndoRedoProvider>
          </TourProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
