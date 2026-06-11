import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { NetworkStatusProvider } from "@/components/network-status";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/components/ui/toast";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Pegasus",
  description: "Panel administrativo Pegasus",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${poppins.variable} h-full antialiased`}
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
