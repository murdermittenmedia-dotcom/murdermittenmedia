export type PastedArticleLink = { url: string; label?: string };

/**
 * Parses copied artist link sheets such as:
 *
 * Music
 * Spotify: https://...
 * Social
 * Instagram: https://...
 * Music Videos
 * CHRIS ROCC (Official Video): https://...
 *
 * Headings are ignored; every labeled or unlabeled URL is preserved.
 */
export function parsePastedArticleLinks(value: string): PastedArticleLink[] {
  const results: PastedArticleLink[] = [];
  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pipeParts = line.split("|");
    const candidate = pipeParts[0]?.trim() ?? "";
    const explicitLabel = pipeParts.slice(1).join("|").trim();
    const matches = Array.from(candidate.matchAll(/https?:\/\/[^\s<>()]+/gi));
    if (!matches.length) continue;
    for (const match of matches) {
      const url = match[0].replace(/[),.;!?]+$/, "");
      const before = candidate.slice(0, match.index ?? 0).trim().replace(/[|\-–—:]+$/, "").trim();
      const after = candidate.slice((match.index ?? 0) + match[0].length).trim().replace(/^[|\-–—:]+/, "").trim();
      const label = explicitLabel || before || after || undefined;
      results.push(label ? { url, label } : { url });
    }
  }
  return results;
}
