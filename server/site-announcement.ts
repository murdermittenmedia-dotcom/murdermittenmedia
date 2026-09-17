export type SiteAnnouncement = {
  title: string;
  message: string;
  actionLabel: string | null;
  actionUrl: string | null;
  publishedAt: number;
};

type SiteAnnouncementBroadcaster = (announcement: SiteAnnouncement | null) => void;

let broadcaster: SiteAnnouncementBroadcaster | null = null;

/** Registers the live Socket.IO publisher without coupling application routers to HTTP setup. */
export function setSiteAnnouncementBroadcaster(next: SiteAnnouncementBroadcaster | null) {
  broadcaster = next;
}

/** Publishes an active announcement or a dismissal to connected site visitors. */
export function broadcastSiteAnnouncement(announcement: SiteAnnouncement | null) {
  broadcaster?.(announcement);
}
