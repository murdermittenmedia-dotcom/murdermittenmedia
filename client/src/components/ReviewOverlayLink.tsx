import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ReviewOverlayLink() {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/broadcast/overlay`);
      toast.success("OBS overlay link copied");
    } catch {
      toast.error("Could not copy automatically. Open the overlay and copy its address.");
    }
  };
  return <section className="rounded-xl border border-red-500/20 bg-red-500/[0.035] p-4">
    <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-300">OBS browser source</p><p className="mt-1 text-xs text-white/60">Transparent review overlay</p></div><button type="button" onClick={() => void copy()} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-400/30 px-3 py-2 text-[9px] font-bold uppercase text-red-200"><Copy className="h-3 w-3" /> Copy link</button></div>
    <p className="mt-2 text-[10px] leading-relaxed text-white/40">Add a Browser Source in OBS, paste this link, and use 1920 × 1080. Shows the current song, votes, next 3, and last played. Silent—keep your review audio source separate.</p>
    <a href="/broadcast/overlay" target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/55 hover:text-white">Open overlay <ExternalLink className="h-3 w-3" /></a>
  </section>;
}
