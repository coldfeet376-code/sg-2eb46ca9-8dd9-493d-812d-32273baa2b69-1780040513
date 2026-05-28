import type { AppProps } from "next/app";
import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";
import "@/styles/globals.css";
import { Toaster } from "@/components/ui/toaster";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { TourProvider } from "@/contexts/TourContext";
import { UndoRedoProvider } from "@/contexts/UndoRedoContext";
import { AuditProvider } from "@/contexts/AuditContext";
import Layout from "@/components/Layout";
import InstallPrompt from "@/components/InstallPrompt";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  useEffect(() => {
    // Force cache refresh on navigation for mobile browsers
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        registrations.forEach(registration => registration.update());
      });
    }
  }, [router.pathname]);

  return (
    <>
      <Head>
        <meta httpEquiv="cache-control" content="no-cache, no-store, must-revalidate" />
        <meta httpEquiv="pragma" content="no-cache" />
        <meta httpEquiv="expires" content="0" />
        <meta name="version" content={`v${Date.now()}`} />
      </Head>
      <NotificationProvider>
        <TourProvider>
          <UndoRedoProvider>
            <AuditProvider>
              <Layout>
                <Component {...pageProps} />
              </Layout>
              <InstallPrompt />
              <Toaster />
            </AuditProvider>
          </UndoRedoProvider>
        </TourProvider>
      </NotificationProvider>
    </>
  );
}