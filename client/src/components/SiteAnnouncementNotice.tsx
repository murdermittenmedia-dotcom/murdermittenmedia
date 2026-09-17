import { useEffect, useState } from "react";
import { ArrowUpRight, Bell, X } from "lucide-react";
import { io } from "socket.io-client";
import { trpc } from "@/lib/trpc";

type SiteAnnouncement = {
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
  publishedAt: number;
};

const DISMISSED_ANNOUNCEMENT_KEY = "mmm-dismissed-site-announcement";

function getDismissedAnnouncement() {
  try {
    const stored = window.localStorage.getItem(DISMISSED_ANNOUNCEMENT_KEY);
    const parsed = stored ? Number(stored) : null;
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** A persistent, admin-published notice with instant Socket.IO updates for open sessions. */
export function SiteAnnouncementNotice() {
  const utils = trpc.useUtils();
  const { data: savedAnnouncement } = trpc.announcements.getActive.useQuery(undefined, {
    refetchInterval: 120_000,
    refetchOnWindowFocus: true,
  });
  const [liveAnnouncement, setLiveAnnouncement] = useState<SiteAnnouncement | null | undefined>(undefined);
  const [dismissedPublishedAt, setDismissedPublishedAt] = useState<number | null>(getDismissedAnnouncement);

  useEffect(() => {
    setLiveAnnouncement(savedAnnouncement ?? null);
  }, [savedAnnouncement]);

  useEffect(() => {
    const socket = io(window.location.origin, { path: "/api/socket.io" });
    socket.on("site:announcement", (next: SiteAnnouncement | null) => {
      setLiveAnnouncement(next);
      utils.announcements.getActive.setData(undefined, next);
    });
    return () => {
      socket.disconnect();
    };
  }, [utils]);

  const announcement = liveAnnouncement === undefined ? savedAnnouncement : liveAnnouncement;
  if (!announcement || dismissedPublishedAt === announcement.publishedAt) return null;

  const isExternal = !!announcement.actionUrl && /^https?:\/\//i.test(announcement.actionUrl);
  const dismiss = () => {
    setDismissedPublishedAt(announcement.publishedAt);
    try {
      window.localStorage.setItem(DISMISSED_ANNOUNCEMENT_KEY, String(announcement.publishedAt));
    } catch {
      // Keep the dismissal for this session even if storage is unavailable.
    }
  };

  return (
    <aside
      aria-label="Site announcement"
      aria-live="polite"
      className="fixed bottom-24 right-4 z-[90] w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-red-500/35 bg-[#100b0c]/95 text-white shadow-[0_18px_70px_rgba(0,0,0,0.58)] backdrop-blur-xl"
    >
      <div className="h-1 bg-gradient-to-r from-red-700 via-red-400 to-red-700" />
      <div className="relative px-4 pb-4 pt-3 sm:px-5">
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss announcement"
          className="absolute right-3 top-3 rounded-md p-1.5 text-white/40 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 pr-9 text-[10px] font-black uppercase tracking-[0.22em] text-red-300">
          <Bell className="h-3.5 w-3.5" />
          From Murder Mitten
        </div>
        <h2 className="mt-2 pr-8 text-base font-bold leading-tight text-white sm:text-lg">{announcement.title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-white/65">{announcement.message}</p>
        {announcement.actionUrl && (
          <a
            href={announcement.actionUrl}
            target={isExternal ? "_blank" : undefined}
            rel={isExternal ? "noreferrer" : undefined}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-white transition-colors hover:bg-red-500 focus:outline-none focus:ring-2 focus:ring-red-300"
          >
            {announcement.actionLabel || "Open"}
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </aside>
  );
}
