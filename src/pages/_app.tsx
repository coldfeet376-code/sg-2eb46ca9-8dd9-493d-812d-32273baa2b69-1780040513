import { useEffect } from "react";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { AuditProvider } from "@/contexts/AuditContext";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { TourProvider } from "@/contexts/TourContext";
import { InstallPrompt } from "@/components/InstallPrompt";
import { Toaster } from "@/components/ui/toaster";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Register service worker for PWA
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker registered:", registration.scope);
          
          // Check for updates
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.log("New service worker available");
                  // Optionally prompt user to reload
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn("Service Worker registration failed:", error);
        });
    }
  }, []);

  return (
    <ThemeProvider>
      <NotificationProvider>
        <AuditProvider>
          <UndoRedoProvider>
            <TourProvider>
              <Component {...pageProps} />
              <InstallPrompt />
              <Toaster />
            </TourProvider>
          </UndoRedoProvider>
        </AuditProvider>
      </NotificationProvider>
    </ThemeProvider>
  );
}
