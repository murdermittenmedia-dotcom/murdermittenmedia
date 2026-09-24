import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { SiteNav } from "@/components/SiteNav";
import { toast } from "sonner";
import {
  ChevronRight,
  Download,
  FileCheck2,
  FileText,
  Library,
  Loader2,
  Music2,
  Package,
  ShoppingBag,
  ShieldCheck,
} from "lucide-react";

type OrderFilter = "all" | "beats" | "merch";

const dollars = (amountCents: number) => `$${(amountCents / 100).toFixed(2)}`;

function parseMerchItems(value: string | null | undefined) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function BeatOrderStatus({ sale }: { sale: any }) {
  if (sale.status === "paid") {
    if (sale.masterDeliveryStatus === "producer_required") return <span className="border border-yellow-400/35 bg-yellow-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-yellow-200">Delivery processing</span>;
    return <span className="border border-green-400/35 bg-green-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-green-300">Ready to download</span>;
  }
  if (sale.status === "refunded" || sale.status === "disputed") {
    return <span className="border border-red-400/35 bg-red-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">{sale.status}</span>;
  }
  if (sale.directPayment?.status === "submitted") {
    return <span className="border border-yellow-400/35 bg-yellow-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-yellow-200">Payment verification</span>;
  }
  if (sale.directPayment?.status === "declined") {
    return <span className="border border-red-400/35 bg-red-400/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-red-300">Payment needs attention</span>;
  }
  return <span className="border border-white/15 bg-white/5 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/50">Payment pending</span>;
}

export default function OrderHistory() {
  const [, setLocation] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [filter, setFilter] = useState<OrderFilter>("all");
  const [recentBeatSaleId, setRecentBeatSaleId] = useState<number | null>(null);
  const completedSession = useRef<string | null>(null);
  const sessionId = new URLSearchParams(window.location.search).get("session_id");
  const isBeatCheckoutReturn = new URLSearchParams(window.location.search).get("beat_success") === "true";
  const freeSaleId = Number(new URLSearchParams(window.location.search).get("free_sale"));
  const isFreeLicenseReturn = Number.isInteger(freeSaleId) && freeSaleId > 0;

  const merchOrders = trpc.merch.orders.getMyOrders.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const beatOrders = trpc.beats.myOrders.useQuery(undefined, {
    enabled: !!user,
    refetchOnWindowFocus: false,
  });
  const confirmBeatCheckout = trpc.beats.checkout.confirm.useMutation({
    onSuccess: (result) => {
      if (result.saleId) setRecentBeatSaleId(result.saleId);
      void Promise.all([
        utils.beats.myOrders.invalidate(),
        utils.beats.library.invalidate(),
      ]);
      window.history.replaceState({}, "", "/account/orders?beat_success=true");
    },
    onError: (error) => toast.error(error.message || "Your payment is still being finalized. Refresh this page in a moment."),
  });

  useEffect(() => {
    if (!sessionId || !user || completedSession.current === sessionId || confirmBeatCheckout.isPending) return;
    completedSession.current = sessionId;
    confirmBeatCheckout.mutate({ sessionId });
    // This deliberately runs once when Stripe returns with the checkout session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, user?.id]);

  const downloadBeatDelivery = async (saleId: number, asset: "master" | "contract") => {
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
    } catch (error: any) {
      toast.error(error?.message || "Could not prepare this download.");
    }
  };

  const isLoading = authLoading || (!!user && (merchOrders.isLoading || beatOrders.isLoading));
  const merch = merchOrders.data ?? [];
  const beats = beatOrders.data ?? [];
  const hasOrders = merch.length > 0 || beats.length > 0;

  if (isLoading) {
    return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><div className="grid min-h-screen place-items-center"><Loader2 className="h-8 w-8 animate-spin text-red-500" /></div></div>;
  }

  if (!user) {
    return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><main className="container pt-36 pb-20 text-center"><Library className="mx-auto h-12 w-12 text-red-500" /><h1 className="mt-5 font-['Anton'] text-4xl uppercase">MY ORDERS</h1><p className="mx-auto mt-3 max-w-md text-sm text-white/50">Sign in to see your merch receipts, licensed beats, master files, and agreements.</p><a href={getLoginUrl("/account/orders")} className="mt-6 inline-block bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-500">Sign in</a></main></div>;
  }

  const tabs: Array<{ id: OrderFilter; label: string; count: number }> = [
    { id: "all", label: "All orders", count: merch.length + beats.length },
    { id: "beats", label: "Beat licenses", count: beats.length },
    { id: "merch", label: "Merch", count: merch.length },
  ];

  return <div className="min-h-screen bg-[#080808] text-white"><SiteNav /><main className="container pt-28 pb-20">
    <header className="border-b border-white/10 pb-7">
      <p className="text-[10px] font-black uppercase tracking-[.3em] text-red-500">Account delivery center</p>
      <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div><h1 className="font-['Anton'] text-5xl uppercase">MY ORDERS</h1><p className="mt-2 max-w-2xl text-sm text-white/50">One place for your merchandise orders and every beat license you have purchased.</p></div>
        <a href="/beats" className="inline-flex items-center justify-center gap-2 border border-red-500/50 px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-red-300 transition hover:bg-red-600 hover:text-white"><Music2 className="h-4 w-4" />Browse beats</a>
      </div>
    </header>

    {(isBeatCheckoutReturn || confirmBeatCheckout.isPending || recentBeatSaleId) && <div className="mt-6 border border-green-400/30 bg-green-400/10 p-4">
      <div className="flex items-start gap-3"><FileCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-green-300" /><div><p className="text-sm font-bold text-green-100">{isFreeLicenseReturn ? "Free license ready" : "Beat payment received"}</p><p className="mt-1 text-xs leading-relaxed text-green-100/70">{confirmBeatCheckout.isPending ? "Generating your agreement and preparing protected downloads…" : isFreeLicenseReturn ? "Your master file and full licensing agreement are ready below." : "Your master file and full licensing agreement are ready below."}</p></div></div>
    </div>}

    <div className="mt-7 flex flex-wrap gap-2 border-b border-white/10 pb-4">
      {tabs.map((tab) => <button key={tab.id} type="button" onClick={() => setFilter(tab.id)} className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest transition ${filter === tab.id ? "bg-red-600 text-white" : "border border-white/15 text-white/55 hover:border-white/45 hover:text-white"}`}>{tab.label} <span className="ml-1 text-white/55">{tab.count}</span></button>)}
    </div>

    {!hasOrders ? <section className="mt-10 border border-dashed border-white/15 py-20 text-center"><ShoppingBag className="mx-auto h-11 w-11 text-white/20" /><h2 className="mt-4 font-['Anton'] text-3xl uppercase">No orders yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-white/45">Merch receipts and paid Beat Marketplace licenses will show up here automatically.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><button onClick={() => setLocation("/merch")} className="bg-red-600 px-5 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-500">Shop merch</button><button onClick={() => setLocation("/beats")} className="border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-widest text-white/70 hover:border-white hover:text-white">Browse beats</button></div></section> : <div className="mt-7 space-y-4">
      {(filter === "all" || filter === "beats") && beats.map((sale: any) => <article key={`beat-${sale.id}`} className={`border p-5 ${sale.id === recentBeatSaleId ? "border-green-400/50 bg-green-400/[.055]" : "border-white/10 bg-[#101010]"}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[.2em] text-red-400">Beat license</span><BeatOrderStatus sale={sale} /></div><h2 className="mt-2 truncate font-['Anton'] text-3xl uppercase">{sale.beatTitleSnapshot}</h2><p className="mt-1 text-sm text-white/55">{sale.licenseNameSnapshot} · Produced by {sale.producerNameSnapshot}</p><p className="mt-3 text-xs text-white/35">Order #{sale.id} · {sale.paidAt ? `Purchased ${new Date(sale.paidAt).toLocaleDateString()}` : `Placed ${new Date(sale.createdAt).toLocaleDateString()}`} · {dollars(sale.amountCents)}</p>{sale.status !== "paid" ? <p className="mt-3 max-w-xl text-xs leading-relaxed text-white/45">{sale.directPayment?.status === "submitted" ? "Payment has been marked as sent. Delivery unlocks as soon as the payment is confirmed." : "Delivery unlocks after payment is completed and confirmed."}</p> : sale.masterDeliveryStatus === "producer_required" && <p className="mt-3 max-w-xl text-xs leading-relaxed text-yellow-100/70">Your license is confirmed. Download delivery is being prepared; your agreement is available below.</p>}</div>{sale.status === "paid" && <div className="grid shrink-0 gap-2 sm:grid-cols-2">{sale.masterDeliveryStatus === "ready" && <button type="button" onClick={() => downloadBeatDelivery(sale.id, "master")} className="flex items-center justify-center gap-2 bg-red-600 px-4 py-3 text-xs font-black uppercase tracking-widest hover:bg-red-500"><Download className="h-4 w-4" />Download beat</button>}<button type="button" onClick={() => downloadBeatDelivery(sale.id, "contract")} className="flex items-center justify-center gap-2 border border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/70 hover:border-white hover:text-white"><FileText className="h-4 w-4" />Agreement PDF</button></div>}</div>{sale.status === "paid" && <div className="mt-5 flex items-start gap-3 border-t border-white/10 pt-4 text-xs leading-relaxed text-white/45"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />The agreement is generated from the producer’s selected lease terms at the time of your purchase. Save it with your release files.</div>}</article>)}
      {(filter === "all" || filter === "merch") && merch.map((order: any) => { const items = parseMerchItems(order.items); return <article key={`merch-${order.id}`} className="border border-white/10 bg-[#101010] p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black uppercase tracking-[.2em] text-red-400">Merch order</span><span className={`border px-2.5 py-1 text-[9px] font-black uppercase tracking-widest ${order.status === "completed" ? "border-green-400/35 bg-green-400/10 text-green-300" : order.status === "pending" ? "border-yellow-400/35 bg-yellow-400/10 text-yellow-200" : "border-red-400/35 bg-red-400/10 text-red-300"}`}>{order.status === "completed" ? "Confirmed" : order.status}</span></div><h2 className="mt-2 font-['Anton'] text-3xl uppercase">Order #{order.id}</h2><p className="mt-1 text-sm text-white/55">{items.slice(0, 2).map((item: any) => item.productName).filter(Boolean).join(" · ") || "Murder Mitten merchandise"}{items.length > 2 ? ` + ${items.length - 2} more` : ""}</p><p className="mt-3 text-xs text-white/35">Placed {new Date(order.createdAt).toLocaleDateString()} · {dollars(order.totalCents)}</p></div><button type="button" onClick={() => setLocation(`/account/orders/${order.id}`)} className="inline-flex shrink-0 items-center justify-center gap-2 border border-white/20 px-4 py-3 text-xs font-black uppercase tracking-widest text-white/70 hover:border-white hover:text-white">View order <ChevronRight className="h-4 w-4" /></button></div></article>; })}
      {filter === "beats" && beats.length === 0 && <p className="py-12 text-center text-sm text-white/45">No Beat Marketplace orders yet.</p>}
      {filter === "merch" && merch.length === 0 && <p className="py-12 text-center text-sm text-white/45">No merchandise orders yet.</p>}
    </div>}

    {hasOrders && <div className="mt-8 flex flex-wrap gap-3 border-t border-white/10 pt-7"><a href="/beats/library" className="inline-flex items-center gap-2 border border-white/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-white hover:text-white"><Library className="h-4 w-4" />Beat library</a><button onClick={() => setLocation("/merch")} className="inline-flex items-center gap-2 border border-white/15 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white/60 hover:border-white hover:text-white"><Package className="h-4 w-4" />Shop merch</button></div>}
  </main></div>;
}
