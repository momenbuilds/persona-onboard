import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { MotionProvider } from "@/components/ui/MotionProvider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: { default: "Persona — Your personal intelligence", template: "%s · Persona" },
  description:
    "Persona is a personal AI assistant that gets things done. Start with a two-minute call and it learns what matters to you.",
  icons: { icon: "/brand/icon.svg", apple: "/brand/apple-icon.png" },
  openGraph: {
    title: "Persona — Your personal intelligence",
    description: "Start with a two-minute call. Persona learns what matters and gets to work.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="grain min-h-dvh bg-white font-sans text-ink antialiased">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
