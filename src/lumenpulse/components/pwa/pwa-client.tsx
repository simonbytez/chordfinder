"use client";

import { Download, Share, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@lp/components/ui/button";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISS_KEY = "lumenpulse.install-dismissed-at";
const DISMISS_DAYS = 14;

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return !!at && Date.now() - at < DISMISS_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** Registers /flashlights/sw.js and shows "Install app" (Chromium) or the iOS Add-to-Home-Screen walkthrough. */
export function PwaClient() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "ios">("hidden");

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/flashlights/sw.js", { scope: "/flashlights" }).catch((err) => console.warn("Service worker registration failed", err));
    }
    if (isStandalone() || recentlyDismissed()) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setMode("prompt");
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    const t = isIos() ? setTimeout(() => setMode("ios"), 2500) : undefined;
    const onInstalled = () => setMode("hidden");
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      if (t) clearTimeout(t);
    };
  }, []);

  const dismiss = () => {
    setMode("hidden");
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  };

  if (mode === "hidden") return null;

  return (
    <div role="dialog" aria-label="Install LumenPulse" className="fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-xl border border-amber/30 bg-popover p-4 shadow-2xl shadow-black/60 sm:bottom-6">
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded p-1 text-muted-foreground hover:bg-secondary" aria-label="Dismiss">
        <X className="size-4" />
      </button>
      <div className="flex gap-3">
        <div className="mt-0.5 size-9 shrink-0 rounded-lg bg-gradient-to-br from-amber to-orange-600 p-2 shadow-[0_0_16px_rgb(245_158_11/0.5)]">
          <Download className="size-5 text-black" />
        </div>
        <div className="space-y-2 pr-4">
          <p className="text-sm font-semibold">Install LumenPulse</p>
          {mode === "prompt" ? (
            <>
              <p className="text-xs text-muted-foreground">Get it on your home screen for instant release alerts and offline browsing.</p>
              <Button
                size="sm"
                onClick={async () => {
                  if (!deferred) return;
                  await deferred.prompt();
                  await deferred.userChoice;
                  setDeferred(null);
                  setMode("hidden");
                }}
              >
                Install app
              </Button>
            </>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
              <li>
                In Safari, tap <Share className="inline size-3.5 -translate-y-px text-sky" /> <span className="text-foreground">Share</span>.
              </li>
              <li>
                Choose <span className="text-foreground">Add to Home Screen</span>.
              </li>
              <li>
                Open LumenPulse from your home screen, then enable <span className="text-foreground">Web Push</span> on the Alerts page. iOS (16.4+) only
                delivers push to installed web apps.
              </li>
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
