/* ============================================================
   PWAInstallBanner — shows an "Add to Home Screen" prompt
   - Android/Chrome: intercepts the native beforeinstallprompt event
   - iOS Safari: shows manual instructions (no native API)
   - Dismissed state persisted in localStorage for 30 days
   ============================================================ */
import { useEffect, useState } from "react";
import { X, Download, Share } from "lucide-react";

const DISMISSED_KEY = "mmm_pwa_dismissed";
const DISMISS_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isDismissed(): boolean {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    if (!ts) return false;
    return Date.now() - parseInt(ts, 10) < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
  } catch {}
}

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSHint, setShowIOSHint] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Already installed or dismissed
    if (isInStandaloneMode() || isDismissed()) return;

    if (isIOS()) {
      // iOS Safari: show manual hint
      setShowIOSHint(true);
      setVisible(true);
      return;
    }

    // Android / Chrome: listen for install prompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setVisible(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] border-t border-red-600/40 bg-[#0d0000]/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3 shadow-[0_-4px_24px_rgba(209,0,0,0.15)]"
      role="banner"
      aria-label="Add to Home Screen"
    >
      {/* Logo */}
      <img
        src="/manus-storage/mmm_logo_8689da6b.png"
        alt="Murder Mitten Media"
        className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-red-600/40"
      />

      {/* Text */}
      <div className="flex-1 min-w-0">
        {showIOSHint ? (
          <>
            <div className="font-semibold text-white text-sm leading-tight">Add to Home Screen</div>
            <div className="text-white/50 text-xs mt-0.5 flex items-center gap-1 flex-wrap">
              Tap
              <Share className="w-3.5 h-3.5 text-blue-400 inline flex-shrink-0" />
              then <span className="text-white/70 font-semibold">"Add to Home Screen"</span>
            </div>
          </>
        ) : (
          <>
            <div className="font-semibold text-white text-sm leading-tight">Install Murder Mitten Media</div>
            <div className="text-white/50 text-xs mt-0.5">Add to your home screen for the full experience</div>
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {!showIOSHint && deferredPrompt && (
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider px-3 py-2 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </button>
        )}
        <button
          onClick={handleDismiss}
          className="text-white/30 hover:text-white/70 transition-colors p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
