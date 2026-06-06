import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { ReactNode } from "react";

export const metadata = {
  title: "Snack Roque — Sistema de Gestión v3.1",
  description: "Sistema Profesional de Gestión para Panadería & Pastelería Snack Roque",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c6af7" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Snack Roque" />
        <link rel="apple-touch-icon" href="/asset/logo.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js')
                    .then(function(reg) { console.log('SW registrado:', reg.scope); })
                    .catch(function(err) { console.log('SW error:', err); });
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
