import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { NetworkStatusProvider } from "@/components/network-status";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";

const inter = Inter({
  variable: "--font-sans-app",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pegaso",
  description: "Panel administrativo Pegaso",
  icons: {
    icon: "/LOGO_OFICIAL_PEGASO.jpeg",
    apple: "/LOGO_OFICIAL_PEGASO.jpeg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <ToastProvider>
            <NetworkStatusProvider>
              {children}
            </NetworkStatusProvider>
          </ToastProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
