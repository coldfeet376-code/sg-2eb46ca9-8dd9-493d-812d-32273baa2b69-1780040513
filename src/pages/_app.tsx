import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "@/components/ThemeProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { TourProvider } from "@/contexts/TourContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
    },
  },
});

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Remove auth check - allow access without login
  useEffect(() => {
    // Public routes - no auth needed anymore
    const publicRoutes = [
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password",
      "/admin/setup",
      "/", // Main page is now public
      "/staff",
      "/managers",
      "/config",
      "/analytics",
      "/swaps",
      "/import",
    ];
    
    // All routes are now accessible
    if (!mounted) return;
    
    // Optional: You can still redirect from login page if needed
    if (router.pathname === "/login") {
      router.push("/");
    }
  }, [router.pathname, mounted]);

  if (!mounted) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <NotificationProvider>
          <UndoRedoProvider>
            <AuditProvider>
              <TourProvider>
                <Component {...pageProps} />
                <Toaster />
              </TourProvider>
            </AuditProvider>
          </UndoRedoProvider>
        </NotificationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}