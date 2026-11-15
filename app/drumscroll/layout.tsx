import type { Metadata, Viewport } from "next";
import { databaseMissing } from "@ds/server/db";
import "@ds/drumscroll.tailwind.css";

export const maxDuration = 60;

export const metadata: Metadata = {
  title: "DrumScroll · Free Snare & Drumset Transcriptions",
  description:
    "Browse free DCI, WGI, rudimental snare and jazz/funk drumset sheet music transcriptions in a Pinterest-style Gallery Grid or TikTok-style Vertical Swipe Feed.",
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function DrumScrollLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark h-full antialiased">
      <body className="min-h-full bg-zinc-950 text-zinc-100">
        {databaseMissing() ? (
          <div className="mx-auto max-w-md px-4 py-24 text-center">
            <h1 className="text-xl font-semibold text-zinc-100">
              DrumScroll isn&apos;t connected to a database yet
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              In the Vercel project, open Storage, connect a Neon Postgres database so{" "}
              <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-amber-300">DATABASE_URL</code>{" "}
              is set, and redeploy.
            </p>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
