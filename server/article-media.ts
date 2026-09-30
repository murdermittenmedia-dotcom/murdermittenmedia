export type ArticleCatalogLink = {
  url: string;
  platform: "spotify" | "apple" | "youtube";
  label: string;
  embedUrl: string;
};

function youtubeId(url: URL) {
  if (url.hostname === "youtu.be") return url.pathname.slice(1).split("/")[0];
  if (url.pathname === "/watch") return url.searchParams.get("v");
  const parts = url.pathname.split("/").filter(Boolean);
  const index = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
  return index >= 0 ? parts[index + 1] : null;
}

export function normalizeArticleCatalogLinks(input: Array<{ url: string; label?: string }>): ArticleCatalogLink[] {
  return input.flatMap<ArticleCatalogLink>((item, index) => {
    try {
      const parsed = new URL(item.url.trim());
      const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
      const label = item.label?.trim() || (index === 0 ? "Latest Release" : index === 1 ? "Latest Project" : "Featured Track");
      if (host === "open.spotify.com" || host === "spotify.link") {
        const path = parsed.pathname.replace(/^\//, "");
        if (!path) return [];
        return [{ url: parsed.toString(), platform: "spotify", label, embedUrl: `https://open.spotify.com/embed/${path}` }];
      }
      if (host === "music.apple.com") {
        const path = parsed.pathname.replace(/^\//, "");
        if (!path) return [];
        return [{ url: parsed.toString(), platform: "apple", label, embedUrl: `https://embed.music.apple.com/${path}${parsed.search}` }];
      }
      if (["youtube.com", "m.youtube.com", "youtu.be"].includes(host)) {
        const id = youtubeId(parsed);
        if (!id) return [];
        return [{ url: parsed.toString(), platform: "youtube", label, embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}` }];
      }
    } catch {
      return [];
    }
    return [];
  });
}
