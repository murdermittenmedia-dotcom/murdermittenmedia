type ProfileSong = {
  id: number;
  title: string;
  artistName: string;
  fileKey?: string | null;
  fileUrl?: string | null;
  externalUrl?: string | null;
  genre?: string | null;
  isPublic: boolean;
  uploadedAt: Date;
  fireCount: number;
  trashCount: number;
};

type BattleRecord = {
  id: number;
  winnerArtistName: string;
  winnerSongTitle: string;
  winnerSongUrl?: string | null;
  loserArtistName: string;
  loserSongTitle: string;
  loserSongUrl?: string | null;
  battleDate: Date;
};

const titleKey = (title: string) => title.trim().toLocaleLowerCase();

export function mergeProfileSongs(
  catalogueSongs: ProfileSong[],
  battleRecords: BattleRecord[],
  artistName: string,
): ProfileSong[] {
  const merged = new Map<string, ProfileSong>();
  for (const song of catalogueSongs) merged.set(titleKey(song.title), song);

  let syntheticId = -1;
  for (const record of battleRecords) {
    const isWinner = record.winnerArtistName === artistName;
    const title = isWinner ? record.winnerSongTitle : record.loserSongTitle;
    const externalUrl = isWinner ? record.winnerSongUrl : record.loserSongUrl;
    const key = titleKey(title);
    if (!key) continue;
    const existing = merged.get(key);
    if (existing) {
      if (!existing.fileKey && !existing.fileUrl && !existing.externalUrl && externalUrl) {
        merged.set(key, { ...existing, externalUrl });
      }
      continue;
    }
    merged.set(key, {
      id: syntheticId--,
      title: title.trim(),
      artistName,
      fileKey: null,
      fileUrl: null,
      externalUrl: externalUrl ?? null,
      genre: null,
      isPublic: true,
      uploadedAt: record.battleDate,
      fireCount: 0,
      trashCount: 0,
    });
  }

  return Array.from(merged.values()).sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
}
