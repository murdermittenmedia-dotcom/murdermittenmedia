export type LinkPreviewDraft = {
  type: string;
  title: string;
  url: string;
  subtitle: string;
  platform: string;
  icon: string;
  thumbnailUrl: string;
};

export type LinkPreviewItem = {
  id: number;
  type: string;
  title: string;
  url?: string | null;
  subtitle?: string | null;
  platform?: string | null;
  icon?: string | null;
  thumbnailUrl?: string | null;
  isVisible: boolean;
};

export type PreviewLink = LinkPreviewDraft & {
  id: number | string;
  isVisible: boolean;
};

export function buildPreviewLinks(items: LinkPreviewItem[], drafts: Record<number, LinkPreviewDraft>, draft: LinkPreviewDraft): PreviewLink[] {
  return [
    ...items.map((item) => {
      const itemDraft = drafts[item.id];
      return {
        id: item.id,
        type: itemDraft?.type ?? item.type,
        title: itemDraft?.title ?? item.title,
        url: itemDraft?.url ?? item.url ?? "",
        subtitle: itemDraft?.subtitle ?? item.subtitle ?? "",
        platform: itemDraft?.platform ?? item.platform ?? "",
        icon: itemDraft?.icon ?? item.icon ?? "link",
        thumbnailUrl: itemDraft?.thumbnailUrl ?? item.thumbnailUrl ?? "",
        isVisible: item.isVisible,
      };
    }),
    ...(draft.title.trim() ? [{ id: "draft", ...draft, isVisible: true }] : []),
  ];
}
