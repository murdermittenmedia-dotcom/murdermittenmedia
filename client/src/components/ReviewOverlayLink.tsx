import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export function ReviewOverlayLink() {
  const copy = async (layout: "horizontal" | "vertical") => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/broadcast/overlay?layout=${layout}`);
      toast.success(`${layout === "horizontal" ? "Horizontal" : "Vertical"} OBS overlay link copied`);
    } catch {
      toast.error("Could not copy automatically. Open the overlay and copy its address.");
    }
  };
  return <section className="rounded-xl border border-red-500/20 bg-red-500/[0.035] p-4">
    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-red-300">OBS browser sources</p>
    <p className="mt-1 text-xs text-white/60">Two transparent overlays, same live review data.</p>
    <div className="mt-3 space-y-2">
      {(["horizontal", "vertical"] as const).map((layout) => <div key={layout} className="rounded-lg border border-white/10 bg-black/15 p-3">
        <div className="flex items-center justify-between gap-3"><span className="text-xs font-bold capitalize text-white/80">{layout}</span><button type="button" onClick={() => void copy(layout)} className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-red-400/30 px-3 py-2 text-[9px] font-bold uppercase text-red-200"><Copy className="h-3 w-3" /> Copy link</button></div>
        <p className="mt-1 text-[10px] leading-relaxed text-white/40">{layout === "horizontal" ? "Bottom lower third. OBS size: 1920 × 1080." : "Now Playing → Next Up → Previously Queued. OBS size: 480 × 900, or 1920 × 1080 for the right-side stack."}</p>
        <a href={`/broadcast/overlay?layout=${layout}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/55 hover:text-white">Open {layout} overlay <ExternalLink className="h-3 w-3" /></a>
      </div>)}
    </div>
    <p className="mt-2 text-[10px] text-white/40">Both are silent—keep your review audio source separate.</p>
  </section>;
}
