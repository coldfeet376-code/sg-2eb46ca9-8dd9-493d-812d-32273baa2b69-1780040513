import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { NotificationProvider } from "@/contexts/NotificationContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <NotificationProvider>
        <Component {...pageProps} />
      </NotificationProvider>
    </ThemeProvider>
  );
}
