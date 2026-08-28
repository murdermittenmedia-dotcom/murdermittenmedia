export function getWheelCatalogueMatchKey(userId: number, title: string): string {
  return `${userId}:${title.trim().toLocaleLowerCase()}`;
}

export function buildWheelCatalogueSong(input: {
  userId: number;
  title: string;
  artistName: string;
  songUrl?: string | null;
  fileKey?: string | null;
  fileUrl?: string | null;
}) {
  return {
    userId: input.userId,
    title: input.title.trim(),
    artistName: input.artistName.trim(),
    fileKey: input.fileKey ?? null,
    fileUrl: input.fileUrl ?? null,
    externalUrl: input.fileKey || input.fileUrl ? null : input.songUrl ?? null,
    isPublic: true,
  };
}
