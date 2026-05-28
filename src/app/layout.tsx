import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gestor de Horarios - STAFF",
  description: "Gestor de horarios del personal para organizar turnos, proformas y novedades.",
  keywords: ["horarios", "schedule", "staff", "gestor", "proformas"],
  authors: [{ name: "Alvaro Enrique Cascante Moraga" }],
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "Gestor de Horarios - STAFF",
    description: "Gestor de horarios del personal para organizar turnos y proformas.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
