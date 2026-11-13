"use client";

import { BellOff, BellRing, Loader2, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@lp/components/ui/button";

type State = "checking" | "unsupported" | "ios-install" | "no-vapid" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** Web Push permission + subscription for THIS device. */
export function PushToggle({ vapidPublicKey, deviceCount }: { vapidPublicKey: string; deviceCount: number }) {
  const router = useRouter();
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let next: State;
      if (!vapidPublicKey) next = "no-vapid";
      else if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) next = isIos() && !isStandalone() ? "ios-install" : "unsupported";
      else if (Notification.permission === "denied") next = "denied";
      else {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        next = sub ? "on" : "off";
      }
      if (!cancelled) setState(next);
    })().catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, [vapidPublicKey]);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) }));
      const res = await fetch("/api/flashlights/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
      setState("on");
      toast.success("Push enabled on this device");
      router.refresh();
    } catch (e) {
      toast.error("Couldn't enable push", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/flashlights/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
      setState("off");
      toast.success("Push disabled on this device");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const msg: Record<State, React.ReactNode> = {
    checking: "Checking this device…",
    unsupported: "This browser doesn't support Web Push. Use ntfy or Discord for phone buzzes.",
    "ios-install": (
      <>
        On iPhone/iPad, push only works for installed web apps: tap <b>Share → Add to Home Screen</b>, open LumenPulse from the home screen, then come back here.
      </>
    ),
    "no-vapid": (
      <>
        Server has no VAPID keys. Run <code className="rounded bg-secondary px-1">npm run lumenpulse:vapid</code> and restart.
      </>
    ),
    denied: "Notifications are blocked for this site. Re-allow them in your browser's site settings.",
    off: "Get native notifications on this device, even when LumenPulse is closed.",
    on: "This device will receive native push notifications.",
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3.5 sm:flex-row sm:items-center">
      <div className="flex flex-1 gap-3">
        <Smartphone className="mt-0.5 size-5 shrink-0 text-amber" />
        <div>
          <p className="text-sm font-medium">
            Web Push{" "}
            <span className="ml-1 font-mono text-[11px] text-muted-foreground">
              {deviceCount} device{deviceCount === 1 ? "" : "s"} subscribed
            </span>
          </p>
          <p className="text-xs text-muted-foreground">{msg[state]}</p>
        </div>
      </div>
      {(state === "off" || state === "on") && (
        <Button variant={state === "on" ? "outline" : "default"} size="sm" onClick={state === "on" ? disable : enable} disabled={busy}>
          {busy ? <Loader2 data-icon="inline-start" className="animate-spin" /> : state === "on" ? <BellOff data-icon="inline-start" /> : <BellRing data-icon="inline-start" />}
          {state === "on" ? "Disable on this device" : "Enable push"}
        </Button>
      )}
    </div>
  );
}
