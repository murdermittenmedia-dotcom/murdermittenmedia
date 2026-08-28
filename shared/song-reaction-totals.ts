export interface SongReactionSource {
  artistName: string;
  songTitle: string;
  fireCount?: number | null;
  trashCount?: number | null;
}

export interface CatalogueSong {
  artistName: string;
  title: string;
  [key: string]: unknown;
}

export function attachSongReactionTotals<
  T extends CatalogueSong,
  R extends SongReactionSource,
>(songs: T[], submissions: R[]) {
  const totals = new Map<string, { fireCount: number; trashCount: number }>();

  for (const submission of submissions) {
    const key = `${submission.artistName}\u0000${submission.songTitle}`;
    const current = totals.get(key) ?? { fireCount: 0, trashCount: 0 };
    current.fireCount += submission.fireCount ?? 0;
    current.trashCount += submission.trashCount ?? 0;
    totals.set(key, current);
  }

  return songs.map((song) => {
    const total = totals.get(`${song.artistName}\u0000${song.title}`) ?? {
      fireCount: 0,
      trashCount: 0,
    };
    return { ...song, ...total };
  });
}
