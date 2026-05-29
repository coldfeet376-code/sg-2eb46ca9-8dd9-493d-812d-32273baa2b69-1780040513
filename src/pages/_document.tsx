import { Html, Head, Main, NextScript } from "next/document";

import { SEOElements } from "@/components/SEO";
export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <SEOElements />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" />
        <meta name="application-name" content="Warehouse Rota" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Warehouse Rota" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0F172A" />
        <script
          src="https://cdn.softgen.ai/script.js"
          async
          data-softgen-monitoring="true"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const hasReloaded = sessionStorage.getItem('sw_force_reload');

                if (!hasReloaded && 'serviceWorker' in navigator) {
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    return Promise.all(registrations.map(function(registration) {
                      return registration.unregister();
                    }));
                  }).then(function() {
                    if ('caches' in window) {
                      return caches.keys().then(function(names) {
                        return Promise.all(names.map(function(name) {
                          return caches.delete(name);
                        }));
                      });
                    }
                  }).then(function() {
                    sessionStorage.setItem('sw_force_reload', 'true');
                    window.location.reload();
                  });
                }
              })();
            `,
          }}
        />
      </Head>
      <body className="min-h-screen w-full scroll-smooth bg-background text-foreground antialiased">
        <Main />
        <NextScript />
        {process.env.NODE_ENV === "development" && (
          <script
            src="https://cdn.softgen.dev/visual-editor.min.js"
            async
            data-softgen-visual-editor="true"
          />
        )}
      </body>
    </Html>
  );
}
