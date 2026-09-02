"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export function useOnlineStatus(): {
  isOnline: boolean;
  wasOffline: boolean;
} {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const wasOfflineRef = useRef(false);

  const handleOnline = useCallback(() => {
    if (!navigator.onLine) return;
    setIsOnline(true);
    if (wasOfflineRef.current) {
      setWasOffline(true);
      wasOfflineRef.current = false;
      setTimeout(() => setWasOffline(false), 3000);
    }
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    wasOfflineRef.current = true;
  }, []);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
