import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { CompareProvider } from "@lp/components/compare/compare-provider";
import { CompareTray } from "@lp/components/compare/compare-tray";
import { DetailDrawer } from "@lp/components/light/detail-drawer";
import { DrawerProvider } from "@lp/components/light/drawer-provider";
import { LightStateProvider } from "@lp/components/light/light-state";
import { PwaClient } from "@lp/components/pwa/pwa-client";
import { SiteHeader } from "@lp/components/site-header";
import { Toaster } from "@lp/components/ui/sonner";
import { TooltipProvider } from "@lp/components/ui/tooltip";
import "@lp/globals.tailwind.css";

// Server actions run inside the page's function, and Vercel Hobby's default limit is 10 s.
// "Run sync now", radar refresh and test notifications can take longer; 60 s is the plan's cap.
export const maxDuration = 60;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "LumenPulse: flashlight releases, restocks & specs", template: "%s · LumenPulse" },
  description:
    "Parametric flashlight discovery for enthusiasts: filter by emitter, CCT, CRI, battery and firmware, track new releases and restocks across stores, and get instant alerts.",
  applicationName: "LumenPulse",
  manifest: "/flashlights/manifest.json",
  appleWebApp: { capable: true, title: "LumenPulse", statusBarStyle: "black-translucent" },
  icons: {
    icon: [
      { url: "/flashlights/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/flashlights/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/flashlights/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/flashlights/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#090D16",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/flashlights">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <LightStateProvider>
            <CompareProvider>
              <DrawerProvider>
                <SiteHeader />
                <main className="flex-1 pb-24">{children}</main>
                <CompareTray />
                <DetailDrawer />
                <PwaClient />
                <Toaster theme="dark" position="top-center" richColors closeButton />
              </DrawerProvider>
            </CompareProvider>
          </LightStateProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
