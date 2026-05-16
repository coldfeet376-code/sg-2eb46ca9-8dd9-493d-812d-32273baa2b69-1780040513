import "@/styles/globals.css";
import { useEffect } from "react";
import { useRouter } from "next/router";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuditProvider } from "@/contexts/AuditContext";

function AuthWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    // Skip auth check for login page
    if (router.pathname === "/login") return;

    // Check if user is authenticated
    const isLoggedIn = localStorage.getItem("warehouse-auth");
    if (!isLoggedIn || isLoggedIn !== "true") {
      router.push("/login");
    }
  }, [router.pathname, router]);

  // Don't render protected pages until auth check is complete
  if (router.pathname !== "/login") {
    const isLoggedIn = typeof window !== "undefined" && localStorage.getItem("warehouse-auth") === "true";
    if (!isLoggedIn) return null;
  }

  return <>{children}</>;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <AuditProvider>
        <NotificationProvider>
          <AuthWrapper>
            <Component {...pageProps} />
          </AuthWrapper>
        </NotificationProvider>
      </AuditProvider>
    </ThemeProvider>
  );
}
