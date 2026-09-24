import { useMemo, useState } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

type Beat = { id: number; title: string; artworkUrl?: string | null; youtubeUrl?: string | null };
type PriceCode = "basic" | "premium" | "exclusive";

async function base64For(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function BulkBeatEditor({ beats }: { beats: Beat[] }) {
  const imported = useMemo(() => beats.filter((beat) => !!beat.youtubeUrl), [beats]);
  const [selected, setSelected] = useState<number[]>([]);
  const [applyTags, setApplyTags] = useState(false);
  const [tags, setTags] = useState("");
  const [prices, setPrices] = useState<Record<PriceCode, string>>({ basic: "", premium: "", exclusive: "" });
  const [cover, setCover] = useState<File | null>(null);
  const update = trpc.beats.producer.bulkUpdateYouTube.useMutation({
    onSuccess: (result) => {
      toast.success(`${result.updated} imported beat${result.updated === 1 ? "" : "s"} updated.`);
      setSelected([]); setApplyTags(false); setTags(""); setPrices({ basic: "", premium: "", exclusive: "" }); setCover(null);
    },
    onError: (error) => toast.error(error.message || "Could not update those beats."),
  });
  const utils = trpc.useUtils();
  if (!imported.length) return null;
  const allSelected = selected.length === imported.length;
  const toggle = (id: number) => setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const submit = async () => {
    if (!selected.length) return toast.error("Select at least one imported beat.");
    const parsedPrices = Object.fromEntries(Object.entries(prices).filter(([, value]) => value.trim() !== "").map(([code, value]) => [code, Math.round(Number(value) * 100)])) as Partial<Record<PriceCode, number>>;
    if (Object.values(parsedPrices).some((value) => !Number.isFinite(value) || value! < 0)) return toast.error("Enter valid prices.");
    if (!applyTags && !Object.keys(parsedPrices).length && !cover) return toast.error("Choose prices, tags, or cover art to update.");
    const input: Parameters<typeof update.mutateAsync>[0] = { ids: selected };
    if (applyTags) input.tags = tags;
    if (Object.keys(parsedPrices).length) input.prices = parsedPrices;
    if (cover) { input.artworkBase64 = await base64For(cover); input.artworkName = cover.name; input.artworkMimeType = cover.type as "image/jpeg" | "image/png" | "image/webp"; }
    await update.mutateAsync(input);
    await Promise.all([utils.beats.producer.mine.invalidate(), utils.beats.invalidate()]);
  };
  return <section className="border border-yellow-500/30 bg-yellow-500/[.04] p-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-300">Bulk edit imported beats</p><h3 className="mt-1 font-['Anton'] text-2xl uppercase">Update the batch</h3><p className="mt-1 text-xs leading-relaxed text-white/50">Select YouTube-imported listings, then apply new prices, tags, or one cover image to all of them.</p></div><button type="button" onClick={() => setSelected(allSelected ? [] : imported.map((beat) => beat.id))} className="border border-yellow-400/40 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-yellow-200 hover:bg-yellow-400 hover:text-black">{allSelected ? "Clear all" : "Select all"}</button></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{imported.map((beat) => <label key={beat.id} className={`flex cursor-pointer items-center gap-3 border p-3 transition ${selected.includes(beat.id) ? "border-yellow-400 bg-yellow-400/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}><input type="checkbox" checked={selected.includes(beat.id)} onChange={() => toggle(beat.id)} className="h-4 w-4 accent-yellow-400" />{beat.artworkUrl ? <img src={beat.artworkUrl} alt="" className="h-10 w-10 shrink-0 object-cover" /> : <div className="grid h-10 w-10 shrink-0 place-items-center bg-white/10"><ImagePlus className="h-4 w-4 text-white/35" /></div>}<span className="min-w-0 truncate text-xs font-bold text-white">{beat.title}</span></label>)}</div>
    {!!selected.length && <div className="mt-5 grid gap-4 border-t border-white/10 pt-5 lg:grid-cols-[1fr_1fr_1fr_auto]">
      <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">Prices · leave blank to keep</span><div className="space-y-2">{(["basic", "premium", "exclusive"] as PriceCode[]).map((code) => <input key={code} type="number" min="0" step="0.01" value={prices[code]} onChange={(event) => setPrices((current) => ({ ...current, [code]: event.target.value }))} placeholder={`${code} price`} className="w-full border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none focus:border-yellow-400" />)}</div></label>
      <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">Tags</span><label className="mb-2 flex items-center gap-2 text-xs text-white/65"><input type="checkbox" checked={applyTags} onChange={(event) => setApplyTags(event.target.checked)} className="accent-yellow-400" />Replace tags on selected beats</label><textarea value={tags} onChange={(event) => setTags(event.target.value)} disabled={!applyTags} rows={4} placeholder="detroit, drill, piano" className="w-full resize-none border border-white/10 bg-black/30 p-3 text-xs text-white outline-none disabled:opacity-40 focus:border-yellow-400" /></label>
      <label className="block"><span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-white/45">Cover art</span><span className="flex min-h-[104px] cursor-pointer flex-col items-center justify-center border border-dashed border-white/20 bg-black/20 p-3 text-center text-xs text-white/45 hover:border-yellow-400"><ImagePlus className="mb-2 h-5 w-5 text-yellow-300" />{cover ? <span className="max-w-full truncate text-yellow-200">{cover.name}</span> : "Choose one image for the batch"}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setCover(event.target.files?.[0] || null)} /></span></label>
      <button type="button" onClick={() => void submit()} disabled={update.isPending} className="flex h-fit items-center justify-center gap-2 bg-yellow-400 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-black hover:bg-yellow-300 disabled:opacity-50">{update.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Apply to {selected.length}</button>
    </div>}
  </section>;
}
