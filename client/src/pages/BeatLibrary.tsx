import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { SiteNav } from "@/components/SiteNav";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { toast } from "sonner";
import { Download, FileCheck2, Library, Loader2, Music2, ReceiptText, ShieldCheck } from "lucide-react";

const dollars = (amount: number) => `$${(amount / 100).toFixed(2)}`;

export default function BeatLibrary() {
  const { user, loading } = useAuth();
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const { data: library = [], isLoading } = trpc.beats.library.useQuery(undefined, { enabled: !!user });
  const confirm = trpc.beats.checkout.confirm.useMutation({ onSuccess: () => utils.beats.library.invalidate(), onError: (error) => toast.error(error.message) });

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (sessionId && user && !confirm.isPending) confirm.mutate({ sessionId });
  // This intentionally runs when the buyer returns from Stripe to start the server-confirmed fulfillment fallback.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const download = async (saleId: number, asset: "master" | "contract") => {
    try {
      const result = await utils.beats.getDelivery.fetch({ saleId, asset });
      const response = await fetch(result.url, { credentials: "omit" });
      if (!response.ok) throw new Error("The delivery file could not be fetched.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = result.filename;
      anchor.style.display = "none";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
    } catch (error: any) { toast.error(error.message || "Could not prepare this download."); }
  };

  if (loading || isLoading) return <div className="min-h-screen bg-[#080808]"><SiteNav /><div className="grid min-h-screen place-items-center"><Loader2 className="h-7 w-7 animate-spin text-red-500" /></div></div>;
  if (!user) return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="container pt-36 text-center"><Library className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-5 font-['Anton'] text-4xl uppercase">Your Beat Library</h1><p className="mt-3 text-sm text-white/50">Sign in to retrieve licensed master files and contracts.</p><a href={getLoginUrl(location)} className="mt-6 inline-block bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest">Sign in</a></div></div>;

  return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><main className="container pt-28 pb-20"><div className="border-b border-white/10 pb-7"><p className="text-[10px] font-black uppercase tracking-[.3em] text-red-500">Buyer dashboard</p><h1 className="mt-2 font-['Anton'] text-5xl uppercase">BEAT LIBRARY</h1><p className="mt-2 text-sm text-white/50">Your paid master files and marketplace license records live here.</p></div>{confirm.isPending && <div className="mt-5 flex items-center gap-3 border border-red-500/30 bg-red-500/10 p-4 text-sm text-white/70"><Loader2 className="h-4 w-4 animate-spin text-red-400" />Finalizing your purchase and generating your contract…</div>}{library.length ? <div className="mt-7 grid gap-4">{library.map((sale) => <article key={sale.id} className="border border-white/10 bg-[#101010] p-5"><div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between"><div><div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-green-400"><FileCheck2 className="h-4 w-4" />Paid & licensed</div><h2 className="mt-2 font-['Anton'] text-3xl uppercase">{sale.beatTitleSnapshot}</h2><p className="mt-1 text-sm text-white/50">{sale.licenseNameSnapshot} · Produced by {sale.producerNameSnapshot}</p><p className="mt-3 text-xs text-white/35">Purchased {sale.paidAt ? new Date(sale.paidAt).toLocaleDateString() : "today"} · {dollars(sale.amountCents)}</p></div><div className="grid gap-2 sm:grid-cols-2"><button onClick={() => download(sale.id, "master")} className="flex items-center justify-center gap-2 bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-500"><Download className="h-4 w-4" />Master file</button><button onClick={() => download(sale.id, "contract")} className="flex items-center justify-center gap-2 border border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/70 hover:border-white hover:text-white"><ReceiptText className="h-4 w-4" />License PDF</button></div></div><div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/45"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />Keep a copy of the PDF with your release files. It records the selected marketplace license and delivery date; obtain tailored legal advice for samples, publishing, split sheets, or custom releases.</div></article>)}</div> : <div className="mt-10 border border-dashed border-white/15 py-20 text-center"><Music2 className="mx-auto h-10 w-10 text-white/20" /><h2 className="mt-4 font-['Anton'] text-3xl uppercase">Your library is ready</h2><p className="mt-2 text-sm text-white/45">When you license a beat, your protected master download and license PDF will appear here.</p><Link href="/beats" className="mt-6 inline-block bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest">Browse the marketplace</Link></div>}</main></div>;
}
