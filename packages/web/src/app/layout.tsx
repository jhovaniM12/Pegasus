import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Inter } from "next/font/google";
import "./globals.css";
import { NetworkStatusProvider } from "@/components/network-status";
import { ServiceWorkerUpdateBanner } from "@/components/service-worker-update-banner";
import { ThemeProvider } from "@/components/theme-provider";
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
  applicationName: "Pegaso",
  appleWebApp: {
    capable: true,
    title: "Pegaso",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1d3d6b",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Script id="pegaso-sw-register" strategy="beforeInteractive">
          {`if("serviceWorker"in navigator){navigator.serviceWorker.register("/service-worker.js",{scope:"/"})}`}
        </Script>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <TooltipProvider>
            <ToastProvider>
              <NetworkStatusProvider>
                <ServiceWorkerUpdateBanner />
                {children}
              </NetworkStatusProvider>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
