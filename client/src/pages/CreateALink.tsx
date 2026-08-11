import { useMemo, useState } from "react";
import { Link2, Plus, Trash2, ArrowUp, ArrowDown, Eye, EyeOff, ExternalLink, Copy, Check, Music2, Instagram, Youtube, Globe, Sparkles, Palette, Save, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";

const SOCIAL_PRESETS = [
  { platform: "Instagram", icon: "instagram", title: "Instagram", Icon: Instagram },
  { platform: "YouTube", icon: "youtube", title: "YouTube", Icon: Youtube },
  { platform: "Website", icon: "globe", title: "Website", Icon: Globe },
  { platform: "Music", icon: "music", title: "Listen to my music", Icon: Music2 },
] as const;

const THEME_OPTIONS = [
  { value: "midnight", label: "Midnight", background: "#080808", accent: "#d10000" },
  { value: "ember", label: "Ember", background: "#160b0b", accent: "#ff3b30" },
  { value: "ice", label: "Ice", background: "#07131d", accent: "#38bdf8" },
  { value: "violet", label: "Violet", background: "#110b1d", accent: "#a855f7" },
] as const;

type LinkDraft = {
  type: "social" | "release" | "custom" | "header";
  title: string;
  url: string;
  subtitle: string;
  platform: string;
  icon: string;
};

const emptyDraft: LinkDraft = {
  type: "custom",
  title: "",
  url: "",
  subtitle: "",
  platform: "",
  icon: "link",
};

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export default function CreateALink() {
  const { user, loading } = useAuth();
  const utils = trpc.useUtils();
  const [copied, setCopied] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageName, setNewPageName] = useState("");
  const [newPageBio, setNewPageBio] = useState("");
  const [draft, setDraft] = useState<LinkDraft>(emptyDraft);
  const [selectedSongId, setSelectedSongId] = useState("");
  const [drafts, setDrafts] = useState<Record<number, LinkDraft>>({});
  const [savingItemId, setSavingItemId] = useState<number | null>(null);

  const pageQuery = trpc.linkPages.mine.useQuery(undefined, { enabled: !!user });
  const songsQuery = trpc.songs.mine.useQuery(undefined, { enabled: !!user });
  const pageData = pageQuery.data;
  const page = pageData?.page;
  const items = pageData?.items ?? [];
  const songs = songsQuery.data ?? [];

  const createPage = trpc.linkPages.create.useMutation({
    onSuccess: async () => {
      toast.success("Your link page is ready");
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updatePage = trpc.linkPages.update.useMutation({
    onSuccess: async () => {
      toast.success("Page settings saved");
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const uploadAvatar = trpc.linkPages.uploadAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Avatar uploaded");
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const addItem = trpc.linkPages.addItem.useMutation({
    onSuccess: async () => {
      setDraft(emptyDraft);
      setSelectedSongId("");
      toast.success("Link added");
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const updateItem = trpc.linkPages.updateItem.useMutation({
    onSuccess: async () => {
      setSavingItemId(null);
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => {
      setSavingItemId(null);
      toast.error(error.message);
    },
  });
  const deleteItem = trpc.linkPages.deleteItem.useMutation({
    onSuccess: async () => {
      toast.success("Link removed");
      await utils.linkPages.mine.invalidate();
    },
    onError: (error) => toast.error(error.message),
  });
  const reorder = trpc.linkPages.reorder.useMutation({
    onSuccess: async () => await utils.linkPages.mine.invalidate(),
    onError: (error) => toast.error(error.message),
  });

  const publicHref = page ? `${window.location.origin}/link/${page.slug}` : "";
  const selectedTheme = useMemo(() => THEME_OPTIONS.find((theme) => theme.value === page?.theme) ?? THEME_OPTIONS[0], [page?.theme]);

  if (loading || (user && pageQuery.isLoading)) {
    return <div className="min-h-screen bg-[#080808] text-white grid place-items-center"><Loader2 className="w-7 h-7 animate-spin text-red-500" /></div>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <main className="container max-w-3xl pt-32 pb-20 px-4">
          <div className="border border-white/10 bg-white/[0.03] p-8 md:p-12 text-center">
            <Link2 className="w-10 h-10 mx-auto text-red-500 mb-5" />
            <p className="text-red-500 text-xs uppercase tracking-[0.3em] font-bold mb-3">Creator tools</p>
            <h1 className="font-['Anton'] text-4xl md:text-6xl uppercase">Create A Link</h1>
            <p className="text-white/60 mt-4 max-w-xl mx-auto">Build one clean page for your socials, music, releases, bookings, and every place your audience can find you.</p>
            <a href={getLoginUrl()} className="inline-flex mt-8 bg-red-600 hover:bg-red-500 px-6 py-3 text-xs font-black uppercase tracking-widest">Log in to start</a>
          </div>
        </main>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="min-h-screen bg-[#080808] text-white">
        <SiteNav />
        <main className="container max-w-3xl pt-32 pb-20 px-4">
          <div className="border border-white/10 bg-gradient-to-br from-red-950/30 via-white/[0.03] to-transparent p-7 md:p-10">
            <div className="flex items-center gap-3 mb-4"><Sparkles className="w-5 h-5 text-red-500" /><span className="text-red-500 text-xs font-bold uppercase tracking-[0.25em]">Your creator hub</span></div>
            <h1 className="font-['Anton'] text-4xl md:text-6xl uppercase">Create A Link</h1>
            <p className="text-white/60 mt-3">One page. Every link. Your audience should never have to hunt for your next release.</p>
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Link username</span><div className="flex mt-2"><span className="px-3 py-2.5 bg-white/5 border border-r-0 border-white/10 text-white/30 text-sm">/link/</span><Input value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))} placeholder="your-name" className="bg-white/5 border-white/10 text-white" /></div></label>
              <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Display name</span><Input value={newPageName} onChange={(e) => setNewPageName(e.target.value)} placeholder={user.artistName || user.name || "Your name"} className="mt-2 bg-white/5 border-white/10 text-white" /></label>
            </div>
            <label className="block mt-4"><span className="text-[10px] uppercase tracking-widest text-white/50">Short bio</span><Textarea value={newPageBio} onChange={(e) => setNewPageBio(e.target.value)} placeholder="Tell people what you make..." className="mt-2 bg-white/5 border-white/10 text-white min-h-24" /></label>
            <Button disabled={createPage.isPending} onClick={() => createPage.mutate({ slug: newPageSlug || undefined, displayName: newPageName || undefined, bio: newPageBio || undefined })} className="mt-6 bg-red-600 hover:bg-red-500 uppercase tracking-widest font-black"><Plus className="w-4 h-4 mr-2" />{createPage.isPending ? "Creating..." : "Create my link page"}</Button>
          </div>
        </main>
      </div>
    );
  }

  const getDraft = (item: typeof items[number]): LinkDraft => drafts[item.id] ?? {
    type: item.type,
    title: item.title,
    url: item.url ?? "",
    subtitle: item.subtitle ?? "",
    platform: item.platform ?? "",
    icon: item.icon ?? "link",
  };

  const updateDraft = (itemId: number, changes: Partial<LinkDraft>) => {
    const current = items.find((item) => item.id === itemId);
    if (!current) return;
    setDrafts((previous) => ({ ...previous, [itemId]: { ...getDraft(current), ...changes } }));
  };

  const saveItem = (itemId: number) => {
    const item = items.find((entry) => entry.id === itemId);
    if (!item) return;
    const itemDraft = getDraft(item);
    setSavingItemId(itemId);
    updateItem.mutate({
      pageId: page.id,
      itemId,
      type: itemDraft.type,
      title: itemDraft.title,
      url: itemDraft.url ? normalizeUrl(itemDraft.url) : null,
      subtitle: itemDraft.subtitle || null,
      platform: itemDraft.platform || null,
      icon: itemDraft.icon || null,
    });
  };

  const addNewItem = () => {
    if (!draft.title.trim()) return toast.error("Give this link a title");
    if (draft.type !== "header" && !draft.url.trim()) return toast.error("Add a URL for this link");
    addItem.mutate({
      pageId: page.id,
      type: draft.type,
      title: draft.title.trim(),
      url: draft.type === "header" ? null : normalizeUrl(draft.url),
      subtitle: draft.subtitle.trim() || null,
      platform: draft.platform.trim() || null,
      icon: draft.icon.trim() || null,
      songId: selectedSongId ? Number(selectedSongId) : null,
      sortOrder: items.length,
      isVisible: true,
    });
  };

  const addSocialPreset = (preset: typeof SOCIAL_PRESETS[number]) => {
    setDraft({ type: "social", title: preset.title, url: "", subtitle: "", platform: preset.platform, icon: preset.icon });
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((item) => item.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate({ pageId: page.id, itemIds: ids });
  };

  const handleAvatarUpload = (file: File | undefined) => {
    if (!file) return;
    const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowed.includes(file.type)) return toast.error("Use a JPG, PNG, WEBP, or GIF image");
    if (file.size > 4 * 1024 * 1024) return toast.error("Avatar image must be 4MB or smaller");
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      const base64 = value.includes(",") ? value.split(",")[1] : value;
      uploadAvatar.mutate({ pageId: page.id, base64, mimeType: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif" });
    };
    reader.readAsDataURL(file);
  };

  const copyLink = async () => {
    if (!publicHref) return;
    await navigator.clipboard.writeText(publicHref);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      <SiteNav />
      <main className="container max-w-6xl pt-28 pb-20 px-4">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-8">
          <div><p className="text-red-500 text-xs font-black uppercase tracking-[0.3em] mb-2">Creator tools</p><h1 className="font-['Anton'] text-5xl md:text-7xl uppercase leading-none">Create A <span className="text-red-600">Link</span></h1><p className="text-white/50 mt-3 max-w-xl">Build and publish your all-in-one destination for music, socials, bookings, and drops.</p></div>
          <div className="flex flex-wrap gap-2"><a href={`/link/${page.slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 border border-white/20 hover:border-red-500 px-4 py-2 text-xs uppercase tracking-widest font-bold"><ExternalLink className="w-4 h-4" />View page</a><button onClick={copyLink} className="inline-flex items-center gap-2 border border-white/20 hover:border-red-500 px-4 py-2 text-xs uppercase tracking-widest font-bold">{copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}{copied ? "Copied" : "Copy link"}</button></div>
        </div>

        <div className="grid xl:grid-cols-[1fr_360px] gap-6 items-start">
          <section className="space-y-6 min-w-0">
            <div className="border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3 mb-5"><div><h2 className="font-['Anton'] text-2xl uppercase">Page identity</h2><p className="text-white/40 text-xs mt-1">These details sit at the top of your public page.</p></div><Palette className="w-5 h-5 text-red-500" /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Public username</span><Input defaultValue={page.slug} onBlur={(e) => updatePage.mutate({ pageId: page.id, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })} className="mt-2 bg-white/5 border-white/10 text-white" /></label>
                <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Display name</span><Input defaultValue={page.displayName ?? ""} onBlur={(e) => updatePage.mutate({ pageId: page.id, displayName: e.target.value || null })} className="mt-2 bg-white/5 border-white/10 text-white" /></label>
              </div>
              <label className="block mt-4"><span className="text-[10px] uppercase tracking-widest text-white/50">Bio</span><Textarea defaultValue={page.bio ?? ""} onBlur={(e) => updatePage.mutate({ pageId: page.id, bio: e.target.value || null })} className="mt-2 bg-white/5 border-white/10 text-white min-h-20" /></label>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Avatar image</span><label className="mt-2 flex items-center gap-3 rounded-md border border-dashed border-white/20 bg-white/5 p-2.5 cursor-pointer hover:border-red-500"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(e) => handleAvatarUpload(e.target.files?.[0])} /><span className="w-10 h-10 rounded-full overflow-hidden bg-red-600/70 grid place-items-center text-sm font-black">{page.avatarUrl ? <img src={page.avatarUrl} alt="Current avatar" className="w-full h-full object-cover" /> : (page.displayName ?? "C").charAt(0).toUpperCase()}</span><span className="text-xs text-white/70">{uploadAvatar.isPending ? "Uploading..." : "Choose an image"}</span></label></div>
                <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Theme preset</span><select defaultValue={page.theme} onChange={(e) => { const theme = THEME_OPTIONS.find((option) => option.value === e.target.value); updatePage.mutate({ pageId: page.id, theme: e.target.value, backgroundColor: theme?.background, accentColor: theme?.accent, buttonColor: theme?.accent }); }} className="mt-2 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"><option value="midnight">Midnight</option><option value="ember">Ember</option><option value="ice">Ice</option><option value="violet">Violet</option></select></label>
                <label className="block"><span className="text-[10px] uppercase tracking-widest text-white/50">Button style</span><select defaultValue={page.buttonStyle} onChange={(e) => updatePage.mutate({ pageId: page.id, buttonStyle: e.target.value as "solid" | "outline" | "soft" | "glass" })} className="mt-2 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"><option value="solid">Solid</option><option value="outline">Outline</option><option value="soft">Soft</option><option value="glass">Glass</option></select></label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-white/10"><label className="flex items-center gap-3 text-xs text-white/60"><input type="color" defaultValue={page.backgroundColor} onChange={(e) => updatePage.mutate({ pageId: page.id, backgroundColor: e.target.value })} className="w-10 h-8 rounded border-0 bg-transparent cursor-pointer" /><span>Background<br /><code className="text-[10px] text-white/35">{page.backgroundColor}</code></span></label><label className="flex items-center gap-3 text-xs text-white/60"><input type="color" defaultValue={page.accentColor} onChange={(e) => updatePage.mutate({ pageId: page.id, accentColor: e.target.value })} className="w-10 h-8 rounded border-0 bg-transparent cursor-pointer" /><span>Accent<br /><code className="text-[10px] text-white/35">{page.accentColor}</code></span></label><label className="flex items-center gap-3 text-xs text-white/60"><input type="color" defaultValue={page.textColor} onChange={(e) => updatePage.mutate({ pageId: page.id, textColor: e.target.value })} className="w-10 h-8 rounded border-0 bg-transparent cursor-pointer" /><span>Text<br /><code className="text-[10px] text-white/35">{page.textColor}</code></span></label></div>
              <div className="flex items-center gap-3 mt-4"><label className="flex items-center gap-3 text-xs text-white/60"><input type="color" defaultValue={page.buttonColor} onChange={(e) => updatePage.mutate({ pageId: page.id, buttonColor: e.target.value })} className="w-10 h-8 rounded border-0 bg-transparent cursor-pointer" /><span>Link/button color<br /><code className="text-[10px] text-white/35">{page.buttonColor}</code></span></label></div>
              <div className="flex flex-wrap items-center gap-5 mt-5 pt-5 border-t border-white/10"><label className="inline-flex items-center gap-2 text-xs text-white/60 cursor-pointer"><input type="checkbox" defaultChecked={page.isPublished} onChange={(e) => updatePage.mutate({ pageId: page.id, isPublished: e.target.checked })} className="accent-red-600" /><span>{page.isPublished ? "Published" : "Draft"}</span></label><label className="inline-flex items-center gap-2 text-xs text-white/60 cursor-pointer"><input type="checkbox" defaultChecked={page.showBranding} onChange={(e) => updatePage.mutate({ pageId: page.id, showBranding: e.target.checked })} className="accent-red-600" />Show Murder Mitten branding</label><span className="text-[10px] text-white/30 ml-auto">{selectedTheme.label} theme</span></div>
            </div>

            <div className="border border-white/10 bg-white/[0.03] p-5 md:p-6">
              <div className="flex items-center justify-between mb-5"><div><h2 className="font-['Anton'] text-2xl uppercase">Your links</h2><p className="text-white/40 text-xs mt-1">Drag-ready ordered blocks. Use the arrows to reorder on mobile.</p></div><Link2 className="w-5 h-5 text-red-500" /></div>
              <div className="space-y-3">
                {items.length === 0 && <div className="border border-dashed border-white/15 p-8 text-center text-white/35 text-sm">No links yet. Add your first social or release below.</div>}
                {items.map((item, index) => { const itemDraft = getDraft(item); return (
                  <div key={item.id} className={`border ${item.isVisible ? "border-white/10" : "border-white/5 opacity-55"} bg-black/20 p-4`}>
                    <div className="flex items-start gap-3"><div className="flex flex-col gap-1 pt-1"><button onClick={() => moveItem(index, -1)} disabled={index === 0 || reorder.isPending} className="text-white/30 hover:text-white disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button><button onClick={() => moveItem(index, 1)} disabled={index === items.length - 1 || reorder.isPending} className="text-white/30 hover:text-white disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button></div><div className="flex-1 min-w-0"><div className="grid md:grid-cols-2 gap-3"><Input value={itemDraft.title} onChange={(e) => updateDraft(item.id, { title: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Link title" /><Input value={itemDraft.url} onChange={(e) => updateDraft(item.id, { url: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="https://..." /></div><div className="grid md:grid-cols-2 gap-3 mt-3"><Input value={itemDraft.subtitle} onChange={(e) => updateDraft(item.id, { subtitle: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Optional subtitle" /><Input value={itemDraft.platform} onChange={(e) => updateDraft(item.id, { platform: e.target.value })} className="bg-white/5 border-white/10 text-white" placeholder="Platform label" /></div><div className="flex flex-wrap items-center gap-2 mt-3"><button onClick={() => saveItem(item.id)} disabled={savingItemId === item.id} className="inline-flex items-center gap-1.5 bg-red-600 hover:bg-red-500 px-3 py-1.5 text-[10px] uppercase tracking-widest font-black"><Save className="w-3 h-3" />{savingItemId === item.id ? "Saving" : "Save"}</button><button onClick={() => updateItem.mutate({ pageId: page.id, itemId: item.id, isVisible: !item.isVisible })} className="inline-flex items-center gap-1.5 border border-white/15 hover:border-white/40 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold">{item.isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{item.isVisible ? "Hide" : "Show"}</button><span className="text-[10px] uppercase tracking-widest text-white/25">{item.type}</span></div></div><button onClick={() => deleteItem.mutate({ pageId: page.id, itemId: item.id })} className="text-white/25 hover:text-red-500 p-1" title="Delete link"><Trash2 className="w-4 h-4" /></button></div>
                  </div>
                ); })}
              </div>
            </div>

            <div className="border border-red-600/30 bg-red-950/10 p-5 md:p-6">
              <div className="flex items-center gap-3 mb-5"><Plus className="w-5 h-5 text-red-500" /><div><h2 className="font-['Anton'] text-2xl uppercase">Add a block</h2><p className="text-white/45 text-xs mt-1">Socials, releases, booking links, or a section header.</p></div></div>
              <div className="flex flex-wrap gap-2 mb-5">{SOCIAL_PRESETS.map((preset) => { const Icon = preset.Icon; return <button key={preset.platform} onClick={() => addSocialPreset(preset)} className="inline-flex items-center gap-2 border border-white/15 hover:border-red-500 px-3 py-2 text-xs text-white/70 hover:text-white"><Icon className="w-4 h-4" />{preset.platform}</button>; })}</div>
              <div className="grid md:grid-cols-3 gap-3"><select value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as LinkDraft["type"] })} className="h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"><option value="custom">Custom link</option><option value="social">Social link</option><option value="release">Music release</option><option value="header">Section header</option></select><Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Title" className="bg-white/5 border-white/10 text-white" /><Input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder={draft.type === "header" ? "No URL needed" : "https://..."} disabled={draft.type === "header"} className="bg-white/5 border-white/10 text-white" /></div>
              <div className="grid md:grid-cols-2 gap-3 mt-3"><Input value={draft.subtitle} onChange={(e) => setDraft({ ...draft, subtitle: e.target.value })} placeholder="Optional subtitle" className="bg-white/5 border-white/10 text-white" /><Input value={draft.platform} onChange={(e) => setDraft({ ...draft, platform: e.target.value })} placeholder="Platform label" className="bg-white/5 border-white/10 text-white" /></div>
              {draft.type === "release" && <select value={selectedSongId} onChange={(e) => { const songId = e.target.value; setSelectedSongId(songId); const song = songs.find((entry) => entry.id === Number(songId)); if (song) setDraft({ ...draft, title: song.title, url: song.externalUrl ?? song.fileUrl ?? "", subtitle: song.artistName, platform: song.genre ?? "Release" }); }} className="mt-3 w-full h-10 rounded-md bg-white/5 border border-white/10 px-3 text-sm text-white"><option value="">Select an existing release (optional)</option>{songs.map((song) => <option key={song.id} value={song.id}>{song.title} — {song.artistName}</option>)}</select>}
              <Button onClick={addNewItem} disabled={addItem.isPending} className="mt-4 bg-red-600 hover:bg-red-500 uppercase tracking-widest font-black"><Plus className="w-4 h-4 mr-2" />{addItem.isPending ? "Adding..." : "Add to page"}</Button>
            </div>
          </section>

          <aside className="xl:sticky xl:top-24 min-w-0">
            <div className="border border-white/10 bg-black/60 p-4 md:p-5">
              <div className="flex items-center justify-between mb-4"><div><p className="text-[10px] uppercase tracking-widest text-red-500 font-bold">Live preview</p><h2 className="font-['Anton'] text-2xl uppercase">Your page</h2></div><a href={`/link/${page.slug}`} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white"><ExternalLink className="w-4 h-4" /></a></div>
              <div className="mx-auto max-w-[300px] min-h-[440px] p-5 flex flex-col items-center text-center border border-white/10" style={{ background: `linear-gradient(145deg, ${page.backgroundColor}, #050505)`, color: page.textColor }}>
                {page.avatarUrl ? <img src={page.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover ring-2 ring-white/20" /> : <div className="w-16 h-16 rounded-full bg-red-600/80 grid place-items-center text-2xl font-['Anton']">{(page.displayName ?? user.name ?? "C").charAt(0).toUpperCase()}</div>}
                <h3 className="font-['Anton'] text-xl uppercase mt-4">{page.displayName || user.name || "Creator"}</h3>
                {page.bio && <p className="text-white/55 text-xs mt-2 line-clamp-3">{page.bio}</p>}
                <div className="w-full space-y-2 mt-6">{items.filter((item) => item.isVisible).slice(0, 5).map((item) => <div key={item.id} className={`w-full px-3 py-2.5 text-xs ${page.buttonStyle === "outline" ? "border" : page.buttonStyle === "soft" ? "bg-white/10" : page.buttonStyle === "glass" ? "bg-white/10 backdrop-blur border border-white/15" : ""}`} style={{ backgroundColor: page.buttonStyle === "solid" ? page.buttonColor : undefined, borderColor: page.buttonStyle === "outline" ? page.buttonColor : undefined, color: page.textColor }}>{item.title}</div>)}</div>
                {page.showBranding && <p className="mt-auto pt-8 text-[9px] uppercase tracking-widest text-white/25">Murder Mitten Media</p>}
              </div>
              <p className="text-[11px] text-white/30 mt-4 break-all">{publicHref}</p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
