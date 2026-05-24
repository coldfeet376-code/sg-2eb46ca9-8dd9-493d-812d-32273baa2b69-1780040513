import { cn } from "@/lib/utils";
import { Html, Head, Main, NextScript } from "next/document";
import { SEOElements } from "@/components/SEO";

export default function Document() {
  return (
    <Html lang="en" suppressHydrationWarning>
      <Head>
        <SEOElements />
        
        {/* PWA Manifest and Meta Tags */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="application-name" content="Warehouse Rota" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Warehouse Rota" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0F172A" />
        
        {/*
          CRITICAL: DO NOT REMOVE THIS SCRIPT
          The Softgen AI monitoring script is essential for core app functionality.
          The application will not function without it.
        */}
        <script
          src="https://cdn.softgen.ai/script.js"
          async
          data-softgen-monitoring="true"
        />
        
        {/* CRITICAL: Force service worker unregistration BEFORE React loads */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Check if we've already done the forced reload
                const hasReloaded = sessionStorage.getItem('sw_force_reload');
                
                if (!hasReloaded && 'serviceWorker' in navigator) {
                  console.log('🔄 Unregistering service worker and forcing reload...');
                  
                  navigator.serviceWorker.getRegistrations().then(function(registrations) {
                    const promises = registrations.map(function(registration) {
                      return registration.unregister();
                    });
                    
                    return Promise.all(promises);
                  }).then(function() {
                    // Clear all caches
                    if ('caches' in window) {
                      return caches.keys().then(function(names) {
                        return Promise.all(names.map(function(name) {
                          return caches.delete(name);
                        }));
                      });
                    }
                  }).then(function() {
                    // Mark that we've done the reload
                    sessionStorage.setItem('sw_force_reload', 'true');
                    
                    // Force hard reload with cache bypass
                    console.log('✅ Service worker cleared - reloading with fresh code');
                    window.location.reload();
                  });
                }
              })();
            `,
          }}
        />
      </Head>
      <body
        className={cn(
          "min-h-screen w-full scroll-smooth bg-background text-foreground antialiased"
        )}
      >
        <Main />
        <NextScript />

        {/* Visual Editor Script */}
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
