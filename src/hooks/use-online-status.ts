"use client";

// Real network-reachability based online/offline tracking.
// Combines browser link-state events (navigator.onLine) with an actual
// server probe so "Online" only shows when the backend is truly reachable,
// and "Offline" reflects a genuinely unreachable server (e.g. dead WiFi
// with no Internet), not just a disconnected network card.

import { useCallback, useEffect, useRef, useState } from "react";

const PROBE_URL = "/api/health";
const PROBE_INTERVAL_MS = 15_000;
const PROBE_TIMEOUT_MS = 5_000;
// Consecutive failed probes required before flipping to offline, to avoid
// flicker on a single slow/transient request.
const DISCONNECT_THRESHOLD = 2;

async function probeServer(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    const res = await fetch(PROBE_URL, {
      cache: "no-store",
      signal: controller.signal,
      headers: { "x-mediflow-probe": "1" },
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineRef = useRef(false);
  const failedProbesRef = useRef(0);

  const markOnline = useCallback(() => {
    if (wasOfflineRef.current) {
      setWasOffline(true);
      wasOfflineRef.current = false;
      window.setTimeout(() => setWasOffline(false), 3000);
    }
    failedProbesRef.current = 0;
    setIsOnline(true);
  }, []);

  const markOffline = useCallback(() => {
    wasOfflineRef.current = true;
    setIsOnline(false);
  }, []);

  useEffect(() => {
    const check = async () => {
      if (typeof navigator === "undefined") return;
      // If the OS already reports a broken link, skip the probe.
      if (!navigator.onLine) {
        markOffline();
        return;
      }
      const reachable = await probeServer();
      if (reachable) {
        markOnline();
      } else {
        failedProbesRef.current += 1;
        if (failedProbesRef.current >= DISCONNECT_THRESHOLD) markOffline();
      }
    };

    const handleOnline = () => {
      failedProbesRef.current = 0;
      void check();
    };
    const handleOffline = () => markOffline();

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const interval = window.setInterval(() => void check(), PROBE_INTERVAL_MS);
    void check();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.clearInterval(interval);
    };
  }, [markOnline, markOffline]);

  return { isOnline, wasOffline };
}