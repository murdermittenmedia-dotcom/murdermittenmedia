export type ArticleLinkPlatform =
  | "spotify"
  | "apple"
  | "youtube"
  | "soundcloud"
  | "audiomack"
  | "tidal"
  | "deezer"
  | "bandcamp"
  | "instagram"
  | "tiktok"
  | "twitter"
  | "facebook"
  | "website";

export type ArticleCatalogLink = {
  url: string;
  platform: ArticleLinkPlatform;
  label: string;
  embedUrl?: string;
  category: "player" | "social" | "link";
};

function youtubeId(url: URL) {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
  return index >= 0 ? parts[index + 1] : null;
}

function defaultLabel(platform: ArticleLinkPlatform, index: number) {
  if (platform === "instagram") return "Instagram";
  if (platform === "tiktok") return "TikTok";
  if (platform === "twitter") return "X / Twitter";
  if (platform === "facebook") return "Facebook";
  if (platform === "website") return "Official Website";
  return index === 0 ? "Latest Release" : index === 1 ? "Latest Project" : "Featured Track";
}

function hostPlatform(host: string): ArticleLinkPlatform | null {
  if (host === "open.spotify.com" || host === "spotify.link") return "spotify";
  if (host === "music.apple.com" || host === "itunes.apple.com") return "apple";
  if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) return "youtube";
  if (host === "soundcloud.com" || host === "on.soundcloud.com") return "soundcloud";
  if (host === "audiomack.com") return "audiomack";
  if (host === "tidal.com") return "tidal";
  if (host === "deezer.com" || host === "link.deezer.com") return "deezer";
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) return "bandcamp";
  if (host === "instagram.com") return "instagram";
  if (host === "tiktok.com") return "tiktok";
  if (["twitter.com", "x.com"].includes(host)) return "twitter";
  if (host === "facebook.com" || host === "fb.com") return "facebook";
  return "website";
}

export function normalizeArticleCatalogLinks(input: Array<{ url: string; label?: string }>): ArticleCatalogLink[] {
  return input.flatMap<ArticleCatalogLink>((item, index) => {
    try {
      const parsed = new URL(item.url.trim());
      if (!/^https?:$/.test(parsed.protocol)) return [];
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      const platform = hostPlatform(host);
      if (!platform) return [];
      const label = item.label?.trim() || defaultLabel(platform, index);

      if (platform === "spotify") {
        const path = parsed.hostname === "spotify.link" ? "" : parsed.pathname.replace(/^\//, "");
        return [{ url: parsed.toString(), platform, label, category: "player", ...(path ? { embedUrl: `https://open.spotify.com/embed/${path}` } : {}) }];
      }
      if (platform === "apple") {
        const path = parsed.pathname.replace(/^\//, "");
        return [{ url: parsed.toString(), platform, label, category: "player", ...(path ? { embedUrl: `https://embed.music.apple.com/${path}${parsed.search}` } : {}) }];
      }
      if (platform === "youtube") {
        const id = youtubeId(parsed);
        return [{ url: parsed.toString(), platform, label, category: id ? "player" : "link", ...(id ? { embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}` } : {}) }];
      }
      if (platform === "soundcloud") {
        return [{ url: parsed.toString(), platform, label, category: "player", embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(parsed.toString())}&color=%23e10600&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false` }];
      }
      const category = ["instagram", "tiktok", "twitter", "facebook"].includes(platform) ? "social" : "link";
      return [{ url: parsed.toString(), platform, label, category }];
    } catch {
      return [];
    }
  });
}
