/**
 * usePageTracker
 * Fires a page view event on every route change and sends a heartbeat
 * every 30 seconds so the admin stats page can show "active now" counts.
 */
import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

// Generate or retrieve a stable session ID for this browser tab
function getSessionId(): string {
  const key = "mmm_sid";
  let sid = sessionStorage.getItem(key);
  if (!sid) {
    sid = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(key, sid);
  }
  return sid;
}

export function usePageTracker() {
  const [location] = useLocation();
  const sessionId = useRef(getSessionId());
  const lastTrackedPath = useRef<string | null>(null);

  const trackView = trpc.siteAnalytics.trackView.useMutation();
  const heartbeat = trpc.siteAnalytics.heartbeat.useMutation();

  // Track page view on route change
  useEffect(() => {
    const path = location;
    if (path === lastTrackedPath.current) return;
    lastTrackedPath.current = path;
    trackView.mutate({
      path,
      sessionId: sessionId.current,
      referrer: document.referrer || undefined,
    });
  }, [location]);

  // Heartbeat every 30 seconds
  useEffect(() => {
    function sendHeartbeat() {
      heartbeat.mutate({
        path: lastTrackedPath.current ?? location,
        sessionId: sessionId.current,
      });
    }
    sendHeartbeat(); // send immediately on mount
    const interval = setInterval(sendHeartbeat, 30_000);
    return () => clearInterval(interval);
  }, []);
}
