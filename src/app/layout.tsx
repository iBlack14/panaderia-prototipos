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
      </head>
      <body>
        <AppProvider>
          {children}
        </AppProvider>
      </body>
    </html>
  );
}
