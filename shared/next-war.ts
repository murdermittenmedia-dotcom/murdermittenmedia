export type WinnerEntryForAdvance = {
  userId?: number | null;
  artistName: string;
  songTitle: string;
  songUrl?: string | null;
  roundNumber?: number | null;
  status: string;
};

export function buildNextWarEntries(entries: WinnerEntryForAdvance[]) {
  const alreadyAdvanced = new Set(
    entries
      .filter(entry => entry.status === "active" || entry.status === "pending")
      .map(entry => `${entry.userId ?? entry.artistName}|${entry.songTitle.trim().toLocaleLowerCase()}|${entry.roundNumber ?? 1}`),
  );
  return entries
    .filter(entry => entry.status === "winner")
    .filter(entry => !alreadyAdvanced.has(`${entry.userId ?? entry.artistName}|${entry.songTitle.trim().toLocaleLowerCase()}|${(entry.roundNumber ?? 1) + 1}`))
    .map(entry => ({
      userId: entry.userId ?? null,
      artistName: entry.artistName,
      songTitle: entry.songTitle,
      songUrl: entry.songUrl ?? null,
      contactInfo: null,
      paid: false,
      paymentConfirmed: true,
      status: "active" as const,
      wheelPosition: 0,
      roundNumber: (entry.roundNumber ?? 1) + 1,
    }));
}
